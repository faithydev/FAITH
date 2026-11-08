import { Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { mockPaymentBody } from '@faith/validators';
import type { Request } from 'express';
import type { z } from 'zod';
import { Auth, AuthContext, Public } from '../auth/context';
import { ZBody } from '../core/zod';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments/:id')
  get(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.payments.get(id, a.user.id);
  }

  /** Development only. The route answers 404 unless the mock provider is active. */
  @Post('payments/:id/simulate') @HttpCode(200)
  simulate(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(mockPaymentBody) b: z.infer<typeof mockPaymentBody>) {
    return this.payments.simulate(id, a.user.id, b.outcome);
  }

  @Public() @Post('webhooks/payments/:provider') @HttpCode(200)
  webhook(@Param('provider') provider: string, @Req() req: Request & { rawBody?: Buffer }) {
    return this.payments.handleWebhook(provider, req.rawBody ?? Buffer.alloc(0), req.headers);
  }
}
