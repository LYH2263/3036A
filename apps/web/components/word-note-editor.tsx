'use client';

import type {
  UpsertWordNoteResultDto,
  UserWordProgressDto,
  WordNoteDto
} from '@lexigram/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Loader2,
  Save,
  StickyNote,
  Trash2,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { apiRequest, ApiError } from '../lib/api';
import { renderLightMarkdown } from '../lib/markdown';
import { enqueueOfflineEvent } from '../lib/offline-queue';

const MAX_NOTE_LENGTH = 5000;

interface WordNoteEditorProps {
  progressId: string;
  testIdPrefix?: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

function updateListNoteFlag(
  queryClient: ReturnType<typeof useQueryClient>,
  progressId: string,
  hasNote: boolean
) {
  const now = new Date().toISOString();

  queryClient.setQueriesData<UserWordProgressDto[]>(
    { queryKey: ['today-reviews'] },
    (data) => {
      if (!data) return data;
      return data.map((item) =>
        item.id === progressId
          ? { ...item, hasNote, noteUpdatedAt: hasNote ? now : null }
          : item
      );
    }
  );

  queryClient.setQueriesData<UserWordProgressDto[]>(
    { queryKey: ['user-words'] },
    (data) => {
      if (!data) return data;
      return data.map((item) =>
        item.id === progressId
          ? { ...item, hasNote, noteUpdatedAt: hasNote ? now : null }
          : item
      );
    }
  );
}

export function WordNoteEditor({ progressId, testIdPrefix = 'note' }: WordNoteEditorProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownVersionRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);

  const noteQuery = useQuery({
    queryKey: ['word-note', progressId],
    queryFn: () =>
      apiRequest<WordNoteDto | null>(`/word-notes/progress/${progressId}`),
    enabled: expanded
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ content, expectedVersion }: { content: string; expectedVersion?: number }) => {
      const clientEventId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!online) {
        await enqueueOfflineEvent({
          type: 'WORD_NOTE_UPSERT',
          clientEventId,
          payload: {
            progressId,
            content,
            expectedVersion
          },
          createdAt: new Date().toISOString()
        });

        return { queued: true, content };
      }

      try {
        const result = await apiRequest<UpsertWordNoteResultDto>(
          `/word-notes/progress/${progressId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              content,
              expectedVersion,
              clientEventId
            })
          }
        );

        return { queued: false, result };
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 409) {
          throw error;
        }

        await enqueueOfflineEvent({
          type: 'WORD_NOTE_UPSERT',
          clientEventId,
          payload: {
            progressId,
            content,
            expectedVersion
          },
          createdAt: new Date().toISOString()
        });

        return { queued: true, content };
      }
    },
    onMutate: () => {
      isSavingRef.current = true;
      setSaveStatus('saving');
      setErrorMessage('');
    },
    onSuccess: (data) => {
      let nextStatus: SaveStatus = 'saved';

      if ('queued' in data && data.queued) {
        nextStatus = 'offline';
        const nextVersion = (lastKnownVersionRef.current ?? 0) + 1;
        const localNote: WordNoteDto = {
          id: `local-${progressId}`,
          progressId,
          content: data.content ?? '',
          version: nextVersion,
          createdAt: noteQuery.data?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        lastKnownVersionRef.current = nextVersion;
        queryClient.setQueryData(['word-note', progressId], localNote);

        updateListNoteFlag(queryClient, progressId, true);
      } else if ('result' in data && data.result) {
        if (data.result.deleted) {
          nextStatus = 'idle';
          lastKnownVersionRef.current = null;
          queryClient.setQueryData(['word-note', progressId], null);
          setEditing(false);
          setDraftContent('');

          updateListNoteFlag(queryClient, progressId, false);
        } else if (data.result.note) {
          nextStatus = 'saved';
          lastKnownVersionRef.current = data.result.note.version;
          queryClient.setQueryData(['word-note', progressId], data.result.note);

          updateListNoteFlag(queryClient, progressId, true);
        }
      }

      setSaveStatus(nextStatus);
      isSavingRef.current = false;

      if (nextStatus !== 'error' && nextStatus !== 'idle') {
        setTimeout(() => {
          setSaveStatus((prev) => (prev === 'error' ? prev : 'idle'));
        }, 2000);
      }
    },
    onError: (error) => {
      isSavingRef.current = false;
      setSaveStatus('error');
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        if (error.statusCode === 409) {
          void noteQuery.refetch();
        }
      } else {
        setErrorMessage('保存失败，请稍后重试');
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!online) {
        const clientEventId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;

        await enqueueOfflineEvent({
          type: 'WORD_NOTE_DELETE',
          clientEventId,
          payload: { progressId },
          createdAt: new Date().toISOString()
        });

        return { queued: true };
      }

      try {
        await apiRequest(`/word-notes/progress/${progressId}`, {
          method: 'DELETE'
        });
        return { queued: false };
      } catch (_error) {
        const clientEventId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;

        await enqueueOfflineEvent({
          type: 'WORD_NOTE_DELETE',
          clientEventId,
          payload: { progressId },
          createdAt: new Date().toISOString()
        });

        return { queued: true };
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['word-note', progressId], null);
      lastKnownVersionRef.current = null;
      updateListNoteFlag(queryClient, progressId, false);
      setEditing(false);
      setDraftContent('');
      if (data.queued) {
        setSaveStatus('offline');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }
  });

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [editing]);

  useEffect(() => {
    if (noteQuery.data) {
      setDraftContent(noteQuery.data.content);
      lastKnownVersionRef.current = noteQuery.data.version;
    } else if (noteQuery.isFetched) {
      lastKnownVersionRef.current = null;
    }
  }, [noteQuery.data, noteQuery.isFetched]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const debouncedSave = (content: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const trimmed = content.trim();
      if (trimmed === '') {
        return;
      }
      if (isSavingRef.current) {
        return;
      }

      upsertMutation.mutate({
        content: trimmed,
        expectedVersion: lastKnownVersionRef.current ?? undefined
      });
    }, 800);
  };

  const handleContentChange = (value: string) => {
    if (value.length > MAX_NOTE_LENGTH) {
      return;
    }
    setDraftContent(value);
    setSaveStatus('idle');
    if (value.trim() !== '') {
      debouncedSave(value);
    }
  };

  const startEditing = () => {
    setDraftContent(noteQuery.data?.content || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setDraftContent(noteQuery.data?.content || '');
    setEditing(false);
    setErrorMessage('');
    setSaveStatus('idle');
  };

  const handleSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const trimmed = draftContent.trim();

    if (trimmed === '') {
      if (!noteQuery.data) {
        setEditing(false);
      }
      return;
    }

    if (isSavingRef.current) {
      return;
    }

    upsertMutation.mutate({
      content: trimmed,
      expectedVersion: lastKnownVersionRef.current ?? undefined
    });
  };

  const handleDelete = () => {
    if (confirm('确定要删除这条笔记吗？')) {
      deleteMutation.mutate();
    }
  };

  const hasNote = !!noteQuery.data;
  const charCount = draftContent.length;
  const charWarning = charCount > MAX_NOTE_LENGTH * 0.9;

  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3" data-testid={`${testIdPrefix}-container`}>
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-sm text-slate-600 hover:text-brand-600"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testIdPrefix}-toggle`}
      >
        <span className="flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
          我的笔记
          {hasNote && !editing ? (
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
              有笔记
            </span>
          ) : null}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {expanded ? (
        <div className="mt-2 space-y-2">
          {noteQuery.isLoading ? (
            <p className="text-xs text-slate-500" data-testid={`${testIdPrefix}-loading`}>
              加载笔记中...
            </p>
          ) : editing ? (
            <div className="space-y-2" data-testid={`${testIdPrefix}-editor`}>
              <textarea
                ref={textareaRef}
                className="input-control min-h-[120px] resize-y text-sm"
                value={draftContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="写下你的助记法、联想记忆、自定义例句...&#10;&#10;支持轻量 Markdown：&#10;**加粗文字**&#10;- 列表项 1&#10;- 列表项 2"
                data-testid={`${testIdPrefix}-textarea`}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  {saveStatus === 'saving' ? (
                    <span className="flex items-center gap-1 text-slate-500" data-testid={`${testIdPrefix}-saving`}>
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      保存中...
                    </span>
                  ) : saveStatus === 'saved' ? (
                    <span className="flex items-center gap-1 text-emerald-600" data-testid={`${testIdPrefix}-saved`}>
                      <Check className="h-3 w-3" aria-hidden="true" />
                      已保存
                    </span>
                  ) : saveStatus === 'offline' ? (
                    <span className="flex items-center gap-1 text-amber-600" data-testid={`${testIdPrefix}-offline`}>
                      离线待同步
                    </span>
                  ) : saveStatus === 'error' ? (
                    <span className="text-red-600" data-testid={`${testIdPrefix}-error`}>
                      {errorMessage || '保存失败'}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs ${charWarning ? 'text-amber-600' : 'text-slate-400'}`}
                    data-testid={`${testIdPrefix}-char-count`}
                  >
                    {charCount}/{MAX_NOTE_LENGTH}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary h-7 px-2 text-xs"
                    onClick={cancelEditing}
                    data-testid={`${testIdPrefix}-cancel`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                    取消
                  </button>
                  <button
                    type="button"
                    className="btn-primary h-7 px-2 text-xs"
                    onClick={handleSave}
                    disabled={saveStatus === 'saving' || upsertMutation.isPending}
                    data-testid={`${testIdPrefix}-save`}
                  >
                    <Save className="h-3 w-3" aria-hidden="true" />
                    保存
                  </button>
                </div>
              </div>
            </div>
          ) : hasNote ? (
            <div className="space-y-2" data-testid={`${testIdPrefix}-content`}>
              <div
                className="prose prose-sm max-w-none rounded-md bg-amber-50/50 p-2.5 text-sm text-slate-700"
                dangerouslySetInnerHTML={{ __html: renderLightMarkdown(noteQuery.data!.content) }}
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  更新于 {new Date(noteQuery.data!.updatedAt).toLocaleString('zh-CN')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn-secondary h-7 px-2 text-xs"
                    onClick={startEditing}
                    data-testid={`${testIdPrefix}-edit`}
                  >
                    <Edit3 className="h-3 w-3" aria-hidden="true" />
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn-secondary h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                    onClick={handleDelete}
                    data-testid={`${testIdPrefix}-delete`}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    删除
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2" data-testid={`${testIdPrefix}-empty`}>
              <p className="text-xs text-slate-400">暂无笔记，添加你的助记法或联想吧</p>
              <button
                type="button"
                className="btn-secondary h-7 px-2 text-xs"
                onClick={startEditing}
                data-testid={`${testIdPrefix}-add`}
              >
                <Edit3 className="h-3 w-3" aria-hidden="true" />
                添加笔记
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
