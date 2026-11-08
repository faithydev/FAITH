import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Persona, PERSONAS } from '@faith/config';
import {
  addRoleBody, onboardingBody, organizationBody, orgMemberBody, preferencesBody, profileBody, verificationBody,
} from '@faith/validators';
import type { z } from 'zod';
import { Auth, AuthContext } from '../auth/context';
import { ZBody } from '../core/zod';
import { IdentityService } from './identity.service';

@ApiTags('identity')
@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('me')
  me(@Auth() a: AuthContext) {
    return this.identity.me(a);
  }

  @Patch('me/profile')
  profile(@Auth() a: AuthContext, @ZBody(profileBody) b: z.infer<typeof profileBody>) {
    return this.identity.updateProfile(a.user.id, b);
  }

  @Patch('me/preferences')
  preferences(@Auth() a: AuthContext, @ZBody(preferencesBody) b: z.infer<typeof preferencesBody>) {
    return this.identity.updatePreferences(a, b);
  }

  @Post('me/roles') @HttpCode(200)
  addRole(@Auth() a: AuthContext, @ZBody(addRoleBody) b: z.infer<typeof addRoleBody>) {
    return this.identity.addPersona(a, b.persona);
  }

  @Get('onboarding/questions')
  questions(@Query('personas') personas = '') {
    const list = personas.split(',').filter((p): p is Persona => (PERSONAS as readonly string[]).includes(p));
    return this.identity.onboardingQuestions(list);
  }

  @Post('onboarding') @HttpCode(200)
  onboard(@Auth() a: AuthContext, @ZBody(onboardingBody) b: z.infer<typeof onboardingBody>) {
    return this.identity.completeOnboarding(a, b);
  }

  @Get('organizations')
  orgs(@Auth() a: AuthContext) {
    return this.identity.myOrganizations(a.user.id);
  }

  @Post('organizations')
  createOrg(@Auth() a: AuthContext, @ZBody(organizationBody) b: z.infer<typeof organizationBody>) {
    return this.identity.createOrganization(a.user.id, b);
  }

  @Get('organizations/:id/members')
  members(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.identity.members(id, a.user.id);
  }

  @Post('organizations/:id/members')
  addMember(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(orgMemberBody) b: z.infer<typeof orgMemberBody>) {
    return this.identity.addMember(id, a.user.id, b);
  }

  @Delete('organizations/:id/members/:userId')
  removeMember(@Auth() a: AuthContext, @Param('id') id: string, @Param('userId') userId: string) {
    return this.identity.removeMember(id, a.user.id, userId);
  }

  @Get('verifications')
  verifications(@Auth() a: AuthContext) {
    return this.identity.myVerifications(a.user.id);
  }

  @Post('verifications')
  verify(@Auth() a: AuthContext, @ZBody(verificationBody) b: z.infer<typeof verificationBody>) {
    return this.identity.requestVerification(a.user.id, b);
  }
}
