import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString({ message: '密码格式不正确' })
  @MinLength(6, { message: '密码长度至少为 6 位' })
  password!: string;
}
