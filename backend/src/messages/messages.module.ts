import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminModule } from '../admin/admin.module';
import { MessagesController } from './messages.controller';
import { ConversationsController } from './conversations.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [PrismaModule, AdminModule],
  controllers: [MessagesController, ConversationsController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
