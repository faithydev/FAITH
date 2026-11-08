import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AdminController, LabController } from './admin/admin.controller';
import { ExportController } from './admin/export.controller';
import { AdminService } from './admin/admin.service';
import { AiService } from './ai/ai.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { OriginGuard, PermissionGuard, SessionGuard } from './auth/context';
import { EntitlementsService } from './auth/entitlements.service';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { CatalogService } from './commerce/catalog.service';
import { BuyerController, MarketplaceController, SellerController } from './commerce/commerce.controller';
import { OrdersService } from './commerce/orders.service';
import { SellerService } from './commerce/seller.service';
import { UploadsController } from './commerce/uploads.controller';
import { EmailService, StorageService } from './core/adapters';
import { AllExceptionsFilter } from './core/errors';
import { AuditService, EventsService, FlagsService, SettingsService } from './core/platform.services';
import { PrismaService } from './core/prisma.service';
import { RateLimitGuard } from './core/rate-limit';
import { CreatorController } from './creator/creator.controller';
import { CreatorService } from './creator/creator.service';
import { DeveloperService } from './developer/developer.service';
import { ApiKeyGuard, PublicApiController } from './developer/public-api';
import { LedgerService } from './finance/ledger.service';
import { PayoutsService } from './finance/payouts.service';
import { HealthController } from './health.controller';
import { IdentityController } from './identity/identity.controller';
import { IdentityService } from './identity/identity.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import {
  AiController, AutomationController, CommunicationController, DeveloperController, GrowthController,
} from './platform/platform.controllers';
import { CommunicationService, GrowthService, InsightService } from './platform/platform.service';
import { RewardsController } from './rewards/rewards.controller';
import { RewardsService } from './rewards/rewards.service';
import { WorkController } from './work/work.controller';
import { WorkService } from './work/work.service';

const shared = [
  PrismaService, AuditService, EventsService, SettingsService, FlagsService, EmailService, StorageService,
  EntitlementsService, LedgerService, PaymentsService, PayoutsService, IdentityService,
];

/** Services every domain may depend on. Domains never reach into each other's internals. */
@Global()
@Module({ providers: shared, exports: shared })
export class CoreModule {}

@Module({
  controllers: [MarketplaceController, BuyerController, SellerController, UploadsController],
  providers: [CatalogService, SellerService, OrdersService],
  exports: [CatalogService, SellerService, OrdersService],
})
export class CommerceModule {}

@Module({
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}

@Module({ controllers: [WorkController], providers: [WorkService] })
export class WorkModule {}

@Module({ controllers: [CreatorController], providers: [CreatorService] })
export class CreatorModule {}

@Module({
  controllers: [DeveloperController, PublicApiController],
  providers: [DeveloperService, ApiKeyGuard],
  exports: [DeveloperService],
})
export class DeveloperModule {}

@Module({
  imports: [CommerceModule],
  controllers: [AiController, AutomationController],
  providers: [AiService],
})
export class AiModule {}

@Module({
  controllers: [CommunicationController, GrowthController],
  providers: [CommunicationService, GrowthService, InsightService],
})
export class CommunicationModule {}

@Module({
  imports: [CommerceModule, RewardsModule, DeveloperModule],
  controllers: [AdminController, LabController, ExportController],
  providers: [AdminService],
})
export class AdminModule {}

@Module({
  imports: [
    CoreModule, CommerceModule, RewardsModule, WorkModule, CreatorModule, DeveloperModule, AiModule,
    CommunicationModule, AdminModule,
  ],
  controllers: [HealthController, AuthController, IdentityController, PaymentsController, BillingController],
  providers: [
    AuthService, BillingService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
