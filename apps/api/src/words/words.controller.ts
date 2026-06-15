import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../common/jwt-auth.guard';

import { GetWordsQueryDto } from './get-words-query.dto';
import { WordsService } from './words.service';

@UseGuards(JwtAuthGuard)
@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  getWords(@Query() query: GetWordsQueryDto) {
    return this.wordsService.searchWords(query);
  }
}
