import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

class RetryAnswerDto {
  @IsUUID('4', { message: '题目 ID 格式不正确' })
  mistakeId!: string;

  @IsString({ message: '答案格式不正确' })
  answer!: string;
}

export class RetryMistakesDto {
  @IsArray({ message: '答案列表格式不正确' })
  @ArrayMinSize(1, { message: '答案列表不能为空' })
  @ValidateNested({ each: true })
  @Type(() => RetryAnswerDto)
  answers!: RetryAnswerDto[];

  @IsOptional()
  @IsString({ message: '客户端事件 ID 格式不正确' })
  @MaxLength(120, { message: '客户端事件 ID 长度不能超过 120' })
  clientEventId?: string;
}
