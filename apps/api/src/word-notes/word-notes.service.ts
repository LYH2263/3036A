import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { formatStandardDateTime } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';

import { UpsertWordNoteDto } from './upsert-word-note.dto';

@Injectable()
export class WordNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async getNoteByProgressId(userId: string, progressId: string) {
    const note = await this.prisma.wordNote.findUnique({
      where: {
        userId_progressId: {
          userId,
          progressId
        }
      }
    });

    if (!note) {
      return null;
    }

    return this.mapNote(note);
  }

  async getNotesByUser(userId: string) {
    const notes = await this.prisma.wordNote.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    return notes.map((n) => this.mapNote(n));
  }

  async upsertNote(userId: string, progressId: string, dto: UpsertWordNoteDto) {
    const progress = await this.prisma.userWordProgress.findUnique({
      where: { id: progressId }
    });

    if (!progress || progress.userId !== userId) {
      throw new NotFoundException({
        message: '单词进度不存在',
        errorCode: 'PROGRESS_NOT_FOUND'
      });
    }

    const trimmedContent = dto.content.trim();

    if (trimmedContent.length === 0) {
      const existing = await this.prisma.wordNote.findUnique({
        where: {
          userId_progressId: {
            userId,
            progressId
          }
        }
      });

      if (existing) {
        await this.prisma.wordNote.delete({
          where: { id: existing.id }
        });
      }

      return { deleted: true, note: null };
    }

    const clientEventId = dto.clientEventId?.trim() || randomUUID();

    const existing = await this.prisma.wordNote.findUnique({
      where: {
        userId_progressId: {
          userId,
          progressId
        }
      }
    });

    if (existing) {
      if (dto.expectedVersion !== undefined && existing.version !== dto.expectedVersion) {
        throw new ConflictException({
          message: '笔记已被其他操作修改，请刷新后重试',
          errorCode: 'NOTE_VERSION_CONFLICT',
          currentVersion: existing.version
        });
      }

      const updated = await this.prisma.wordNote.update({
        where: { id: existing.id },
        data: {
          content: trimmedContent,
          version: existing.version + 1
        }
      });

      return {
        updated: true,
        note: this.mapNote(updated),
        clientEventId
      };
    }

    const created = await this.prisma.wordNote.create({
      data: {
        userId,
        progressId,
        content: trimmedContent,
        version: 1
      }
    });

    return {
      created: true,
      note: this.mapNote(created),
      clientEventId
    };
  }

  async deleteNote(userId: string, progressId: string) {
    const note = await this.prisma.wordNote.findUnique({
      where: {
        userId_progressId: {
          userId,
          progressId
        }
      }
    });

    if (!note) {
      return { deleted: false };
    }

    await this.prisma.wordNote.delete({
      where: { id: note.id }
    });

    return { deleted: true };
  }

  private mapNote(note: {
    id: string;
    userId: string;
    progressId: string;
    content: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: note.id,
      progressId: note.progressId,
      content: note.content,
      version: note.version,
      createdAt: formatStandardDateTime(note.createdAt),
      updatedAt: formatStandardDateTime(note.updatedAt)
    };
  }
}
