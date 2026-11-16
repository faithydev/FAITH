import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { cardBody, upgradeBody } from '@faith/validators';
import type { z } from 'zod';
import { Auth, AuthContext, Public } from '../auth/context';
import { RateLimit } from '../core/rate-limit';
import { ZBody } from '../core/zod';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public() @Get('plans')
  plans() {
    return this.billing.plans();
  }

  @Get('state')
  state(@Auth() a: AuthContext) {
    return this.billing.state(a.user.id);
  }

  @Post('upgrade')
  upgrade(@Auth() a: AuthContext, @ZBody(upgradeBody) b: z.infer<typeof upgradeBody>) {
    return this.billing.upgrade(a.user.id, b.interval, b.idempotencyKey, b.badgeKind, b.cardId);
  }

  @Get('cards')
  cards(@Auth() a: AuthContext) {
    return this.billing.cards(a.user.id);
  }

  @Post('cards') @RateLimit(10, 600)
  addCard(@Auth() a: AuthContext, @ZBody(cardBody) b: z.infer<typeof cardBody>) {
    return this.billing.addCard(a.user.id, b);
  }

  @Post('cards/:id/default') @HttpCode(200)
  makeDefault(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.billing.makeDefault(a.user.id, id);
  }

  @Delete('cards/:id')
  removeCard(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.billing.removeCard(a.user.id, id);
  }

  @Post('cancel') @HttpCode(200)
  cancel(@Auth() a: AuthContext) {
    return this.billing.cancel(a.user.id);
  }

  @Post('resume') @HttpCode(200)
  resume(@Auth() a: AuthContext) {
    return this.billing.resume(a.user.id);
  }
}
