import { Injectable } from '@nestjs/common';
import { Prisma } from '@faith/database';
import type { communityBody, courseBody, creatorProfileBody, lessonBody, postBody } from '@faith/validators';
import type { z } from 'zod';
import { uniqueSlug } from '../core/crypto';
import { conflict, forbidden, notFound } from '../core/errors';
import { EventsService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';

const author = { select: { id: true, profile: { select: { displayName: true, username: true } } } } as const;

@Injectable()
export class CreatorService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  // --- Profiles ------------------------------------------------------------

  async publicCreators(q?: string) {
    const where: Prisma.CreatorProfileWhereInput = q ? { headline: { contains: q, mode: 'insensitive' } } : {};
    const rows = await this.prisma.db.creatorProfile.findMany({
      where,
      take: 48,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, status: true, profile: { select: { displayName: true, username: true, bio: true, country: true } } } } },
    });
    return rows.filter((r) => r.user.status === 'ACTIVE' && r.user.profile);
  }

  async publicCreator(username: string) {
    const profile = await this.prisma.db.userProfile.findUnique({
      where: { username },
      include: { user: { select: { id: true, status: true, creatorProfile: true } } },
    });
    if (!profile || profile.user.status !== 'ACTIVE' || !profile.user.creatorProfile) throw notFound('CREATOR_NOT_FOUND');
    const userId = profile.userId;
    const [courses, communities, stores] = await Promise.all([
      this.prisma.db.course.findMany({ where: { creatorId: userId, status: 'PUBLISHED' }, select: { slug: true, title: true, summary: true, level: true } }),
      this.prisma.db.community.findMany({ where: { ownerId: userId, visibility: 'PUBLIC' }, select: { slug: true, name: true, description: true } }),
      this.prisma.db.store.findMany({ where: { ownerId: userId, status: 'ACTIVE' }, select: { slug: true, name: true, tagline: true } }),
    ]);
    return {
      displayName: profile.displayName, username: profile.username, bio: profile.bio, country: profile.country, website: profile.website,
      creator: profile.user.creatorProfile, courses, communities, stores,
    };
  }

  myProfile(userId: string) {
    return this.prisma.db.creatorProfile.findUnique({ where: { userId } });
  }

  saveProfile(userId: string, body: z.infer<typeof creatorProfileBody>) {
    return this.prisma.db.creatorProfile.upsert({ where: { userId }, update: body, create: { ...body, userId } });
  }

  // --- Courses -------------------------------------------------------------

  publicCourses() {
    return this.prisma.db.course.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 48,
      select: {
        slug: true, title: true, summary: true, level: true, language: true,
        creator: author,
        product: { select: { slug: true, priceFromMinor: true, currency: true } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  /** The outline is public. Lesson bodies stay server-side unless the viewer has access. */
  async course(slug: string, userId?: string) {
    const c = await this.prisma.db.course.findUnique({
      where: { slug },
      include: {
        creator: author,
        product: { select: { slug: true, priceFromMinor: true, currency: true, status: true } },
        sections: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' } } } },
      },
    });
    if (!c || (c.status !== 'PUBLISHED' && c.creatorId !== userId)) throw notFound('COURSE_NOT_FOUND');
    const access = userId ? await this.hasAccess(c, userId) : false;
    const enrollment = userId
      ? await this.prisma.db.enrollment.findUnique({
          where: { courseId_userId: { courseId: c.id, userId } },
          include: { progress: { select: { lessonId: true } } },
        })
      : null;
    const done = new Set(enrollment?.progress.map((p) => p.lessonId));
    return {
      ...c,
      access,
      enrolled: !!enrollment,
      completedAt: enrollment?.completedAt ?? null,
      sections: c.sections.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) => {
          const open = access || l.isPreview;
          return { id: l.id, title: l.title, durationSec: l.durationSec, isPreview: l.isPreview, completed: done.has(l.id), locked: !open, body: open ? l.body : null };
        }),
      })),
    };
  }

  /** A refund revokes the entitlement, which ends paid access here too. */
  private async hasAccess(c: { id: string; creatorId: string; productId: string | null }, userId: string) {
    if (c.creatorId === userId) return true;
    if (!c.productId) {
      return !!(await this.prisma.db.enrollment.findUnique({ where: { courseId_userId: { courseId: c.id, userId } } }));
    }
    return !!(await this.prisma.db.digitalEntitlement.findFirst({
      where: { userId, productId: c.productId, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    }));
  }

  private async ownedCourse(id: string, userId: string) {
    const c = await this.prisma.db.course.findUnique({ where: { id } });
    if (!c || c.creatorId !== userId) throw notFound('COURSE_NOT_FOUND');
    return c;
  }

  myCourses(userId: string) {
    return this.prisma.db.course.findMany({
      where: { creatorId: userId },
      orderBy: { updatedAt: 'desc' },
      include: { sections: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, select: { id: true, title: true, isPreview: true } } } }, _count: { select: { enrollments: true } } },
    });
  }

  async createCourse(userId: string, body: z.infer<typeof courseBody>) {
    if (body.productId) {
      const product = await this.prisma.db.product.findUnique({ where: { id: body.productId }, include: { store: true } });
      if (!product || product.store.ownerId !== userId) throw notFound('PRODUCT_NOT_FOUND');
    }
    return this.prisma.db.course.create({ data: { ...body, productId: body.productId ?? null, slug: uniqueSlug(body.title), creatorId: userId } });
  }

  async addSection(courseId: string, userId: string, title: string) {
    await this.ownedCourse(courseId, userId);
    const position = await this.prisma.db.courseSection.count({ where: { courseId } });
    return this.prisma.db.courseSection.create({ data: { courseId, title, position } });
  }

  async addLesson(sectionId: string, userId: string, body: z.infer<typeof lessonBody>) {
    const section = await this.prisma.db.courseSection.findUnique({ where: { id: sectionId } });
    if (!section) throw notFound();
    await this.ownedCourse(section.courseId, userId);
    const position = await this.prisma.db.lesson.count({ where: { sectionId } });
    return this.prisma.db.lesson.create({ data: { ...body, sectionId, position } });
  }

  async setCoursePublished(id: string, userId: string, published: boolean) {
    await this.ownedCourse(id, userId);
    if (published) {
      const lessons = await this.prisma.db.lesson.count({ where: { section: { courseId: id } } });
      if (lessons === 0) throw conflict('COURSE_NEEDS_LESSON');
    }
    return this.prisma.db.course.update({ where: { id }, data: { status: published ? 'PUBLISHED' : 'DRAFT' } });
  }

  async enroll(slug: string, userId: string) {
    const c = await this.prisma.db.course.findUnique({ where: { slug } });
    if (!c || c.status !== 'PUBLISHED') throw notFound('COURSE_NOT_FOUND');
    if (c.productId) throw forbidden('COURSE_REQUIRES_PURCHASE');
    return this.prisma.tx(async (tx) => {
      const e = await tx.enrollment.upsert({
        where: { courseId_userId: { courseId: c.id, userId } },
        update: {},
        create: { courseId: c.id, userId },
      });
      await this.events.emit(tx, 'course.enrolled', { courseId: c.id, userId, title: c.title });
      return e;
    });
  }

  async completeLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.db.lesson.findUnique({ where: { id: lessonId }, include: { section: { include: { course: true } } } });
    if (!lesson) throw notFound('LESSON_NOT_FOUND');
    const course = lesson.section.course;
    if (!(await this.hasAccess(course, userId))) throw forbidden('COURSE_ACCESS_REQUIRED');
    const enrollment = await this.prisma.db.enrollment.findUnique({ where: { courseId_userId: { courseId: course.id, userId } } });
    if (!enrollment) throw forbidden('COURSE_ACCESS_REQUIRED');
    await this.prisma.db.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
      update: {},
      create: { enrollmentId: enrollment.id, lessonId },
    });
    const [total, done] = await Promise.all([
      this.prisma.db.lesson.count({ where: { section: { courseId: course.id } } }),
      this.prisma.db.lessonProgress.count({ where: { enrollmentId: enrollment.id } }),
    ]);
    if (done >= total && !enrollment.completedAt) {
      await this.prisma.db.enrollment.update({ where: { id: enrollment.id }, data: { completedAt: new Date() } });
    }
    return { completed: done, total, courseCompleted: done >= total };
  }

  myEnrollments(userId: string) {
    return this.prisma.db.enrollment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { course: { select: { slug: true, title: true } }, _count: { select: { progress: true } } },
    });
  }

  // --- Communities ---------------------------------------------------------

  publicCommunities() {
    return this.prisma.db.community.findMany({
      orderBy: { createdAt: 'desc' },
      take: 48,
      select: {
        slug: true, name: true, description: true, visibility: true,
        owner: author,
        product: { select: { slug: true, priceFromMinor: true, currency: true } },
        _count: { select: { members: true } },
      },
    });
  }

  private async membership(communityId: string, userId?: string) {
    if (!userId) return null;
    return this.prisma.db.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
  }

  /** Private content is withheld on the server, not hidden by the page. */
  async community(slug: string, userId?: string) {
    const c = await this.prisma.db.community.findUnique({
      where: { slug },
      include: {
        owner: author,
        product: { select: { slug: true, priceFromMinor: true, currency: true } },
        channels: { orderBy: { position: 'asc' } },
        _count: { select: { members: true, posts: true } },
      },
    });
    if (!c) throw notFound('COMMUNITY_NOT_FOUND');
    const member = await this.membership(c.id, userId);
    const canRead = c.visibility === 'PUBLIC' || (member?.status === 'ACTIVE');
    const posts = canRead
      ? await this.prisma.db.post.findMany({
          where: { communityId: c.id, status: 'VISIBLE' },
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            author,
            comments: { where: { status: 'VISIBLE' }, orderBy: { createdAt: 'asc' }, take: 20, include: { author } },
          },
        })
      : [];
    return { ...c, member, canRead, posts };
  }

  myCommunities(userId: string) {
    return this.prisma.db.community.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId, status: 'ACTIVE' } } }] },
      include: { _count: { select: { members: true, posts: true } } },
    });
  }

  async createCommunity(userId: string, body: z.infer<typeof communityBody>) {
    if (body.productId) {
      const product = await this.prisma.db.product.findUnique({ where: { id: body.productId }, include: { store: true } });
      if (!product || product.store.ownerId !== userId) throw notFound('PRODUCT_NOT_FOUND');
    }
    return this.prisma.db.community.create({
      data: {
        ...body, productId: body.productId ?? null, slug: uniqueSlug(body.name), ownerId: userId,
        members: { create: { userId, role: 'OWNER' } },
        channels: { create: { name: 'general' } },
      },
    });
  }

  async join(slug: string, userId: string) {
    const c = await this.prisma.db.community.findUnique({ where: { slug } });
    if (!c) throw notFound('COMMUNITY_NOT_FOUND');
    if (c.visibility === 'PRIVATE') throw forbidden('COMMUNITY_REQUIRES_MEMBERSHIP');
    const existing = await this.membership(c.id, userId);
    if (existing?.status === 'BANNED') throw forbidden('BANNED_FROM_COMMUNITY');
    if (existing) return existing;
    return this.prisma.db.communityMember.create({ data: { communityId: c.id, userId } });
  }

  private async moderator(communityId: string, userId: string) {
    const m = await this.membership(communityId, userId);
    if (!m || m.role === 'MEMBER' || m.status !== 'ACTIVE') throw forbidden('COMMUNITY_MODERATOR_REQUIRED');
    return m;
  }

  async addChannel(communityId: string, userId: string, name: string) {
    await this.moderator(communityId, userId);
    return this.prisma.db.communityChannel.create({ data: { communityId, name } });
  }

  async post(slug: string, userId: string, body: z.infer<typeof postBody>) {
    const c = await this.prisma.db.community.findUnique({ where: { slug } });
    if (!c) throw notFound('COMMUNITY_NOT_FOUND');
    const m = await this.membership(c.id, userId);
    if (m?.status !== 'ACTIVE') throw forbidden('COMMUNITY_MEMBER_REQUIRED');
    return this.prisma.db.post.create({ data: { ...body, channelId: body.channelId ?? null, communityId: c.id, authorId: userId } });
  }

  async comment(postId: string, userId: string, body: string) {
    const post = await this.prisma.db.post.findUnique({ where: { id: postId } });
    if (!post) throw notFound('POST_NOT_FOUND');
    const m = await this.membership(post.communityId, userId);
    if (m?.status !== 'ACTIVE') throw forbidden('COMMUNITY_MEMBER_REQUIRED');
    return this.prisma.db.comment.create({ data: { postId, authorId: userId, body } });
  }

  async hidePost(postId: string, userId: string) {
    const post = await this.prisma.db.post.findUnique({ where: { id: postId } });
    if (!post) throw notFound('POST_NOT_FOUND');
    await this.moderator(post.communityId, userId);
    return this.prisma.db.post.update({ where: { id: postId }, data: { status: 'HIDDEN' } });
  }

  async moderateMember(communityId: string, actorId: string, targetId: string, body: { status?: 'ACTIVE' | 'BANNED'; role?: 'MODERATOR' | 'MEMBER' }) {
    await this.moderator(communityId, actorId);
    const target = await this.membership(communityId, targetId);
    if (!target) throw notFound();
    if (target.role === 'OWNER') throw forbidden('CANNOT_MODERATE_OWNER');
    return this.prisma.db.communityMember.update({ where: { communityId_userId: { communityId, userId: targetId } }, data: body });
  }

  async communityMembers(communityId: string, userId: string) {
    await this.moderator(communityId, userId);
    return this.prisma.db.communityMember.findMany({
      where: { communityId },
      include: { user: author },
      orderBy: { createdAt: 'asc' },
    });
  }

  // --- Dashboard -----------------------------------------------------------

  async overview(userId: string) {
    const [subs, courses, communities, stores] = await Promise.all([
      this.prisma.db.campaignSubmission.groupBy({ by: ['status'], where: { creatorId: userId }, _count: true }),
      this.prisma.db.course.count({ where: { creatorId: userId } }),
      this.prisma.db.community.count({ where: { ownerId: userId } }),
      this.prisma.db.store.count({ where: { ownerId: userId } }),
    ]);
    const enrolled = await this.prisma.db.enrollment.count({ where: { course: { creatorId: userId } } });
    const members = await this.prisma.db.communityMember.count({ where: { community: { ownerId: userId }, status: 'ACTIVE' } });
    return {
      submissions: Object.fromEntries(subs.map((s) => [s.status, s._count])),
      courses, communities, stores, students: enrolled, members,
    };
  }
}
