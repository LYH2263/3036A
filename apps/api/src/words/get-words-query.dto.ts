import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GetWordsQueryDto {
  @IsOptional()
  @IsString({ message: '查询词格式不正确' })
  @MaxLength(40, { message: '查询词长度不能超过 40' })
  q?: string;
}
