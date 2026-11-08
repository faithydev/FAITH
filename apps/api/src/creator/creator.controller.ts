import { Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  channelBody, commentBody, communityBody, courseBody, creatorProfileBody, lessonBody, memberModerationBody, postBody, sectionBody,
} from '@faith/validators';
import { z } from 'zod';
import { Auth, AuthContext, OptionalAuth, Public, RequirePermission } from '../auth/context';
import { ZBody } from '../core/zod';
import { CreatorService } from './creator.service';

const publishedBody = z.object({ published: z.boolean() });

@ApiTags('creator')
@Controller()
export class CreatorController {
  constructor(private readonly creator: CreatorService) {}

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
