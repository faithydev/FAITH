import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './auth/context';
import { env } from './core/env';
import { PrismaService } from './core/prisma.service';
import { PaymentsService } from './payments/payments.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly payments: PaymentsService) {}

  /** What the interface needs to label honestly: demo data, simulated money, the AI adapter. */
  @Public() @Get('meta')
  async meta() {
    const demo = await this.prisma.db.platformSetting.findUnique({ where: { key: 'platform.demoData' } });
    return {
      demoData: demo?.value === true,
      mockPayments: this.payments.active().name === 'mock',
      publicDemo: env.PUBLIC_DEMO,
      aiLive: !!env.ANTHROPIC_API_KEY,
    };
  }

  @Public() @Get()
  async check() {
    await this.prisma.db.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'up',
      adapters: {
        payments: this.payments.status(),
        storage: env.STORAGE_DRIVER,
        email: env.EMAIL_DRIVER,
        ai: env.ANTHROPIC_API_KEY ? 'anthropic' : 'demo',
        queue: env.REDIS_URL ? 'bullmq' : 'postgres-polling',
      },
    };
  }
}
