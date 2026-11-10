/**
 * Reference data only: roles and permissions, plans, categories and the built-in automations.
 * Safe to run on every start of a live platform; it never creates accounts or sample content.
 */
import { SYSTEM_RULES } from '@faith/automation';
import { createPrismaClient, seedReference } from '@faith/database';
import { env } from './core/env';

async function main() {
  const db = createPrismaClient(env.DATABASE_URL);
  await seedReference(db);
  for (const rule of SYSTEM_RULES) {
    await db.automationRule.upsert({
      where: { key: rule.key },
      update: { name: rule.name, trigger: rule.trigger, actions: rule.actions },
      create: { key: rule.key, name: rule.name, trigger: rule.trigger, actions: rule.actions },
    });
  }
  await db.$disconnect();
  console.log('Reference data is in place.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
