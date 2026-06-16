import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewRating } from '@prisma/client';
import type { ReviewUserWordResultDto } from '@lexigram/shared';

import { PrismaService } from '../prisma/prisma.service';
import { formatStandardDateTime } from '../common/time.util';

import { CreateUserWordDto } from './create-user-word.dto';
import { GetUserWordsQueryDto } from './get-user-words-query.dto';
import { ReviewUserWordDto } from './review-user-word.dto';

type ProgressWithWordAndGroups = Prisma.UserWordProgressGetPayload<{
  include: {
    wordEntry: true;
    groups: true;
    note: true;
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
        groups: true,
        note: true
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
        groups: true,
        note: true
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
        groups: true,
        note: true
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
        groups: true,
        note: true
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

  private normalizeRating(dto: ReviewUserWordDto): { rating: ReviewRating; known: boolean } {
    if (dto.rating) {
      const known = dto.rating === ReviewRating.recognized || dto.rating === ReviewRating.mastered;
      return { rating: dto.rating, known };
    }

    const known = dto.known ?? false;
    const rating = known ? ReviewRating.recognized : ReviewRating.fuzzy;
    return { rating, known };
  }

  async review(userId: string, progressId: string, dto: ReviewUserWordDto): Promise<ReviewUserWordResultDto> {
    const progress = await this.prisma.userWordProgress.findUnique({
      where: { id: progressId },
      include: {
        wordEntry: true,
        groups: true,
        note: true
      }
    });

    if (!progress || progress.userId !== userId) {
      throw new NotFoundException({
        message: '复习项不存在',
        errorCode: 'REVIEW_ITEM_NOT_FOUND'
      });
    }

    const { rating, known } = this.normalizeRating(dto);
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
        include: { wordEntry: true, groups: true, note: true }
      });

      if (!latest) {
        throw new BadRequestException({
          message: '复习项状态异常',
          errorCode: 'REVIEW_ITEM_STATE_INVALID'
        });
      }

      const now = new Date();
      const nextPreview = this.calculateNext(progress.easeFactor, progress.intervalDays, rating);
      const nextReviewAtPreview = new Date(now.getTime() + nextPreview.intervalDays * 24 * 60 * 60 * 1000);

      return {
        deduplicated: true,
        progress: this.mapProgress(latest),
        nextReviewPreview: {
          intervalDays: nextPreview.intervalDays,
          easeFactor: nextPreview.easeFactor,
          nextReviewAt: formatStandardDateTime(nextReviewAtPreview)
        }
      };
    }

    const now = new Date();
    const next = this.calculateNext(progress.easeFactor, progress.intervalDays, rating);
    const nextReviewAt = new Date(now.getTime() + next.intervalDays * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedProgress = await tx.userWordProgress.update({
        where: { id: progressId },
        data: {
          status: known ? 'known' : 'learning',
          easeFactor: next.easeFactor,
          intervalDays: next.intervalDays,
          nextReviewAt,
          lastReviewedAt: now
        },
        include: {
          wordEntry: true,
          groups: true,
          note: true
        }
      });

      await tx.userWordReviewEvent.create({
        data: {
          userId,
          progressId,
          clientEventId,
          known,
          rating,
          easeFactorAfter: next.easeFactor,
          intervalDaysAfter: next.intervalDays,
          reviewedAt: now
        }
      });

      return updatedProgress;
    });

    return {
      deduplicated: false,
      progress: this.mapProgress(updated),
      nextReviewPreview: {
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        nextReviewAt: formatStandardDateTime(nextReviewAt)
      }
    };
  }

  private calculateNext(easeFactor: number, intervalDays: number, rating: ReviewRating) {
    const MIN_EASE = 1.3;
    const MAX_EASE = 3.0;

    let easeDelta: number;
    let intervalMultiplier: number;

    switch (rating) {
      case ReviewRating.completely_forgot:
        easeDelta = -0.3;
        intervalMultiplier = 0;
        break;
      case ReviewRating.fuzzy:
        easeDelta = -0.15;
        intervalMultiplier = 0.5;
        break;
      case ReviewRating.recognized:
        easeDelta = 0.15;
        intervalMultiplier = 1;
        break;
      case ReviewRating.mastered:
        easeDelta = 0.3;
        intervalMultiplier = 1.2;
        break;
      default:
        easeDelta = 0;
        intervalMultiplier = 1;
    }

    const nextEase = Math.max(MIN_EASE, Math.min(MAX_EASE, Number((easeFactor + easeDelta).toFixed(2))));

    let nextInterval: number;
    if (intervalMultiplier === 0) {
      nextInterval = 1;
    } else {
      const effectiveMultiplier = nextEase * intervalMultiplier;
      nextInterval = Math.max(1, Math.round(intervalDays * effectiveMultiplier));
    }

    return { easeFactor: nextEase, intervalDays: nextInterval };
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
      hasNote: !!item.note,
      noteUpdatedAt: item.note ? formatStandardDateTime(item.note.updatedAt) : null,
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
