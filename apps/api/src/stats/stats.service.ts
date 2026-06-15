import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [todayReviewCount, todayNewWords, vocabularyTotal, totalReviews, grammarStats] =
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
