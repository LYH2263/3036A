import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { GrammarLevel, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { formatStandardDateTime } from '../common/time.util';

import { GetLessonsQueryDto } from './get-lessons-query.dto';
import { GetMistakesQueryDto } from './get-mistakes-query.dto';
import { RetryMistakesDto } from './retry-mistakes.dto';
import { SubmitAttemptDto } from './submit-attempt.dto';

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

  async submitAttempt(userId: string, lessonId: string, dto: SubmitAttemptDto) {
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

      const expected = question.answer.trim().toLowerCase();
      const actual = answer.answer.trim().toLowerCase();
      if (expected === actual) {
        correctCount += 1;
      } else {
        wrongAnswers.push({
          questionId: question.id,
          userAnswer: answer.answer,
          correctAnswer: question.answer
        });
      }
    }

    const score = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
    const clientEventId = dto.clientEventId?.trim() || randomUUID();

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
        createdAt: formatStandardDateTime(duplicated.createdAt)
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
          answers: dto.answers as unknown as Prisma.InputJsonValue
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
      createdAt: formatStandardDateTime(created!.createdAt)
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
}
