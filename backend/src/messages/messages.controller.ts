import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { RequestUploadUrlDto } from './dto/upload-url.dto';
import { ConfirmAttachmentDto } from './dto/confirm-attachment.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';

@ApiTags('Direct Messages')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // ================= 3.1 CONVERSATION APIS =================
  @Post('conversations')
  @ApiOperation({ summary: 'Create or retrieve a 1-to-1 conversation' })
  createConversation(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.getOrCreateConversation(userId, dto.recipientId);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Retrieve inbox conversations' })
  listConversations(@CurrentUser('id') userId: string) {
    return this.messagesService.listConversations(userId);
  }

  @Get('conversations/unread-count')
  @ApiOperation({ summary: 'Get total unread direct message count' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.messagesService.getUnreadCount(userId);
    return { count };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Retrieve conversation details' })
  getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.getConversation(userId, conversationId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Paginated message history' })
  getMessages(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagesService.getMessages(userId, conversationId, query);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message' })
  sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(userId, conversationId, dto);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.markAsRead(userId, conversationId);
  }

  // ================= 3.2 MESSAGE EDIT & DELETE APIS =================
  @Patch(':id')
  @ApiOperation({ summary: 'Edit own message' })
  editMessage(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(userId, messageId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete own message (soft delete)' })
  deleteMessage(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
  ) {
    return this.messagesService.deleteMessage(userId, messageId);
  }

  // ================= 3.3 ATTACHMENT APIS =================
  @Post('attachments/upload-url')
  @ApiOperation({ summary: 'Request signed Cloudinary direct upload payload' })
  requestUploadUrl(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestUploadUrlDto,
  ) {
    return this.messagesService.requestUploadUrl(userId, dto);
  }

  @Post('attachments/confirm')
  @ApiOperation({ summary: 'Verify and confirm Cloudinary upload' })
  confirmAttachment(
    @CurrentUser('id') userId: string,
    @Body() dto: ConfirmAttachmentDto,
  ) {
    return this.messagesService.confirmAttachment(userId, dto);
  }
}
