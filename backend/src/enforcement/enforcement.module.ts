import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RestrictionService } from './restriction.service';
import { AccountStatusService } from './account-status.service';
import { RestrictionExpiryJob } from './restriction-expiry.job';

@Module({
  imports: [PrismaModule, AuditModule, ScheduleModule],
  providers: [RestrictionService, AccountStatusService, RestrictionExpiryJob],
  exports: [RestrictionService, AccountStatusService],
})
export class EnforcementModule {}
