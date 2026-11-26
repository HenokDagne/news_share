import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EVENTS } from '../common/events/events';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Asserts whether userA is allowed to message userB according to blocking and privacy rules.
   */
  async assertCanMessage(senderId: string, recipientId: string): Promise<void> {
    if (senderId === recipientId) {
      throw new BadRequestException('Cannot message yourself');
    }

    // 1. Recipient existence
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      include: { profile: true, privacyPreference: true },
    });
    if (!recipient || !recipient.profile) {
      throw new NotFoundException('Recipient not found');
    }

    // 2. Check blocks in either direction
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: recipientId },
          { blockerId: recipientId, blockedId: senderId },
        ],
      },
    });
    if (block) {
      throw new ForbiddenException('Cannot message this user due to account blocking');
    }

    // 3. Respect DM Privacy Preference (EVERYONE, FRIENDS, NO_ONE)
    const dmPref = recipient.privacyPreference?.dmPermission || 'FRIENDS';
    if (dmPref === 'NO_ONE') {
      throw new ForbiddenException('This user does not accept direct messages');
    }

    if (dmPref === 'FRIENDS') {
      // Check if recipient follows sender, or if there is a mutual follow
      const follow = await this.prisma.follow.findFirst({
        where: {
          OR: [
            { followerId: recipientId, followingId: senderId },
            { followerId: senderId, followingId: recipientId },
          ],
        },
      });
      if (!follow) {
        throw new ForbiddenException('This user only accepts direct messages from friends or followed users');
      }
    }
  }

  /**
   * Canonical ordering of two user IDs to prevent duplicate conversations
   */
  private canonicalPair(u1: string, u2: string): [string, string] {
    return u1 < u2 ? [u1, u2] : [u2, u1];
  }

  /**
   * Formats a conversation row with the other participant's profile and last message metadata
   */
  private formatConversation(conv: any, currentUserId: string) {
    const isUser1 = conv.user1Id === currentUserId;
    const otherUser = isUser1 ? conv.user2 : conv.user1;
    const lastMessage = conv.messages && conv.messages.length > 0 ? conv.messages[0] : null;

    return {
      id: conv.id,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      participant: {
        id: otherUser.id,
        username: otherUser.profile?.username || 'user',
        fullName: otherUser.profile?.fullName || otherUser.profile?.username || '',
        avatarUrl: otherUser.profile?.avatarUrl || null,
      },
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            recipientId: lastMessage.recipientId,
            isRead: lastMessage.isRead,
            createdAt: lastMessage.createdAt,
          }
        : null,
      unreadCount: conv._count?.messages || 0,
    };
  }

  /**
   * Retrieves or creates a 1-to-1 conversation between the current user and target user
   */
  async getOrCreateConversation(currentUserId: string, recipientId: string) {
    await this.assertCanMessage(currentUserId, recipientId);

    const [u1, u2] = this.canonicalPair(currentUserId, recipientId);

    // Look for existing conversation
    let conv = await this.prisma.conversation.findUnique({
      where: {
        user1Id_user2Id: { user1Id: u1, user2Id: u2 },
      },
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          user1Id: u1,
          user2Id: u2,
          lastMessageAt: new Date(),
        },
        include: {
          user1: { include: { profile: true } },
          user2: { include: { profile: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    }

    const unreadCount = await this.prisma.directMessage.count({
      where: {
        conversationId: conv.id,
        recipientId: currentUserId,
        isRead: false,
      },
    });

    return {
      ...this.formatConversation(conv, currentUserId),
      unreadCount,
    };
  }

  /**
   * Lists all conversations for the current user, ordered by most recent message
   */
  async listConversations(currentUserId: string) {
    const convs = await this.prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Compute unread count for each conversation
    const results = await Promise.all(
      convs.map(async (conv) => {
        const unreadCount = await this.prisma.directMessage.count({
          where: {
            conversationId: conv.id,
            recipientId: currentUserId,
            isRead: false,
          },
        });
        return {
          ...this.formatConversation(conv, currentUserId),
          unreadCount,
        };
      }),
    );

    return results;
  }

  /**
   * Gets details for a specific conversation ensuring the user is a participant
   */
  async getConversation(currentUserId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      throw new ForbiddenException('Access denied to this conversation');
    }

    const unreadCount = await this.prisma.directMessage.count({
      where: {
        conversationId: conv.id,
        recipientId: currentUserId,
        isRead: false,
      },
    });

    return {
      ...this.formatConversation(conv, currentUserId),
      unreadCount,
    };
  }

  /**
   * Fetches messages in a conversation with chronological ordering
   */
  async getMessages(currentUserId: string, conversationId: string, limit = 50) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      throw new ForbiddenException('Access denied to this conversation');
    }

    const messages = await this.prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: {
          include: { profile: true },
        },
      },
    });

    return messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      recipientId: m.recipientId,
      content: m.content,
      isRead: m.isRead,
      readAt: m.readAt,
      createdAt: m.createdAt,
      sender: {
        id: m.sender.id,
        username: m.sender.profile?.username || 'user',
        fullName: m.sender.profile?.fullName || '',
        avatarUrl: m.sender.profile?.avatarUrl || null,
      },
    }));
  }

  /**
   * Sends a message in a conversation, updating the conversation's timestamp and firing events
   */
  async sendMessage(currentUserId: string, conversationId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException('Message cannot be empty');
    }

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      throw new ForbiddenException('Access denied to this conversation');
    }

    const recipientId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id;

    // Validate recipient and block/privacy status
    await this.assertCanMessage(currentUserId, recipientId);

    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.directMessage.create({
        data: {
          conversationId,
          senderId: currentUserId,
          recipientId,
          content: trimmed,
          isRead: false,
          createdAt: now,
        },
        include: {
          sender: {
            include: { profile: true },
          },
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      }),
    ]);

    const formatted = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
      isRead: message.isRead,
      readAt: message.readAt,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        username: message.sender.profile?.username || 'user',
        fullName: message.sender.profile?.fullName || '',
        avatarUrl: message.sender.profile?.avatarUrl || null,
      },
    };

    // Emit real-time message event
    this.events.emit(EVENTS.DIRECT_MESSAGE_CREATED, {
      message: formatted,
      recipientId,
      senderId: currentUserId,
    });

    return formatted;
  }

  /**
   * Marks unread messages in a conversation received by the current user as read
   */
  async markAsRead(currentUserId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      throw new ForbiddenException('Access denied to this conversation');
    }

    const otherUserId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id;
    const now = new Date();

    const res = await this.prisma.directMessage.updateMany({
      where: {
        conversationId,
        recipientId: currentUserId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    if (res.count > 0) {
      this.events.emit(EVENTS.DIRECT_MESSAGE_READ, {
        conversationId,
        senderId: otherUserId,
        recipientId: currentUserId,
      });
    }

    return { markedCount: res.count };
  }

  /**
   * Total unread messages count across all conversations for current user
   */
  async getUnreadCount(currentUserId: string): Promise<number> {
    return this.prisma.directMessage.count({
      where: {
        recipientId: currentUserId,
        isRead: false,
      },
    });
  }
}
