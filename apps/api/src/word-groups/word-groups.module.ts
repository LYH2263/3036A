import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { WordGroupsController } from './word-groups.controller';
import { WordGroupsService } from './word-groups.service';

@Module({
  imports: [PrismaModule],
  controllers: [WordGroupsController],
  providers: [WordGroupsService]
})
export class WordGroupsModule {}
