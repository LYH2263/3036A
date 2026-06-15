import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TimeLimitModeDto {
  PER_QUESTION = 'per_question',
  PER_QUIZ = 'per_quiz'
}

class AttemptAnswerDto {
  @IsUUID('4', { message: '题目 ID 格式不正确' })
  questionId!: string;

  @IsString({ message: '答案格式不正确' })
  answer!: string;

  @IsOptional()
  @IsBoolean({ message: '是否超时格式不正确' })
  timedOut?: boolean;

  @IsOptional()
  @IsInt({ message: '用时格式不正确' })
  @Min(0, { message: '用时不能为负数' })
  timeTakenMs?: number;
}

export class SubmitAttemptDto {
  @IsArray({ message: '答案列表格式不正确' })
  @ArrayMinSize(1, { message: '答案列表不能为空' })
  @ValidateNested({ each: true })
  @Type(() => AttemptAnswerDto)
  answers!: AttemptAnswerDto[];

  @IsOptional()
  @IsString({ message: '客户端事件 ID 格式不正确' })
  @MaxLength(120, { message: '客户端事件 ID 长度不能超过 120' })
  clientEventId?: string;

  @IsOptional()
  @IsBoolean({ message: '是否限时模式格式不正确' })
  isTimedMode?: boolean;

  @IsOptional()
  @IsEnum(TimeLimitModeDto, { message: '限时模式类型不正确' })
  timeLimitMode?: TimeLimitModeDto;

  @IsOptional()
  @IsInt({ message: '限时秒数格式不正确' })
  @Min(5, { message: '限时最少 5 秒' })
  @Max(3600, { message: '限时最多 3600 秒' })
  timeLimitSec?: number;

  @IsOptional()
  @IsInt({ message: '总用时格式不正确' })
  @Min(0, { message: '总用时不能为负数' })
  timeTakenMs?: number;
}
