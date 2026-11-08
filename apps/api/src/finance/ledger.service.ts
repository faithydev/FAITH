import { Injectable } from '@nestjs/common';
import type { LedgerAccountType } from '@faith/database';
import { PrismaService, Tx } from '../core/prisma.service';

export type AccountRef = { key: string; type: LedgerAccountType; ownerType: string; ownerId?: string };

/** The chart of accounts. Keys embed the currency so balances can never mix currencies. */
export const Accounts = {
  clearing: (c: string): AccountRef => ({ key: `platform:clearing:${c}`, type: 'ASSET', ownerType: 'platform' }),
  commission: (c: string): AccountRef => ({ key: `platform:commission:${c}`, type: 'REVENUE', ownerType: 'platform' }),
  subscriptions: (c: string): AccountRef => ({ key: `platform:subscriptions:${c}`, type: 'REVENUE', ownerType: 'platform' }),
  advertising: (c: string): AccountRef => ({ key: `platform:advertising:${c}`, type: 'REVENUE', ownerType: 'platform' }),
  appCommission: (c: string): AccountRef => ({ key: `platform:app_commission:${c}`, type: 'REVENUE', ownerType: 'platform' }),
  payoutsInTransit: (c: string): AccountRef => ({ key: `platform:payouts_in_transit:${c}`, type: 'LIABILITY', ownerType: 'platform' }),
  storePayable: (id: string, c: string): AccountRef => ({ key: `store:${id}:payable:${c}`, type: 'LIABILITY', ownerType: 'store', ownerId: id }),
  userEarnings: (id: string, c: string): AccountRef => ({ key: `user:${id}:earnings:${c}`, type: 'LIABILITY', ownerType: 'user', ownerId: id }),
  developerPayable: (id: string, c: string): AccountRef => ({ key: `developer:${id}:payable:${c}`, type: 'LIABILITY', ownerType: 'developer', ownerId: id }),
  campaignBudget: (id: string, c: string): AccountRef => ({ key: `campaign:${id}:budget:${c}`, type: 'LIABILITY', ownerType: 'campaign', ownerId: id }),
};

export type Leg = { account: AccountRef; amountMinor: bigint };

export type PostInput = {
  idempotencyKey: string;
  kind: string;
  currency: string;
  memo?: string;
  refType?: string;
  refId?: string;
  debit: Leg[];
  credit: Leg[];
};

/**
 * Double-entry ledger. Records what FAITH owes and is owed; it is not a wallet, and funds sit
 * with licensed payment partners. The database independently rejects unbalanced transactions
 * and any edit to a posted entry.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async post(tx: Tx, input: PostInput) {
    const seen = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (seen) return seen;

    const debit = input.debit.filter((l) => l.amountMinor !== 0n);
    const credit = input.credit.filter((l) => l.amountMinor !== 0n);
    const sum = (legs: Leg[]) => legs.reduce((a, l) => a + l.amountMinor, 0n);
    for (const l of [...debit, ...credit]) {
      if (l.amountMinor < 0n) throw new Error(`negative ledger leg on ${l.account.key}`);
    }
    if (sum(debit) !== sum(credit)) {
      throw new Error(`unbalanced ledger post ${input.kind}: ${sum(debit)} != ${sum(credit)}`);
    }
    if (debit.length === 0) return null;

    const transaction = await tx.ledgerTransaction.create({
      data: {
        idempotencyKey: input.idempotencyKey, kind: input.kind, currency: input.currency,
        memo: input.memo, refType: input.refType, refId: input.refId,
      },
    });
    const entries = async (legs: Leg[], direction: 'DEBIT' | 'CREDIT') => {
      for (const leg of legs) {
        const account = await tx.ledgerAccount.upsert({
          where: { key: leg.account.key },
          update: {},
          create: { ...leg.account, currency: input.currency },
        });
        await tx.ledgerEntry.create({
          data: { transactionId: transaction.id, accountId: account.id, direction, amountMinor: leg.amountMinor },
        });
      }
    };
    await entries(debit, 'DEBIT');
    await entries(credit, 'CREDIT');
    return transaction;
  }

  /** Signed balance in the account's natural direction. */
  async balance(key: string, tx?: Tx): Promise<bigint> {
    const db = tx ?? this.prisma.db;
    const account = await db.ledgerAccount.findUnique({ where: { key } });
    if (!account) return 0n;
    return this.balanceOf(account.id, account.type, tx);
  }

  private async balanceOf(accountId: string, type: LedgerAccountType, tx?: Tx): Promise<bigint> {
    const groups = await (tx ?? this.prisma.db).ledgerEntry.groupBy({
      by: ['direction'],
      where: { accountId },
      _sum: { amountMinor: true },
    });
    const of = (d: string) => groups.find((g) => g.direction === d)?._sum.amountMinor ?? 0n;
    const debitNormal = type === 'ASSET' || type === 'EXPENSE';
    return debitNormal ? of('DEBIT') - of('CREDIT') : of('CREDIT') - of('DEBIT');
  }

  /** All balances a user or store holds, for earnings pages and payouts. */
  async balancesFor(ownerType: string, ownerIds: string[]) {
    if (ownerIds.length === 0) return [];
    const accounts = await this.prisma.db.ledgerAccount.findMany({ where: { ownerType, ownerId: { in: ownerIds } } });
    return Promise.all(accounts.map(async (a) => ({
      key: a.key, ownerId: a.ownerId, currency: a.currency, balanceMinor: await this.balanceOf(a.id, a.type),
    })));
  }

  /** Trial balance per currency. Debits equal credits, or something is badly wrong. */
  async trialBalance() {
    const rows = await this.prisma.db.$queryRaw<{ currency: string; debit: bigint; credit: bigint }[]>`
      SELECT a."currency",
             COALESCE(SUM(e."amountMinor") FILTER (WHERE e."direction" = 'DEBIT'), 0)::bigint AS debit,
             COALESCE(SUM(e."amountMinor") FILTER (WHERE e."direction" = 'CREDIT'), 0)::bigint AS credit
      FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
      GROUP BY a."currency" ORDER BY a."currency"`;
    return rows.map((r) => ({ ...r, balanced: r.debit === r.credit }));
  }
}
