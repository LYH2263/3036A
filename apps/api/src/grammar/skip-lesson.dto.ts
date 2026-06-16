import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SkipLessonDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}
