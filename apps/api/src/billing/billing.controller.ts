import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { upgradeBody } from '@faith/validators';
import type { z } from 'zod';
import { Auth, AuthContext, Public } from '../auth/context';
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
    return this.billing.upgrade(a.user.id, b.interval, b.idempotencyKey);
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
