import { Injectable } from '@nestjs/common';
import { Prisma } from '@faith/database';
import type {
  candidateProfileBody, freelancerProfileBody, jobBody, jobQuery, milestoneBody, portfolioBody, serviceBody,
} from '@faith/validators';
import type { z } from 'zod';
import { uniqueSlug } from '../core/crypto';
import { badRequest, conflict, forbidden, notFound } from '../core/errors';
import { EventsService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';
import { paged, skipTake } from '../core/zod';
import { IdentityService } from '../identity/identity.service';

const personSelect = { id: true, profile: { select: { displayName: true, username: true, country: true } } } as const;

@Injectable()
export class WorkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly events: EventsService,
  ) {}

  // --- Jobs ----------------------------------------------------------------

  async jobs(q: z.infer<typeof jobQuery>) {
    const where: Prisma.JobWhereInput = {
      status: 'OPEN',
      ...(q.workplace ? { workplace: q.workplace } : {}),
      ...(q.employmentType ? { employmentType: q.employmentType } : {}),
      ...(q.experience ? { experience: q.experience } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { skills: { has: q.q.toLowerCase() } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.job.findMany({
        where, orderBy: { publishedAt: 'desc' }, ...skipTake(q),
        select: {
          id: true, slug: true, title: true, employmentType: true, workplace: true, experience: true, location: true, country: true,
          currency: true, salaryMinMinor: true, salaryMaxMinor: true, skills: true, publishedAt: true,
          org: { select: { name: true, slug: true, verifiedAt: true } },
        },
      }),
      this.prisma.db.job.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async job(slug: string, userId?: string) {
    const job = await this.prisma.db.job.findUnique({ where: { slug }, include: { org: { select: { name: true, slug: true, about: true, website: true, verifiedAt: true } } } });
    if (!job || job.status !== 'OPEN') throw notFound('JOB_NOT_FOUND');
    const [application, saved] = userId
      ? await Promise.all([
          this.prisma.db.jobApplication.findUnique({ where: { jobId_applicantId: { jobId: job.id, applicantId: userId } } }),
          this.prisma.db.savedJob.findUnique({ where: { userId_jobId: { userId, jobId: job.id } } }),
        ])
      : [null, null];
    return { ...job, application, saved: !!saved };
  }

  async postJob(userId: string, body: z.infer<typeof jobBody>) {
    await this.identity.assertOrgRole(body.orgId, userId, ['OWNER', 'ADMIN', 'MANAGER']);
    const { salaryMinMinor, salaryMaxMinor, ...rest } = body;
    if (salaryMinMinor && salaryMaxMinor && BigInt(salaryMinMinor) > BigInt(salaryMaxMinor)) throw badRequest('INVALID_SALARY_RANGE');
    return this.prisma.db.job.create({
      data: {
        ...rest,
        slug: uniqueSlug(body.title),
        postedById: userId,
        status: 'PENDING_REVIEW',
        skills: body.skills.map((s) => s.toLowerCase()),
        salaryMinMinor: salaryMinMinor ? BigInt(salaryMinMinor) : null,
        salaryMaxMinor: salaryMaxMinor ? BigInt(salaryMaxMinor) : null,
      },
    });
  }

  private async ownedJob(id: string, userId: string) {
    const job = await this.prisma.db.job.findUnique({ where: { id } });
    if (!job) throw notFound('JOB_NOT_FOUND');
    const m = await this.prisma.db.organizationMember.findUnique({ where: { orgId_userId: { orgId: job.orgId, userId } } });
    if (!m || m.role === 'MEMBER') throw notFound('JOB_NOT_FOUND');
    return job;
  }

  async employerJobs(userId: string) {
    const orgs = await this.prisma.db.organizationMember.findMany({ where: { userId, role: { not: 'MEMBER' } }, select: { orgId: true } });
    return this.prisma.db.job.findMany({
      where: { orgId: { in: orgs.map((o) => o.orgId) } },
      orderBy: { createdAt: 'desc' },
      include: { org: { select: { name: true } }, _count: { select: { applications: true } } },
    });
  }

  async closeJob(id: string, userId: string) {
    await this.ownedJob(id, userId);
    return this.prisma.db.job.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  async apply(slug: string, userId: string, coverLetter: string) {
    const job = await this.prisma.db.job.findUnique({ where: { slug } });
    if (!job || job.status !== 'OPEN') throw notFound('JOB_NOT_FOUND');
    const member = await this.prisma.db.organizationMember.findUnique({ where: { orgId_userId: { orgId: job.orgId, userId } } });
    if (member) throw forbidden('CANNOT_APPLY_TO_OWN_JOB');
    return this.prisma.tx(async (tx) => {
      const application = await tx.jobApplication.create({ data: { jobId: job.id, applicantId: userId, coverLetter } });
      await this.events.emit(tx, 'job.application.submitted', { applicationId: application.id, jobId: job.id, title: job.title, employerId: job.postedById, applicantId: userId });
      return application;
    });
  }

  async withdraw(id: string, userId: string) {
    const { count } = await this.prisma.db.jobApplication.updateMany({
      where: { id, applicantId: userId, status: { notIn: ['HIRED', 'REJECTED', 'WITHDRAWN'] } },
      data: { status: 'WITHDRAWN' },
    });
    if (count === 0) throw notFound('APPLICATION_NOT_FOUND');
    return { status: 'withdrawn' };
  }

  myApplications(userId: string) {
    return this.prisma.db.jobApplication.findMany({
      where: { applicantId: userId },
      orderBy: { createdAt: 'desc' },
      include: { job: { select: { slug: true, title: true, org: { select: { name: true } } } } },
    });
  }

  async jobApplications(jobId: string, userId: string) {
    await this.ownedJob(jobId, userId);
    return this.prisma.db.jobApplication.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      include: { applicant: { select: { ...personSelect, candidateProfile: { select: { headline: true, skills: true, languages: true } } } } },
    });
  }

  async setApplicationStatus(id: string, userId: string, status: 'REVIEWING' | 'SHORTLISTED' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED') {
    const app = await this.prisma.db.jobApplication.findUnique({ where: { id } });
    if (!app) throw notFound('APPLICATION_NOT_FOUND');
    await this.ownedJob(app.jobId, userId);
    return this.prisma.db.jobApplication.update({ where: { id }, data: { status } });
  }

  async setSaved(jobId: string, userId: string, saved: boolean) {
    if (saved) await this.prisma.db.savedJob.upsert({ where: { userId_jobId: { userId, jobId } }, update: {}, create: { userId, jobId } });
    else await this.prisma.db.savedJob.deleteMany({ where: { userId, jobId } });
    return { saved };
  }

  async savedJobs(userId: string) {
    const rows = await this.prisma.db.savedJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { job: { select: { slug: true, title: true, status: true, workplace: true, org: { select: { name: true } } } } },
    });
    return rows.map((r) => r.job);
  }

  candidate(userId: string) {
    return this.prisma.db.candidateProfile.findUnique({ where: { userId } });
  }

  saveCandidate(userId: string, body: z.infer<typeof candidateProfileBody>) {
    const data = { ...body, skills: body.skills.map((s) => s.toLowerCase()) };
    return this.prisma.db.candidateProfile.upsert({ where: { userId }, update: data, create: { ...data, userId } });
  }

  /** Candidate discovery only ever shows people who opted in. */
  discoverCandidates(skill?: string) {
    return this.prisma.db.candidateProfile.findMany({
      where: { discoverable: true, ...(skill ? { skills: { has: skill.toLowerCase() } } : {}) },
      take: 50,
      select: {
        headline: true, skills: true, languages: true,
        user: { select: personSelect },
      },
    });
  }

  portfolio(userId: string) {
    return this.prisma.db.portfolioItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  addPortfolio(userId: string, body: z.infer<typeof portfolioBody>) {
    return this.prisma.db.portfolioItem.create({ data: { ...body, userId } });
  }

  async removePortfolio(userId: string, id: string) {
    const { count } = await this.prisma.db.portfolioItem.deleteMany({ where: { id, userId } });
    if (count === 0) throw notFound();
    return { status: 'ok' };
  }

  // --- Services ------------------------------------------------------------

  async services(q: { q?: string; page: number; pageSize: number }) {
    const where: Prisma.ServiceListingWhereInput = {
      status: 'PUBLISHED',
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.serviceListing.findMany({
        where, orderBy: { createdAt: 'desc' }, ...skipTake(q),
        select: {
          id: true, slug: true, title: true, summary: true, currency: true, tags: true,
          packages: { orderBy: { priceMinor: 'asc' }, take: 1, select: { priceMinor: true, deliveryDays: true } },
          freelancer: { select: personSelect },
        },
      }),
      this.prisma.db.serviceListing.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async service(slug: string) {
    const s = await this.prisma.db.serviceListing.findUnique({
      where: { slug },
      include: {
        packages: { orderBy: { position: 'asc' } },
        freelancer: { select: { ...personSelect, freelancerProfile: true } },
      },
    });
    if (!s || s.status !== 'PUBLISHED') throw notFound('SERVICE_NOT_FOUND');
    return s;
  }

  createService(userId: string, body: z.infer<typeof serviceBody>) {
    const { packages, publish, categoryId, ...rest } = body;
    return this.prisma.db.serviceListing.create({
      data: {
        ...rest,
        categoryId: categoryId ?? null,
        slug: uniqueSlug(body.title),
        freelancerId: userId,
        status: publish ? 'PUBLISHED' : 'DRAFT',
        packages: { create: packages.map((p, position) => ({ ...p, priceMinor: BigInt(p.priceMinor), position })) },
      },
      include: { packages: true },
    });
  }

  myServices(userId: string) {
    return this.prisma.db.serviceListing.findMany({
      where: { freelancerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { packages: true, _count: { select: { projects: true } } },
    });
  }

  async setServiceStatus(id: string, userId: string, status: 'PUBLISHED' | 'PAUSED') {
    const { count } = await this.prisma.db.serviceListing.updateMany({ where: { id, freelancerId: userId }, data: { status } });
    if (count === 0) throw notFound('SERVICE_NOT_FOUND');
    return { status };
  }

  freelancer(userId: string) {
    return this.prisma.db.freelancerProfile.findUnique({ where: { userId } });
  }

  saveFreelancer(userId: string, body: z.infer<typeof freelancerProfileBody>) {
    const data = { ...body, hourlyRateMinor: body.hourlyRateMinor ? BigInt(body.hourlyRateMinor) : null };
    return this.prisma.db.freelancerProfile.upsert({ where: { userId }, update: data, create: { ...data, userId } });
  }

  // --- Projects. No escrow here: that requires a licensed partner. -------------

  async requestProject(clientId: string, slug: string, packageId: string, requirements: string) {
    const service = await this.prisma.db.serviceListing.findUnique({ where: { slug }, include: { packages: true } });
    if (!service || service.status !== 'PUBLISHED') throw notFound('SERVICE_NOT_FOUND');
    if (service.freelancerId === clientId) throw badRequest('CANNOT_HIRE_YOURSELF');
    const pack = service.packages.find((p) => p.id === packageId);
    if (!pack) throw notFound('PACKAGE_NOT_FOUND');
    return this.prisma.db.project.create({
      data: {
        title: `${service.title} — ${pack.name}`, requirements, clientId, freelancerId: service.freelancerId, serviceId: service.id,
        currency: service.currency, totalMinor: pack.priceMinor,
        milestones: { create: { title: pack.name, description: pack.description, amountMinor: pack.priceMinor } },
      },
      include: { milestones: true },
    });
  }

  private async project(id: string, userId: string) {
    const p = await this.prisma.db.project.findUnique({
      where: { id },
      include: {
        milestones: { orderBy: { position: 'asc' } },
        client: { select: personSelect },
        freelancer: { select: personSelect },
        disputes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!p || (p.clientId !== userId && p.freelancerId !== userId)) throw notFound('PROJECT_NOT_FOUND');
    return p;
  }

  getProject(id: string, userId: string) {
    return this.project(id, userId);
  }

  myProjects(userId: string) {
    return this.prisma.db.project.findMany({
      where: { OR: [{ clientId: userId }, { freelancerId: userId }] },
      orderBy: { updatedAt: 'desc' },
      include: { client: { select: personSelect }, freelancer: { select: personSelect }, milestones: { select: { status: true } } },
    });
  }

  async acceptProject(id: string, userId: string) {
    const p = await this.project(id, userId);
    if (p.freelancerId !== userId) throw forbidden('FREELANCER_ONLY');
    if (p.status !== 'REQUESTED') throw conflict('PROJECT_STATE');
    return this.prisma.db.project.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async addMilestone(id: string, userId: string, body: z.infer<typeof milestoneBody>) {
    const p = await this.project(id, userId);
    if (p.status === 'COMPLETED' || p.status === 'CANCELED') throw conflict('PROJECT_STATE');
    return this.prisma.db.projectMilestone.create({
      data: { ...body, amountMinor: BigInt(body.amountMinor), projectId: id, position: p.milestones.length },
    });
  }

  async deliver(milestoneId: string, userId: string, deliveryNote: string) {
    const m = await this.prisma.db.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!m) throw notFound('MILESTONE_NOT_FOUND');
    const p = await this.project(m.projectId, userId);
    if (p.freelancerId !== userId) throw forbidden('FREELANCER_ONLY');
    if (p.status !== 'ACTIVE') throw conflict('PROJECT_STATE');
    return this.prisma.db.projectMilestone.update({ where: { id: milestoneId }, data: { status: 'SUBMITTED', deliveryNote } });
  }

  async reviewMilestone(milestoneId: string, userId: string, approve: boolean) {
    const m = await this.prisma.db.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!m) throw notFound('MILESTONE_NOT_FOUND');
    const p = await this.project(m.projectId, userId);
    if (p.clientId !== userId) throw forbidden('CLIENT_ONLY');
    if (m.status !== 'SUBMITTED') throw conflict('MILESTONE_STATE');
    await this.prisma.db.projectMilestone.update({ where: { id: milestoneId }, data: { status: approve ? 'APPROVED' : 'CHANGES_REQUESTED' } });
    const open = await this.prisma.db.projectMilestone.count({ where: { projectId: p.id, status: { not: 'APPROVED' } } });
    if (open === 0) await this.prisma.db.project.update({ where: { id: p.id }, data: { status: 'COMPLETED' } });
    return { status: approve ? 'approved' : 'changes_requested' };
  }

  async openDispute(userId: string, body: { projectId?: string; orderId?: string; reason: string }) {
    if (body.projectId) {
      await this.project(body.projectId, userId);
      await this.prisma.db.project.update({ where: { id: body.projectId }, data: { status: 'DISPUTED' } });
    } else {
      const order = await this.prisma.db.order.findUnique({ where: { id: body.orderId! } });
      if (!order || order.buyerId !== userId) throw notFound('ORDER_NOT_FOUND');
    }
    return this.prisma.db.dispute.create({ data: { ...body, raisedById: userId } });
  }
}
