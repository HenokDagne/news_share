import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { AuditService } from './audit.service';
import { AlertService } from './alert.service';
import { AuditCryptoService } from './audit-crypto.service';
import { SystemLifecycleService } from './system-lifecycle.service';
import { RolesGuard } from './roles.guard';
import { AuditInterceptor } from './audit.interceptor';
import { AuditController } from './audit.controller';

@Global()
@Module({
  imports: [PrismaModule, MailModule],
  providers: [
    AuditService,
    AlertService,
    AuditCryptoService,
    SystemLifecycleService,
    RolesGuard,
    AuditInterceptor,
  ],
  controllers: [AuditController],
  exports: [AuditService, AlertService, AuditCryptoService, RolesGuard, AuditInterceptor],
})
export class AuditModule {}
