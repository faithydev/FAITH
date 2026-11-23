import { Controller, Get, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { directPayBody, receiptBody, receiptDecisionBody } from '@faith/validators';
import type { Response } from 'express';
import type { z } from 'zod';
import { Auth, AuthContext, RequirePermission } from '../auth/context';
import { StorageService } from '../core/adapters';
import { notFound } from '../core/errors';
import { RateLimit } from '../core/rate-limit';
import { ZBody } from '../core/zod';
import { DirectPayService } from './direct-pay.service';

@ApiTags('direct-pay')
@Controller()
export class DirectPayController {
  constructor(private readonly direct: DirectPayService, private readonly storage: StorageService) {}

  // Seller: where buyers send the money ------------------------------------------

  @Get('seller/stores/:id/direct-pay') @RequirePermission('store.manage')
  account(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.direct.account(id, a.user.id);
  }

  @Put('seller/stores/:id/direct-pay') @RequirePermission('store.manage')
  save(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(directPayBody) b: z.infer<typeof directPayBody>) {
    return this.direct.saveAccount(id, a.user.id, b);
  }

  // Buyer: pay, then send the receipt ----------------------------------------------

  @Get('payments/:id/direct')
  view(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.direct.payerView(id, a.user.id);
  }

  @Post('payments/:id/receipt') @HttpCode(200) @RateLimit(10, 600)
  submit(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(receiptBody) b: z.infer<typeof receiptBody>) {
    return this.direct.submitReceipt(id, a.user.id, b);
  }

  // Seller: check the receipt and confirm --------------------------------------------

  @Get('seller/stores/:id/receipts') @RequirePermission('order.sell.read')
  receipts(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.direct.storeReceipts(id, a.user.id);
  }

  @Post('seller/receipts/:id/decide') @HttpCode(200) @RequirePermission('order.sell.read')
  decide(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(receiptDecisionBody) b: z.infer<typeof receiptDecisionBody>) {
    return this.direct.decide(id, a.user.id, b.approve, b.reason);
  }

  /** The receipt image or PDF, shown inline to its seller and to the buyer who sent it. Never cached. */
  @Get('receipts/:id/file')
  async file(@Auth() a: AuthContext, @Param('id') id: string, @Res() res: Response) {
    const { key, mime } = await this.direct.receiptFile(id, a.user.id);
    let stream: NodeJS.ReadableStream;
    try {
      stream = await this.storage.store.open(key);
    } catch {
      throw notFound('RECEIPT_NOT_FOUND');
    }
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    stream.pipe(res);
  }
}
