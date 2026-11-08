import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, Prisma, PrismaClient } from '@faith/database';
import { env } from './env';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly db: PrismaClient = createPrismaClient(env.DATABASE_URL);

  async onModuleDestroy() {
    await this.db.$disconnect();
  }

  /** Runs `fn` atomically. Money paths use this so a partial write can never commit. */
  tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn, { maxWait: 10_000, timeout: 20_000 });
  }
}
