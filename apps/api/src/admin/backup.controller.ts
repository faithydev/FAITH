import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Auth, AuthContext, ClientIp, RequirePermission } from '../auth/context';
import { BackupService } from '../core/backup.service';
import { env } from '../core/env';
import { conflict, notFound } from '../core/errors';
import { AuditService } from '../core/platform.services';
import { RateLimit } from '../core/rate-limit';

/**
 * Database backups for the platform's owners. A backup holds every person's data (encrypted),
 * so only super admins (founders) see, make or download one, and every action is audited.
 */
@ApiTags('admin')
@Controller('admin/backups')
@RequirePermission('admin.access', 'admin.roles.write')
export class BackupController {
  constructor(private readonly backups: BackupService, private readonly audit: AuditService) {}

  @Get()
  async list() {
    return {
      enabled: env.BACKUP_ENABLED && env.RUN_WORKER,
      keepDays: env.BACKUP_KEEP_DAYS,
      ownPassphrase: !!env.BACKUP_PASSPHRASE,
      storage: env.STORAGE_DRIVER,
      items: await this.backups.list(),
    };
  }

  @Post() @HttpCode(200) @RateLimit(3, 3600)
  async now(@Auth() a: AuthContext, @ClientIp() ip?: string) {
    const made = await this.backups.run();
    if (!made) throw conflict('BACKUP_RUNNING');
    await this.audit.record({ actor: a.user, action: 'admin.backup.created', resourceType: 'backup', resourceId: made.name, metadata: { size: made.size, rows: made.rows }, ip });
    return made;
  }

  @Get(':name')
  async download(@Auth() a: AuthContext, @Param('name') name: string, @Res() res: Response, @ClientIp() ip?: string) {
    const file = await this.backups.open(name);
    if (!file) throw notFound('BACKUP_NOT_FOUND');
    await this.audit.record({ actor: a.user, action: 'admin.backup.downloaded', resourceType: 'backup', resourceId: name, ip });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'no-store');
    file.stream.on('error', () => res.destroy());
    file.stream.pipe(res);
  }
}
