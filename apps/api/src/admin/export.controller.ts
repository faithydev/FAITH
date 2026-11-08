/**
 * Spreadsheet exports for the people who run the platform. Each file is CSV with a UTF-8 byte
 * order mark, so Excel opens Uzbek, Russian, Arabic and Chinese text correctly. Every export is
 * gated by the same permission as the screen it mirrors, and each download is audited.
 */
import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Auth, AuthContext, RequirePermission } from '../auth/context';
import { AuditService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';

const MAX_ROWS = 20_000;

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 19) : String(v);
  // Quote everything that could break a row, and defuse formulas (=, +, -, @) for spreadsheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function csv(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const fractionDigits = (currency: string) => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2; } catch { return 2; }
};
const major = (minor: bigint | string | number | null | undefined, currency: string) => {
  if (minor === null || minor === undefined || minor === '') return '';
  const digits = fractionDigits(currency);
  const n = BigInt(minor);
  const neg = n < 0n; const abs = neg ? -n : n;
  const base = 10n ** BigInt(digits);
  const whole = (abs / base).toString();
  const frac = digits ? '.' + (abs % base).toString().padStart(digits, '0') : '';
  return `${neg ? '-' : ''}${whole}${frac}`;
};

/** Ids that may appear in an event payload, in the order that best names "who did it". */
const ACTOR_KEYS = ['userId', 'buyerId', 'applicantId', 'creatorId', 'ownerId', 'developerId'] as const;

@ApiTags('admin')
@Controller('admin/export')
@RequirePermission('admin.access')
export class ExportController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private send(res: Response, name: string, body: string) {
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="faith-${name}-${stamp}.csv"`);
    res.setHeader('cache-control', 'no-store');
    res.send(body);
  }

  @Get('users.csv') @RequirePermission('admin.users.read')
  async users(@Auth() ctx: AuthContext, @Res() res: Response) {
    const users = await this.prisma.db.user.findMany({
      where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: MAX_ROWS,
      select: {
        email: true, status: true, locale: true, emailVerifiedAt: true, createdAt: true,
        profile: { select: { displayName: true, username: true, country: true } },
        roles: { select: { role: { select: { key: true } } } },
        accounts: { select: { provider: true } },
        sessions: { select: { lastSeenAt: true }, orderBy: { lastSeenAt: 'desc' }, take: 1 },
        _count: { select: { orders: true } },
      },
    });
    const rows = users.map((u) => [
      u.createdAt, u.profile?.displayName, u.email, u.profile?.username, u.roles.map((r) => r.role.key).join(' '),
      u.accounts.length ? u.accounts.map((a) => a.provider).join(' ') : 'email', u.status,
      u.emailVerifiedAt ? 'yes' : 'no', u.locale, u.profile?.country, u.sessions[0]?.lastSeenAt, u._count.orders,
    ]);
    await this.audit.record({ actor: { id: ctx.user.id }, action: 'admin.export', resourceType: 'users', metadata: { rows: rows.length } });
    this.send(res, 'users', csv(['registered', 'name', 'email', 'username', 'roles', 'sign_in', 'status', 'email_verified', 'language', 'country', 'last_seen', 'orders'], rows));
  }

  /** Everything people did: domain events (sign-ups, orders, installs...) and staff actions. */
  @Get('activity.csv') @RequirePermission('admin.audit.read')
  async activity(@Auth() ctx: AuthContext, @Res() res: Response) {
    const [events, audits] = await Promise.all([
      this.prisma.db.outboxEvent.findMany({ orderBy: { createdAt: 'desc' }, take: MAX_ROWS, select: { createdAt: true, type: true, payload: true } }),
      this.prisma.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: MAX_ROWS, select: { createdAt: true, action: true, resourceType: true, resourceId: true, ipAddress: true, actor: { select: { email: true } } } }),
    ]);
    const ids = new Set<string>();
    for (const e of events) {
      const p = e.payload as Record<string, unknown>;
      for (const k of ACTOR_KEYS) if (typeof p[k] === 'string') ids.add(p[k] as string);
    }
    const people = new Map((await this.prisma.db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));
    const rows: unknown[][] = [
      ...events.map((e) => {
        const p = e.payload as Record<string, unknown>;
        const who = ACTOR_KEYS.map((k) => p[k]).find((v): v is string => typeof v === 'string');
        const currency = String(p.currency ?? '');
        const amount = p.totalMinor ?? p.amountMinor;
        const detail = [p.number && `#${p.number}`, p.title, p.name, p.method, p.planKey].filter(Boolean).join(' · ');
        return [e.createdAt, 'event', e.type, (who && people.get(who)) ?? (p.email as string | undefined) ?? '', detail, currency && amount !== undefined ? major(amount as string, currency) : '', currency, ''];
      }),
      ...audits.map((a) => [a.createdAt, 'staff', a.action, a.actor?.email ?? '', [a.resourceType, a.resourceId].filter(Boolean).join(' '), '', '', a.ipAddress]),
    ].sort((x, y) => (y[0] as Date).getTime() - (x[0] as Date).getTime()).slice(0, MAX_ROWS);
    await this.audit.record({ actor: { id: ctx.user.id }, action: 'admin.export', resourceType: 'activity', metadata: { rows: rows.length } });
    this.send(res, 'activity', csv(['time', 'source', 'what', 'who', 'details', 'amount', 'currency', 'ip'], rows));
  }

  @Get('orders.csv') @RequirePermission('admin.finance.read')
  async orders(@Auth() ctx: AuthContext, @Res() res: Response) {
    const orders = await this.prisma.db.order.findMany({
      orderBy: { createdAt: 'desc' }, take: MAX_ROWS,
      select: {
        number: true, status: true, currency: true, subtotalMinor: true, discountMinor: true, taxMinor: true, totalMinor: true,
        affiliateCode: true, paidAt: true, createdAt: true, buyer: { select: { email: true } },
        items: { select: { product: { select: { title: true } } } },
      },
    });
    const rows = orders.map((o) => [
      o.createdAt, o.number, o.buyer.email, o.items.map((i) => i.product.title).join(' + '), o.status,
      major(o.subtotalMinor, o.currency), major(o.discountMinor, o.currency), major(o.taxMinor, o.currency), major(o.totalMinor, o.currency),
      o.currency, o.paidAt, o.affiliateCode,
    ]);
    await this.audit.record({ actor: { id: ctx.user.id }, action: 'admin.export', resourceType: 'orders', metadata: { rows: rows.length } });
    this.send(res, 'orders', csv(['created', 'number', 'buyer', 'items', 'status', 'subtotal', 'discount', 'tax', 'total', 'currency', 'paid_at', 'affiliate'], rows));
  }
}
