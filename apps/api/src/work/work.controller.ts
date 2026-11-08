import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  candidateProfileBody, disputeBody, freelancerProfileBody, jobApplicationStatusBody, jobApplyBody, jobBody, jobQuery,
  milestoneBody, milestoneDeliveryBody, milestoneReviewBody, pageQuery, portfolioBody, projectRequestBody, quickServiceBody, serviceBody,
} from '@faith/validators';
import { z } from 'zod';
import { Auth, AuthContext, OptionalAuth, Public, RequirePermission } from '../auth/context';
import { ZBody, ZQuery } from '../core/zod';
import { WorkService } from './work.service';

const serviceQuery = pageQuery.extend({ q: z.string().trim().max(120).optional() });
const statusBody = z.object({ status: z.enum(['PUBLISHED', 'PAUSED']) });

@ApiTags('work')
@Controller()
export class WorkController {
  constructor(private readonly work: WorkService) {}

  @Public() @Get('jobs')
  jobs(@ZQuery(jobQuery) q: z.infer<typeof jobQuery>) {
    return this.work.jobs(q);
  }

  @Public() @Get('jobs/:slug')
  job(@Param('slug') slug: string, @OptionalAuth() a?: AuthContext) {
    return this.work.job(slug, a?.user.id);
  }

  @Post('jobs') @RequirePermission('job.post')
  post(@Auth() a: AuthContext, @ZBody(jobBody) b: z.infer<typeof jobBody>) {
    return this.work.postJob(a.user.id, b);
  }

  @Post('jobs/:slug/apply') @RequirePermission('job.apply')
  apply(@Auth() a: AuthContext, @Param('slug') slug: string, @ZBody(jobApplyBody) b: z.infer<typeof jobApplyBody>) {
    return this.work.apply(slug, a.user.id, b.coverLetter);
  }

  @Get('employer/jobs') @RequirePermission('job.post')
  employerJobs(@Auth() a: AuthContext) {
    return this.work.employerJobs(a.user.id);
  }

  @Post('employer/jobs/:id/close') @HttpCode(200) @RequirePermission('job.post')
  close(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.work.closeJob(id, a.user.id);
  }

  @Get('employer/jobs/:id/applications') @RequirePermission('job.post')
  applications(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.work.jobApplications(id, a.user.id);
  }

  @Patch('employer/applications/:id') @RequirePermission('job.post')
  status(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(jobApplicationStatusBody) b: z.infer<typeof jobApplicationStatusBody>) {
    return this.work.setApplicationStatus(id, a.user.id, b.status);
  }

  @Get('employer/candidates') @RequirePermission('job.post')
  candidates(@Query('skill') skill?: string) {
    return this.work.discoverCandidates(skill);
  }

  @Get('work/applications')
  mine(@Auth() a: AuthContext) {
    return this.work.myApplications(a.user.id);
  }

  @Post('work/applications/:id/withdraw') @HttpCode(200)
  withdraw(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.work.withdraw(id, a.user.id);
  }

  @Get('work/saved')
  saved(@Auth() a: AuthContext) {
    return this.work.savedJobs(a.user.id);
  }

  @Put('work/saved/:jobId')
  save(@Auth() a: AuthContext, @Param('jobId') id: string) {
    return this.work.setSaved(id, a.user.id, true);
  }

  @Delete('work/saved/:jobId')
  unsave(@Auth() a: AuthContext, @Param('jobId') id: string) {
    return this.work.setSaved(id, a.user.id, false);
  }

  @Get('work/profile')
  candidate(@Auth() a: AuthContext) {
    return this.work.candidate(a.user.id);
  }

  @Put('work/profile')
  saveCandidate(@Auth() a: AuthContext, @ZBody(candidateProfileBody) b: z.infer<typeof candidateProfileBody>) {
    return this.work.saveCandidate(a.user.id, b);
  }

  @Get('work/portfolio')
  portfolio(@Auth() a: AuthContext) {
    return this.work.portfolio(a.user.id);
  }

  @Post('work/portfolio')
  addPortfolio(@Auth() a: AuthContext, @ZBody(portfolioBody) b: z.infer<typeof portfolioBody>) {
    return this.work.addPortfolio(a.user.id, b);
  }

  @Delete('work/portfolio/:id')
  removePortfolio(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.work.removePortfolio(a.user.id, id);
  }

  // Services ---------------------------------------------------------------

  @Public() @Get('services')
  services(@ZQuery(serviceQuery) q: z.infer<typeof serviceQuery>) {
    return this.work.services(q);
  }

  @Public() @Get('services/:slug')
  service(@Param('slug') slug: string) {
    return this.work.service(slug);
  }

  @Post('services/:slug/projects')
  request(@Auth() a: AuthContext, @Param('slug') slug: string, @ZBody(projectRequestBody) b: z.infer<typeof projectRequestBody>) {
    return this.work.requestProject(a.user.id, slug, b.packageId, b.requirements);
  }

  @Get('freelance/profile')
  freelancer(@Auth() a: AuthContext) {
    return this.work.freelancer(a.user.id);
  }

  @Put('freelance/profile') @RequirePermission('service.manage')
  saveFreelancer(@Auth() a: AuthContext, @ZBody(freelancerProfileBody) b: z.infer<typeof freelancerProfileBody>) {
    return this.work.saveFreelancer(a.user.id, b);
  }

  @Get('freelance/services') @RequirePermission('service.manage')
  myServices(@Auth() a: AuthContext) {
    return this.work.myServices(a.user.id);
  }

  @Post('freelance/services') @RequirePermission('service.manage')
  createService(@Auth() a: AuthContext, @ZBody(serviceBody) b: z.infer<typeof serviceBody>) {
    return this.work.createService(a.user.id, b);
  }

  @Post('freelance/services/quick') @RequirePermission('service.manage')
  quickService(@Auth() a: AuthContext, @ZBody(quickServiceBody) b: z.infer<typeof quickServiceBody>) {
    const { packageName, priceMinor, deliveryDays, ...rest } = b;
    return this.work.createService(a.user.id, { ...rest, packages: [{ name: packageName, description: b.summary, priceMinor, deliveryDays, revisions: 1 }] });
  }

  @Patch('freelance/services/:id') @RequirePermission('service.manage')
  serviceStatus(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(statusBody) b: z.infer<typeof statusBody>) {
    return this.work.setServiceStatus(id, a.user.id, b.status);
  }

  // Projects ---------------------------------------------------------------

  @Get('projects')
  projects(@Auth() a: AuthContext) {
    return this.work.myProjects(a.user.id);
  }

  @Get('projects/:id')
  project(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.work.getProject(id, a.user.id);
  }

  @Post('projects/:id/accept') @HttpCode(200)
  accept(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.work.acceptProject(id, a.user.id);
  }

  @Post('projects/:id/milestones')
  milestone(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(milestoneBody) b: z.infer<typeof milestoneBody>) {
    return this.work.addMilestone(id, a.user.id, b);
  }

  @Post('milestones/:id/deliver') @HttpCode(200)
  deliver(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(milestoneDeliveryBody) b: z.infer<typeof milestoneDeliveryBody>) {
    return this.work.deliver(id, a.user.id, b.deliveryNote);
  }

  @Post('milestones/:id/review') @HttpCode(200)
  review(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(milestoneReviewBody) b: z.infer<typeof milestoneReviewBody>) {
    return this.work.reviewMilestone(id, a.user.id, b.approve);
  }

  @Post('disputes')
  dispute(@Auth() a: AuthContext, @ZBody(disputeBody) b: z.infer<typeof disputeBody>) {
    return this.work.openDispute(a.user.id, b);
  }
}
