import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { formatStandardDateTime } from '../common/time.util';

import { AddSearchHistoryDto } from './add-search-history.dto';

const MAX_HISTORY_ITEMS = 20;

@Injectable()
export class SearchHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async addSearchHistory(userId: string, dto: AddSearchHistoryDto) {
    const normalized = dto.query.trim();

    if (!normalized) {
      return null;
    }

    await this.prisma.searchHistory.upsert({
      where: {
        userId_query: {
          userId,
          query: normalized
        }
      },
      create: {
        userId,
        query: normalized,
        searchedAt: new Date()
      },
      update: {
        searchedAt: new Date()
      }
    });

    const total = await this.prisma.searchHistory.count({
      where: { userId }
    });

    if (total > MAX_HISTORY_ITEMS) {
      const toDelete = await this.prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { searchedAt: 'desc' },
        skip: MAX_HISTORY_ITEMS,
        select: { id: true }
      });

      if (toDelete.length > 0) {
        await this.prisma.searchHistory.deleteMany({
          where: {
            id: {
              in: toDelete.map((i) => i.id)
            }
          }
        });
      }
    }

    return this.getSearchHistory(userId);
  }

  async getSearchHistory(userId: string) {
    const items = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { searchedAt: 'desc' },
      take: MAX_HISTORY_ITEMS
    });

    const queries = items.map((i) => i.query);

    const progresses = await this.prisma.userWordProgress.findMany({
      where: {
        userId,
        wordEntry: {
          word: {
            in: queries
          }
        }
      },
      select: {
        wordEntry: {
          select: {
            word: true
          }
        }
      }
    });

    const inLibrarySet = new Set(progresses.map((p) => p.wordEntry.word));

    return items.map((item) => this.mapHistoryItem(item, inLibrarySet));
  }

  async deleteSearchHistoryItem(userId: string, query: string) {
    const normalized = query.trim();

    if (!normalized) {
      return this.getSearchHistory(userId);
    }

    await this.prisma.searchHistory.deleteMany({
      where: {
        userId,
        query: normalized
      }
    });

    return this.getSearchHistory(userId);
  }

  async clearAllSearchHistory(userId: string) {
    await this.prisma.searchHistory.deleteMany({
      where: { userId }
    });

    return [];
  }

  private mapHistoryItem(
    item: { id: string; query: string; searchedAt: Date },
    inLibrarySet: Set<string>
  ) {
    return {
      id: item.id,
      query: item.query,
      searchedAt: formatStandardDateTime(item.searchedAt),
      inLibrary: inLibrarySet.has(item.query)
    };
  }
}
