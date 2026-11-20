import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PreferencesService } from './preferences.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Preferences')
@ApiBearerAuth('JWT')
@Controller()
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Post('posts/:id/not-interested')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark post as Not Interested (hides from recommendations & feeds)' })
  @ApiResponse({ status: 204, description: 'Post hidden from feed' })
  @ApiResponse({ status: 400, description: 'Cannot mark own post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async notInterested(
    @CurrentUser('id') me: string,
    @Param('id', ParseUUIDPipe) postId: string,
  ): Promise<void> {
    await this.preferencesService.markNotInterested(me, postId);
  }

  @Delete('posts/:id/not-interested')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Undo Not Interested preference' })
  @ApiResponse({ status: 204, description: 'Preference removed' })
  async removeNotInterested(
    @CurrentUser('id') me: string,
    @Param('id', ParseUUIDPipe) postId: string,
  ): Promise<void> {
    await this.preferencesService.removeNotInterested(me, postId);
  }

  @Post('posts/:id/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Save/bookmark a post' })
  @ApiResponse({ status: 204, description: 'Post saved' })
  async savePost(
    @CurrentUser('id') me: string,
    @Param('id', ParseUUIDPipe) postId: string,
  ): Promise<void> {
    await this.preferencesService.savePost(me, postId);
  }

  @Delete('posts/:id/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a post from saved bookmarks' })
  @ApiResponse({ status: 204, description: 'Post unsaved' })
  async unsavePost(
    @CurrentUser('id') me: string,
    @Param('id', ParseUUIDPipe) postId: string,
  ): Promise<void> {
    await this.preferencesService.unsavePost(me, postId);
  }

  @Get('me/saved')
  @ApiOperation({ summary: 'Get current user saved posts' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of saved posts' })
  getSaved(
    @CurrentUser('id') me: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.preferencesService.getSavedPosts(me, limit ? Number(limit) : 20, cursor);
  }
}
