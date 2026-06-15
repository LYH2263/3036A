import { Module } from '@nestjs/common';

import { UserWordsController } from './user-words.controller';
import { UserWordsService } from './user-words.service';

@Module({
  controllers: [UserWordsController],
  providers: [UserWordsService]
})
export class UserWordsModule {}
