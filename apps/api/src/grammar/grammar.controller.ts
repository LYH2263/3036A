import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, CurrentUserPayload } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

import { GetLessonsQueryDto } from './get-lessons-query.dto';
import { GetMistakesQueryDto } from './get-mistakes-query.dto';
import { GrammarService } from './grammar.service';
import { RetryMistakesDto } from './retry-mistakes.dto';
import { SubmitAttemptDto } from './submit-attempt.dto';

@UseGuards(JwtAuthGuard)
@Controller('grammar')
export class GrammarController {
  constructor(private readonly grammarService: GrammarService) {}

  @Get('lessons')
  getLessons(@Query() query: GetLessonsQueryDto) {
    return this.grammarService.getLessons(query);
  }

  @Get('lessons/:id')
  getLesson(@Param('id') lessonId: string) {
    return this.grammarService.getLessonDetail(lessonId);
  }

  @Post('lessons/:id/attempts')
  submitAttempt(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') lessonId: string,
    @Body() dto: SubmitAttemptDto
  ) {
    return this.grammarService.submitAttempt(user.sub, lessonId, dto);
  }

  @Get('mistakes')
  getMistakes(@CurrentUser() user: CurrentUserPayload, @Query() query: GetMistakesQueryDto) {
    return this.grammarService.getMistakes(user.sub, query);
  }

  @Get('mistakes/lessons')
  getMistakeLessons(@CurrentUser() user: CurrentUserPayload) {
    return this.grammarService.getMistakeLessons(user.sub);
  }

  @Post('mistakes/retry')
  retryMistakes(@CurrentUser() user: CurrentUserPayload, @Body() dto: RetryMistakesDto) {
    return this.grammarService.retryMistakes(user.sub, dto);
  }
}
