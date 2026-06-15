'use client';

import type { WordGroupDto } from '@lexigram/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderPlus,
  Inbox,
  Layers3,
  Pencil,
  Plus,
  Save,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import { useState } from 'react';

import { apiRequest, ApiError } from '../lib/api';

const PRESET_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6'
];

export type GroupFilter =
  | { type: 'all' }
  | { type: 'ungrouped' }
  | { type: 'group'; groupId: string };

interface GroupSidebarProps {
  filter: GroupFilter;
  onFilterChange: (filter: GroupFilter) => void;
  totalCount: number;
  ungroupedCount: number;
  onNotice: (message: string) => void;
}

interface CreateGroupForm {
  name: string;
  color: string;
}

interface EditState {
  groupId: string;
  name: string;
  color: string;
}

export function GroupSidebar({
  filter,
  onFilterChange,
  totalCount,
  ungroupedCount,
  onNotice
}: GroupSidebarProps) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateGroupForm>({
    name: '',
    color: PRESET_COLORS[0]
  });
  const [editing, setEditing] = useState<EditState | null>(null);

  const groupsQuery = useQuery({
    queryKey: ['word-groups'],
    queryFn: () => apiRequest<WordGroupDto[]>('/word-groups')
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateGroupForm) =>
      apiRequest<WordGroupDto>('/word-groups', {
        method: 'POST',
        body: JSON.stringify(dto)
      }),
    onSuccess: () => {
      setShowCreate(false);
      setCreateForm({ name: '', color: PRESET_COLORS[0] });
      onNotice('分组创建成功');
      void queryClient.invalidateQueries({ queryKey: ['word-groups'] });
    },
    onError: (error) => {
      onNotice(error instanceof ApiError ? error.message : '创建分组失败');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({
      groupId,
      dto
    }: {
      groupId: string;
      dto: Partial<CreateGroupForm>;
    }) =>
      apiRequest<WordGroupDto>(`/word-groups/${groupId}`, {
        method: 'PATCH',
        body: JSON.stringify(dto)
      }),
    onSuccess: () => {
      setEditing(null);
      onNotice('分组更新成功');
      void queryClient.invalidateQueries({ queryKey: ['word-groups'] });
    },
    onError: (error) => {
      onNotice(error instanceof ApiError ? error.message : '更新分组失败');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiRequest(`/word-groups/${groupId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      onNotice('分组已删除（单词不会被删除）');
      void queryClient.invalidateQueries({ queryKey: ['word-groups'] });
      if (filter.type === 'group') {
        onFilterChange({ type: 'all' });
      }
    },
    onError: (error) => {
      onNotice(error instanceof ApiError ? error.message : '删除分组失败');
    }
  });

  const handleCreate = () => {
    const name = createForm.name.trim();
    if (!name) {
      onNotice('请输入分组名称');
      return;
    }
    createMutation.mutate({ name, color: createForm.color });
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      onNotice('请输入分组名称');
      return;
    }
    updateMutation.mutate({
      groupId: editing.groupId,
      dto: { name, color: editing.color }
    });
  };

  const groups = groupsQuery.data ?? [];

  return (
    <aside
      className="card space-y-3 bg-white/95"
      data-testid="group-sidebar"
    >
      <div className="flex items-center justify-between">
        <h2 className="section-title">
          <Layers3 className="h-4 w-4 text-brand-600" aria-hidden="true" />
          分组管理
        </h2>
        <button
          type="button"
          className="btn-secondary h-8 px-2 text-xs"
          onClick={() => setShowCreate((v) => !v)}
          data-testid="group-create-toggle"
        >
          {showCreate ? (
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {showCreate ? '取消' : '新建'}
        </button>
      </div>

      {showCreate ? (
        <div
          className="space-y-2 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/80 p-3"
          data-testid="group-create-form"
        >
          <input
            className="input-control h-9 text-sm"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, name: e.target.value }))
            }
            placeholder="分组名称（如：考研核心）"
            data-testid="group-create-name"
            maxLength={50}
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() =>
                  setCreateForm((f) => ({ ...f, color }))
                }
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  createForm.color === color
                    ? 'border-slate-700 scale-110'
                    : 'border-white'
                }`}
                style={{ backgroundColor: color }}
                data-testid={`group-create-color-${color}`}
                aria-label={`选择颜色 ${color}`}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary h-8 px-3 text-xs"
              onClick={() => {
                setShowCreate(false);
                setCreateForm({ name: '', color: PRESET_COLORS[0] });
              }}
              disabled={createMutation.isPending}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-primary h-8 px-3 text-xs"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="group-create-submit"
            >
              <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
              创建
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <button
          type="button"
          className={`flex w-full items-center justify-between rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors ${
            filter.type === 'all'
              ? 'bg-brand-100 text-brand-700 font-medium'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
          onClick={() => onFilterChange({ type: 'all' })}
          data-testid="group-filter-all"
        >
          <span className="flex items-center gap-2">
            <Layers3 className="h-4 w-4" aria-hidden="true" />
            全部单词
          </span>
          <span className="text-xs text-slate-500">{totalCount}</span>
        </button>

        <button
          type="button"
          className={`flex w-full items-center justify-between rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors ${
            filter.type === 'ungrouped'
              ? 'bg-brand-100 text-brand-700 font-medium'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
          onClick={() => onFilterChange({ type: 'ungrouped' })}
          data-testid="group-filter-ungrouped"
        >
          <span className="flex items-center gap-2">
            <Inbox className="h-4 w-4" aria-hidden="true" />
            未分组
          </span>
          <span className="text-xs text-slate-500">{ungroupedCount}</span>
        </button>
      </div>

      <div className="border-t border-slate-200 pt-2">
        {groupsQuery.isLoading ? (
          <p className="px-3 py-2 text-xs text-slate-500">加载分组...</p>
        ) : groups.length === 0 ? (
          <p
            className="px-3 py-2 text-xs text-slate-500"
            data-testid="group-empty-hint"
          >
            暂无自定义分组，点击上方"新建"创建
          </p>
        ) : (
          <div className="space-y-1" data-testid="group-list">
            {groups.map((group) => (
              <div key={group.id}>
                {editing?.groupId === group.id ? (
                  <div
                    className="space-y-2 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/80 p-2"
                    data-testid={`group-edit-form-${group.id}`}
                  >
                    <input
                      className="input-control h-8 text-xs"
                      value={editing.name}
                      onChange={(e) =>
                        setEditing((ed) =>
                          ed ? { ...ed, name: e.target.value } : ed
                        )
                      }
                      maxLength={50}
                      data-testid={`group-edit-name-${group.id}`}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() =>
                            setEditing((ed) =>
                              ed ? { ...ed, color } : ed
                            )
                          }
                          className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
                            editing.color === color
                              ? 'border-slate-700 scale-110'
                              : 'border-white'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`选择颜色 ${color}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        className="btn-secondary h-7 px-2 text-xs"
                        onClick={() => setEditing(null)}
                        disabled={updateMutation.isPending}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="btn-primary h-7 px-2 text-xs"
                        onClick={handleSaveEdit}
                        disabled={updateMutation.isPending}
                        data-testid={`group-edit-save-${group.id}`}
                      >
                        <Save className="h-3 w-3" aria-hidden="true" />
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`group flex items-center justify-between rounded-[var(--radius-control)] px-3 py-2 transition-colors ${
                      filter.type === 'group' && filter.groupId === group.id
                        ? 'bg-brand-100 text-brand-700'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 text-left text-sm"
                      onClick={() =>
                        onFilterChange({ type: 'group', groupId: group.id })
                      }
                      data-testid={`group-item-${group.id}`}
                    >
                      <Tag
                        className="h-4 w-4 shrink-0"
                        style={{ color: group.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{group.name}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                        onClick={() =>
                          setEditing({
                            groupId: group.id,
                            name: group.name,
                            color: group.color
                          })
                        }
                        data-testid={`group-edit-btn-${group.id}`}
                        aria-label="编辑分组"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1 text-slate-500 hover:bg-red-100 hover:text-red-600"
                        onClick={() => {
                          if (
                            window.confirm(
                              `确定删除分组"${group.name}"？单词不会被删除。`
                            )
                          ) {
                            deleteMutation.mutate(group.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`group-delete-btn-${group.id}`}
                        aria-label="删除分组"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <span className="ml-2 shrink-0 text-xs text-slate-500 group-hover:hidden">
                      {group.wordCount}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
