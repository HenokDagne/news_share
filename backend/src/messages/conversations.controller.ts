import {
  Body,
  Controller,
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
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';

@ApiTags('Direct Messages (Conversations Alias)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create or retrieve a 1-to-1 conversation' })
  createConversation(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.getOrCreateConversation(userId, dto.recipientId);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve inbox conversations' })
  listConversations(@CurrentUser('id') userId: string) {
    return this.messagesService.listConversations(userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread direct message count' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.messagesService.getUnreadCount(userId);
    return { count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve conversation details' })
  getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.getConversation(userId, conversationId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Paginated message history' })
  getMessages(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagesService.getMessages(userId, conversationId, query);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message' })
  sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(userId, conversationId, dto);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  markAsReadPost(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.markAsRead(userId, conversationId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark messages as read (PATCH alias)' })
  markAsReadPatch(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.markAsRead(userId, conversationId);
  }
}
