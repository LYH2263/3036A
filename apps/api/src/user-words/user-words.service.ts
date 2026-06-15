import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { formatStandardDateTime } from '../common/time.util';

import { CreateUserWordDto } from './create-user-word.dto';
import { GetUserWordsQueryDto } from './get-user-words-query.dto';
import { ReviewUserWordDto } from './review-user-word.dto';

type ProgressWithWordAndGroups = Prisma.UserWordProgressGetPayload<{
  include: {
    wordEntry: true;
    groups: true;
  };
}>;

@Injectable()
export class UserWordsService {
  constructor(private readonly prisma: PrismaService) {}

  async addUserWord(userId: string, dto: CreateUserWordDto) {
    const word = await this.prisma.wordEntry.findUnique({ where: { id: dto.wordEntryId } });

    if (!word) {
      throw new NotFoundException({
        message: '词条不存在',
        errorCode: 'WORD_NOT_FOUND'
      });
    }

    const existing = await this.prisma.userWordProgress.findUnique({
      where: {
        userId_wordEntryId: {
          userId,
          wordEntryId: dto.wordEntryId
        }
      },
      include: {
        wordEntry: true,
        groups: true
      }
    });

    if (existing) {
      return this.mapProgress(existing);
    }

    const progress = await this.prisma.userWordProgress.create({
      data: {
        userId,
        wordEntryId: dto.wordEntryId,
        status: 'learning',
        easeFactor: 2.5,
        intervalDays: 1,
        nextReviewAt: new Date()
      },
      include: {
        wordEntry: true,
        groups: true
      }
    });

    return this.mapProgress(progress);
  }

  async getTodayReviews(userId: string, query: GetUserWordsQueryDto = {}) {
    const now = new Date();

    const where: Prisma.UserWordProgressWhereInput = {
      userId,
      nextReviewAt: {
        lte: now
      }
    };

    this.applyGroupFilter(where, userId, query);

    const items = await this.prisma.userWordProgress.findMany({
      where,
      include: {
        wordEntry: true,
        groups: true
      },
      orderBy: {
        nextReviewAt: 'asc'
      }
    });

    return items.map((item) => this.mapProgress(item));
  }

  async getUserWords(userId: string, query: GetUserWordsQueryDto = {}) {
    const where: Prisma.UserWordProgressWhereInput = {
      userId
    };

    this.applyGroupFilter(where, userId, query);

    const items = await this.prisma.userWordProgress.findMany({
      where,
      include: {
        wordEntry: true,
        groups: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return items.map((item) => this.mapProgress(item));
  }

  private applyGroupFilter(
    where: Prisma.UserWordProgressWhereInput,
    userId: string,
    query: GetUserWordsQueryDto
  ) {
    if (query.groupId) {
      where.groups = {
        some: {
          id: query.groupId,
          userId
        }
      };
    } else if (query.ungroupedOnly) {
      where.groups = {
        none: {}
      };
    }
  }

  async review(userId: string, progressId: string, dto: ReviewUserWordDto) {
    const progress = await this.prisma.userWordProgress.findUnique({
      where: { id: progressId },
      include: {
        wordEntry: true,
        groups: true
      }
    });

    if (!progress || progress.userId !== userId) {
      throw new NotFoundException({
        message: '复习项不存在',
        errorCode: 'REVIEW_ITEM_NOT_FOUND'
      });
    }

    const clientEventId = dto.clientEventId?.trim() || randomUUID();

    const existedEvent = await this.prisma.userWordReviewEvent.findUnique({
      where: {
        userId_clientEventId: {
          userId,
          clientEventId
        }
      }
    });

    if (existedEvent) {
      const latest = await this.prisma.userWordProgress.findUnique({
        where: { id: progressId },
        include: { wordEntry: true, groups: true }
      });

      if (!latest) {
        throw new BadRequestException({
          message: '复习项状态异常',
          errorCode: 'REVIEW_ITEM_STATE_INVALID'
        });
      }

      return {
        deduplicated: true,
        progress: this.mapProgress(latest)
      };
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = this.calculateNext(progress.easeFactor, progress.intervalDays, dto.known);
      const nextReviewAt = new Date(now.getTime() + next.intervalDays * 24 * 60 * 60 * 1000);

      const updatedProgress = await tx.userWordProgress.update({
        where: { id: progressId },
        data: {
          status: dto.known ? 'known' : 'learning',
          easeFactor: next.easeFactor,
          intervalDays: next.intervalDays,
          nextReviewAt,
          lastReviewedAt: now
        },
        include: {
          wordEntry: true,
          groups: true
        }
      });

      await tx.userWordReviewEvent.create({
        data: {
          userId,
          progressId,
          clientEventId,
          known: dto.known,
          easeFactorAfter: next.easeFactor,
          intervalDaysAfter: next.intervalDays,
          reviewedAt: now
        }
      });

      return updatedProgress;
    });

    return {
      deduplicated: false,
      progress: this.mapProgress(updated)
    };
  }

  private calculateNext(easeFactor: number, intervalDays: number, known: boolean) {
    if (known) {
      const nextEase = Math.min(3.0, Number((easeFactor + 0.15).toFixed(2)));
      const nextInterval = Math.max(1, Math.round(intervalDays * nextEase));
      return { easeFactor: nextEase, intervalDays: nextInterval };
    }

    const nextEase = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));
    return { easeFactor: nextEase, intervalDays: 1 };
  }

  private mapProgress(item: ProgressWithWordAndGroups) {
    return {
      id: item.id,
      wordEntryId: item.wordEntryId,
      status: item.status,
      easeFactor: item.easeFactor,
      intervalDays: item.intervalDays,
      nextReviewAt: formatStandardDateTime(item.nextReviewAt),
      lastReviewedAt: item.lastReviewedAt ? formatStandardDateTime(item.lastReviewedAt) : null,
      word: {
        id: item.wordEntry.id,
        word: item.wordEntry.word,
        definition: item.wordEntry.definition,
        exampleSentence: item.wordEntry.exampleSentence,
        phonetic: item.wordEntry.phonetic
      },
      groups: item.groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        createdAt: formatStandardDateTime(g.createdAt),
        updatedAt: formatStandardDateTime(g.updatedAt)
      }))
    };
  }
}
