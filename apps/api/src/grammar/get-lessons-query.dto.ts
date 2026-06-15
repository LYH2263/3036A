import { IsIn, IsOptional } from 'class-validator';

export class GetLessonsQueryDto {
  @IsOptional()
  @IsIn(['basic', 'intermediate', 'advanced'], {
    message: '级别参数无效，仅支持 basic、intermediate、advanced'
  })
  level?: 'basic' | 'intermediate' | 'advanced';
}
