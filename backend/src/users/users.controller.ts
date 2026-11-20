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
  Put,
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
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { MeResponseDto, ProfileResponseDto } from './users.mapper';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { MAX_AVATAR_BYTES } from '../common/constants/upload.constants';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile (includes email)' })
  @ApiResponse({ status: 200, type: MeResponseDto })
  getMe(@CurrentUser('id') userId: string) {
    return this.users.getMe(userId);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change account password with verification of current password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'New password violates policy or identical to current' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, user.sid, dto);
  }

  @Get('me/sessions')
  @ApiOperation({ summary: 'List all active sessions for current user' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.list(user.id, user.sid);
  }

  @Delete('me/sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    await this.sessions.revoke(sessionId, 'USER_REVOKED');
    return { message: 'Session revoked successfully' };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Username already in use' })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(userId, dto);
  }

  @Put('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or replace avatar image (JPEG, PNG, WebP, max 2 MB)' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or missing file' })
  @ApiResponse({ status: 413, description: 'File too large' })
  uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.users.uploadAvatar(userId, file);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current user avatar' })
  @ApiResponse({ status: 204, description: 'Avatar deleted successfully' })
  deleteAvatar(@CurrentUser('id') userId: string) {
    return this.users.deleteAvatar(userId);
  }

  @Get('users')
  @ApiOperation({ summary: 'Search user profiles' })
  @ApiPaginatedResponse(ProfileResponseDto)
  searchUsers(
    @CurrentUser('id') userId: string,
    @Query() dto: SearchUsersDto,
  ) {
    return this.users.searchUsers(dto, userId);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get a user profile by ID (without email)' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(@Param('id') id: string) {
    return this.users.getProfileById(id);
  }
}
