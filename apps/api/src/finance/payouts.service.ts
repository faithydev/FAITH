import { Injectable } from '@nestjs/common';
import type { payoutBody } from '@faith/validators';
import type { z } from 'zod';
import { badRequest, conflict, notFound } from '../core/errors';
import { AuditService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';
import { Accounts, LedgerService } from './ledger.service';

/**
 * Payout requests. FAITH records the obligation; a licensed partner moves the money. No adapter
 * here sends real funds, so `mark_paid` records a transfer made outside the platform.
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  /** Accounts the caller may withdraw from: their own earnings, stores they own, their apps. */
  private async ownedAccount(userId: string, accountKey: string) {
    const account = await this.prisma.db.ledgerAccount.findUnique({ where: { key: accountKey } });
    if (!account || account.ownerId === null) throw notFound('ACCOUNT_NOT_FOUND');
    if (account.ownerType === 'user' || account.ownerType === 'developer') {
      if (account.ownerId === userId) return account;
    }
    if (account.ownerType === 'store') {
      const store = await this.prisma.db.store.findUnique({ where: { id: account.ownerId } });
      if (store?.ownerId === userId) return account;
    }
    throw notFound('ACCOUNT_NOT_FOUND');
  }

  async overview(userId: string) {
    const stores = await this.prisma.db.store.findMany({ where: { ownerId: userId }, select: { id: true, name: true } });
    const [mine, dev, storeBalances, payouts] = await Promise.all([
      this.ledger.balancesFor('user', [userId]),
      this.ledger.balancesFor('developer', [userId]),
      this.ledger.balancesFor('store', stores.map((s) => s.id)),
      this.prisma.db.payoutRequest.findMany({ where: { requestedById: userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    return { balances: [...mine, ...dev, ...storeBalances], payouts };
  }

  async request(userId: string, body: z.infer<typeof payoutBody>) {
    const amount = BigInt(body.amountMinor);
    const idempotencyKey = `payout:${userId}:${body.idempotencyKey}`;
    const prior = await this.prisma.db.payoutRequest.findUnique({ where: { idempotencyKey } });
    if (prior) return prior;
    const account = await this.ownedAccount(userId, body.accountKey);

    return this.prisma.tx(async (tx) => {
      // Serialises concurrent requests on one account, so a balance cannot be spent twice.
      await tx.$queryRaw`SELECT "id" FROM "LedgerAccount" WHERE "id" = ${account.id} FOR UPDATE`;
      const available = await this.ledger.balance(account.key, tx);
      if (amount > available) throw badRequest('INSUFFICIENT_BALANCE', { availableMinor: available });

      const payout = await tx.payoutRequest.create({
        data: {
          accountKey: account.key, ownerType: account.ownerType, ownerId: account.ownerId!, requestedById: userId,
          amountMinor: amount, currency: account.currency, idempotencyKey,
        },
      });
      await this.ledger.post(tx, {
        idempotencyKey: `payout:${payout.id}:requested`, kind: 'payout_requested', currency: account.currency,
        refType: 'PayoutRequest', refId: payout.id,
        debit: [{ account: { key: account.key, type: account.type, ownerType: account.ownerType, ownerId: account.ownerId! }, amountMinor: amount }],
        credit: [{ account: Accounts.payoutsInTransit(account.currency), amountMinor: amount }],
      });
      return payout;
    });
  }

  list(status?: string) {
    return this.prisma.db.payoutRequest.findMany({
      where: status ? { status: status as 'REQUESTED' } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async decide(id: string, actorId: string, decision: 'approve' | 'reject' | 'mark_paid', note?: string) {
    return this.prisma.tx(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PayoutRequest" WHERE "id" = ${id} FOR UPDATE`;
      const p = await tx.payoutRequest.findUnique({ where: { id } });
      if (!p) throw notFound('PAYOUT_NOT_FOUND');
      const c = p.currency;
      const owner = await tx.ledgerAccount.findUniqueOrThrow({ where: { key: p.accountKey } });

      if (decision === 'approve') {
        if (p.status !== 'REQUESTED') throw conflict('PAYOUT_ALREADY_DECIDED');
        await tx.payoutRequest.update({ where: { id }, data: { status: 'APPROVED', decidedById: actorId, decidedAt: new Date(), decisionNote: note } });
      } else if (decision === 'reject') {
        if (!['REQUESTED', 'APPROVED'].includes(p.status)) throw conflict('PAYOUT_ALREADY_DECIDED');
        await tx.payoutRequest.update({ where: { id }, data: { status: 'REJECTED', decidedById: actorId, decidedAt: new Date(), decisionNote: note } });
        await this.ledger.post(tx, {
          idempotencyKey: `payout:${id}:rejected`, kind: 'payout_reversed', currency: c, refType: 'PayoutRequest', refId: id,
          debit: [{ account: Accounts.payoutsInTransit(c), amountMinor: p.amountMinor }],
          credit: [{ account: { key: owner.key, type: owner.type, ownerType: owner.ownerType, ownerId: owner.ownerId! }, amountMinor: p.amountMinor }],
        });
      } else {
        if (p.status !== 'APPROVED') throw conflict('PAYOUT_NOT_APPROVED');
        await tx.payoutRequest.update({ where: { id }, data: { status: 'PAID', paidAt: new Date(), decisionNote: note } });
        await this.ledger.post(tx, {
          idempotencyKey: `payout:${id}:paid`, kind: 'payout_paid', currency: c, refType: 'PayoutRequest', refId: id,
          debit: [{ account: Accounts.payoutsInTransit(c), amountMinor: p.amountMinor }],
          credit: [{ account: Accounts.clearing(c), amountMinor: p.amountMinor }],
        });
      }
      await this.audit.record({ actor: { id: actorId }, action: `payout.${decision}`, resourceType: 'PayoutRequest', resourceId: id, metadata: { amountMinor: p.amountMinor.toString() } }, tx);
      return tx.payoutRequest.findUniqueOrThrow({ where: { id } });
    });
  }
}
