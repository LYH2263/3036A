'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  RefreshCw,
  Search,
  Trash2,
  XCircle
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { OfflineQueueEvent } from '@lexigram/shared';

import { readOfflineEvents, removeOfflineEvent } from '../lib/offline-queue';
import {
  isSyncInProgress,
  syncOfflineQueueDetailed,
  syncSingleOfflineEvent
} from '../lib/sync';

interface QueueItem {
  id: number;
  event: OfflineQueueEvent;
  syncing?: boolean;
  lastError?: string;
  lastSuccess?: boolean;
  retryCount: number;
}

const LONG_TERM_FAILURE_THRESHOLD = 3;
const EVENT_TYPE_LABELS: Record<OfflineQueueEvent['type'], string> = {
  WORD_REVIEW: '单词复习',
  GRAMMAR_ATTEMPT: '语法练习',
  GRAMMAR_MISTAKE_RETRY: '错题重练',
  WORD_NOTE_UPSERT: '笔记更新',
  WORD_NOTE_DELETE: '笔记删除',
  SEARCH_HISTORY_ADD: '搜索记录添加',
  SEARCH_HISTORY_DELETE: '搜索记录删除',
  SEARCH_HISTORY_CLEAR: '搜索记录清空'
};

function getEventTypeIcon(type: OfflineQueueEvent['type']) {
  switch (type) {
    case 'WORD_REVIEW':
      return <RefreshCw className="h-4 w-4" aria-hidden="true" />;
    case 'GRAMMAR_ATTEMPT':
    case 'GRAMMAR_MISTAKE_RETRY':
      return <FileText className="h-4 w-4" aria-hidden="true" />;
    case 'WORD_NOTE_UPSERT':
    case 'WORD_NOTE_DELETE':
      return <FileText className="h-4 w-4" aria-hidden="true" />;
    case 'SEARCH_HISTORY_ADD':
    case 'SEARCH_HISTORY_DELETE':
    case 'SEARCH_HISTORY_CLEAR':
      return <Search className="h-4 w-4" aria-hidden="true" />;
    default:
      return <Database className="h-4 w-4" aria-hidden="true" />;
  }
}

function getRelatedObject(event: OfflineQueueEvent): string {
  switch (event.type) {
    case 'WORD_REVIEW':
    case 'WORD_NOTE_UPSERT':
    case 'WORD_NOTE_DELETE':
      return `学习进度 ${event.payload.progressId.slice(0, 8)}...`;
    case 'GRAMMAR_ATTEMPT':
      return `课程 ${event.payload.lessonId.slice(0, 8)}...`;
    case 'GRAMMAR_MISTAKE_RETRY':
      return `${event.payload.answers.length} 道错题`;
    case 'SEARCH_HISTORY_ADD':
    case 'SEARCH_HISTORY_DELETE':
      return `"${event.payload.query.slice(0, 15)}${event.payload.query.length > 15 ? '...' : ''}"`;
    case 'SEARCH_HISTORY_CLEAR':
      return '全部搜索记录';
    default:
      return '未知对象';
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function OfflineQueuePanel({ onSynced }: { onSynced?: () => void }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: number;
    failed: number;
    timestamp: Date;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const events = await readOfflineEvents();
      setQueue((prev) => {
        const existingMap = new Map(prev.map((item) => [item.id, item]));
        return events.map((row) => {
          const existing = existingMap.get(row.id);
          return {
            id: row.id,
            event: row.event,
            retryCount: existing?.retryCount ?? 0,
            lastError: existing?.lastError,
            lastSuccess: existing?.lastSuccess
          };
        });
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleRetryAll = async () => {
    if (syncingAll || syncingId !== null || isSyncInProgress()) return;

    setSyncingAll(true);
    setQueue((prev) => prev.map((item) => ({ ...item, syncing: true, lastError: undefined, lastSuccess: undefined })));

    try {
      const result = await syncOfflineQueueDetailed();

      const successCount = result.results.filter((r) => r.success).length;
      const failedCount = result.results.filter((r) => !r.success).length;

      setLastSyncResult({
        success: successCount,
        failed: failedCount,
        timestamp: new Date()
      });

      setQueue((prev) => {
        const resultMap = new Map(result.results.map((r) => [r.id, r]));
        return prev
          .map((item) => {
            const resultItem = resultMap.get(item.id);
            if (resultItem?.success) {
              return null;
            }
            return {
              ...item,
              syncing: false,
              lastSuccess: resultItem?.success,
              lastError: resultItem?.error,
              retryCount: resultItem?.success ? 0 : item.retryCount + 1
            };
          })
          .filter((item): item is QueueItem => item !== null);
      });

      onSynced?.();
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRetrySingle = async (id: number) => {
    if (syncingAll || syncingId !== null || isSyncInProgress()) return;

    setSyncingId(id);
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, syncing: true, lastError: undefined, lastSuccess: undefined } : item
      )
    );

    try {
      const result = await syncSingleOfflineEvent(id);

      if (result) {
        setLastSyncResult({
          success: result.success ? 1 : 0,
          failed: result.success ? 0 : 1,
          timestamp: new Date()
        });

        if (result.success) {
          setQueue((prev) => prev.filter((item) => item.id !== id));
        } else {
          setQueue((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    syncing: false,
                    lastSuccess: false,
                    lastError: result.error,
                    retryCount: item.retryCount + 1
                  }
                : item
            )
          );
        }
      }

      onSynced?.();
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (syncingAll || syncingId !== null) return;

    try {
      await removeOfflineEvent(id);
      setQueue((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('删除事件失败:', error);
    }
  };

  const handleDeleteFailed = async () => {
    if (syncingAll || syncingId !== null) return;

    const failedItems = queue.filter((item) => item.retryCount >= LONG_TERM_FAILURE_THRESHOLD);
    for (const item of failedItems) {
      await removeOfflineEvent(item.id);
    }
    setQueue((prev) => prev.filter((item) => item.retryCount < LONG_TERM_FAILURE_THRESHOLD));
  };

  const isSyncing = syncingAll || syncingId !== null;
  const longTermFailedCount = queue.filter((item) => item.retryCount >= LONG_TERM_FAILURE_THRESHOLD).length;

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="card bg-slate-50/70">
        <div className="flex items-center gap-2 text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span className="text-sm">加载队列中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-slate-50/70" data-testid="offline-queue-panel">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="section-title">
            <Database className="h-4 w-4 text-brand-600" aria-hidden="true" />
            待同步管理
          </h2>
          <p className="text-xs text-slate-500" data-testid="queue-count">
            队列中共有 {queue.length} 条待同步事件
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {longTermFailedCount > 0 ? (
            <button
              type="button"
              className="btn-secondary h-9 text-red-600"
              onClick={handleDeleteFailed}
              disabled={isSyncing}
              data-testid="delete-failed-btn"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              清除长期失败 ({longTermFailedCount})
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary h-9"
            onClick={handleRetryAll}
            disabled={isSyncing || queue.length === 0}
            data-testid="retry-all-btn"
          >
            <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} aria-hidden="true" />
            {syncingAll ? '同步中...' : `重试全部 (${queue.length})`}
          </button>
        </div>
      </div>

      {lastSyncResult ? (
        <div
          className={`mb-4 rounded-[var(--radius-control)] border px-3 py-2 text-sm ${
            lastSyncResult.failed > 0
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
          data-testid="last-sync-result"
        >
          <div className="flex items-center gap-2">
            {lastSyncResult.failed > 0 ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              上次同步：成功 {lastSyncResult.success} 条，失败 {lastSyncResult.failed} 条
              <span className="ml-2 text-xs opacity-70">
                ({formatTime(lastSyncResult.timestamp.toISOString())})
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {longTermFailedCount > 0 ? (
        <div
          className="mb-4 rounded-[var(--radius-control)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          data-testid="long-term-failure-warning"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span>
              有 {longTermFailedCount} 条事件已多次同步失败，建议检查网络连接后重试，或删除无效事件。
            </span>
          </div>
        </div>
      ) : null}

      {queue.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-8 text-center"
          data-testid="queue-empty"
        >
          <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold text-emerald-700">队列为空</p>
          <p className="mt-1 text-sm text-slate-500">所有离线事件都已同步完成。</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="queue-list">
          {queue.map((item) => {
            const isItemSyncing = item.syncing || syncingId === item.id;
            const isLongTermFailed = item.retryCount >= LONG_TERM_FAILURE_THRESHOLD;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-[var(--radius-control)] border p-3 transition-all ${
                  isLongTermFailed
                    ? 'border-red-200 bg-red-50/50'
                    : item.lastSuccess === false
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-slate-200 bg-white'
                }`}
                data-testid={`queue-item-${item.id}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${
                      isLongTermFailed
                        ? 'bg-red-100 text-red-600'
                        : item.lastSuccess === false
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {getEventTypeIcon(item.event.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {EVENT_TYPE_LABELS[item.event.type]}
                      </span>
                      {item.retryCount > 0 ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            isLongTermFailed
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          已重试 {item.retryCount} 次
                        </span>
                      ) : null}
                      {isItemSyncing ? (
                        <span className="inline-flex items-center gap-1 text-xs text-brand-600">
                          <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                          同步中...
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-0.5 text-xs text-slate-600">
                      {getRelatedObject(item.event)}
                    </p>

                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {formatTime(item.event.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {item.lastSuccess === false ? (
                          <XCircle className="h-3 w-3 text-red-500" aria-hidden="true" />
                        ) : item.lastSuccess === true ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                        ) : (
                          <Clock3 className="h-3 w-3 text-slate-400" aria-hidden="true" />
                        )}
                        {item.lastSuccess === false
                          ? '同步失败'
                          : item.lastSuccess === true
                            ? '同步成功'
                            : '等待同步'}
                      </span>
                    </div>

                    {item.lastError && isExpanded ? (
                      <div
                        className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"
                        data-testid={`error-detail-${item.id}`}
                      >
                        <p className="font-medium">错误详情：</p>
                        <p className="mt-1 break-all font-mono">{item.lastError}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {item.lastError ? (
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => toggleExpand(item.id)}
                        title={isExpanded ? '收起错误详情' : '查看错误详情'}
                        data-testid={`toggle-error-${item.id}`}
                      >
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600 disabled:opacity-50"
                      onClick={() => handleRetrySingle(item.id)}
                      disabled={isSyncing}
                      title="重试"
                      data-testid={`retry-single-${item.id}`}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${syncingId === item.id ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                      onClick={() => handleDelete(item.id)}
                      disabled={isSyncing}
                      title="删除"
                      data-testid={`delete-single-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
