import { Injectable, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { FEATURES, FLAGS, FREE_LIMITS, LOCALE_LABELS, Locale } from '@faith/config';
import type { AiActionClass } from '@faith/database';
import { Prisma } from '@faith/database';
import { aiCapabilities } from '@faith/validators';
import { EntitlementsService } from '../auth/entitlements.service';
import { OrdersService } from '../commerce/orders.service';
import { SellerService } from '../commerce/seller.service';
import { env } from '../core/env';
import { conflict, forbidden, notFound, tooMany } from '../core/errors';
import { logger } from '../core/logger';
import { FlagsService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';

type Capability = (typeof aiCapabilities)[number];
export type AiCompletion = { text: string; model: string };

export interface AiProvider {
  readonly name: string;
  /** False for the demo adapter, whose output is a canned template rather than a model's. */
  readonly live: boolean;
  complete(input: { system: string; prompt: string }): Promise<AiCompletion>;
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly live = true;
  private readonly client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async complete(input: { system: string; prompt: string }): Promise<AiCompletion> {
    const response = await this.client.beta.messages.create({
      model: env.AI_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      // Fallback routing: a safety decline is retried on a suitable model within this call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: input.system,
      messages: [{ role: 'user', content: input.prompt }],
    } as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);

    if (response.stop_reason === 'refusal') throw conflict('AI_REFUSED');
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
    if (!text) throw conflict('AI_EMPTY_RESPONSE');
    return { text, model: response.model };
  }
}

/** Runs with no API key. Output is a visibly labelled template, not an AI result. */
export class DemoProvider implements AiProvider {
  readonly name = 'demo';
  readonly live = false;

  async complete(input: { prompt: string }): Promise<AiCompletion> {
    return {
      model: 'demo-template',
      text: `[DEMO: no AI model is connected]\n\nThis placeholder stands in for a generated draft about:\n"${input.prompt.slice(0, 160)}"\n\nSet ANTHROPIC_API_KEY to generate real content.`,
    };
  }
}

const SYSTEM_BY_CAPABILITY: Record<Capability, string> = {
  product_description: 'You write clear, honest product descriptions for digital goods. Never invent features or claims the seller did not give you.',
  marketing_copy: 'You write concise marketing copy. Avoid unverifiable superlatives and invented statistics.',
  landing_copy: 'You draft landing page copy with a headline, supporting points and a call to action.',
  campaign_suggestions: 'You suggest creator campaign ideas, including the payout model and required advertising disclosure.',
  store_optimization: 'You review a store and suggest specific, prioritised improvements.',
  categorize_product: 'You suggest the best category and tags for a product, and say why in one line.',
  support_draft: 'You draft a courteous customer support reply for a human to review before sending.',
  analytics_explain: 'You explain business metrics in plain language. Never make up numbers that were not provided.',
  workflow_recommendation: 'You recommend simple automations built from triggers, conditions and actions.',
  translate: 'You translate text faithfully and keep the tone and any product names unchanged.',
  business_plan: 'You help draft a pragmatic one-page business plan. State your assumptions.',
};

/** Every capability only reads or drafts. Nothing here can change platform state. */
const CAPABILITY_CLASS: Record<Capability, AiActionClass> = {
  product_description: 'DRAFT', marketing_copy: 'DRAFT', landing_copy: 'DRAFT', campaign_suggestions: 'READ_ONLY',
  store_optimization: 'READ_ONLY', categorize_product: 'READ_ONLY', support_draft: 'DRAFT', analytics_explain: 'READ_ONLY',
  workflow_recommendation: 'READ_ONLY', translate: 'DRAFT', business_plan: 'DRAFT',
};

const PRO_CAPABILITIES = new Set<Capability>(['store_optimization', 'analytics_explain', 'workflow_recommendation', 'business_plan', 'campaign_suggestions']);

type ProposedAction = 'product.publish' | 'product.archive' | 'refund.approve';
const ACTION_CLASS: Record<ProposedAction, AiActionClass> = {
  'product.publish': 'PUBLISHING',
  'product.archive': 'REVERSIBLE',
  'refund.approve': 'FINANCIAL',
};

@Injectable()
export class AiService implements OnModuleInit {
  readonly provider: AiProvider = env.ANTHROPIC_API_KEY ? new AnthropicProvider() : new DemoProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly flags: FlagsService,
    private readonly seller: SellerService,
    private readonly orders: OrdersService,
  ) {}

  onModuleInit() {
    logger.info({ provider: this.provider.name }, 'AI provider selected');
  }

  status() {
    return { provider: this.provider.name, live: this.provider.live, capabilities: aiCapabilities.map((c) => ({ key: c, pro: PRO_CAPABILITIES.has(c) })) };
  }

  private async assertQuota(userId: string) {
    const limit = await this.entitlements.limit(userId, 'limit.aiRequestsPerDay', FREE_LIMITS.aiRequestsPerDay);
    const since = new Date(Date.now() - 86_400_000);
    const used = await this.prisma.db.aiActionLog.count({ where: { userId, createdAt: { gt: since } } });
    if (used >= limit) throw tooMany('AI_DAILY_LIMIT');
  }

  async run(userId: string, input: { capability: Capability; prompt: string; locale: Locale }) {
    if (PRO_CAPABILITIES.has(input.capability) && !(await this.entitlements.has(userId, 'ai.businessTools' satisfies (typeof FEATURES)[number]))) {
      throw forbidden('PLAN_UPGRADE_REQUIRED');
    }
    await this.assertQuota(userId);
    const system = `${SYSTEM_BY_CAPABILITY[input.capability]} Reply in ${LOCALE_LABELS[input.locale]}. You advise a business owner on FAITH; your output is a suggestion that a person reviews.`;
    const actionClass = CAPABILITY_CLASS[input.capability];
    try {
      const out = await this.provider.complete({ system, prompt: input.prompt });
      const log = await this.prisma.db.aiActionLog.create({
        data: {
          userId, capability: input.capability, provider: this.provider.name, model: out.model, actionClass, status: 'COMPLETED',
          input: { prompt: input.prompt, locale: input.locale }, output: { text: out.text },
        },
      });
      return { id: log.id, text: out.text, provider: this.provider.name, live: this.provider.live, actionClass };
    } catch (err) {
      await this.prisma.db.aiActionLog.create({
        data: {
          userId, capability: input.capability, provider: this.provider.name, model: env.AI_MODEL, actionClass, status: 'FAILED',
          input: { prompt: input.prompt }, error: (err as Error).message.slice(0, 500),
        },
      });
      if (err instanceof Anthropic.RateLimitError) throw tooMany('AI_RATE_LIMITED');
      if (err instanceof Anthropic.APIError) {
        logger.error({ status: err.status }, 'AI provider error');
        throw conflict('AI_PROVIDER_ERROR');
      }
      throw err;
    }
  }

  /** The assistant can only propose a consequential action. A person must then confirm it. */
  async propose(userId: string, action: ProposedAction, targetId: string) {
    if (!(await this.flags.enabled(FLAGS.aiAutopilot, userId))) throw forbidden('FEATURE_DISABLED');
    await this.assertQuota(userId);
    return this.prisma.db.aiActionLog.create({
      data: {
        userId, capability: action, provider: this.provider.name, model: 'action', actionClass: ACTION_CLASS[action],
        status: 'AWAITING_CONFIRMATION', input: { action, targetId } as Prisma.InputJsonValue,
      },
      select: { id: true, capability: true, actionClass: true, status: true, input: true, createdAt: true },
    });
  }

  /** Runs through the same services and ownership checks a person's click would. */
  async confirm(id: string, userId: string, accept: boolean) {
    const log = await this.prisma.db.aiActionLog.findUnique({ where: { id } });
    if (!log || log.userId !== userId) throw notFound();
    const claimed = await this.prisma.db.aiActionLog.updateMany({
      where: { id, status: 'AWAITING_CONFIRMATION' },
      data: { status: accept ? 'CONFIRMED' : 'DECLINED', confirmedAt: new Date() },
    });
    if (claimed.count !== 1) throw conflict('ACTION_ALREADY_DECIDED');
    if (!accept) return { status: 'declined' };

    const { action, targetId } = log.input as { action: ProposedAction; targetId: string };
    try {
      if (action === 'product.publish') await this.seller.publish(targetId, userId);
      else if (action === 'product.archive') await this.seller.archive(targetId, userId);
      else await this.orders.decideRefund(targetId, userId, true, 'Approved through AI assistant with confirmation');
    } catch (err) {
      await this.prisma.db.aiActionLog.update({ where: { id }, data: { status: 'FAILED', error: (err as Error).message.slice(0, 500) } });
      throw err;
    }
    return { status: 'executed' };
  }

  history(userId: string) {
    return this.prisma.db.aiActionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, capability: true, provider: true, actionClass: true, status: true, output: true, createdAt: true },
    });
  }
}
