import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { GrammarModule } from './grammar/grammar.module';
import { PrismaModule } from './prisma/prisma.module';
import { SearchHistoryModule } from './search-history/search-history.module';
import { StatsModule } from './stats/stats.module';
import { UserWordsModule } from './user-words/user-words.module';
import { WordGroupsModule } from './word-groups/word-groups.module';
import { WordNotesModule } from './word-notes/word-notes.module';
import { WordsModule } from './words/words.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 120
        }
      ]
    }),
    PrismaModule,
    AuthModule,
    WordsModule,
    UserWordsModule,
    WordGroupsModule,
    WordNotesModule,
    GrammarModule,
    StatsModule,
    SearchHistoryModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
