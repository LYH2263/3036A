import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { GrammarLevel, Prisma, TimeLimitMode } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { formatStandardDateTime } from '../common/time.util';

import { GetLessonsQueryDto } from './get-lessons-query.dto';
import { GetMistakesQueryDto } from './get-mistakes-query.dto';
import { GetRecommendationDto } from './get-recommendation.dto';
import { RetryMistakesDto } from './retry-mistakes.dto';
import { SkipLessonDto } from './skip-lesson.dto';
import { SubmitAttemptDto, TimeLimitModeDto } from './submit-attempt.dto';

const MASTERY_THRESHOLD = 80;
const DEFAULT_RECOMMENDATION_COUNT = 10;

interface LessonPerformance {
  lessonId: string;
  lessonTitle: string;
  level: GrammarLevel;
  attemptCount: number;
  lastScore: number;
  avgScore: number;
  correctRate: number;
  mistakeCount: number;
  mastered: boolean;
}

interface RecommendationResult {
  questions: Array<{
    id: string;
    lessonId: string;
    lessonTitle: string;
    level: GrammarLevel;
    type: 'single_choice' | 'fill_blank';
    prompt: string;
    options: string[];
    explanation: string;
    answer: string;
  }>;
  reasons: Array<{
    type: 'weak_point' | 'mistake_frequent' | 'level_up' | 'review' | 'cold_start' | 'all_mastered';
    lessonId: string;
    lessonTitle: string;
    level: GrammarLevel;
    description: string;
    score?: number;
    correctRate?: number;
    mistakeCount?: number;
  }>;
  summary: string;
  isColdStart: boolean;
  allMastered: boolean;
}

export interface QuestionResultDetail {
  questionId: string;
  correct: boolean;
  timedOut: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  prompt: string;
  type: 'single_choice' | 'fill_blank';
  options: string[];
  timeTakenMs?: number;
}

export interface SubmitAttemptResult {
  deduplicated: boolean;
  id: string;
  lessonId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: string;
  isTimedMode?: boolean;
  timeLimitMode?: 'per_question' | 'per_quiz';
  timeLimitSec?: number;
  timeTakenMs?: number;
  timeoutCount?: number;
  historicalAvgTimeMs?: number | null;
  timedAttemptCount?: number;
  details?: QuestionResultDetail[];
}

@Injectable()
export class GrammarService {
  constructor(private readonly prisma: PrismaService) {}

  async getLessons(query: GetLessonsQueryDto) {
    const lessons = await this.prisma.grammarLesson.findMany({
      where: query.level ? { level: query.level } : undefined,
      orderBy: [{ level: 'asc' }, { createdAt: 'asc' }]
    });

    return lessons.map((item) => ({
      id: item.id,
      title: item.title,
      level: item.level,
      content: item.content
    }));
  }

  async getLessonDetail(lessonId: string) {
    const lesson = await this.prisma.grammarLesson.findUnique({
      where: { id: lessonId },
      include: {
        questions: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!lesson) {
      throw new NotFoundException({
        message: '语法知识点不存在',
        errorCode: 'LESSON_NOT_FOUND'
      });
    }

    return {
      id: lesson.id,
      title: lesson.title,
      level: lesson.level,
      content: lesson.content,
      questions: lesson.questions.map((item) => ({
        id: item.id,
        type: item.type,
        prompt: item.prompt,
        options: item.options,
        explanation: item.explanation
      }))
    };
  }

  async submitAttempt(userId: string, lessonId: string, dto: SubmitAttemptDto): Promise<SubmitAttemptResult> {
    const lesson = await this.prisma.grammarLesson.findUnique({
      where: { id: lessonId },
      include: {
        questions: true
      }
    });

    if (!lesson) {
      throw new NotFoundException({
        message: '语法知识点不存在',
        errorCode: 'LESSON_NOT_FOUND'
      });
    }

    const questionMap = new Map(lesson.questions.map((item) => [item.id, item]));
    const totalQuestions = dto.answers.length;

    let correctCount = 0;
    let timeoutCount = 0;
    const details: QuestionResultDetail[] = [];
    const wrongAnswers: Array<{
      questionId: string;
      userAnswer: string;
      correctAnswer: string;
    }> = [];
    const correctQuestionIds: string[] = [];

    for (const answer of dto.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        continue;
      }

      const hasAnswer = answer.answer.trim() !== '';
      const isTimedOut = !hasAnswer && answer.timedOut === true;
      const expected = question.answer.trim().toLowerCase();
      const actual = answer.answer.trim().toLowerCase();
      const isCorrect = hasAnswer && expected === actual;

      if (isTimedOut) {
        timeoutCount += 1;
      }

      if (isCorrect) {
        correctCount += 1;
        correctQuestionIds.push(question.id);
      } else {
        wrongAnswers.push({
          questionId: question.id,
          userAnswer: answer.answer,
          correctAnswer: question.answer
        });
      }

      details.push({
        questionId: question.id,
        correct: isCorrect,
        timedOut: isTimedOut,
        userAnswer: answer.answer,
        correctAnswer: question.answer,
        explanation: question.explanation,
        prompt: question.prompt,
        type: question.type as 'single_choice' | 'fill_blank',
        options: question.options as string[],
        timeTakenMs: answer.timeTakenMs
      });
    }

    const score = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
    const clientEventId = dto.clientEventId?.trim() || randomUUID();

    const isTimedMode = dto.isTimedMode === true;
    const timeLimitMode =
      dto.timeLimitMode === TimeLimitModeDto.PER_QUESTION
        ? TimeLimitMode.per_question
        : dto.timeLimitMode === TimeLimitModeDto.PER_QUIZ
          ? TimeLimitMode.per_quiz
          : undefined;
    const timeLimitSec = dto.timeLimitSec;
    const timeTakenMs = dto.timeTakenMs;

    const duplicated = await this.prisma.grammarAttempt.findUnique({
      where: {
        userId_clientEventId: {
          userId,
          clientEventId
        }
      }
    });

    if (duplicated) {
      const historicalAvg = await this.computeHistoricalAvgTime(userId, lessonId, duplicated.id);

      return {
        deduplicated: true,
        id: duplicated.id,
        lessonId: duplicated.lessonId,
        score: duplicated.score,
        totalQuestions: duplicated.totalQuestions,
        correctCount: duplicated.correctCount,
        createdAt: formatStandardDateTime(duplicated.createdAt),
        isTimedMode: duplicated.isTimedMode,
        timeLimitMode: duplicated.timeLimitMode ?? undefined,
        timeLimitSec: duplicated.timeLimitSec ?? undefined,
        timeTakenMs: duplicated.timeTakenMs ?? undefined,
        timeoutCount: duplicated.timeoutCount,
        historicalAvgTimeMs: historicalAvg.avgTimeMs,
        timedAttemptCount: historicalAvg.count,
        details
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.grammarAttempt.create({
        data: {
          userId,
          lessonId,
          score,
          totalQuestions,
          correctCount,
          clientEventId,
          answers: dto.answers as unknown as Prisma.InputJsonValue,
          isTimedMode,
          timeLimitMode,
          timeLimitSec,
          timeTakenMs,
          timeoutCount
        }
      });

      if (correctQuestionIds.length > 0) {
        await tx.grammarMistake.deleteMany({
          where: {
            userId,
            questionId: {
              in: correctQuestionIds
            }
          }
        });
      }

      for (const wrong of wrongAnswers) {
        const question = questionMap.get(wrong.questionId);
        if (!question) continue;

        await tx.grammarMistake.upsert({
          where: {
            userId_questionId: {
              userId,
              questionId: wrong.questionId
            }
          },
          create: {
            userId,
            questionId: wrong.questionId,
            lessonId,
            lessonTitle: lesson.title,
            level: lesson.level,
            questionType: question.type,
            prompt: question.prompt,
            options: question.options as Prisma.InputJsonValue,
            userAnswer: wrong.userAnswer,
            correctAnswer: wrong.correctAnswer,
            explanation: question.explanation
          },
          update: {
            userAnswer: wrong.userAnswer,
            correctAnswer: wrong.correctAnswer,
            explanation: question.explanation,
            errorCount: {
              increment: 1
            },
            lastAttemptAt: new Date()
          }
        });
      }
    });

    const created = await this.prisma.grammarAttempt.findUnique({
      where: {
        userId_clientEventId: {
          userId,
          clientEventId
        }
      }
    });

    const historicalAvg = await this.computeHistoricalAvgTime(userId, lessonId, created!.id);

    return {
      deduplicated: false,
      id: created!.id,
      lessonId: created!.lessonId,
      score: created!.score,
      totalQuestions: created!.totalQuestions,
      correctCount: created!.correctCount,
      createdAt: formatStandardDateTime(created!.createdAt),
      isTimedMode: created!.isTimedMode,
      timeLimitMode: created!.timeLimitMode ?? undefined,
      timeLimitSec: created!.timeLimitSec ?? undefined,
      timeTakenMs: created!.timeTakenMs ?? undefined,
      timeoutCount: created!.timeoutCount,
      historicalAvgTimeMs: historicalAvg.avgTimeMs,
      timedAttemptCount: historicalAvg.count,
      details
    };
  }

  async getMistakes(userId: string, query: GetMistakesQueryDto) {
    const where: Prisma.GrammarMistakeWhereInput = { userId };

    if (query.level) {
      where.level = query.level;
    }

    if (query.lessonId) {
      where.lessonId = query.lessonId;
    }

    const orderBy: Prisma.GrammarMistakeOrderByWithRelationInput[] = [];
    if (query.sortBy === 'errorCount') {
      orderBy.push({ errorCount: 'desc' });
    } else if (query.sortBy === 'lastAttemptAt') {
      orderBy.push({ lastAttemptAt: 'desc' });
    } else {
      orderBy.push({ lastAttemptAt: 'desc' });
    }
    orderBy.push({ createdAt: 'desc' });

    const mistakes = await this.prisma.grammarMistake.findMany({
      where,
      orderBy
    });

    return mistakes.map((item) => ({
      id: item.id,
      questionId: item.questionId,
      lessonId: item.lessonId,
      lessonTitle: item.lessonTitle,
      level: item.level,
      questionType: item.questionType,
      prompt: item.prompt,
      options: item.options,
      userAnswer: item.userAnswer,
      correctAnswer: item.correctAnswer,
      explanation: item.explanation,
      errorCount: item.errorCount,
      lastAttemptAt: formatStandardDateTime(item.lastAttemptAt),
      createdAt: formatStandardDateTime(item.createdAt)
    }));
  }

  async retryMistakes(userId: string, dto: RetryMistakesDto) {
    const clientEventId = dto.clientEventId?.trim() || randomUUID();

    const duplicated = await this.prisma.grammarMistakeRetryEvent.findUnique({
      where: {
        userId_clientEventId: {
          userId,
          clientEventId
        }
      }
    });

    if (duplicated) {
      return {
        deduplicated: true,
        id: duplicated.id,
        correctCount: duplicated.correctCount,
        totalQuestions: duplicated.totalQuestions,
        removedCount: duplicated.removedCount,
        createdAt: formatStandardDateTime(duplicated.createdAt)
      };
    }

    const mistakeIds = dto.answers.map((item) => item.mistakeId);
    const mistakes = await this.prisma.grammarMistake.findMany({
      where: {
        userId,
        id: { in: mistakeIds }
      }
    });

    const mistakeMap = new Map(mistakes.map((item) => [item.id, item]));
    const totalQuestions = mistakes.length;

    let correctCount = 0;
    let removedCount = 0;
    const stillWrong: Array<{
      mistakeId: string;
      userAnswer: string;
    }> = [];

    for (const answer of dto.answers) {
      const mistake = mistakeMap.get(answer.mistakeId);
      if (!mistake) continue;

      const expected = mistake.correctAnswer.trim().toLowerCase();
      const actual = answer.answer.trim().toLowerCase();
      if (expected === actual) {
        correctCount += 1;
      } else {
        stillWrong.push({
          mistakeId: mistake.id,
          userAnswer: answer.answer
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const correctMistakeIds = dto.answers
        .filter((answer) => {
          const mistake = mistakeMap.get(answer.mistakeId);
          if (!mistake) return false;
          const expected = mistake.correctAnswer.trim().toLowerCase();
          const actual = answer.answer.trim().toLowerCase();
          return expected === actual;
        })
        .map((item) => item.mistakeId);

      if (correctMistakeIds.length > 0) {
        await tx.grammarMistake.deleteMany({
          where: {
            userId,
            id: { in: correctMistakeIds }
          }
        });
        removedCount = correctMistakeIds.length;
      }

      for (const wrong of stillWrong) {
        await tx.grammarMistake.update({
          where: { id: wrong.mistakeId },
          data: {
            userAnswer: wrong.userAnswer,
            errorCount: {
              increment: 1
            },
            lastAttemptAt: new Date()
          }
        });
      }

      await tx.grammarMistakeRetryEvent.create({
        data: {
          userId,
          clientEventId,
          answers: dto.answers as unknown as Prisma.InputJsonValue,
          correctCount,
          totalQuestions,
          removedCount
        }
      });
    });

    const created = await this.prisma.grammarMistakeRetryEvent.findUnique({
      where: {
        userId_clientEventId: {
          userId,
          clientEventId
        }
      }
    });

    return {
      deduplicated: false,
      id: created!.id,
      correctCount: created!.correctCount,
      totalQuestions: created!.totalQuestions,
      removedCount: created!.removedCount,
      createdAt: formatStandardDateTime(created!.createdAt)
    };
  }

  async getMistakeLessons(userId: string) {
    const lessons = await this.prisma.grammarMistake.groupBy({
      by: ['lessonId', 'lessonTitle', 'level'],
      where: { userId },
      _count: {
        id: true
      },
      orderBy: {
        lessonTitle: 'asc'
      }
    });

    return lessons.map((item) => ({
      lessonId: item.lessonId,
      lessonTitle: item.lessonTitle,
      level: item.level as GrammarLevel,
      count: item._count.id
    }));
  }

  async getLessonsWithProgress(userId: string, query: GetLessonsQueryDto) {
    const [allLessons, allAttempts] = await Promise.all([
      this.prisma.grammarLesson.findMany({
        where: query.level ? { level: query.level } : undefined,
        orderBy: [{ level: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.grammarAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    const attemptsByLesson = new Map<string, typeof allAttempts>();
    for (const attempt of allAttempts) {
      const list = attemptsByLesson.get(attempt.lessonId) ?? [];
      list.push(attempt);
      attemptsByLesson.set(attempt.lessonId, list);
    }

    const levelLessons = new Map<GrammarLevel, Set<string>>();
    for (const lesson of allLessons) {
      const set = levelLessons.get(lesson.level) ?? new Set();
      set.add(lesson.id);
      levelLessons.set(lesson.level, set);
    }

    const levelMastery = {
      basic: this.computeLevelMastery(
        levelLessons.get(GrammarLevel.basic) ?? new Set(),
        attemptsByLesson
      ),
      intermediate: this.computeLevelMastery(
        levelLessons.get(GrammarLevel.intermediate) ?? new Set(),
        attemptsByLesson
      ),
      advanced: this.computeLevelMastery(
        levelLessons.get(GrammarLevel.advanced) ?? new Set(),
        attemptsByLesson
      )
    };

    const lessons = allLessons.map((lesson) => {
      const attempts = attemptsByLesson.get(lesson.id) ?? [];
      const { status, progressPercent, lastScore, lastAttemptAt, attemptCount } =
        this.computeLessonProgress(attempts);
      const { locked, lockReason } = this.computeLocked(lesson.level, levelMastery);

      return {
        lessonId: lesson.id,
        title: lesson.title,
        level: lesson.level,
        content: lesson.content,
        status,
        progressPercent,
        lastScore,
        attemptCount,
        lastAttemptAt,
        locked,
        lockReason
      };
    });

    return { lessons, levelMastery };
  }

  private async computeHistoricalAvgTime(
    userId: string,
    lessonId: string,
    excludeAttemptId: string
  ): Promise<{ avgTimeMs: number | null; count: number }> {
    const historicalAttempts = await this.prisma.grammarAttempt.findMany({
      where: {
        userId,
        lessonId,
        isTimedMode: true,
        timeTakenMs: { not: null },
        id: { not: excludeAttemptId }
      },
      select: {
        timeTakenMs: true
      }
    });

    if (historicalAttempts.length === 0) {
      return { avgTimeMs: null, count: 0 };
    }

    const sum = historicalAttempts.reduce((acc, a) => acc + (a.timeTakenMs ?? 0), 0);
    const avgTimeMs = Math.round(sum / historicalAttempts.length);

    return { avgTimeMs, count: historicalAttempts.length };
  }

  private computeLevelMastery(
    lessonIds: Set<string>,
    attemptsByLesson: Map<string, Array<{ lessonId: string; score: number; createdAt: Date }>>
  ) {
    const total = lessonIds.size;
    let mastered = 0;

    for (const lessonId of lessonIds) {
      const attempts = attemptsByLesson.get(lessonId) ?? [];
      if (attempts.length > 0) {
        const lastScore = attempts[attempts.length - 1].score;
        if (lastScore >= MASTERY_THRESHOLD) {
          mastered += 1;
        }
      }
    }

    const masteryPercent = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, masteryPercent };
  }

  private computeLessonProgress(
    attempts: Array<{ score: number; createdAt: Date }>
  ) {
    const attemptCount = attempts.length;

    if (attemptCount === 0) {
      return {
        status: 'not_started',
        progressPercent: 0,
        lastScore: null,
        lastAttemptAt: null,
        attemptCount: 0
      };
    }

    const lastAttempt = attempts[attemptCount - 1];
    const lastScore = lastAttempt.score;

    let status: 'not_started' | 'learning' | 'mastered';
    let progressPercent: number;

    if (lastScore >= MASTERY_THRESHOLD) {
      status = 'mastered';
      progressPercent = 100;
    } else {
      status = 'learning';
      const bestScore = Math.max(...attempts.map((a) => a.score));
      progressPercent = Math.max(bestScore, 1);
      if (progressPercent >= MASTERY_THRESHOLD) {
        progressPercent = MASTERY_THRESHOLD - 1;
      }
    }

    return {
      status,
      progressPercent,
      lastScore,
      lastAttemptAt: formatStandardDateTime(lastAttempt.createdAt),
      attemptCount
    };
  }

  private computeLocked(
    lessonLevel: GrammarLevel,
    levelMastery: {
      basic: { mastered: number; total: number };
      intermediate: { mastered: number; total: number };
    }
  ): { locked: boolean; lockReason?: string } {
    if (lessonLevel === GrammarLevel.basic) {
      return { locked: false };
    }

    if (lessonLevel === GrammarLevel.intermediate) {
      if (levelMastery.basic.total === 0) {
        return { locked: false };
      }
      if (levelMastery.basic.mastered < 1) {
        return {
          locked: true,
          lockReason: '需先掌握至少 1 个基础知识点'
        };
      }
      return { locked: false };
    }

    if (lessonLevel === GrammarLevel.advanced) {
      if (levelMastery.intermediate.total === 0) {
        if (levelMastery.basic.total > 0 && levelMastery.basic.mastered < 1) {
          return {
            locked: true,
            lockReason: '需先掌握至少 1 个基础知识点'
          };
        }
        return { locked: false };
      }
      if (levelMastery.intermediate.mastered < 1) {
        return {
          locked: true,
          lockReason: '需先掌握至少 1 个进阶知识点'
        };
      }
      return { locked: false };
    }

    return { locked: false };
  }

  async getRecommendation(userId: string, query: GetRecommendationDto): Promise<RecommendationResult> {
    const questionCount = query.questionCount ?? DEFAULT_RECOMMENDATION_COUNT;

    const [allLessons, allAttempts, allMistakes, allQuestions, activeSkips] = await Promise.all([
      this.prisma.grammarLesson.findMany({
        orderBy: [{ level: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.grammarAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.grammarMistake.findMany({
        where: { userId }
      }),
      this.prisma.grammarQuestion.findMany({
        include: { lesson: true }
      }),
      this.prisma.grammarSkip.findMany({
        where: { userId, expiresAt: { gt: new Date() } }
      })
    ]);

    const skippedLessonIds = new Set(activeSkips.map((s) => s.lessonId));
    const availableLessons = allLessons.filter((l) => !skippedLessonIds.has(l.id));
    const availableQuestions = allQuestions.filter((q) => !skippedLessonIds.has(q.lessonId));

    const isColdStart = allAttempts.length === 0 && allMistakes.length === 0;

    if (isColdStart) {
      return this.generateColdStartRecommendation(availableLessons, availableQuestions, questionCount);
    }

    const lessonPerformances = this.computeLessonPerformances(availableLessons, allAttempts, allMistakes);

    const allMastered =
      lessonPerformances.length > 0 && lessonPerformances.every((lp) => lp.mastered);
    if (allMastered) {
      return this.generateAllMasteredRecommendation(availableLessons, availableQuestions, questionCount);
    }

    const levelMastery = this.computeLevelMasteryFromPerformances(lessonPerformances);
    const unlockedLevels = this.getUnlockedLevels(levelMastery);

    const rankedLessons = this.rankLessonsByPriority(lessonPerformances, unlockedLevels);

    return this.generateRecommendationFromRanked(
      rankedLessons,
      availableQuestions,
      questionCount,
      levelMastery
    );
  }

  private generateColdStartRecommendation(
    allLessons: Array<{ id: string; title: string; level: GrammarLevel }>,
    allQuestions: Array<{
      id: string;
      lessonId: string;
      lesson: { title: string; level: GrammarLevel };
      type: string;
      prompt: string;
      options: unknown;
      answer: string;
      explanation: string;
    }>,
    questionCount: number
  ): RecommendationResult {
    const basicLessons = allLessons.filter((l) => l.level === GrammarLevel.basic);

    const selectedLessons = basicLessons.slice(0, 3);
    const reasons = selectedLessons.map((lesson) => ({
      type: 'cold_start' as const,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      level: lesson.level,
      description: '新用户推荐：从基础知识点开始学习'
    }));

    const lessonQuestions = new Map<string, typeof allQuestions>();
    for (const q of allQuestions) {
      const list = lessonQuestions.get(q.lessonId) ?? [];
      list.push(q);
      lessonQuestions.set(q.lessonId, list);
    }

    const questions: RecommendationResult['questions'] = [];
    const questionsPerLesson = Math.ceil(questionCount / Math.max(1, selectedLessons.length));

    for (const lesson of selectedLessons) {
      const qs = lessonQuestions.get(lesson.id) ?? [];
      const shuffled = this.shuffleArray([...qs]);
      const selected = shuffled.slice(0, questionsPerLesson);
      for (const q of selected) {
        questions.push({
          id: q.id,
          lessonId: q.lessonId,
          lessonTitle: q.lesson.title,
          level: q.lesson.level,
          type: q.type as 'single_choice' | 'fill_blank',
          prompt: q.prompt,
          options: q.options as string[],
          explanation: q.explanation,
          answer: q.answer
        });
      }
    }

    return {
      questions: questions.slice(0, questionCount),
      reasons,
      summary: '欢迎开始语法学习！为您推荐基础知识点，循序渐进打牢基础。',
      isColdStart: true,
      allMastered: false
    };
  }

  private generateAllMasteredRecommendation(
    allLessons: Array<{ id: string; title: string; level: GrammarLevel }>,
    allQuestions: Array<{
      id: string;
      lessonId: string;
      lesson: { title: string; level: GrammarLevel };
      type: string;
      prompt: string;
      options: unknown;
      answer: string;
      explanation: string;
    }>,
    questionCount: number
  ): RecommendationResult {
    const advancedLessons = allLessons.filter((l) => l.level === GrammarLevel.advanced);
    const intermediateLessons = allLessons.filter((l) => l.level === GrammarLevel.intermediate);

    const reviewLessons = [...advancedLessons, ...intermediateLessons].slice(0, 3);
    const reasons = reviewLessons.map((lesson) => ({
      type: 'all_mastered' as const,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      level: lesson.level,
      description: '所有知识点已掌握，推荐复习巩固'
    }));

    const lessonQuestions = new Map<string, typeof allQuestions>();
    for (const q of allQuestions) {
      const list = lessonQuestions.get(q.lessonId) ?? [];
      list.push(q);
      lessonQuestions.set(q.lessonId, list);
    }

    const questions: RecommendationResult['questions'] = [];
    const questionsPerLesson = Math.ceil(questionCount / Math.max(1, reviewLessons.length));

    for (const lesson of reviewLessons) {
      const qs = lessonQuestions.get(lesson.id) ?? [];
      const shuffled = this.shuffleArray([...qs]);
      const selected = shuffled.slice(0, questionsPerLesson);
      for (const q of selected) {
        questions.push({
          id: q.id,
          lessonId: q.lessonId,
          lessonTitle: q.lesson.title,
          level: q.lesson.level,
          type: q.type as 'single_choice' | 'fill_blank',
          prompt: q.prompt,
          options: q.options as string[],
          explanation: q.explanation,
          answer: q.answer
        });
      }
    }

    return {
      questions: questions.slice(0, questionCount),
      reasons,
      summary: '太棒了！所有知识点已掌握，为您推荐复习题目巩固记忆。',
      isColdStart: false,
      allMastered: true
    };
  }

  private computeLessonPerformances(
    allLessons: Array<{ id: string; title: string; level: GrammarLevel }>,
    allAttempts: Array<{ lessonId: string; score: number; correctCount: number; totalQuestions: number; createdAt: Date }>,
    allMistakes: Array<{ lessonId: string; errorCount: number }>
  ): LessonPerformance[] {
    const attemptsByLesson = new Map<string, typeof allAttempts>();
    for (const attempt of allAttempts) {
      const list = attemptsByLesson.get(attempt.lessonId) ?? [];
      list.push(attempt);
      attemptsByLesson.set(attempt.lessonId, list);
    }

    const mistakeCountByLesson = new Map<string, number>();
    for (const mistake of allMistakes) {
      const current = mistakeCountByLesson.get(mistake.lessonId) ?? 0;
      mistakeCountByLesson.set(mistake.lessonId, current + mistake.errorCount);
    }

    const performances: LessonPerformance[] = [];
    for (const lesson of allLessons) {
      const attempts = attemptsByLesson.get(lesson.id) ?? [];
      const mistakeCount = mistakeCountByLesson.get(lesson.id) ?? 0;

      let attemptCount = attempts.length;
      let lastScore = 0;
      let avgScore = 0;
      let correctRate = 0;
      let mastered = false;

      if (attemptCount > 0) {
        lastScore = attempts[attemptCount - 1].score;
        const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
        avgScore = Math.round(totalScore / attemptCount);
        const totalCorrect = attempts.reduce((sum, a) => sum + a.correctCount, 0);
        const totalQuestions = attempts.reduce((sum, a) => sum + a.totalQuestions, 0);
        correctRate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        mastered = lastScore >= MASTERY_THRESHOLD;
      }

      performances.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        level: lesson.level,
        attemptCount,
        lastScore,
        avgScore,
        correctRate,
        mistakeCount,
        mastered
      });
    }

    return performances;
  }

  private computeLevelMasteryFromPerformances(performances: LessonPerformance[]) {
    const byLevel = new Map<GrammarLevel, LessonPerformance[]>();
    for (const p of performances) {
      const list = byLevel.get(p.level) ?? [];
      list.push(p);
      byLevel.set(p.level, list);
    }

    const result = {
      basic: { total: 0, mastered: 0, masteryPercent: 0 },
      intermediate: { total: 0, mastered: 0, masteryPercent: 0 },
      advanced: { total: 0, mastered: 0, masteryPercent: 0 }
    };

    for (const level of [GrammarLevel.basic, GrammarLevel.intermediate, GrammarLevel.advanced]) {
      const list = byLevel.get(level) ?? [];
      const total = list.length;
      const mastered = list.filter((p) => p.mastered).length;
      const masteryPercent = total > 0 ? Math.round((mastered / total) * 100) : 0;
      result[level] = { total, mastered, masteryPercent };
    }

    return result;
  }

  private getUnlockedLevels(levelMastery: {
    basic: { masteryPercent: number; total: number };
    intermediate: { masteryPercent: number; total: number };
  }): GrammarLevel[] {
    const unlocked: GrammarLevel[] = [GrammarLevel.basic];

    if (
      levelMastery.basic.total === 0 ||
      levelMastery.basic.masteryPercent >= LEVEL_UNLOCK_MASTERY_PERCENT
    ) {
      unlocked.push(GrammarLevel.intermediate);
    }

    if (
      levelMastery.intermediate.total === 0
        ? levelMastery.basic.total === 0 || levelMastery.basic.masteryPercent >= LEVEL_UNLOCK_MASTERY_PERCENT
        : levelMastery.intermediate.masteryPercent >= LEVEL_UNLOCK_MASTERY_PERCENT
    ) {
      unlocked.push(GrammarLevel.advanced);
    }

    return unlocked;
  }

  private rankLessonsByPriority(
    performances: LessonPerformance[],
    unlockedLevels: GrammarLevel[]
  ): Array<{ performance: LessonPerformance; priorityScore: number; reasonType: string }> {
    const ranked: Array<{ performance: LessonPerformance; priorityScore: number; reasonType: string }> = [];

    for (const perf of performances) {
      if (!unlockedLevels.includes(perf.level)) {
        continue;
      }

      let priorityScore = 0;
      let reasonType = 'review';

      if (perf.attemptCount === 0) {
        priorityScore = 80;
        reasonType = 'weak_point';
      } else if (!perf.mastered) {
        priorityScore = 100 - perf.lastScore;
        if (perf.mistakeCount > 0) {
          priorityScore += Math.min(perf.mistakeCount * 5, 30);
          reasonType = perf.mistakeCount >= 3 ? 'mistake_frequent' : 'weak_point';
        } else {
          reasonType = 'weak_point';
        }
      } else {
        priorityScore = 10;
        if (perf.correctRate < 90) {
          priorityScore += 15;
          reasonType = 'review';
        } else {
          reasonType = 'review';
        }
      }

      const levelBonus = perf.level === GrammarLevel.basic ? 5 : perf.level === GrammarLevel.intermediate ? 3 : 0;
      priorityScore += levelBonus;

      ranked.push({ performance: perf, priorityScore, reasonType });
    }

    ranked.sort((a, b) => b.priorityScore - a.priorityScore);

    return ranked;
  }

  private generateRecommendationFromRanked(
    rankedLessons: Array<{ performance: LessonPerformance; priorityScore: number; reasonType: string }>,
    allQuestions: Array<{
      id: string;
      lessonId: string;
      lesson: { title: string; level: GrammarLevel };
      type: string;
      prompt: string;
      options: unknown;
      answer: string;
      explanation: string;
    }>,
    questionCount: number,
    levelMastery: {
      basic: { masteryPercent: number; total: number };
      intermediate: { masteryPercent: number; total: number };
      advanced: { masteryPercent: number; total: number };
    }
  ): RecommendationResult {
    const highPriority = rankedLessons.filter((r) => r.priorityScore >= 50);
    const mediumPriority = rankedLessons.filter((r) => r.priorityScore >= 20 && r.priorityScore < 50);
    const lowPriority = rankedLessons.filter((r) => r.priorityScore < 20);

    let selectedLessons: typeof rankedLessons = [];

    if (highPriority.length >= 2) {
      selectedLessons = highPriority.slice(0, 3);
    } else if (highPriority.length === 1) {
      selectedLessons = [...highPriority, ...mediumPriority.slice(0, 2)];
    } else {
      selectedLessons = [...mediumPriority.slice(0, 2), ...lowPriority.slice(0, 1)];
    }

    if (selectedLessons.length < 3) {
      selectedLessons = [...selectedLessons, ...lowPriority.slice(0, 3 - selectedLessons.length)];
    }

    const shouldLevelUp = this.shouldRecommendLevelUp(levelMastery, selectedLessons);
    if (shouldLevelUp) {
      const nextLevelLesson = this.getNextLevelLesson(rankedLessons, levelMastery);
      if (nextLevelLesson && !selectedLessons.find((s) => s.performance.lessonId === nextLevelLesson.performance.lessonId)) {
        selectedLessons[selectedLessons.length - 1] = nextLevelLesson;
      }
    }

    const reasons = selectedLessons.map((item) => {
      const perf = item.performance;
      let description = '';

      switch (item.reasonType) {
        case 'weak_point':
          if (perf.attemptCount === 0) {
            description = '尚未学习，推荐开始练习';
          } else {
            description = `正确率${perf.lastScore}%，需要加强练习`;
          }
          break;
        case 'mistake_frequent':
          description = `错题${perf.mistakeCount}次，高频错题需重点巩固`;
          break;
        case 'level_up':
          description = '基础稳固，推荐挑战更高难度';
          break;
        case 'review':
        default:
          description = perf.mastered
            ? '已掌握，定期复习巩固记忆'
            : '学习中，持续练习提升';
          break;
      }

      return {
        type: item.reasonType as 'weak_point' | 'mistake_frequent' | 'level_up' | 'review',
        lessonId: perf.lessonId,
        lessonTitle: perf.lessonTitle,
        level: perf.level,
        description,
        score: perf.lastScore,
        correctRate: perf.correctRate,
        mistakeCount: perf.mistakeCount
      };
    });

    const lessonQuestions = new Map<string, typeof allQuestions>();
    for (const q of allQuestions) {
      const list = lessonQuestions.get(q.lessonId) ?? [];
      list.push(q);
      lessonQuestions.set(q.lessonId, list);
    }

    const questions: RecommendationResult['questions'] = [];
    const questionsPerLesson = Math.ceil(questionCount / Math.max(1, selectedLessons.length));

    for (const item of selectedLessons) {
      const qs = lessonQuestions.get(item.performance.lessonId) ?? [];
      const shuffled = this.shuffleArray([...qs]);
      const selected = shuffled.slice(0, questionsPerLesson);
      for (const q of selected) {
        questions.push({
          id: q.id,
          lessonId: q.lessonId,
          lessonTitle: q.lesson.title,
          level: q.lesson.level,
          type: q.type as 'single_choice' | 'fill_blank',
          prompt: q.prompt,
          options: q.options as string[],
          explanation: q.explanation,
          answer: q.answer
        });
      }
    }

    const weakPoints = reasons.filter((r) => r.type === 'weak_point' || r.type === 'mistake_frequent');
    const hasLevelUp = reasons.some((r) => r.type === 'level_up');

    let summary = '';
    if (weakPoints.length > 0) {
      summary = `为您推荐${weakPoints.length}个薄弱知识点重点练习，`;
      if (hasLevelUp) {
        summary += '同时加入高阶题目挑战自我。';
      } else {
        summary += '扎实基础后即可解锁更高难度。';
      }
    } else if (hasLevelUp) {
      summary = '基础扎实！为您推荐更高难度题目进阶学习。';
    } else {
      summary = '为您精选复习题目，巩固已学知识点。';
    }

    return {
      questions: questions.slice(0, questionCount),
      reasons,
      summary,
      isColdStart: false,
      allMastered: false
    };
  }

  private shouldRecommendLevelUp(
    levelMastery: {
      basic: { masteryPercent: number; total: number };
      intermediate: { masteryPercent: number; total: number };
    },
    currentSelection: Array<{ performance: LessonPerformance }>
  ): boolean {
    if (
      levelMastery.basic.masteryPercent >= 70 &&
      levelMastery.basic.total > 0 &&
      !currentSelection.some((s) => s.performance.level === GrammarLevel.intermediate)
    ) {
      return true;
    }

    if (
      levelMastery.intermediate.masteryPercent >= 70 &&
      levelMastery.intermediate.total > 0 &&
      !currentSelection.some((s) => s.performance.level === GrammarLevel.advanced)
    ) {
      return true;
    }

    return false;
  }

  private getNextLevelLesson(
    rankedLessons: Array<{ performance: LessonPerformance; priorityScore: number; reasonType: string }>,
    levelMastery: {
      basic: { masteryPercent: number; total: number };
      intermediate: { masteryPercent: number; total: number };
    }
  ): typeof rankedLessons[0] | null {
    let targetLevel: GrammarLevel | null = null;

    if (
      levelMastery.basic.masteryPercent >= 70 &&
      levelMastery.basic.total > 0 &&
      levelMastery.intermediate.masteryPercent < 70
    ) {
      targetLevel = GrammarLevel.intermediate;
    } else if (
      levelMastery.intermediate.masteryPercent >= 70 &&
      levelMastery.intermediate.total > 0
    ) {
      targetLevel = GrammarLevel.advanced;
    }

    if (!targetLevel) return null;

    const candidate = rankedLessons.find(
      (r) => r.performance.level === targetLevel && !r.performance.mastered
    );

    if (candidate) {
      return { ...candidate, reasonType: 'level_up' };
    }

    const masteredCandidate = rankedLessons.find(
      (r) => r.performance.level === targetLevel
    );

    if (masteredCandidate) {
      return { ...masteredCandidate, reasonType: 'level_up' };
    }

    return null;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async skipLesson(userId: string, lessonId: string, dto: SkipLessonDto) {
    const lesson = await this.prisma.grammarLesson.findUnique({
      where: { id: lessonId }
    });

    if (!lesson) {
      throw new NotFoundException({
        message: '语法知识点不存在',
        errorCode: 'LESSON_NOT_FOUND'
      });
    }

    const days = dto.days ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const skip = await this.prisma.grammarSkip.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId
        }
      },
      update: {
        reason: dto.reason,
        expiresAt
      },
      create: {
        userId,
        lessonId,
        reason: dto.reason,
        expiresAt
      },
      include: {
        lesson: true
      }
    });

    return {
      id: skip.id,
      lessonId: skip.lessonId,
      lessonTitle: skip.lesson.title,
      level: skip.lesson.level,
      reason: skip.reason,
      expiresAt: skip.expiresAt.toISOString(),
      createdAt: skip.createdAt.toISOString()
    };
  }

  async unskipLesson(userId: string, lessonId: string) {
    const existing = await this.prisma.grammarSkip.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId
        }
      }
    });

    if (!existing) {
      throw new NotFoundException({
        message: '该知识点未被跳过',
        errorCode: 'SKIP_NOT_FOUND'
      });
    }

    await this.prisma.grammarSkip.delete({
      where: {
        userId_lessonId: {
          userId,
          lessonId
        }
      }
    });

    return { success: true };
  }
}
