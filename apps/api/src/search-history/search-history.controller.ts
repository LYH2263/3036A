import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, CurrentUserPayload } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

import { AddSearchHistoryDto } from './add-search-history.dto';
import { DeleteSearchHistoryDto } from './delete-search-history.dto';
import { SearchHistoryService } from './search-history.service';

@UseGuards(JwtAuthGuard)
@Controller('search-history')
export class SearchHistoryController {
  constructor(private readonly searchHistoryService: SearchHistoryService) {}

  @Get()
  getSearchHistory(@CurrentUser() user: CurrentUserPayload) {
    return this.searchHistoryService.getSearchHistory(user.sub);
  }

  @Post()
  addSearchHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddSearchHistoryDto
  ) {
    return this.searchHistoryService.addSearchHistory(user.sub, dto);
  }

  @Delete()
  deleteSearchHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DeleteSearchHistoryDto
  ) {
    if (query.query) {
      return this.searchHistoryService.deleteSearchHistoryItem(user.sub, query.query);
    }
    return this.searchHistoryService.clearAllSearchHistory(user.sub);
  }
}
