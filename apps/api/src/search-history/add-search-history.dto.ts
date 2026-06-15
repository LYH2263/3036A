import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddSearchHistoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  query: string;
}
