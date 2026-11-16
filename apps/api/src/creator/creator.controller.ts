import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  channelBody, commentBody, communityBody, courseBody, creatorProfileBody, lessonBody, lessonVideoBody, memberModerationBody, postBody, sectionBody,
} from '@faith/validators';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Auth, AuthContext, OptionalAuth, Public, RequirePermission } from '../auth/context';
import { StorageService } from '../core/adapters';
import { forbidden, notFound } from '../core/errors';
import { RateLimit } from '../core/rate-limit';
import { ZBody } from '../core/zod';
import { CreatorService } from './creator.service';

/** Largest slice served per request: players ask again as they play, nobody gets the file in one go. */
const CHUNK = 4 * 1024 * 1024;

/** A single `bytes=a-b`, `bytes=a-` or `bytes=-n` range, clamped to the file; null when unusable. */
function parseRange(header: string | undefined, size: number): [number, number] | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (!m[1] && !m[2])) return null;
  let start: number;
  let end: number;
  if (!m[1]) {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (start >= size || start > end) return null;
  return [start, Math.min(end, start + CHUNK - 1)];
}

const publishedBody = z.object({ published: z.boolean() });

@ApiTags('creator')
@Controller()
export class CreatorController {
  constructor(private readonly creator: CreatorService, private readonly storage: StorageService) {}

  @Public() @Get('creators')
  creators(@Query('q') q?: string) {
    return this.creator.publicCreators(q);
  }

  @Public() @Get('creators/:username')
  publicCreator(@Param('username') username: string) {
    return this.creator.publicCreator(username);
  }

  @Get('creator/overview')
  overview(@Auth() a: AuthContext) {
    return this.creator.overview(a.user.id);
  }

  @Get('creator/profile')
  profile(@Auth() a: AuthContext) {
    return this.creator.myProfile(a.user.id);
  }

  @Put('creator/profile') @RequirePermission('campaign.participate')
  saveProfile(@Auth() a: AuthContext, @ZBody(creatorProfileBody) b: z.infer<typeof creatorProfileBody>) {
    return this.creator.saveProfile(a.user.id, b);
  }

  // Courses ----------------------------------------------------------------

  @Public() @Get('courses')
  courses() {
    return this.creator.publicCourses();
  }

  @Public() @Get('courses/:slug')
  course(@Param('slug') slug: string, @OptionalAuth() a?: AuthContext) {
    return this.creator.course(slug, a?.user.id);
  }

  @Post('courses/:slug/enroll')
  enroll(@Auth() a: AuthContext, @Param('slug') slug: string) {
    return this.creator.enroll(slug, a.user.id);
  }

  @Post('lessons/:id/complete') @HttpCode(200)
  complete(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.creator.completeLesson(id, a.user.id);
  }

  @Get('learning')
  learning(@Auth() a: AuthContext) {
    return this.creator.myEnrollments(a.user.id);
  }

  @Get('creator/courses') @RequirePermission('course.manage')
  myCourses(@Auth() a: AuthContext) {
    return this.creator.myCourses(a.user.id);
  }

  @Post('creator/courses') @RequirePermission('course.manage')
  createCourse(@Auth() a: AuthContext, @ZBody(courseBody) b: z.infer<typeof courseBody>) {
    return this.creator.createCourse(a.user.id, b);
  }

  @Post('creator/courses/:id/sections') @RequirePermission('course.manage')
  section(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(sectionBody) b: z.infer<typeof sectionBody>) {
    return this.creator.addSection(id, a.user.id, b.title);
  }

  @Post('creator/sections/:id/lessons') @RequirePermission('course.manage')
  lesson(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(lessonBody) b: z.infer<typeof lessonBody>) {
    return this.creator.addLesson(id, a.user.id, b);
  }

  @Put('creator/lessons/:id/video') @RequirePermission('course.manage')
  setVideo(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(lessonVideoBody) b: z.infer<typeof lessonVideoBody>) {
    return this.creator.setLessonVideo(id, a.user.id, b.uploadId);
  }

  @Delete('creator/lessons/:id/video') @RequirePermission('course.manage')
  removeVideo(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.creator.setLessonVideo(id, a.user.id, null);
  }

  /**
   * Lesson video, streamed in slices to the signed-in viewer who has access. Same origin as the
   * site (through its /api rewrite), never cached, and refused when opened as a page, so a copied
   * address does not play or download outside the protected player.
   */
  @Public() @Get('lessons/:id/stream') @RateLimit(600, 60)
  async stream(@Param('id') id: string, @OptionalAuth() a: AuthContext | undefined, @Req() req: Request, @Res() res: Response) {
    if (req.headers['sec-fetch-dest'] === 'document') throw forbidden('PROTECTED_VIDEO');
    const { key } = await this.creator.lessonVideo(id, a?.user.id);
    const size = await this.storage.store.size(key);
    if (size === null) throw notFound('LESSON_NOT_FOUND');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const range = parseRange(req.headers.range, size) ?? [0, Math.min(size, CHUNK) - 1];
    const [start, end] = range;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', String(end - start + 1));
    const body = await this.storage.store.openRange(key, start, end);
    body.on('error', () => res.destroy());
    body.pipe(res);
  }

  @Post('creator/courses/:id/published') @HttpCode(200) @RequirePermission('course.manage')
  publish(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(publishedBody) b: z.infer<typeof publishedBody>) {
    return this.creator.setCoursePublished(id, a.user.id, b.published);
  }

  // Communities ------------------------------------------------------------

  @Public() @Get('communities')
  communities() {
    return this.creator.publicCommunities();
  }

  @Public() @Get('communities/:slug')
  community(@Param('slug') slug: string, @OptionalAuth() a?: AuthContext) {
    return this.creator.community(slug, a?.user.id);
  }

  @Get('my/communities')
  mine(@Auth() a: AuthContext) {
    return this.creator.myCommunities(a.user.id);
  }

  @Post('communities') @RequirePermission('community.manage')
  createCommunity(@Auth() a: AuthContext, @ZBody(communityBody) b: z.infer<typeof communityBody>) {
    return this.creator.createCommunity(a.user.id, b);
  }

  @Post('communities/:slug/join')
  join(@Auth() a: AuthContext, @Param('slug') slug: string) {
    return this.creator.join(slug, a.user.id);
  }

  @Post('communities/:slug/posts')
  post(@Auth() a: AuthContext, @Param('slug') slug: string, @ZBody(postBody) b: z.infer<typeof postBody>) {
    return this.creator.post(slug, a.user.id, b);
  }

  @Post('posts/:id/comments')
  comment(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(commentBody) b: z.infer<typeof commentBody>) {
    return this.creator.comment(id, a.user.id, b.body);
  }

  @Post('posts/:id/hide') @HttpCode(200)
  hide(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.creator.hidePost(id, a.user.id);
  }

  @Post('communities/:id/channels')
  channel(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(channelBody) b: z.infer<typeof channelBody>) {
    return this.creator.addChannel(id, a.user.id, b.name);
  }

  @Get('communities/:id/members')
  members(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.creator.communityMembers(id, a.user.id);
  }

  @Patch('communities/:id/members/:userId')
  moderate(@Auth() a: AuthContext, @Param('id') id: string, @Param('userId') userId: string, @ZBody(memberModerationBody) b: z.infer<typeof memberModerationBody>) {
    return this.creator.moderateMember(id, a.user.id, userId, b);
  }
}
