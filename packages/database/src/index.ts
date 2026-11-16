import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';

/**
 * One connection pool per process. Without limits a database that stops answering would hold
 * every request open forever; with them a request fails after a few seconds and the next one
 * gets a fresh connection. DATABASE_POOL_MAX stays well under the free Postgres' connection cap.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      query_timeout: 60_000,
    }),
  });
}

export { seedReference } from './reference';
