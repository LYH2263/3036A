import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { formatStandardDateTime } from '../common/time.util';

import { GetLessonsQueryDto } from './get-lessons-query.dto';
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

    for (const answer of dto.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        continue;
      }

      const expected = question.answer.trim().toLowerCase();
      const actual = answer.answer.trim().toLowerCase();
      if (expected === actual) {
        correctCount += 1;
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

    const created = await this.prisma.grammarAttempt.create({
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

    return {
      deduplicated: false,
      id: created.id,
      lessonId: created.lessonId,
      score: created.score,
      totalQuestions: created.totalQuestions,
      correctCount: created.correctCount,
      createdAt: formatStandardDateTime(created.createdAt)
    };
  }
}
