import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReviewRating } from '@prisma/client';

export class ReviewUserWordDto {
  @IsOptional()
  @IsBoolean({ message: '复习结果格式不正确' })
  known?: boolean;

  @IsOptional()
  @IsEnum(ReviewRating, {
    message: '复习等级格式不正确，有效值：completely_forgot、fuzzy、recognized、mastered'
  })
  rating?: ReviewRating;

  @IsOptional()
  @IsString({ message: '客户端事件 ID 格式不正确' })
  @MaxLength(120, { message: '客户端事件 ID 长度不能超过 120' })
  clientEventId?: string;
}
