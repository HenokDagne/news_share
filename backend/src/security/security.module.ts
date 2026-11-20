import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DataProtectionService } from './data-protection.service';
import { XssSanitizerService } from './xss-sanitizer.service';
import { MtlsGuard } from './guards/mtls.guard';
import { SecurityController } from './security.controller';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule],
  controllers: [SecurityController],
  providers: [DataProtectionService, XssSanitizerService, MtlsGuard],
  exports: [DataProtectionService, XssSanitizerService, MtlsGuard],
})
export class SecurityModule {}
