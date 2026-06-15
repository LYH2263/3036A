import { IsUUID } from 'class-validator';

export class CreateUserWordDto {
  @IsUUID('4', { message: '词条 ID 格式不正确' })
  wordEntryId!: string;
}
