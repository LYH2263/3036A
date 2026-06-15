'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  CloudOff,
  Filter,
  ListChecks,
  RotateCcw,
  XCircle
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { GrammarLevel } from '@lexigram/shared';

import { AppShell } from '../../../components/app-shell';
import { SyncButton } from '../../../components/sync-button';
import { apiRequest } from '../../../lib/api';
import { useRequireAuth } from '../../../lib/auth';
import { enqueueOfflineEvent } from '../../../lib/offline-queue';

function useHashFocus() {
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const timer = setTimeout(() => {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setHighlightTarget(hash);
        setTimeout(() => setHighlightTarget(null), 2500);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return highlightTarget;
}

interface GrammarMistakeDto {
  id: string;
  questionId: string;
  lessonId: string;
  lessonTitle: string;
  level: GrammarLevel;
  questionType: 'single_choice' | 'fill_blank';
  prompt: string;
  options: string[];
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  errorCount: number;
  lastAttemptAt: string;
  createdAt: string;
}

interface GrammarMistakeLessonDto {
  lessonId: string;
  lessonTitle: string;
  level: GrammarLevel;
  count: number;
}

interface RetryResult {
  deduplicated: boolean;
  id: string;
  correctCount: number;
  totalQuestions: number;
  removedCount: number;
  createdAt: string;
}

type ViewMode = 'list' | 'retry';

function formatLessonLevel(level: GrammarLevel): string {
  if (level === 'basic') {
    return '基础';
  }
  if (level === 'intermediate') {
    return '进阶';
  }
  return '高级';
}

export default function GrammarMistakesPage() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<'all' | GrammarLevel>('all');
  const [lessonId, setLessonId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'errorCount' | 'lastAttemptAt'>('lastAttemptAt');
  const [selectedMistakes, setSelectedMistakes] = useState<Set<string>>(new Set());
  const [expandedMistakes, setExpandedMistakes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [retryAnswers, setRetryAnswers] = useState<Record<string, string>>({});
  const [retryResult, setRetryResult] = useState<RetryResult | null>(null);
  const [submitMessage, setSubmitMessage] = useState('');

  const highlightTarget = useHashFocus();

  const mistakesQuery = useQuery({
    queryKey: ['grammar-mistakes', level, lessonId, sortBy],
    queryFn: () => {
      const params = new URLSearchParams();
      if (level !== 'all') {
        params.set('level', level);
      }
      if (lessonId !== 'all') {
        params.set('lessonId', lessonId);
      }
      params.set('sortBy', sortBy);
      return apiRequest<GrammarMistakeDto[]>(`/grammar/mistakes?${params.toString()}`);
    },
    enabled: ready
  });

  const lessonsQuery = useQuery({
    queryKey: ['grammar-mistake-lessons'],
    queryFn: () => apiRequest<GrammarMistakeLessonDto[]>('/grammar/mistakes/lessons'),
    enabled: ready
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      const mistakes = mistakesQuery.data ?? [];
      const retryList =
        viewMode === 'retry' && selectedMistakes.size > 0
          ? mistakes.filter((item) => selectedMistakes.has(item.id))
          : mistakes;

      if (retryList.length === 0) {
        throw new Error('没有可重练的错题');
      }

      const clientEventId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      const payload = {
        answers: retryList.map((item) => ({
          mistakeId: item.id,
          answer: retryAnswers[item.id] ?? ''
        })),
        clientEventId
      };

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!online) {
        await enqueueOfflineEvent({
          type: 'GRAMMAR_MISTAKE_RETRY',
          clientEventId,
          payload: {
            answers: payload.answers
          },
          createdAt: new Date().toISOString()
        });
        return { queued: true };
      }

      try {
        const response = await apiRequest<RetryResult>('/grammar/mistakes/retry', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        return { queued: false, response };
      } catch (_error) {
        await enqueueOfflineEvent({
          type: 'GRAMMAR_MISTAKE_RETRY',
          clientEventId,
          payload: {
            answers: payload.answers
          },
          createdAt: new Date().toISOString()
        });

        return { queued: true };
      }
    },
    onSuccess: (payload) => {
      if (payload.queued) {
        setSubmitMessage('当前离线，重练结果已加入待同步队列');
        setRetryResult(null);
      } else {
        setRetryResult(payload.response ?? null);
        setSubmitMessage('提交成功');
        void queryClient.invalidateQueries({ queryKey: ['grammar-mistakes'] });
        void queryClient.invalidateQueries({ queryKey: ['grammar-mistake-lessons'] });
      }
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
    }
  });

  const toggleMistakeSelection = (mistakeId: string) => {
    setSelectedMistakes((prev) => {
      const next = new Set(prev);
      if (next.has(mistakeId)) {
        next.delete(mistakeId);
      } else {
        next.add(mistakeId);
      }
      return next;
    });
  };

  const toggleExpand = (mistakeId: string) => {
    setExpandedMistakes((prev) => {
      const next = new Set(prev);
      if (next.has(mistakeId)) {
        next.delete(mistakeId);
      } else {
        next.add(mistakeId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const mistakes = mistakesQuery.data ?? [];
    if (selectedMistakes.size === mistakes.length) {
      setSelectedMistakes(new Set());
    } else {
      setSelectedMistakes(new Set(mistakes.map((item) => item.id)));
    }
  };

  const startRetry = () => {
    const mistakes = mistakesQuery.data ?? [];
    const retryList =
      selectedMistakes.size > 0
        ? mistakes.filter((item) => selectedMistakes.has(item.id))
        : mistakes;

    const initialAnswers: Record<string, string> = {};
    retryList.forEach((item) => {
      initialAnswers[item.id] = '';
    });
    setRetryAnswers(initialAnswers);
    setRetryResult(null);
    setSubmitMessage('');
    setViewMode('retry');
  };

  const backToList = () => {
    setViewMode('list');
    setRetryAnswers({});
    setRetryResult(null);
    setSubmitMessage('');
  };

  const levelLabel = useMemo(() => {
    if (level === 'all') {
      return '全部级别';
    }
    return formatLessonLevel(level);
  }, [level]);

  const lessonLabel = useMemo(() => {
    if (lessonId === 'all') {
      return '全部知识点';
    }
    const lesson = lessonsQuery.data?.find((item) => item.lessonId === lessonId);
    return lesson?.lessonTitle ?? '全部知识点';
  }, [lessonId, lessonsQuery.data]);

  const mistakes = mistakesQuery.data ?? [];
  const retryList =
    viewMode === 'retry' && selectedMistakes.size > 0
      ? mistakes.filter((item) => selectedMistakes.has(item.id))
      : mistakes;

  const grammarMessageTone = submitMessage.includes('离线') ? 'status-warning' : 'status-success';

  if (viewMode === 'retry') {
    return (
      <AppShell title="语法错题重练">
        <div className="space-y-5">
          <SyncButton
            onSynced={() => {
              void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
            }}
          />

          <section className="card space-y-4 bg-white/95">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn-secondary h-9 px-3"
                onClick={backToList}
                data-testid="back-to-mistakes"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                返回错题本
              </button>
              <h2 className="section-title text-lg">
                <RotateCcw className="h-4 w-4 text-brand-600" aria-hidden="true" />
                重练错题 ({retryList.length} 题)
              </h2>
            </div>

            <div className="space-y-4" data-testid="retry-questions">
              {retryList.map((mistake, index) => (
                <div
                  key={mistake.id}
                  className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 p-3"
                  data-testid={`retry-question-${mistake.id}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {formatLessonLevel(mistake.level)} · {mistake.lessonTitle}
                    </span>
                    <span className="text-xs text-amber-600">错误 {mistake.errorCount} 次</span>
                  </div>
                  <p className="inline-flex items-start gap-1.5 text-sm font-medium">
                    <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {index + 1}. {mistake.prompt}
                  </p>

                  {mistake.questionType === 'single_choice' ? (
                    <div className="mt-2 grid gap-2">
                      {mistake.options.map((option, optionIndex) => (
                        <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name={mistake.id}
                            className="h-4 w-4 accent-brand-600"
                            value={option}
                            checked={retryAnswers[mistake.id] === option}
                            onChange={(event) =>
                              setRetryAnswers((prev) => ({
                                ...prev,
                                [mistake.id]: event.target.value
                              }))
                            }
                            data-testid={`retry-option-${mistake.id}-${optionIndex}`}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="input-control mt-2"
                      value={retryAnswers[mistake.id] ?? ''}
                      onChange={(event) =>
                        setRetryAnswers((prev) => ({
                          ...prev,
                          [mistake.id]: event.target.value
                        }))
                      }
                      placeholder="请输入答案"
                      data-testid={`retry-input-${mistake.id}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              data-testid="submit-retry"
            >
              {retryMutation.isPending ? '提交中...' : '提交重练'}
            </button>

            {submitMessage ? (
              <p className={grammarMessageTone} data-testid="retry-msg">
                {submitMessage.includes('离线') ? (
                  <CloudOff className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
                )}
                {submitMessage}
              </p>
            ) : null}

            {retryResult ? (
              <div className="status-success" data-testid="retry-result">
                <CheckCircle2 className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
                正确 {retryResult.correctCount}/{retryResult.totalQuestions}，已移除 {retryResult.removedCount} 道错题
              </div>
            ) : null}
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="语法错题本">
      <div className="space-y-5" data-testid="grammar-mistakes-page">
        <SyncButton
          onSynced={() => {
            void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
          }}
        />

        <section className="card space-y-4 bg-white/95" data-testid="mistakes-filter-section">
          <h2 className="section-title">
            <Filter className="h-4 w-4 text-brand-600" aria-hidden="true" />
            筛选条件
          </h2>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">难度级别</p>
            <div className="flex flex-wrap gap-2" data-testid="mistake-level-filters">
              {(['all', 'basic', 'intermediate', 'advanced'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`${item === level ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setLevel(item);
                    setSelectedMistakes(new Set());
                  }}
                  data-testid={`mistake-level-filter-${item}`}
                >
                  {item === 'all'
                    ? '全部'
                    : item === 'basic'
                      ? '基础'
                      : item === 'intermediate'
                        ? '进阶'
                        : '高级'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">知识点</p>
            <div className="flex flex-wrap gap-2" data-testid="mistake-lesson-filters">
              <button
                type="button"
                className={`${lessonId === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setLessonId('all');
                  setSelectedMistakes(new Set());
                }}
                data-testid="mistake-lesson-filter-all"
              >
                全部
              </button>
              {lessonsQuery.data?.map((lesson) => (
                <button
                  key={lesson.lessonId}
                  type="button"
                  className={`${lessonId === lesson.lessonId ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setLessonId(lesson.lessonId);
                    setSelectedMistakes(new Set());
                  }}
                  data-testid={`mistake-lesson-filter-${lesson.lessonId}`}
                >
                  {lesson.lessonTitle} ({lesson.count})
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">排序方式</p>
            <div className="flex flex-wrap gap-2" data-testid="mistake-sort-filters">
              {([
                { value: 'lastAttemptAt', label: '最近错误' },
                { value: 'errorCount', label: '错误次数' }
              ] as const).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`${sortBy === item.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSortBy(item.value)}
                  data-testid={`mistake-sort-${item.value}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <p className="section-subtitle" data-testid="mistakes-filter-label">
            当前筛选：{levelLabel} · {lessonLabel}，共 {mistakes.length} 道错题
          </p>
        </section>

        {mistakes.length > 0 ? (
          <>
            <section className="card space-y-3 bg-white/95">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-secondary h-9 px-3"
                  onClick={selectAll}
                  data-testid="select-all-mistakes"
                >
                  {selectedMistakes.size === mistakes.length ? '取消全选' : '全选'}
                </button>
                <button
                  type="button"
                  className="btn-primary h-9 px-3"
                  onClick={startRetry}
                  data-testid="start-retry"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  重练 {selectedMistakes.size > 0 ? `已选 (${selectedMistakes.size})` : '全部'}
                </button>
                <span className="text-sm text-slate-500">
                  已选 {selectedMistakes.size} / {mistakes.length}
                </span>
              </div>
            </section>

            <section
              id="mistakes-list"
              className={`space-y-3 transition-all duration-500 ${
                highlightTarget === 'mistakes-list'
                  ? 'ring-2 ring-amber-400 ring-offset-2 rounded-[var(--radius-control)] p-2 -m-2'
                  : ''
              }`}
              data-testid="mistakes-list"
            >
              {mistakes.map((mistake) => (
                <div
                  key={mistake.id}
                  className={`card space-y-3 bg-white/95 transition-all ${
                    selectedMistakes.has(mistake.id) ? 'border-brand-400 bg-brand-50/80' : ''
                  }`}
                  data-testid={`mistake-item-${mistake.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-600"
                        checked={selectedMistakes.has(mistake.id)}
                        onChange={() => toggleMistakeSelection(mistake.id)}
                        data-testid={`mistake-checkbox-${mistake.id}`}
                      />
                      <span className="text-xs text-slate-500">
                        {formatLessonLevel(mistake.level)} · {mistake.lessonTitle}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertCircle className="h-3 w-3" aria-hidden="true" />
                      错误 {mistake.errorCount} 次
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-800">
                    <ListChecks className="mr-1 inline h-4 w-4 text-brand-600" aria-hidden="true" />
                    {mistake.prompt}
                  </p>

                  {mistake.questionType === 'single_choice' && mistake.options.length > 0 ? (
                    <div className="space-y-1 pl-5">
                      {mistake.options.map((option) => {
                        const isCorrect = option === mistake.correctAnswer;
                        const isUserAnswer = option === mistake.userAnswer;
                        return (
                          <p
                            key={option}
                            className={`text-sm ${
                              isCorrect
                                ? 'text-green-600'
                                : isUserAnswer
                                  ? 'text-red-500 line-through'
                                  : 'text-slate-600'
                            }`}
                          >
                            {isCorrect ? (
                              <CheckCircle2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
                            ) : isUserAnswer ? (
                              <XCircle className="mr-1 inline h-3 w-3" aria-hidden="true" />
                            ) : null}
                            {option}
                          </p>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="space-y-1 pl-5 text-sm">
                    <p className="text-red-500">
                      <XCircle className="mr-1 inline h-3 w-3" aria-hidden="true" />
                      你的答案：{mistake.userAnswer}
                    </p>
                    <p className="text-green-600">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
                      正确答案：{mistake.correctAnswer}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-sm text-brand-600 hover:text-brand-700"
                    onClick={() => toggleExpand(mistake.id)}
                    data-testid={`toggle-explanation-${mistake.id}`}
                  >
                    {expandedMistakes.has(mistake.id) ? '收起解析' : '查看解析'}
                  </button>

                  {expandedMistakes.has(mistake.id) ? (
                    <div
                      className="rounded-md bg-blue-50 p-3 text-sm text-blue-800"
                      data-testid={`explanation-${mistake.id}`}
                    >
                      {mistake.explanation}
                    </div>
                  ) : null}

                  <p className="text-xs text-slate-400">
                    最近错误：{mistake.lastAttemptAt}
                  </p>
                </div>
              ))}
            </section>
          </>
        ) : (
          <section className="card bg-white/95 text-center py-12" data-testid="no-mistakes">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" aria-hidden="true" />
            <p className="mt-3 text-lg font-medium text-slate-700">太棒了！暂无错题</p>
            <p className="mt-1 text-sm text-slate-500">继续保持，加油！</p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
