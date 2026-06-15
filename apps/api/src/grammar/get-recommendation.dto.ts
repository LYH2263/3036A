import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetRecommendationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '题目数量必须为整数' })
  @Min(1, { message: '题目数量至少为 1' })
  @Max(30, { message: '题目数量最多为 30' })
  questionCount?: number;
}
