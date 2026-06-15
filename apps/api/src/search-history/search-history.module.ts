import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { SearchHistoryController } from './search-history.controller';
import { SearchHistoryService } from './search-history.service';

@Module({
  imports: [PrismaModule],
  controllers: [SearchHistoryController],
  providers: [SearchHistoryService]
})
export class SearchHistoryModule {}
