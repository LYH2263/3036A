import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const MAX_CONTENT_LENGTH = 5000;

export class UpsertWordNoteDto {
  @IsString({ message: '笔记内容格式不正确' })
  @MaxLength(MAX_CONTENT_LENGTH, { message: `笔记内容不能超过 ${MAX_CONTENT_LENGTH} 字` })
  content!: string;

  @IsOptional()
  @IsInt({ message: '版本号格式不正确' })
  @Min(1, { message: '版本号必须大于 0' })
  expectedVersion?: number;

  @IsOptional()
  @IsString({ message: '客户端事件 ID 格式不正确' })
  clientEventId?: string;
}
