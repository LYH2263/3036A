import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewUserWordDto {
  @IsBoolean({ message: '复习结果格式不正确' })
  known!: boolean;

  @IsOptional()
  @IsString({ message: '客户端事件 ID 格式不正确' })
  @MaxLength(120, { message: '客户端事件 ID 长度不能超过 120' })
  clientEventId?: string;
}
