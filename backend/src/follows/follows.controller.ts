import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ProfileResponseDto } from '../users/users.mapper';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';

@ApiTags('Follows')
@ApiBearerAuth('access-token')
@Controller('users/:id')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Post('follow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 200, description: 'Follow status updated' })
  @ApiResponse({ status: 400, description: 'Cannot follow yourself or invalid UUID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  follow(
    @CurrentUser('id') me: string,
    @Param('id') targetId: string,
  ) {
    return this.follows.follow(me, targetId);
  }

  @Delete('follow')
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 200, description: 'Unfollowed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot unfollow yourself or invalid UUID' })
  unfollow(
    @CurrentUser('id') me: string,
    @Param('id') targetId: string,
  ) {
    return this.follows.unfollow(me, targetId);
  }

  @Get('follow-status')
  @ApiOperation({ summary: 'Check mutual follow status between current user and target user' })
  @ApiResponse({
    status: 200,
    schema: {
      properties: {
        isFollowing: { type: 'boolean', example: true },
        isFollowedBy: { type: 'boolean', example: false },
      },
    },
  })
  getFollowStatus(
    @CurrentUser('id') me: string,
    @Param('id') targetId: string,
  ) {
    return this.follows.getFollowStatus(me, targetId);
  }

  @Get('followers')
  @ApiOperation({ summary: "Get a user's followers list" })
  @ApiPaginatedResponse(ProfileResponseDto)
  getFollowers(
    @Param('id') targetId: string,
    @Query() q: PaginationQueryDto,
  ) {
    return this.follows.getFollowers(targetId, q.limit, q.cursor);
  }

  @Get('following')
  @ApiOperation({ summary: 'Get list of users this user follows' })
  @ApiPaginatedResponse(ProfileResponseDto)
  getFollowing(
    @Param('id') targetId: string,
    @Query() q: PaginationQueryDto,
  ) {
    return this.follows.getFollowing(targetId, q.limit, q.cursor);
  }
}
