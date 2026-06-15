'use client';

import type { WordGroupDto } from '@lexigram/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FolderPlus, Tag, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiRequest, ApiError } from '../lib/api';

interface AssignGroupsDialogProps {
  open: boolean;
  onClose: () => void;
  progressIds: string[];
  currentGroupIds: string[];
  onNotice: (message: string) => void;
}

export function AssignGroupsDialog({
  open,
  onClose,
  progressIds,
  currentGroupIds,
  onNotice
}: AssignGroupsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set(currentGroupIds)
  );
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ['word-groups'],
    queryFn: () => apiRequest<WordGroupDto[]>('/word-groups')
  });

  useEffect(() => {
    if (open) {
      setSelectedGroupIds(new Set(currentGroupIds));
      setNewGroupName('');
      setShowNewGroup(false);
    }
  }, [open, currentGroupIds]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const createGroupMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest<WordGroupDto>('/word-groups', {
        method: 'POST',
        body: JSON.stringify({ name })
      }),
    onSuccess: (newGroup) => {
      setSelectedGroupIds((prev) => new Set([...prev, newGroup.id]));
      setNewGroupName('');
      setShowNewGroup(false);
      onNotice(`已创建分组"${newGroup.name}"`);
      void queryClient.invalidateQueries({ queryKey: ['word-groups'] });
    },
    onError: (error) => {
      onNotice(error instanceof ApiError ? error.message : '创建分组失败');
    }
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const groups = groupsQuery.data ?? [];
      const original = new Set(currentGroupIds);
      const toAdd: string[] = [];
      const toRemove: string[] = [];

      for (const gid of selectedGroupIds) {
        if (!original.has(gid)) {
          toAdd.push(gid);
        }
      }
      for (const gid of original) {
        if (!selectedGroupIds.has(gid)) {
          toRemove.push(gid);
        }
      }

      const results: Array<{ type: 'add' | 'remove'; count: number }> = [];

      for (const gid of toAdd) {
        const res = await apiRequest<{ assigned: number }>(
          `/word-groups/${gid}/words`,
          {
            method: 'POST',
            body: JSON.stringify({ progressIds })
          }
        );
        results.push({ type: 'add', count: res.assigned });
      }

      for (const gid of toRemove) {
        const res = await apiRequest<{ removed: number }>(
          `/word-groups/${gid}/words`,
          {
            method: 'DELETE',
            body: JSON.stringify({ progressIds })
          }
        );
        results.push({ type: 'remove', count: res.removed });
      }

      return results;
    },
    onSuccess: () => {
      onNotice('分组已更新');
      void queryClient.invalidateQueries({ queryKey: ['today-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['user-words'] });
      void queryClient.invalidateQueries({ queryKey: ['word-groups'] });
      onClose();
    },
    onError: (error) => {
      onNotice(error instanceof ApiError ? error.message : '更新分组失败');
    }
  });

  if (!open) {
    return null;
  }

  const groups = groupsQuery.data ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      data-testid="assign-groups-dialog-overlay"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-card)] border border-slate-200 bg-white shadow-xl"
        data-testid="assign-groups-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">
            <Tag className="mr-1.5 inline h-4 w-4 text-brand-600" aria-hidden="true" />
            归类到分组
            <span className="ml-2 text-xs font-normal text-slate-500">
              （已选 {progressIds.length} 个单词）
            </span>
          </h3>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            data-testid="assign-groups-close"
            aria-label="关闭"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-4">
          {groupsQuery.isLoading ? (
            <p className="text-sm text-slate-500">加载分组...</p>
          ) : (
            <div className="space-y-1.5" data-testid="assign-group-list">
              {groups.length === 0 ? (
                <p className="text-sm text-slate-500">
                  暂无分组，可点击下方创建
                </p>
              ) : null}
              {groups.map((group) => {
                const checked = selectedGroupIds.has(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                    onClick={() => toggleGroup(group.id)}
                    data-testid={`assign-group-item-${group.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <Tag
                        className="h-4 w-4 shrink-0"
                        style={{ color: group.color }}
                        aria-hidden="true"
                      />
                      <span>{group.name}</span>
                      <span className="text-xs text-slate-400">
                        ({group.wordCount})
                      </span>
                    </span>
                    {checked ? (
                      <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {showNewGroup ? (
            <div
              className="mt-3 space-y-2 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50 p-3"
              data-testid="assign-new-group-form"
            >
              <input
                className="input-control h-9 text-sm"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="新分组名称"
                maxLength={50}
                data-testid="assign-new-group-name"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary h-8 px-3 text-xs"
                  onClick={() => {
                    setShowNewGroup(false);
                    setNewGroupName('');
                  }}
                  disabled={createGroupMutation.isPending}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn-primary h-8 px-3 text-xs"
                  onClick={() => {
                    const name = newGroupName.trim();
                    if (name) {
                      createGroupMutation.mutate(name);
                    }
                  }}
                  disabled={createGroupMutation.isPending || !newGroupName.trim()}
                  data-testid="assign-new-group-submit"
                >
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  创建并添加
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
              onClick={() => setShowNewGroup(true)}
              data-testid="assign-new-group-toggle"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              创建新分组
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            className="btn-secondary h-9 px-4 text-sm"
            onClick={onClose}
            disabled={applyMutation.isPending}
          >
            取消
          </button>
          <button
            type="button"
            className="btn-primary h-9 px-4 text-sm"
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            data-testid="assign-groups-submit"
          >
            应用修改
          </button>
        </div>
      </div>
    </div>
  );
}
