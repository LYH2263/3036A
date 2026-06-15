import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { GrammarLevel, Prisma, TimeLimitMode } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { formatStandardDateTime } from '../common/time.util';

import { GetLessonsQueryDto } from './get-lessons-query.dto';
import { GetMistakesQueryDto } from './get-mistakes-query.dto';
import { RetryMistakesDto } from './retry-mistakes.dto';
import { SubmitAttemptDto, TimeLimitModeDto } from './submit-attempt.dto';

const MASTERY_THRESHOLD = 80;
const LEVEL_UNLOCK_MASTERY_PERCENT = 60;

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
    const totalQuestions = lesson.questions.length;

    let correctCount = 0;
    let timeoutCount = 0;
    const details: QuestionResultDetail[] = [];
    const wrongAnswers: Array<{
      questionId: string;
      userAnswer: string;
      correctAnswer: string;
    }> = [];

    for (const answer of dto.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        continue;
      }

      const isTimedOut = answer.timedOut === true;
      const expected = question.answer.trim().toLowerCase();
      const actual = answer.answer.trim().toLowerCase();
      const isCorrect = !isTimedOut && expected === actual;

      if (isTimedOut) {
        timeoutCount += 1;
      }

      if (isCorrect) {
        correctCount += 1;
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
      basic: { masteryPercent: number; total: number };
      intermediate: { masteryPercent: number; total: number };
    }
  ): { locked: boolean; lockReason?: string } {
    if (lessonLevel === GrammarLevel.basic) {
      return { locked: false };
    }

    if (lessonLevel === GrammarLevel.intermediate) {
      if (levelMastery.basic.total === 0) {
        return { locked: false };
      }
      if (levelMastery.basic.masteryPercent < LEVEL_UNLOCK_MASTERY_PERCENT) {
        return {
          locked: true,
          lockReason: `需先掌握基础知识点（当前掌握度 ${levelMastery.basic.masteryPercent}%，需达到 ${LEVEL_UNLOCK_MASTERY_PERCENT}%）`
        };
      }
      return { locked: false };
    }

    if (lessonLevel === GrammarLevel.advanced) {
      if (levelMastery.intermediate.total === 0) {
        if (levelMastery.basic.total > 0 && levelMastery.basic.masteryPercent < LEVEL_UNLOCK_MASTERY_PERCENT) {
          return {
            locked: true,
            lockReason: `需先掌握基础知识点（当前掌握度 ${levelMastery.basic.masteryPercent}%，需达到 ${LEVEL_UNLOCK_MASTERY_PERCENT}%）`
          };
        }
        return { locked: false };
      }
      if (levelMastery.intermediate.masteryPercent < LEVEL_UNLOCK_MASTERY_PERCENT) {
        return {
          locked: true,
          lockReason: `需先掌握进阶知识点（当前掌握度 ${levelMastery.intermediate.masteryPercent}%，需达到 ${LEVEL_UNLOCK_MASTERY_PERCENT}%）`
        };
      }
      return { locked: false };
    }

    return { locked: false };
  }
}
