import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWordGroupDto {
  @IsString({ message: '分组名称格式不正确' })
  @MinLength(1, { message: '分组名称不能为空' })
  @MaxLength(50, { message: '分组名称长度不能超过 50' })
  name!: string;

  @IsOptional()
  @IsHexColor({ message: '分组颜色格式不正确' })
  color?: string;
}
