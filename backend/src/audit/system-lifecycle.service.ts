import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit.service';
import { AUDIT_ACTIONS } from './audit.constants';
import { AuditSeverity } from '@prisma/client';

@Injectable()
export class SystemLifecycleService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(SystemLifecycleService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Section 2.2: Log critical system events: STARTUP
   */
  async onApplicationBootstrap() {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const port = this.config.get<number>('PORT', 3000);

    await this.audit.logSystemEvent(AUDIT_ACTIONS.SYSTEM_STARTUP, {
      username: 'SYSTEM',
      resource: 'system/lifecycle',
      severity: AuditSeverity.INFO,
      payload: {
        event: 'APPLICATION_STARTUP',
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        environment: nodeEnv,
        port,
        securityFeaturesEnabled: [
          'RBAC',
          'ARGON2ID_PASSWORD_HASHING',
          'AUDIT_TRAILS_AES_GCM',
          'TAMPER_EVIDENT_HASH_CHAINING',
          'BRUTE_FORCE_ANOMALY_DETECTION',
        ],
      },
    });

    this.logger.log(`Audit System Lifecycle: Logged SYSTEM_STARTUP`);
  }

  /**
   * Section 2.2: Log critical system events: SHUTDOWN
   */
  async beforeApplicationShutdown(signal?: string) {
    await this.audit.logSystemEvent(AUDIT_ACTIONS.SYSTEM_SHUTDOWN, {
      username: 'SYSTEM',
      resource: 'system/lifecycle',
      severity: AuditSeverity.INFO,
      payload: {
        event: 'APPLICATION_SHUTDOWN',
        signal: signal || 'TERMINATE',
        pid: process.pid,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });

    this.logger.log(`Audit System Lifecycle: Logged SYSTEM_SHUTDOWN (${signal})`);
  }
}
