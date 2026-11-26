import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UserGateway } from '../admin/realtime/user.gateway';
import { EVENTS } from '../common/events/events';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { RequestUploadUrlDto } from './dto/upload-url.dto';
import { ConfirmAttachmentDto } from './dto/confirm-attachment.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30MB

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
    private readonly userGateway: UserGateway,
  ) {}

  /**
   * Asserts whether senderId is allowed to message recipientId based on blocks and privacy.
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
   * Asserts conversation membership and returns the conversation.
   */
  async assertParticipant(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
        participants: true,
      },
    });
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    if (conv.user1Id !== userId && conv.user2Id !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
    return conv;
  }

  /**
   * Formats a conversation row with the other participant's profile, online status, and last message.
   */
  private formatConversation(conv: any, currentUserId: string) {
    const isUser1 = conv.user1Id === currentUserId;
    const otherUser = isUser1 ? conv.user2 : conv.user1;
    const lastMessage = conv.messages && conv.messages.length > 0 ? conv.messages[0] : null;

    // Check online status via UserGateway presence tracker
    const isOnline = this.userGateway.isUserOnline(otherUser.id);

    return {
      id: conv.id,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      participant: {
        id: otherUser.id,
        username: otherUser.profile?.username || 'user',
        fullName: otherUser.profile?.fullName || otherUser.profile?.username || '',
        avatarUrl: otherUser.profile?.avatarUrl || null,
        isOnline,
      },
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            messageType: lastMessage.messageType || 'TEXT',
            senderId: lastMessage.senderId,
            recipientId: lastMessage.recipientId,
            isRead: lastMessage.isRead,
            isEdited: lastMessage.isEdited,
            isDeleted: lastMessage.isDeleted,
            createdAt: lastMessage.createdAt,
          }
        : null,
      unreadCount: conv.unreadCount ?? 0,
    };
  }

  /**
   * Formats a message with signed attachment URLs and delivery receipts.
   */
  private formatMessage(msg: any) {
    const attachments = (msg.attachments || []).map((att: any) => {
      const isImage = att.resourceType === 'image';
      const signedUrl = this.storage.generateSignedDownloadUrl(
        att.cloudinaryPublicId,
        isImage ? 'image' : 'raw',
        7200,
      );
      return {
        id: att.id,
        cloudinaryPublicId: att.cloudinaryPublicId,
        resourceType: att.resourceType,
        deliveryType: att.deliveryType,
        format: att.format,
        mimeType: att.mimeType,
        bytes: att.bytes,
        width: att.width,
        height: att.height,
        originalFilename: att.originalFilename,
        status: att.status,
        url: signedUrl,
      };
    });

    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      content: msg.isDeleted ? '[Message deleted]' : msg.content,
      messageType: msg.messageType || 'TEXT',
      idempotencyKey: msg.idempotencyKey,
      isEdited: msg.isEdited,
      editedAt: msg.editedAt,
      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,
      isRead: msg.isRead,
      readAt: msg.readAt,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      sender: msg.sender?.profile
        ? {
            id: msg.sender.id,
            username: msg.sender.profile.username,
            fullName: msg.sender.profile.fullName || msg.sender.profile.username,
            avatarUrl: msg.sender.profile.avatarUrl,
          }
        : undefined,
      attachments,
      receipts: msg.receipts || [],
    };
  }

  /**
   * 1. Get or create a 1-to-1 conversation (creates Conversation + ConversationParticipant).
   */
  async getOrCreateConversation(currentUserId: string, recipientId: string) {
    await this.assertCanMessage(currentUserId, recipientId);

    const [u1, u2] = this.canonicalPair(currentUserId, recipientId);

    return this.prisma.$transaction(async (tx) => {
      let conv = await tx.conversation.findUnique({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        include: {
          user1: { include: { profile: true } },
          user2: { include: { profile: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!conv) {
        conv = await tx.conversation.create({
          data: {
            user1Id: u1,
            user2Id: u2,
            participants: {
              create: [
                { userId: u1 },
                { userId: u2 },
              ],
            },
          },
          include: {
            user1: { include: { profile: true } },
            user2: { include: { profile: true } },
            messages: true,
          },
        });
      } else {
        // Ensure participant rows exist
        await tx.conversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: conv.id, userId: u1 } },
          create: { conversationId: conv.id, userId: u1 },
          update: {},
        });
        await tx.conversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: conv.id, userId: u2 } },
          create: { conversationId: conv.id, userId: u2 },
          update: {},
        });
      }

      return this.formatConversation(conv, currentUserId);
    });
  }

  /**
   * 2. List all conversations for the authenticated user (Inbox).
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
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Compute unread count per conversation
    const unreadCounts = await this.prisma.directMessage.groupBy({
      by: ['conversationId'],
      where: {
        recipientId: currentUserId,
        isRead: false,
      },
      _count: { id: true },
    });
    const unreadMap = new Map<string, number>();
    for (const uc of unreadCounts) {
      unreadMap.set(uc.conversationId, uc._count.id);
    }

    return convs.map((conv) => {
      const convWithUnread = {
        ...conv,
        unreadCount: unreadMap.get(conv.id) || 0,
      };
      return this.formatConversation(convWithUnread, currentUserId);
    });
  }

  /**
   * 3. Get single conversation details.
   */
  async getConversation(currentUserId: string, conversationId: string) {
    const conv = await this.assertParticipant(currentUserId, conversationId);
    const unreadCount = await this.prisma.directMessage.count({
      where: {
        conversationId,
        recipientId: currentUserId,
        isRead: false,
      },
    });
    return this.formatConversation({ ...conv, unreadCount }, currentUserId);
  }

  /**
   * 4. Get paginated messages in a conversation (cursor-based pagination).
   */
  async getMessages(currentUserId: string, conversationId: string, query: ListMessagesQueryDto) {
    await this.assertParticipant(currentUserId, conversationId);

    const limit = query.limit || 30;
    const cursor = query.cursor;

    const whereClause: any = { conversationId };
    if (cursor) {
      const cursorMsg = await this.prisma.directMessage.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (cursorMsg) {
        whereClause.createdAt = { lt: cursorMsg.createdAt };
      }
    }

    const messages = await this.prisma.directMessage.findMany({
      where: whereClause,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { include: { profile: true } },
        attachments: true,
        receipts: true,
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Return chronological order for UI
    const chronological = items.reverse();

    return {
      messages: chronological.map((m) => this.formatMessage(m)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * 5. Send a direct message (supports idempotency, attachments, transactional persistence, receipts, push).
   */
  async sendMessage(currentUserId: string, conversationId: string, dto: SendMessageDto) {
    const conv = await this.assertParticipant(currentUserId, conversationId);
    const recipientId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id;

    await this.assertCanMessage(currentUserId, recipientId);

    const trimmedContent = (dto.content || '').trim();
    if (!trimmedContent && (!dto.attachmentIds || dto.attachmentIds.length === 0)) {
      throw new BadRequestException('Message content or attachment is required');
    }

    // Idempotency check: if key provided, check if already exists
    if (dto.idempotencyKey) {
      const existing = await this.prisma.directMessage.findUnique({
        where: {
          conversationId_idempotencyKey: {
            conversationId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
        include: {
          sender: { include: { profile: true } },
          attachments: true,
          receipts: true,
        },
      });
      if (existing) {
        return this.formatMessage(existing);
      }
    }

    const recipientOnline = this.userGateway.isUserOnline(recipientId);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create message
      const msg = await tx.directMessage.create({
        data: {
          conversationId,
          senderId: currentUserId,
          recipientId,
          content: trimmedContent || (dto.messageType === 'IMAGE' ? '📷 Image' : '📎 Attachment'),
          messageType: dto.messageType || 'TEXT',
          idempotencyKey: dto.idempotencyKey,
        },
      });

      // 2. Link attachments if provided
      if (dto.attachmentIds && dto.attachmentIds.length > 0) {
        await tx.messageAttachment.updateMany({
          where: {
            id: { in: dto.attachmentIds },
            conversationId,
            uploaderId: currentUserId,
          },
          data: {
            messageId: msg.id,
            status: 'confirmed',
          },
        });
      }

      // 3. Create message receipts
      await tx.messageReceipt.create({
        data: {
          messageId: msg.id,
          userId: currentUserId,
          status: 'SENT',
        },
      });
      if (recipientOnline) {
        await tx.messageReceipt.create({
          data: {
            messageId: msg.id,
            userId: recipientId,
            status: 'DELIVERED',
          },
        });
      }

      // 4. Update conversation activity and participant read state
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });
      await tx.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId, userId: currentUserId } },
        create: { conversationId, userId: currentUserId, lastReadAt: new Date() },
        update: { lastReadAt: new Date() },
      });

      return tx.directMessage.findUniqueOrThrow({
        where: { id: msg.id },
        include: {
          sender: { include: { profile: true } },
          attachments: true,
          receipts: true,
        },
      });
    });

    const formatted = this.formatMessage(result);

    // Emit real-time events
    this.events.emit(EVENTS.DIRECT_MESSAGE_CREATED, {
      message: formatted,
      conversationId,
      recipientId,
      senderId: currentUserId,
    });
    if (recipientOnline) {
      this.events.emit(EVENTS.DIRECT_MESSAGE_DELIVERED, {
        messageId: formatted.id,
        conversationId,
        recipientId,
        senderId: currentUserId,
      });
    }

    // Offline alert / Push Notification (Section 5)
    if (!recipientOnline) {
      try {
        const senderName = formatted.sender?.fullName || formatted.sender?.username || 'Someone';
        const preview = formatted.content.length > 80 ? formatted.content.substring(0, 77) + '...' : formatted.content;
        await this.prisma.notification.create({
          data: {
            userId: recipientId,
            actorId: currentUserId,
            type: 'DIRECT_MESSAGE',
            message: `${senderName}: ${preview}`,
          },
        });
        this.logger.log(`Created offline in-app notification for user ${recipientId}`);
      } catch (notifErr: any) {
        this.logger.warn(`Failed to create offline notification: ${notifErr?.message}`);
      }
    }

    return formatted;
  }

  /**
   * 6. Edit own message (Section 3.2).
   */
  async editMessage(currentUserId: string, messageId: string, dto: EditMessageDto) {
    const msg = await this.prisma.directMessage.findUnique({
      where: { id: messageId },
      include: { attachments: true, sender: { include: { profile: true } }, receipts: true },
    });
    if (!msg) {
      throw new NotFoundException('Message not found');
    }
    if (msg.senderId !== currentUserId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    if (msg.isDeleted) {
      throw new BadRequestException('Cannot edit a deleted message');
    }
    if (msg.messageType !== 'TEXT') {
      throw new BadRequestException('Only text messages can be edited');
    }

    const updated = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: {
        content: dto.content.trim(),
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        sender: { include: { profile: true } },
        attachments: true,
        receipts: true,
      },
    });

    const formatted = this.formatMessage(updated);

    this.events.emit(EVENTS.DIRECT_MESSAGE_EDITED, {
      message: formatted,
      conversationId: msg.conversationId,
      recipientId: msg.recipientId,
      senderId: currentUserId,
    });

    return formatted;
  }

  /**
   * 7. Delete own message (Soft delete, Section 3.2).
   */
  async deleteMessage(currentUserId: string, messageId: string) {
    const msg = await this.prisma.directMessage.findUnique({
      where: { id: messageId },
      include: { attachments: true },
    });
    if (!msg) {
      throw new NotFoundException('Message not found');
    }
    if (msg.senderId !== currentUserId) {
      throw new ForbiddenException('You can only delete your own messages');
    }
    if (msg.isDeleted) {
      return { success: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.directMessage.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          content: '[Message deleted]',
        },
      });

      // Soft delete attachments
      if (msg.attachments && msg.attachments.length > 0) {
        await tx.messageAttachment.updateMany({
          where: { messageId },
          data: {
            status: 'deleted',
            deletedAt: new Date(),
          },
        });
      }
    });

    this.events.emit(EVENTS.DIRECT_MESSAGE_DELETED, {
      messageId,
      conversationId: msg.conversationId,
      recipientId: msg.recipientId,
      senderId: currentUserId,
    });

    return { success: true, messageId };
  }

  /**
   * 8. Mark all unread messages in a conversation as read.
   */
  async markAsRead(currentUserId: string, conversationId: string) {
    const conv = await this.assertParticipant(currentUserId, conversationId);
    const senderId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Mark unread messages read
      await tx.directMessage.updateMany({
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

      // 2. Update participant lastReadAt
      await tx.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId, userId: currentUserId } },
        create: { conversationId, userId: currentUserId, lastReadAt: now },
        update: { lastReadAt: now },
      });
    });

    this.events.emit(EVENTS.DIRECT_MESSAGE_READ, {
      conversationId,
      senderId,
      recipientId: currentUserId,
      readAt: now,
    });

    return { success: true, readAt: now };
  }

  /**
   * 9. Get total unread count for current user.
   */
  async getUnreadCount(currentUserId: string): Promise<number> {
    return this.prisma.directMessage.count({
      where: {
        recipientId: currentUserId,
        isRead: false,
      },
    });
  }

  /**
   * 10. Request Cloudinary signed direct upload payload (Section 4.2).
   */
  async requestUploadUrl(currentUserId: string, dto: RequestUploadUrlDto) {
    await this.assertParticipant(currentUserId, dto.conversationId);

    const mime = (dto.mimeType || '').toLowerCase();
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(mime)) {
      throw new BadRequestException(
        `Invalid file type "${dto.mimeType}". Allowed types: JPEG, PNG, WebP, PDF, TXT, DOCX`,
      );
    }

    const isImage = mime.startsWith('image/');
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
    if (dto.bytes > maxBytes) {
      throw new BadRequestException(
        `File size exceeds limit of ${Math.round(maxBytes / (1024 * 1024))} MB`,
      );
    }

    const uniqueAssetId = randomUUID();
    const folder = `messages/${dto.conversationId}`;
    const resourceType: 'image' | 'raw' = isImage ? 'image' : 'raw';

    const signedPayload = this.storage.generateSignedUploadPayload(
      folder,
      uniqueAssetId,
      resourceType,
    );

    // Persist pending attachment record
    const attachment = await this.prisma.messageAttachment.create({
      data: {
        conversationId: dto.conversationId,
        uploaderId: currentUserId,
        cloudinaryPublicId: `${signedPayload.folder}/${uniqueAssetId}`,
        resourceType,
        deliveryType: 'authenticated',
        mimeType: mime,
        originalFilename: dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_'),
        bytes: dto.bytes,
        status: 'pending',
      },
    });

    return {
      ...signedPayload,
      publicId: uniqueAssetId,
      attachmentId: attachment.id,
    };
  }

  /**
   * 11. Confirm Cloudinary upload (Section 4.2).
   */
  async confirmAttachment(currentUserId: string, dto: ConfirmAttachmentDto) {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: dto.attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    if (attachment.uploaderId !== currentUserId) {
      throw new ForbiddenException('You can only confirm your own attachments');
    }
    if (
      attachment.cloudinaryPublicId !== dto.cloudinaryPublicId &&
      !attachment.cloudinaryPublicId.endsWith(dto.cloudinaryPublicId)
    ) {
      throw new BadRequestException('Public ID does not match attachment record');
    }

    // Verify asset with Cloudinary
    const verified = await this.storage.verifyCloudinaryAsset(
      attachment.cloudinaryPublicId,
      attachment.resourceType as 'image' | 'raw',
    );

    const updated = await this.prisma.messageAttachment.update({
      where: { id: dto.attachmentId },
      data: {
        status: 'confirmed',
        bytes: verified?.bytes || attachment.bytes,
        format: verified?.format,
        width: verified?.width,
        height: verified?.height,
      },
    });

    const signedUrl = this.storage.generateSignedDownloadUrl(
      updated.cloudinaryPublicId,
      updated.resourceType as 'image' | 'raw',
      7200,
    );

    return {
      ...updated,
      url: signedUrl,
    };
  }

  /**
   * 12. Scheduled orphan attachment cleanup (Section 4.7).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOrphanedAttachments() {
    this.logger.log('Running scheduled orphan attachment cleanup job...');
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const staleAttachments = await this.prisma.messageAttachment.findMany({
      where: {
        createdAt: { lt: dayAgo },
        OR: [
          { status: 'pending' },
          { status: 'confirmed', messageId: null },
        ],
      },
    });

    for (const att of staleAttachments) {
      try {
        await this.storage.safeDelete(
          att.cloudinaryPublicId,
          att.resourceType as 'image' | 'raw',
        );
        await this.prisma.messageAttachment.update({
          where: { id: att.id },
          data: {
            status: 'orphaned',
            deletedAt: new Date(),
          },
        });
        this.logger.log(`Cleaned up orphaned attachment: ${att.id} (${att.cloudinaryPublicId})`);
      } catch (err: any) {
        this.logger.warn(`Failed to clean up attachment ${att.id}: ${err?.message}`);
      }
    }
  }
}
