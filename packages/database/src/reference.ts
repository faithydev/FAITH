import {
  FEATURES, FLAGS, FREE_LIMITS, PERMISSIONS, PRO_LIMITS, ROLE_KEYS, ROLE_PERMISSIONS, STAFF_ROLES,
} from '@faith/config';
import type { PrismaClient } from './generated/prisma/client';

type Names = { uz: string; ru: string; en: string; tr: string; kk: string; ar: string; zh: string; es: string };

const CATEGORIES: { slug: string; names: Names }[] = [
  { slug: 'design', names: { uz: 'Dizayn', ru: 'Дизайн', en: 'Design', tr: 'Tasarım', kk: 'Дизайн', ar: 'التصميم', zh: '设计', es: 'Diseño' } },
  { slug: 'development', names: { uz: 'Dasturlash', ru: 'Разработка', en: 'Development', tr: 'Yazılım', kk: 'Әзірлеу', ar: 'البرمجة', zh: '开发', es: 'Desarrollo' } },
  { slug: 'education', names: { uz: 'Taʼlim', ru: 'Обучение', en: 'Education', tr: 'Eğitim', kk: 'Білім', ar: 'التعليم', zh: '教育', es: 'Educación' } },
  { slug: 'marketing', names: { uz: 'Marketing', ru: 'Маркетинг', en: 'Marketing', tr: 'Pazarlama', kk: 'Маркетинг', ar: 'التسويق', zh: '营销', es: 'Marketing' } },
  { slug: 'business', names: { uz: 'Biznes', ru: 'Бизнес', en: 'Business', tr: 'İş', kk: 'Бизнес', ar: 'الأعمال', zh: '商业', es: 'Negocios' } },
  { slug: 'media', names: { uz: 'Media', ru: 'Медиа', en: 'Media', tr: 'Medya', kk: 'Медиа', ar: 'الوسائط', zh: '媒体', es: 'Medios' } },
  { slug: 'software', names: { uz: 'Dasturiy taʼminot', ru: 'Программы', en: 'Software', tr: 'Yazılımlar', kk: 'Бағдарламалар', ar: 'البرامج', zh: '软件', es: 'Software' } },
  { slug: 'community', names: { uz: 'Hamjamiyat', ru: 'Сообщества', en: 'Community', tr: 'Topluluk', kk: 'Қауымдастық', ar: 'المجتمع', zh: '社区', es: 'Comunidad' } },
];

const FLAG_ROWS: { key: string; description: string; enabled?: boolean; rolloutPct?: number }[] = [
  { key: FLAGS.liveStreaming, description: 'Live streaming in Creator Studio. Off until broadcast infrastructure exists.' },
  { key: FLAGS.videoTranscoding, description: 'Server-side video transcoding. Off until a media pipeline exists.' },
  { key: FLAGS.physicalProducts, description: 'Physical goods. Off until shipping and logistics are real.' },
  { key: FLAGS.aiAutopilot, description: 'Lets the AI assistant propose actions for explicit confirmation.', enabled: true, rolloutPct: 100 },
  { key: FLAGS.futureLab, description: 'Future Lab experiments.', enabled: true, rolloutPct: 100 },
];

/**
 * Everything the platform needs to run, in every environment: permissions, roles, plans,
 * categories and flags. Safe to run repeatedly. It never invents a Pro price: prices stay null
 * until an administrator sets them.
 */
export async function seedReference(db: PrismaClient): Promise<void> {
  for (const key of PERMISSIONS) await db.permission.upsert({ where: { key }, update: {}, create: { key } });
  const permissions = new Map((await db.permission.findMany()).map((p) => [p.key, p.id]));

  for (const key of ROLE_KEYS) {
    const role = await db.role.upsert({
      where: { key },
      update: { isStaff: STAFF_ROLES.includes(key) },
      create: { key, isStaff: STAFF_ROLES.includes(key) },
    });
    for (const p of ROLE_PERMISSIONS[key]) {
      const permissionId = permissions.get(p)!;
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  const free = await db.subscriptionPlan.upsert({ where: { key: 'free' }, update: {}, create: { key: 'free', name: 'Free' } });
  // Pro costs $11.99 a month (decided by the business). Set only where no price exists yet, so a
  // price changed later in Admin → Settings is never overwritten by a reseed.
  const pro = await db.subscriptionPlan.upsert({ where: { key: 'pro' }, update: {}, create: { key: 'pro', name: 'Pro', monthlyMinor: 1199n, currency: 'USD' } });
  await db.subscriptionPlan.updateMany({ where: { key: 'pro', monthlyMinor: null }, data: { monthlyMinor: 1199n, currency: 'USD' } });

  const limit = async (planId: string, limits: Record<string, number>) => {
    for (const [name, value] of Object.entries(limits)) {
      const featureKey = `limit.${name}`;
      await db.featureEntitlement.upsert({
        where: { planId_featureKey: { planId, featureKey } },
        update: { limit: value },
        create: { planId, featureKey, limit: value },
      });
    }
  };
  await limit(free.id, FREE_LIMITS);
  await limit(pro.id, PRO_LIMITS);
  for (const featureKey of FEATURES) {
    await db.featureEntitlement.upsert({
      where: { planId_featureKey: { planId: pro.id, featureKey } },
      update: {},
      create: { planId: pro.id, featureKey },
    });
  }

  for (const [position, c] of CATEGORIES.entries()) {
    await db.productCategory.upsert({
      where: { slug: c.slug },
      update: { names: c.names, position },
      create: { slug: c.slug, names: c.names, position },
    });
  }

  for (const f of FLAG_ROWS) {
    await db.featureFlag.upsert({
      where: { key: f.key },
      update: { description: f.description },
      create: { key: f.key, description: f.description, enabled: f.enabled ?? false, rolloutPct: f.rolloutPct ?? 0 },
    });
  }
}
