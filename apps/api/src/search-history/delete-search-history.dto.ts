import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteSearchHistoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}
