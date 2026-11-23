import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { GovernanceService } from './governance.service';
import { GovernanceAdminController } from './governance-admin.controller';
import { GovernanceUserController } from './governance-user.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [GovernanceAdminController, GovernanceUserController],
  providers: [GovernanceService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
