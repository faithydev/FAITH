/**
 * Exchange rates for display. Prices are set, charged and settled in the soum or the dollar;
 * these rates only let people read an amount in their own currency. They come from the Central
 * Bank of Uzbekistan's public feed and are never estimated: with no stored rate, nothing converts.
 */
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { refreshRates } from '@faith/automation';
import { BASE_CURRENCIES, CURRENCY_REGIONS, RATE_SCALE } from '@faith/money';
import { Auth, AuthContext, Public, RequirePermission } from '../auth/context';
import { badRequest } from '../core/errors';
import { logger } from '../core/logger';
import { AuditService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';

@ApiTags('rates')
@Controller()
export class RatesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** Soum per unit, as exact micro-soum digit strings. A currency with no rate is left out. */
  @Public() @Get('rates')
  async rates() {
    const rows = await this.prisma.db.exchangeRate.findMany({ select: { currency: true, uzsPerUnitMicro: true, source: true, asOf: true } });
    const latest = rows.reduce<Date | null>((d, r) => (!d || r.asOf > d ? r.asOf : d), null);
    return {
      base: BASE_CURRENCIES,
      scale: RATE_SCALE.toString(),
      source: rows[0]?.source ?? null,
      asOf: latest ? latest.toISOString().slice(0, 10) : null,
      regions: CURRENCY_REGIONS,
      rates: Object.fromEntries([['UZS', RATE_SCALE.toString()], ...rows.map((r) => [r.currency, r.uzsPerUnitMicro.toString()])]),
    };
  }

  /** Pulls the official feed now instead of waiting for the next scheduled refresh. */
  @Post('admin/rates/refresh') @HttpCode(200) @RequirePermission('admin.access', 'admin.settings.write')
  async refresh(@Auth() a: AuthContext) {
    try {
      const result = await refreshRates(this.prisma.db);
      await this.audit.record({ actor: { id: a.user.id }, action: 'rates.refreshed', resourceType: 'ExchangeRate', metadata: result });
      return result;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'rates refresh failed');
      throw badRequest('RATES_UNAVAILABLE');
    }
  }
}
