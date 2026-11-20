import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class SearchUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search term for username or full name' })
  @IsOptional()
  @IsString()
  search?: string;
}
