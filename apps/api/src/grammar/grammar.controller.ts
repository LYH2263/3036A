import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, CurrentUserPayload } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

import { GetLessonsQueryDto } from './get-lessons-query.dto';
import { GrammarService } from './grammar.service';
import { SubmitAttemptDto } from './submit-attempt.dto';

@UseGuards(JwtAuthGuard)
@Controller('grammar/lessons')
export class GrammarController {
  constructor(private readonly grammarService: GrammarService) {}

  @Get()
  getLessons(@Query() query: GetLessonsQueryDto) {
    return this.grammarService.getLessons(query);
  }

  @Get(':id')
  getLesson(@Param('id') lessonId: string) {
    return this.grammarService.getLessonDetail(lessonId);
  }

  @Post(':id/attempts')
  submitAttempt(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') lessonId: string,
    @Body() dto: SubmitAttemptDto
  ) {
    return this.grammarService.submitAttempt(user.sub, lessonId, dto);
  }
}
