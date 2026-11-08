import { Injectable } from '@nestjs/common';
import type { Feature } from '@faith/config';
import { PrismaService, Tx } from '../core/prisma.service';

/** Feature access comes from the active plan, computed fresh, never from a client claim. */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async activePlan(userId: string, tx?: Tx) {
    const db = tx ?? this.prisma.db;
    const sub = await db.subscription.findFirst({
      where: { userId, status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
      orderBy: { currentPeriodEnd: 'desc' },
      include: { plan: { include: { features: true } } },
    });
    if (sub) return { plan: sub.plan, subscription: sub };
    const free = await db.subscriptionPlan.findUnique({ where: { key: 'free' }, include: { features: true } });
    return { plan: free, subscription: null };
  }

  async features(userId: string): Promise<Map<string, number | null>> {
    const { plan } = await this.activePlan(userId);
    return new Map(plan?.features.map((f) => [f.featureKey, f.limit]) ?? []);
  }

  async has(userId: string, feature: Feature): Promise<boolean> {
    return (await this.features(userId)).has(feature);
  }

  /** Numeric limit such as `limit.products`, or the fallback if the plan does not set one. */
  async limit(userId: string, key: string, fallback: number): Promise<number> {
    return (await this.features(userId)).get(key) ?? fallback;
  }
}
