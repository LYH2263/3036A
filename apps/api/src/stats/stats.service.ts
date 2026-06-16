import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface ReminderItem {
  type: 'overdue_review' | 'today_review' | 'mistake_retry' | 'unmet_goal';
  title: string;
  count: number;
  urgency: number;
  href: string;
  description: string;
}

export interface RemindersResponse {
  items: ReminderItem[];
  allCleared: boolean;
  totalCount: number;
}

const DEFAULT_DAILY_GOALS = {
  reviewCount: 20,
  grammarAttempts: 1
};

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReminders(userId: string): Promise<RemindersResponse> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [
      overdueReviewCount,
      todayDueReviewCount,
      todayCompletedReviews,
      todayGrammarAttempts,
      mistakeCount
    ] = await Promise.all([
      this.prisma.userWordProgress.count({
        where: {
          userId,
          nextReviewAt: {
            lt: todayStart
          }
        }
      }),
      this.prisma.userWordProgress.count({
        where: {
          userId,
          nextReviewAt: {
            gte: todayStart,
            lt: tomorrowStart
          }
        }
      }),
      this.prisma.userWordReviewEvent.count({
        where: {
          userId,
          reviewedAt: {
            gte: todayStart,
            lt: tomorrowStart
          }
        }
      }),
      this.prisma.grammarAttempt.count({
        where: {
          userId,
          createdAt: {
            gte: todayStart,
            lt: tomorrowStart
          }
        }
      }),
      this.prisma.grammarMistake.count({
        where: { userId }
      })
    ]);

    const totalAvailableReviews = overdueReviewCount + todayDueReviewCount;
    const effectiveReviewGoal = Math.min(DEFAULT_DAILY_GOALS.reviewCount, totalAvailableReviews);
    const reviewRemaining = totalAvailableReviews > 0
      ? Math.max(0, effectiveReviewGoal - todayCompletedReviews)
      : 0;
    const grammarRemaining = mistakeCount > 0
      ? Math.max(0, DEFAULT_DAILY_GOALS.grammarAttempts - todayGrammarAttempts)
      : 0;
    const hasUnmetGoal = reviewRemaining > 0 || grammarRemaining > 0;
    const unmetGoalCount = (reviewRemaining > 0 ? 1 : 0) + (grammarRemaining > 0 ? 1 : 0);

    const items: ReminderItem[] = [];

    if (overdueReviewCount > 0) {
      items.push({
        type: 'overdue_review',
        title: '已积压过期',
        count: overdueReviewCount,
        urgency: 1,
        href: '/vocabulary#review-list',
        description: '已过期的单词复习，请尽快处理'
      });
    }

    if (mistakeCount > 0) {
      items.push({
        type: 'mistake_retry',
        title: '错题待重练',
        count: mistakeCount,
        urgency: 2,
        href: '/grammar/mistakes#mistakes-list',
        description: '有待重练的语法错题'
      });
    }

    if (todayDueReviewCount > 0) {
      items.push({
        type: 'today_review',
        title: '今日待复习',
        count: todayDueReviewCount,
        urgency: 3,
        href: '/vocabulary#review-list',
        description: '今日到期的单词复习'
      });
    }

    if (hasUnmetGoal) {
      const goalDescriptions: string[] = [];
      if (reviewRemaining > 0) {
        goalDescriptions.push(`复习还需 ${reviewRemaining} 个`);
      }
      if (grammarRemaining > 0) {
        goalDescriptions.push(`语法还需 ${grammarRemaining} 次`);
      }
      items.push({
        type: 'unmet_goal',
        title: '今日目标未达成',
        count: unmetGoalCount,
        urgency: 4,
        href: '/progress',
        description: goalDescriptions.join('，')
      });
    }

    items.sort((a, b) => a.urgency - b.urgency);

    const totalCount = items.reduce((sum, item) => sum + item.count, 0);

    return {
      items,
      allCleared: items.length === 0,
      totalCount
    };
  }

  async getOverview(userId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [todayReviewCount, todayNewWords, vocabularyTotal, totalReviews, grammarStats, grammarMistakeCount] =
      await Promise.all([
        this.prisma.userWordReviewEvent.count({
          where: {
            userId,
            reviewedAt: {
              gte: todayStart,
              lt: tomorrowStart
            }
          }
        }),
        this.prisma.userWordProgress.count({
          where: {
            userId,
            createdAt: {
              gte: todayStart,
              lt: tomorrowStart
            }
          }
        }),
        this.prisma.userWordProgress.count({
          where: {
            userId
          }
        }),
        this.prisma.userWordReviewEvent.count({
          where: {
            userId
          }
        }),
        this.prisma.grammarAttempt.aggregate({
          where: {
            userId
          },
          _count: {
            id: true
          },
          _sum: {
            correctCount: true,
            totalQuestions: true
          }
        }),
        this.prisma.grammarMistake.count({
          where: { userId }
        })
      ]);

    const grammarAttempts = grammarStats._count.id;
    const totalCorrect = grammarStats._sum.correctCount ?? 0;
    const totalQuestions = grammarStats._sum.totalQuestions ?? 0;
    const grammarCorrectRate =
      totalQuestions > 0 ? Number(((totalCorrect / totalQuestions) * 100).toFixed(2)) : 0;

    const streakDays = await this.computeStreakDays(userId, todayStart);

    const achievements = [
      {
        code: 'WORDS_20',
        title: '词汇积累 20',
        description: '累计加入 20 个单词',
        unlocked: vocabularyTotal >= 20
      },
      {
        code: 'STREAK_3',
        title: '连续学习 3 天',
        description: '连续学习达到 3 天',
        unlocked: streakDays >= 3
      },
      {
        code: 'GRAMMAR_10',
        title: '语法训练 10 次',
        description: '累计完成 10 次语法练习',
        unlocked: grammarAttempts >= 10
      }
    ]
      .filter((item) => item.unlocked)
      .map(({ unlocked: _unused, ...rest }) => rest);

    return {
      todayReviewCount,
      todayNewWords,
      vocabularyTotal,
      totalReviews,
      grammarAttempts,
      grammarCorrectRate,
      grammarMistakeCount,
      streakDays,
      achievements
    };
  }

  private async computeStreakDays(userId: string, todayStart: Date): Promise<number> {
    const [reviewEvents, attempts, addedWords] = await Promise.all([
      this.prisma.userWordReviewEvent.findMany({
        where: { userId },
        select: { reviewedAt: true },
        orderBy: { reviewedAt: 'desc' },
        take: 90
      }),
      this.prisma.grammarAttempt.findMany({
        where: { userId },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 90
      }),
      this.prisma.userWordProgress.findMany({
        where: { userId },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 90
      })
    ]);

    const daySet = new Set<string>();
    const toDayKey = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    };

    reviewEvents.forEach((item) => daySet.add(toDayKey(item.reviewedAt)));
    attempts.forEach((item) => daySet.add(toDayKey(item.createdAt)));
    addedWords.forEach((item) => daySet.add(toDayKey(item.createdAt)));

    let streak = 0;
    let cursor = new Date(todayStart);

    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (!daySet.has(key)) {
        break;
      }
      streak += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    }

    return streak;
  }
}
