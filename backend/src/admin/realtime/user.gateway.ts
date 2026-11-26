import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
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
  private readonly onlineUsers = new Map<string, number>(); // userId -> connectionCount

  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
    private readonly accountStatus: AccountStatusService,
    private readonly config: ConfigService,
  ) {}

  isUserOnline(userId: string): boolean {
    return (this.onlineUsers.get(userId) || 0) > 0;
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
      if (!session) {
        client.disconnect(true);
        return;
      }

      await this.accountStatus.assertCanAuthenticate(session.user);

      const userId = session.userId;
      client.data = {
        userId,
        sid: session.id,
      };

      client.join(`user:${userId}`);
      const currentCount = this.onlineUsers.get(userId) || 0;
      this.onlineUsers.set(userId, currentCount + 1);

      if (currentCount === 0) {
        this.server?.emit('user:online', { userId, timestamp: new Date() });
      }

      this.logger.log(`User socket connected: ${userId} (${client.id})`);
    } catch (err: any) {
      this.logger.warn(`User socket handshake rejected: ${err?.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      const currentCount = this.onlineUsers.get(userId) || 1;
      if (currentCount <= 1) {
        this.onlineUsers.delete(userId);
        this.server?.emit('user:offline', { userId, timestamp: new Date() });
      } else {
        this.onlineUsers.set(userId, currentCount - 1);
      }
    }
    this.logger.log(`User socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('conversation:join')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      client.join(`conversation:${data.conversationId}`);
      this.logger.debug(`Socket ${client.id} joined conversation:${data.conversationId}`);
    }
  }

  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      client.leave(`conversation:${data.conversationId}`);
      this.logger.debug(`Socket ${client.id} left conversation:${data.conversationId}`);
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; recipientId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId) return;
    const payload = { conversationId: data.conversationId, userId, isTyping: true };
    this.server?.to(`user:${data.recipientId}`).emit('typing:start', payload);
    this.server?.to(`conversation:${data.conversationId}`).emit('typing:start', payload);
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; recipientId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId) return;
    const payload = { conversationId: data.conversationId, userId, isTyping: false };
    this.server?.to(`user:${data.recipientId}`).emit('typing:stop', payload);
    this.server?.to(`conversation:${data.conversationId}`).emit('typing:stop', payload);
  }

  @OnEvent(EVENTS.ACTIVITY_CREATED)
  onActivityCreated(event: { userId: string; activity: any }) {
    this.server?.to(`user:${event.userId}`).emit('activity.new', event.activity);
  }

  @OnEvent(EVENTS.DIRECT_MESSAGE_CREATED)
  onDirectMessageCreated(event: { message: any; recipientId: string; senderId: string; conversationId: string }) {
    const payload = event.message;
    // Emit standard spec events
    this.server?.to(`user:${event.recipientId}`).emit('message:new', payload);
    this.server?.to(`user:${event.senderId}`).emit('message:new', payload);
    this.server?.to(`conversation:${event.conversationId}`).emit('message:new', payload);

    // Keep legacy alias for backward compatibility
    this.server?.to(`user:${event.recipientId}`).emit('dm.message.new', payload);
    this.server?.to(`user:${event.senderId}`).emit('dm.message.new', payload);
  }

  @OnEvent(EVENTS.DIRECT_MESSAGE_READ)
  onDirectMessageRead(event: { conversationId: string; senderId: string; recipientId: string; readAt: Date }) {
    this.server?.to(`user:${event.senderId}`).emit('message:read', event);
    this.server?.to(`conversation:${event.conversationId}`).emit('message:read', event);
    this.server?.to(`user:${event.senderId}`).emit('dm.message.read', event);
  }

  @OnEvent(EVENTS.DIRECT_MESSAGE_EDITED)
  onDirectMessageEdited(event: { message: any; conversationId: string; recipientId: string; senderId: string }) {
    this.server?.to(`user:${event.recipientId}`).emit('message:edited', event.message);
    this.server?.to(`user:${event.senderId}`).emit('message:edited', event.message);
    this.server?.to(`conversation:${event.conversationId}`).emit('message:edited', event.message);
  }

  @OnEvent(EVENTS.DIRECT_MESSAGE_DELETED)
  onDirectMessageDeleted(event: { messageId: string; conversationId: string; recipientId: string; senderId: string }) {
    const payload = { messageId: event.messageId, conversationId: event.conversationId };
    this.server?.to(`user:${event.recipientId}`).emit('message:deleted', payload);
    this.server?.to(`user:${event.senderId}`).emit('message:deleted', payload);
    this.server?.to(`conversation:${event.conversationId}`).emit('message:deleted', payload);
  }

  @OnEvent(EVENTS.DIRECT_MESSAGE_DELIVERED)
  onDirectMessageDelivered(event: { messageId: string; conversationId: string; recipientId: string; senderId: string }) {
    const payload = { messageId: event.messageId, conversationId: event.conversationId };
    this.server?.to(`user:${event.senderId}`).emit('message:delivered', payload);
    this.server?.to(`conversation:${event.conversationId}`).emit('message:delivered', payload);
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
      for (const [, socket] of this.server.sockets.sockets) {
        if (socket.data?.userId === event.userId) {
          socket.disconnect(true);
        }
      }
    }, 1000);
  }
}
