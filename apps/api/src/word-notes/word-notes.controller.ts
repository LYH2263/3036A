import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';

import { CurrentUser, CurrentUserPayload } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

import { UpsertWordNoteDto } from './upsert-word-note.dto';
import { WordNotesService } from './word-notes.service';

@UseGuards(JwtAuthGuard)
@Controller('word-notes')
export class WordNotesController {
  constructor(private readonly wordNotesService: WordNotesService) {}

  @Get('progress/:progressId')
  getNoteByProgressId(
    @CurrentUser() user: CurrentUserPayload,
    @Param('progressId') progressId: string
  ) {
    return this.wordNotesService.getNoteByProgressId(user.sub, progressId);
  }

  @Get()
  getNotes(@CurrentUser() user: CurrentUserPayload) {
    return this.wordNotesService.getNotesByUser(user.sub);
  }

  @Put('progress/:progressId')
  upsertNote(
    @CurrentUser() user: CurrentUserPayload,
    @Param('progressId') progressId: string,
    @Body() dto: UpsertWordNoteDto
  ) {
    return this.wordNotesService.upsertNote(user.sub, progressId, dto);
  }

  @Delete('progress/:progressId')
  deleteNote(
    @CurrentUser() user: CurrentUserPayload,
    @Param('progressId') progressId: string
  ) {
    return this.wordNotesService.deleteNote(user.sub, progressId);
  }
}
