import { Injectable } from '@nestjs/common';
import { DEFAULT_COMMISSION_BPS, SETTING_KEYS } from '@faith/config';
import { Prisma } from '@faith/database';
import { createHash } from 'node:crypto';
import { PrismaService, Tx } from './prisma.service';

type Actor = { id: string } | null | undefined;
type AuditInput = {
  actor?: Actor;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditInput, tx?: Tx) {
    return (tx ?? this.prisma.db).auditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        ipAddress: input.ip,
      },
    });
  }

  security(kind: string, data: { userId?: string; ip?: string; metadata?: Record<string, unknown> }) {
    return this.prisma.db.securityEvent.create({
      data: { kind, userId: data.userId, ipAddress: data.ip, metadata: (data.metadata ?? {}) as Prisma.InputJsonValue },
    });
  }
}

/** Writes domain events into the outbox inside the caller's transaction. */
@Injectable()
export class EventsService {
  emit(tx: Tx, type: string, payload: Record<string, unknown>) {
    return tx.outboxEvent.create({ data: { type, payload: payload as Prisma.InputJsonValue } });
  }
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, fallback: T, tx?: Tx): Promise<T> {
    const row = await (tx ?? this.prisma.db).platformSetting.findUnique({ where: { key } });
    return row ? (row.value as T) : fallback;
  }

  async set(key: string, value: unknown, actorId: string) {
    return this.prisma.db.platformSetting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue, updatedById: actorId },
      create: { key, value: value as Prisma.InputJsonValue, updatedById: actorId },
    });
  }

  commissionBps(tx?: Tx) {
    return this.get<number>(SETTING_KEYS.commissionBps, DEFAULT_COMMISSION_BPS, tx);
  }
}

/** Stable percentage bucket, so a person stays on the same side of a rollout. */
export function rolloutBucket(flagKey: string, userId: string): number {
  return createHash('sha256').update(`${flagKey}:${userId}`).digest().readUInt32BE(0) % 100;
}

@Injectable()
export class FlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async enabled(key: string, userId?: string): Promise<boolean> {
    const flag = await this.prisma.db.featureFlag.findUnique({ where: { key } });
    if (!flag) return false;
    if (userId && flag.allowUsers.includes(userId)) return true;
    if (!flag.enabled) return false;
    if (flag.rolloutPct >= 100) return true;
    return !!userId && rolloutBucket(key, userId) < flag.rolloutPct;
  }

  /** Flags a client may see. Allow-lists stay on the server. */
  async publicState(userId?: string) {
    const flags = await this.prisma.db.featureFlag.findMany({ select: { key: true } });
    const entries = await Promise.all(flags.map(async (f) => [f.key, await this.enabled(f.key, userId)] as const));
    return Object.fromEntries(entries);
  }
}
