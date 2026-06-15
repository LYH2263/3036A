import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { formatStandardDateTime } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';

import { AssignWordsDto } from './assign-words.dto';
import { CreateWordGroupDto } from './create-word-group.dto';
import { UpdateWordGroupDto } from './update-word-group.dto';

@Injectable()
export class WordGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(userId: string, dto: CreateWordGroupDto) {
    const trimmedName = dto.name.trim();

    const existing = await this.prisma.wordGroup.findUnique({
      where: {
        userId_name: {
          userId,
          name: trimmedName
        }
      }
    });

    if (existing) {
      throw new BadRequestException({
        message: '分组名称已存在',
        errorCode: 'GROUP_NAME_DUPLICATE'
      });
    }

    const group = await this.prisma.wordGroup.create({
      data: {
        userId,
        name: trimmedName,
        color: dto.color || '#6366f1'
      },
      include: {
        _count: {
          select: { progresses: true }
        }
      }
    });

    return this.mapGroupWithCount(group);
  }

  async getGroups(userId: string) {
    const groups = await this.prisma.wordGroup.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { progresses: true }
        }
      }
    });

    return groups.map((g) => this.mapGroupWithCount(g));
  }

  async getGroupById(userId: string, groupId: string) {
    const group = await this.prisma.wordGroup.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: { progresses: true }
        }
      }
    });

    if (!group || group.userId !== userId) {
      throw new NotFoundException({
        message: '分组不存在',
        errorCode: 'GROUP_NOT_FOUND'
      });
    }

    return this.mapGroupWithCount(group);
  }

  async updateGroup(userId: string, groupId: string, dto: UpdateWordGroupDto) {
    const existing = await this.prisma.wordGroup.findUnique({
      where: { id: groupId }
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException({
        message: '分组不存在',
        errorCode: 'GROUP_NOT_FOUND'
      });
    }

    const data: Prisma.WordGroupUpdateInput = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();

      if (trimmedName !== existing.name) {
        const duplicate = await this.prisma.wordGroup.findUnique({
          where: {
            userId_name: {
              userId,
              name: trimmedName
            }
          }
        });

        if (duplicate) {
          throw new BadRequestException({
            message: '分组名称已存在',
            errorCode: 'GROUP_NAME_DUPLICATE'
          });
        }
      }

      data.name = trimmedName;
    }

    if (dto.color !== undefined) {
      data.color = dto.color;
    }

    const updated = await this.prisma.wordGroup.update({
      where: { id: groupId },
      data,
      include: {
        _count: {
          select: { progresses: true }
        }
      }
    });

    return this.mapGroupWithCount(updated);
  }

  async deleteGroup(userId: string, groupId: string) {
    const existing = await this.prisma.wordGroup.findUnique({
      where: { id: groupId }
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException({
        message: '分组不存在',
        errorCode: 'GROUP_NOT_FOUND'
      });
    }

    await this.prisma.wordGroup.delete({
      where: { id: groupId }
    });

    return { success: true };
  }

  async assignWordsToGroup(userId: string, groupId: string, dto: AssignWordsDto) {
    const group = await this.prisma.wordGroup.findUnique({
      where: { id: groupId }
    });

    if (!group || group.userId !== userId) {
      throw new NotFoundException({
        message: '分组不存在',
        errorCode: 'GROUP_NOT_FOUND'
      });
    }

    const validProgresses = await this.prisma.userWordProgress.findMany({
      where: {
        id: { in: dto.progressIds },
        userId
      },
      select: { id: true }
    });

    const validIds = validProgresses.map((p) => p.id);

    await this.prisma.wordGroup.update({
      where: { id: groupId },
      data: {
        progresses: {
          connect: validIds.map((id) => ({ id }))
        }
      }
    });

    const updated = await this.prisma.wordGroup.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: { progresses: true }
        }
      }
    });

    return {
      assigned: validIds.length,
      skipped: dto.progressIds.length - validIds.length,
      group: updated ? this.mapGroupWithCount(updated) : null
    };
  }

  async removeWordsFromGroup(userId: string, groupId: string, dto: AssignWordsDto) {
    const group = await this.prisma.wordGroup.findUnique({
      where: { id: groupId }
    });

    if (!group || group.userId !== userId) {
      throw new NotFoundException({
        message: '分组不存在',
        errorCode: 'GROUP_NOT_FOUND'
      });
    }

    const validProgresses = await this.prisma.userWordProgress.findMany({
      where: {
        id: { in: dto.progressIds },
        userId
      },
      select: { id: true }
    });

    const validIds = validProgresses.map((p) => p.id);

    await this.prisma.wordGroup.update({
      where: { id: groupId },
      data: {
        progresses: {
          disconnect: validIds.map((id) => ({ id }))
        }
      }
    });

    const updated = await this.prisma.wordGroup.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: { progresses: true }
        }
      }
    });

    return {
      removed: validIds.length,
      skipped: dto.progressIds.length - validIds.length,
      group: updated ? this.mapGroupWithCount(updated) : null
    };
  }

  private mapGroupWithCount(
    group: Prisma.WordGroupGetPayload<{
      include: {
        _count: {
          select: { progresses: true };
        };
      };
    }>
  ) {
    return {
      id: group.id,
      name: group.name,
      color: group.color,
      createdAt: formatStandardDateTime(group.createdAt),
      updatedAt: formatStandardDateTime(group.updatedAt),
      wordCount: group._count.progresses
    };
  }
}
