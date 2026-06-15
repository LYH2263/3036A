import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { GetWordsQueryDto } from './get-words-query.dto';

@Injectable()
export class WordsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchWords(query: GetWordsQueryDto) {
    const normalized = query.q?.trim().toLowerCase() ?? '';

    if (!normalized) {
      return [];
    }

    const items = await this.prisma.wordEntry.findMany({
      where: {
        OR: [
          {
            word: {
              startsWith: normalized,
              mode: 'insensitive'
            }
          },
          {
            word: {
              contains: normalized,
              mode: 'insensitive'
            }
          }
        ]
      },
      take: 20,
      orderBy: {
        word: 'asc'
      }
    });

    return items.map((item) => ({
      id: item.id,
      word: item.word,
      definition: item.definition,
      exampleSentence: item.exampleSentence,
      phonetic: item.phonetic
    }));
  }
}
