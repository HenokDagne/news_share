import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BackupsService } from './backups.service';
import { BackupCryptoService } from './backup-crypto.service';
import { BackupsController } from './backups.controller';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule],
  controllers: [BackupsController],
  providers: [BackupsService, BackupCryptoService],
  exports: [BackupsService, BackupCryptoService],
})
export class BackupsModule {}
