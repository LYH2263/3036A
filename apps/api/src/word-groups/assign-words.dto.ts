import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AssignWordsDto {
  @IsArray({ message: '单词进度 ID 列表格式不正确' })
  @ArrayNotEmpty({ message: '单词进度 ID 列表不能为空' })
  @IsUUID('4', { each: true, message: '单词进度 ID 格式不正确' })
  progressIds!: string[];
}
