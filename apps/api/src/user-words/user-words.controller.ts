import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, CurrentUserPayload } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

import { CreateUserWordDto } from './create-user-word.dto';
import { GetUserWordsQueryDto } from './get-user-words-query.dto';
import { ReviewUserWordDto } from './review-user-word.dto';
import { UserWordsService } from './user-words.service';

@UseGuards(JwtAuthGuard)
@Controller('user-words')
export class UserWordsController {
  constructor(private readonly userWordsService: UserWordsService) {}

  @Post()
  addWord(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateUserWordDto) {
    return this.userWordsService.addUserWord(user.sub, dto);
  }

  @Get()
  getUserWords(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: GetUserWordsQueryDto
  ) {
    return this.userWordsService.getUserWords(user.sub, query);
  }

  @Get('reviews/today')
  getTodayReviews(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: GetUserWordsQueryDto
  ) {
    return this.userWordsService.getTodayReviews(user.sub, query);
  }

  @Post(':id/review')
  review(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') progressId: string,
    @Body() dto: ReviewUserWordDto
  ) {
    return this.userWordsService.review(user.sub, progressId, dto);
  }
}
