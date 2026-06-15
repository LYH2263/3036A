import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { WordNotesController } from './word-notes.controller';
import { WordNotesService } from './word-notes.service';

@Module({
  imports: [PrismaModule],
  controllers: [WordNotesController],
  providers: [WordNotesService]
})
export class WordNotesModule {}
