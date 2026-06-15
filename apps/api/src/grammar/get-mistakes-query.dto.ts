import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { GrammarLevel } from '@prisma/client';

export class GetMistakesQueryDto {
  @IsOptional()
  @IsEnum(GrammarLevel, { message: '难度级别格式不正确' })
  level?: GrammarLevel;

  @IsOptional()
  @IsUUID('4', { message: '知识点 ID 格式不正确' })
  lessonId?: string;

  @IsOptional()
  @IsString({ message: '排序字段格式不正确' })
  sortBy?: 'errorCount' | 'lastAttemptAt';
}
