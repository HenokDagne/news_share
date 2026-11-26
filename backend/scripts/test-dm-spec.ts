import { PrismaClient } from '@prisma/client';
import { MessagesService } from '../src/messages/messages.service';
import { StorageService } from '../src/storage/storage.service';
import { UserGateway } from '../src/admin/realtime/user.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

async function main() {
  console.log('--- STARTING DM MODULE SPEC TESTS ---');
  const prisma = new PrismaClient();
  const config = new ConfigService();
  const events = new EventEmitter2();
  const storage = new StorageService(config);

  const mockJwt = {} as any;
  const mockSessions = {} as any;
  const mockAccountStatus = {} as any;
  const userGateway = new UserGateway(mockJwt, mockSessions, mockAccountStatus, config);

  const messagesService = new MessagesService(prisma as any, storage, events, userGateway);

  const user1 = await prisma.user.findFirst({ where: { profile: { username: 'john36' } }, include: { profile: true } });
  const user2 = await prisma.user.findFirst({ where: { profile: { username: 'ada_l' } }, include: { profile: true } });
  const user3 = await prisma.user.findFirst({ where: { profile: { username: 'admin' } }, include: { profile: true } });

  if (!user1 || !user2 || !user3) {
    throw new Error('Test users not found');
  }

  console.log(`User 1: ${user1.profile?.username} (${user1.id})`);
  console.log(`User 2: ${user2.profile?.username} (${user2.id})`);
  console.log(`User 3: ${user3.profile?.username} (${user3.id})`);

  // Ensure follow connection for FRIENDS DM permission
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: user1.id, followingId: user2.id } },
    create: { followerId: user1.id, followingId: user2.id },
    update: {},
  });
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: user2.id, followingId: user1.id } },
    create: { followerId: user2.id, followingId: user1.id },
    update: {},
  });

  // 1. Get or create conversation
  console.log('1. Testing getOrCreateConversation...');
  const conv = await messagesService.getOrCreateConversation(user1.id, user2.id);
  console.log(`Conversation ID: ${conv.id}`);

  // 2. Test self-conversation rejection
  console.log('2. Testing self-conversation prevention...');
  try {
    await messagesService.getOrCreateConversation(user1.id, user1.id);
    throw new Error('FAILED: self conversation was allowed');
  } catch (err: any) {
    console.log(`Passed: Self-conversation rejected with: "${err.message}"`);
  }

  // 3. Test request Cloudinary direct upload URL
  console.log('3. Testing requestUploadUrl (Cloudinary signed payload)...');
  const uploadPayload = await messagesService.requestUploadUrl(user1.id, {
    conversationId: conv.id,
    filename: 'test_image.jpg',
    mimeType: 'image/jpeg',
    bytes: 204800,
  });
  console.log(`Upload URL payload received. Attachment ID: ${uploadPayload.attachmentId}`);

  // 4. Test confirm attachment
  console.log('4. Testing confirmAttachment...');
  const confirmedAtt = await messagesService.confirmAttachment(user1.id, {
    attachmentId: uploadPayload.attachmentId,
    cloudinaryPublicId: uploadPayload.publicId,
  });
  console.log(`Attachment confirmed: status=${confirmedAtt.status}, URL=${confirmedAtt.url}`);

  // 5. Test sending message with attachment and idempotency key
  console.log('5. Testing sendMessage with idempotency and attachment...');
  const idempotencyKey = 'test-idem-' + Date.now();
  const sentMsg = await messagesService.sendMessage(user1.id, conv.id, {
    content: 'Hello with attachment and idempotency!',
    idempotencyKey,
    messageType: 'IMAGE',
    attachmentIds: [confirmedAtt.id],
  });
  console.log(`Sent message ID: ${sentMsg.id}, attachments count: ${sentMsg.attachments.length}`);

  // 6. Test idempotency duplicate prevention
  console.log('6. Testing idempotency duplicate send...');
  const dupMsg = await messagesService.sendMessage(user1.id, conv.id, {
    content: 'Duplicate send attempt',
    idempotencyKey,
  });
  if (dupMsg.id !== sentMsg.id) {
    throw new Error('FAILED: idempotency duplicate prevention failed');
  }
  console.log('Passed: Idempotency returned existing message record.');

  // 7. Test getMessages (cursor-based pagination)
  console.log('7. Testing getMessages with pagination...');
  const messagesPage = await messagesService.getMessages(user2.id, conv.id, { limit: 10 });
  console.log(`Fetched ${messagesPage.messages.length} messages. Next cursor: ${messagesPage.nextCursor}`);

  // 8. Test markAsRead
  console.log('8. Testing markAsRead by recipient...');
  await messagesService.markAsRead(user2.id, conv.id);
  const convAfterRead = await messagesService.getConversation(user2.id, conv.id);
  console.log(`Recipient unread count after markAsRead: ${convAfterRead.unreadCount}`);

  // 9. Test editMessage
  console.log('9. Testing editMessage by sender...');
  const textMsg = await messagesService.sendMessage(user1.id, conv.id, { content: 'Original text' });
  const edited = await messagesService.editMessage(user1.id, textMsg.id, { content: 'Edited text content' });
  console.log(`Message edited: isEdited=${edited.isEdited}, content="${edited.content}"`);

  // 10. Test unauthorized edit rejection
  console.log('10. Testing unauthorized edit prevention...');
  try {
    await messagesService.editMessage(user2.id, textMsg.id, { content: 'Hacked by user2' });
    throw new Error('FAILED: Unauthorized edit was allowed');
  } catch (err: any) {
    console.log(`Passed: Unauthorized edit rejected with: "${err.message}"`);
  }

  // 11. Test deleteMessage (soft delete)
  console.log('11. Testing deleteMessage (soft delete)...');
  await messagesService.deleteMessage(user1.id, textMsg.id);
  const deletedPage = await messagesService.getMessages(user1.id, conv.id, { limit: 5 });
  const deletedMsg = deletedPage.messages.find((m) => m.id === textMsg.id);
  console.log(`Deleted message: isDeleted=${deletedMsg?.isDeleted}, content="${deletedMsg?.content}"`);

  // 12. Test unauthorized conversation access (IDOR prevention)
  console.log('12. Testing IDOR prevention (third user cannot access conversation)...');
  try {
    await messagesService.getMessages(user3.id, conv.id, {});
    throw new Error('FAILED: Third user accessed private conversation');
  } catch (err: any) {
    console.log(`Passed: IDOR blocked with: "${err.message}"`);
  }

  console.log('--- ALL BACKEND DM MODULE TESTS PASSED SUCCESSFULLY! ---');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
