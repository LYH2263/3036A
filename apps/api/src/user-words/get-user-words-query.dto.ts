import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class GetUserWordsQueryDto {
  @IsOptional()
  @IsUUID('4', { message: '分组 ID 格式不正确' })
  groupId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0' || lower === '') return false;
    }
    return false;
  })
  @IsBoolean({ message: '仅未分组参数格式不正确' })
  ungroupedOnly?: boolean;
}
