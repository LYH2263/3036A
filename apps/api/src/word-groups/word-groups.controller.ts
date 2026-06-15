import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';

import { CurrentUser, CurrentUserPayload } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

import { AssignWordsDto } from './assign-words.dto';
import { CreateWordGroupDto } from './create-word-group.dto';
import { UpdateWordGroupDto } from './update-word-group.dto';
import { WordGroupsService } from './word-groups.service';

@UseGuards(JwtAuthGuard)
@Controller('word-groups')
export class WordGroupsController {
  constructor(private readonly wordGroupsService: WordGroupsService) {}

  @Post()
  createGroup(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWordGroupDto
  ) {
    return this.wordGroupsService.createGroup(user.sub, dto);
  }

  @Get()
  getGroups(@CurrentUser() user: CurrentUserPayload) {
    return this.wordGroupsService.getGroups(user.sub);
  }

  @Get(':id')
  getGroupById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') groupId: string
  ) {
    return this.wordGroupsService.getGroupById(user.sub, groupId);
  }

  @Patch(':id')
  updateGroup(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') groupId: string,
    @Body() dto: UpdateWordGroupDto
  ) {
    return this.wordGroupsService.updateGroup(user.sub, groupId, dto);
  }

  @Delete(':id')
  deleteGroup(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') groupId: string
  ) {
    return this.wordGroupsService.deleteGroup(user.sub, groupId);
  }

  @Post(':id/words')
  assignWordsToGroup(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') groupId: string,
    @Body() dto: AssignWordsDto
  ) {
    return this.wordGroupsService.assignWordsToGroup(user.sub, groupId, dto);
  }

  @Delete(':id/words')
  removeWordsFromGroup(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') groupId: string,
    @Body() dto: AssignWordsDto
  ) {
    return this.wordGroupsService.removeWordsFromGroup(user.sub, groupId, dto);
  }
}
