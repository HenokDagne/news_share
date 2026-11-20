import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SessionService } from '../../auth/session.service';
import { AccountStatusService } from '../../enforcement/account-status.service';
import { EVENTS } from '../../common/events/events';

@WebSocketGateway({
  namespace: '/user',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class UserGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UserGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
    private readonly accountStatus: AccountStatusService,
    private readonly config: ConfigService,
  ) {}

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
      if (!session) {
        client.disconnect(true);
        return;
      }

      await this.accountStatus.assertCanAuthenticate(session.user);

      client.data = {
        userId: session.userId,
        sid: session.id,
      };

      client.join(`user:${session.userId}`);
      this.logger.log(`User socket connected: ${session.userId}`);
    } catch (err: any) {
      this.logger.warn(`User socket handshake rejected: ${err?.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`User socket disconnected: ${client.id}`);
  }

  @OnEvent(EVENTS.ACTIVITY_CREATED)
  onActivityCreated(event: { userId: string; activity: any }) {
    this.server?.to(`user:${event.userId}`).emit('activity.new', event.activity);
  }

  @OnEvent(EVENTS.RESTRICTION_APPLIED)
  onRestrictionApplied(event: { userId: string; type: string }) {
    this.server?.to(`user:${event.userId}`).emit('account.restricted', {
      type: event.type,
      message: 'An administrative restriction was placed on your account.',
    });

    // Disconnect after 1 second
    setTimeout(() => {
      if (!this.server?.sockets?.sockets) return;
      for (const [, sock] of this.server.sockets.sockets) {
        if (sock.data?.userId === event.userId) {
          sock.disconnect(true);
        }
      }
    }, 1000);
  }
}
