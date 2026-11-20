import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SessionService } from '../../auth/session.service';
import { AccountStatusService } from '../../enforcement/account-status.service';
import { hasPermission } from '../../permissions/permissions.catalog';
import { EVENTS } from '../../common/events/events';

@WebSocketGateway({
  namespace: '/admin',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class AdminGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
    private readonly accountStatus: AccountStatusService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Admin WebSocket Gateway initialized on namespace /admin');
    // Periodically clean up expired sockets
    setInterval(() => {
      if (!this.server?.sockets?.sockets) return;
      const now = Date.now();
      for (const [, sock] of this.server.sockets.sockets) {
        if (sock.data?.exp && sock.data.exp < now) {
          sock.disconnect(true);
        }
      }
    }, 30_000);
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.replace('Bearer ', '') as string);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const secret = this.config.get<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwt.verifyAsync(token, { secret });

      const session = await this.sessions.touch(payload.sid, payload.sub);
      if (!session || session.user.role === Role.USER) {
        client.disconnect(true);
        return;
      }

      await this.accountStatus.assertCanAuthenticate(session.user);

      const user = {
        role: session.user.role,
        permissions: session.user.permissions.map((p) => p.permission),
      };

      client.data = {
        userId: session.userId,
        sid: session.id,
        exp: (payload.exp || 0) * 1000,
      };

      client.join('staff');
      if (hasPermission(user, 'DASHBOARD_VIEW')) client.join('dashboard');
      if (hasPermission(user, 'REPORTS_VIEW')) client.join('reports');
      if (hasPermission(user, 'AUDIT_VIEW')) client.join('audit');

      this.logger.log(`Admin client connected: ${session.userId} (Socket: ${client.id})`);
    } catch (err: any) {
      this.logger.warn(`Admin socket handshake failed: ${err?.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Admin client disconnected: ${client.id}`);
  }

  @OnEvent(EVENTS.USER_REGISTERED)
  onUserRegistered(event: any) {
    this.server?.to('dashboard').emit('registration.new', {
      id: event.userId,
      username: event.username,
      createdAt: event.createdAt || new Date(),
    });
    this.server?.to('dashboard').emit('stats.changed');
  }

  @OnEvent(EVENTS.REPORT_CREATED)
  onReportCreated(event: any) {
    this.server?.to('reports').emit('report.new', {
      caseId: event.caseId,
      targetType: event.targetType,
      priority: event.priority,
    });
    this.server?.to('dashboard').emit('stats.changed');
  }

  @OnEvent(EVENTS.CASE_UPDATED)
  onCaseUpdated(event: any) {
    this.server?.to('reports').emit('case.updated', {
      caseId: event.caseId,
      status: event.status,
    });
    this.server?.to('dashboard').emit('stats.changed');
  }

  @OnEvent(EVENTS.ADMIN_ACTION)
  onAdminAction(event: any) {
    this.server?.to('audit').emit('audit.new', {
      action: event.action,
      actor: event.actorLabel,
      at: event.at || new Date(),
    });
    this.server?.to('dashboard').emit('admin.action', {
      action: event.action,
      actor: event.actorLabel,
      at: event.at || new Date(),
    });
  }

  @OnEvent(EVENTS.SESSION_REVOKED)
  onSessionRevoked(event: { sid: string }) {
    if (!this.server?.sockets?.sockets) return;
    for (const [, sock] of this.server.sockets.sockets) {
      if (sock.data?.sid === event.sid) {
        sock.disconnect(true);
      }
    }
  }
}
