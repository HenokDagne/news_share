import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { MAX_POST_IMAGE_BYTES } from '../common/constants/upload.constants';

@ApiTags('Posts')
@ApiBearerAuth('access-token')
@Controller()
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post('posts')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_POST_IMAGE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new post (title, content, or image)' })
  @ApiResponse({ status: 201, type: PostResponseDto })
  @ApiResponse({ status: 400, description: 'Empty post or invalid file' })
  @ApiResponse({ status: 413, description: 'File exceeds 5 MB limit' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePostDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.posts.create(userId, dto, image);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Personal feed: posts from followed users + own' })
  @ApiPaginatedResponse(PostResponseDto)
  feed(
    @CurrentUser('id') userId: string,
    @Query() q: PaginationQueryDto,
  ) {
    return this.posts.feed(userId, q.limit, q.cursor);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Global timeline, newest first' })
  @ApiPaginatedResponse(PostResponseDto)
  timeline(
    @CurrentUser('id') userId: string | undefined,
    @Query() q: PaginationQueryDto,
  ) {
    return this.posts.timeline(userId, q.limit, q.cursor);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  findOne(
    @CurrentUser('id') userId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.posts.findOne(id, userId);
  }

  @Get('users/:id/posts')
  @ApiOperation({ summary: 'Get posts by a specific user' })
  @ApiPaginatedResponse(PostResponseDto)
  userPosts(
    @CurrentUser('id') currentUserId: string | undefined,
    @Param('id') id: string,
    @Query() q: PaginationQueryDto,
  ) {
    return this.posts.userPosts(id, currentUserId, q.limit, q.cursor);
  }

  @Patch('posts/:id')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_POST_IMAGE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a post (author only)' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @ApiResponse({ status: 400, description: 'Empty post or bad file' })
  @ApiResponse({ status: 403, description: 'Forbidden: not your post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.posts.update(userId, id, dto, image);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post (author only)' })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden: not your post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.posts.remove(userId, id);
  }

  // ===================== LIKE / UNLIKE =====================

  @Post('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like a post' })
  @ApiResponse({ status: 200, description: 'Post liked' })
  like(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.posts.like(userId, id);
  }

  @Delete('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike a post' })
  @ApiResponse({ status: 200, description: 'Post unliked' })
  unlike(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.posts.unlike(userId, id);
  }

  // ===================== COMMENTS =====================

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'List comments for a post' })
  @ApiPaginatedResponse(CommentResponseDto)
  getComments(
    @Param('id') id: string,
    @Query() q: PaginationQueryDto,
  ) {
    return this.posts.getComments(id, q.limit, q.cursor);
  }

  @Post('posts/:id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiResponse({ status: 201, type: CommentResponseDto })
  addComment(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.posts.addComment(userId, id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a comment (author only)' })
  @ApiResponse({ status: 200, description: 'Comment deleted' })
  deleteComment(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.posts.deleteComment(userId, id);
  }
}
