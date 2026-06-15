'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CloudOff, FileText, Filter, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { SyncButton } from '../../components/sync-button';
import { apiRequest } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { enqueueOfflineEvent } from '../../lib/offline-queue';

interface GrammarLessonItem {
  id: string;
  title: string;
  level: 'basic' | 'intermediate' | 'advanced';
  content: string;
}

interface GrammarLessonDetail extends GrammarLessonItem {
  questions: Array<{
    id: string;
    type: 'single_choice' | 'fill_blank';
    prompt: string;
    options: string[];
    explanation: string;
  }>;
}

interface AttemptResult {
  deduplicated: boolean;
  id: string;
  lessonId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: string;
}

function formatLessonLevel(level: 'basic' | 'intermediate' | 'advanced'): string {
  if (level === 'basic') {
    return '基础';
  }
  if (level === 'intermediate') {
    return '进阶';
  }
  return '高级';
}

export default function GrammarPage() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<'all' | 'basic' | 'intermediate' | 'advanced'>('all');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitMessage, setSubmitMessage] = useState('');
  const [result, setResult] = useState<AttemptResult | null>(null);

  const lessonsQuery = useQuery({
    queryKey: ['grammar-lessons', level],
    queryFn: () =>
      apiRequest<GrammarLessonItem[]>(
        level === 'all' ? '/grammar/lessons' : `/grammar/lessons?level=${level}`
      ),
    enabled: ready
  });

  useEffect(() => {
    if (!selectedLessonId && lessonsQuery.data && lessonsQuery.data.length > 0) {
      setSelectedLessonId(lessonsQuery.data[0].id);
    }
  }, [lessonsQuery.data, selectedLessonId]);

  const lessonDetailQuery = useQuery({
    queryKey: ['grammar-lesson-detail', selectedLessonId],
    queryFn: () => apiRequest<GrammarLessonDetail>(`/grammar/lessons/${selectedLessonId}`),
    enabled: ready && Boolean(selectedLessonId)
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!lessonDetailQuery.data) {
        throw new Error('请先选择知识点');
      }

      const clientEventId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      const payload = {
        answers: lessonDetailQuery.data.questions.map((item) => ({
          questionId: item.id,
          answer: answers[item.id] ?? ''
        })),
        clientEventId
      };

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!online) {
        await enqueueOfflineEvent({
          type: 'GRAMMAR_ATTEMPT',
          clientEventId,
          payload: {
            lessonId: lessonDetailQuery.data.id,
            answers: payload.answers
          },
          createdAt: new Date().toISOString()
        });
        return { queued: true };
      }

      try {
        const response = await apiRequest<AttemptResult>(
          `/grammar/lessons/${lessonDetailQuery.data.id}/attempts`,
          {
            method: 'POST',
            body: JSON.stringify(payload)
          }
        );

        return { queued: false, response };
      } catch (_error) {
        await enqueueOfflineEvent({
          type: 'GRAMMAR_ATTEMPT',
          clientEventId,
          payload: {
            lessonId: lessonDetailQuery.data.id,
            answers: payload.answers
          },
          createdAt: new Date().toISOString()
        });

        return { queued: true };
      }
    },
    onSuccess: (payload) => {
      if (payload.queued) {
        setSubmitMessage('当前离线，练习结果已加入待同步队列');
        setResult(null);
      } else {
        setResult(payload.response ?? null);
        setSubmitMessage('提交成功');
      }
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
    }
  });

  const levelLabel = useMemo(() => {
    if (level === 'all') {
      return '全部级别';
    }
    return formatLessonLevel(level);
  }, [level]);

  const grammarMessageTone = submitMessage.includes('离线') ? 'status-warning' : 'status-success';

  return (
    <AppShell title="语法学习与练习">
      <div className="space-y-5" data-testid="grammar-page">
        <SyncButton
          onSynced={() => {
            void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
          }}
        />

        <section className="card space-y-4 bg-white/95" data-testid="grammar-lessons-section">
          <h2 className="section-title">
            <Filter className="h-4 w-4 text-brand-600" aria-hidden="true" />
            知识点筛选
          </h2>
          <div className="flex flex-wrap gap-2" data-testid="grammar-level-filters">
            {(['all', 'basic', 'intermediate', 'advanced'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`${item === level ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setLevel(item);
                  setSelectedLessonId('');
                  setAnswers({});
                  setResult(null);
                  setSubmitMessage('');
                }}
                data-testid={`level-filter-${item}`}
              >
                {item === 'all' ? '全部' : item === 'basic' ? '基础' : item === 'intermediate' ? '进阶' : '高级'}
              </button>
            ))}
          </div>

          <p className="section-subtitle" data-testid="grammar-level-label">
            当前筛选：{levelLabel}
          </p>

          <div className="grid gap-2 sm:grid-cols-2" data-testid="grammar-lesson-list">
            {lessonsQuery.data?.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => {
                  setSelectedLessonId(lesson.id);
                  setAnswers({});
                  setResult(null);
                  setSubmitMessage('');
                }}
                className={`rounded-[var(--radius-control)] border p-3 text-left transition-all ${
                  lesson.id === selectedLessonId
                    ? 'border-brand-400 bg-brand-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm'
                }`}
                data-testid={`lesson-item-${lesson.id}`}
              >
                <p className="font-medium">{lesson.title}</p>
                <p className="mt-1 text-xs text-slate-500">级别：{formatLessonLevel(lesson.level)}</p>
              </button>
            ))}
          </div>
        </section>

        {lessonDetailQuery.data ? (
          <section className="card space-y-4 bg-white/95" data-testid="grammar-detail-section">
            <div>
              <h2 className="section-title text-lg" data-testid="grammar-lesson-title">
                <FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {lessonDetailQuery.data.title}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{lessonDetailQuery.data.content}</p>
            </div>

            <div className="space-y-4" data-testid="grammar-questions">
              {lessonDetailQuery.data.questions.map((question, index) => (
                <div
                  key={question.id}
                  className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 p-3"
                  data-testid={`question-${question.id}`}
                >
                  <p className="inline-flex items-start gap-1.5 text-sm font-medium">
                    <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {index + 1}. {question.prompt}
                  </p>

                  {question.type === 'single_choice' ? (
                    <div className="mt-2 grid gap-2">
                      {question.options.map((option, optionIndex) => (
                        <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name={question.id}
                            className="h-4 w-4 accent-brand-600"
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={(event) =>
                              setAnswers((prev) => ({
                                ...prev,
                                [question.id]: event.target.value
                              }))
                            }
                            data-testid={`question-option-${question.id}-${optionIndex}`}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="input-control mt-2"
                      value={answers[question.id] ?? ''}
                      onChange={(event) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [question.id]: event.target.value
                        }))
                      }
                      placeholder="请输入答案"
                      data-testid={`question-input-${question.id}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => submitMutation.mutate()}
              data-testid="submit-attempt"
            >
              {submitMutation.isPending ? '提交中...' : '提交练习'}
            </button>

            {submitMessage ? (
              <p className={grammarMessageTone} data-testid="grammar-msg">
                {submitMessage.includes('离线') ? (
                  <CloudOff className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
                )}
                {submitMessage}
              </p>
            ) : null}

            {result ? (
              <div className="status-success" data-testid="attempt-result">
                <CheckCircle2 className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
                得分：{result.score}，正确 {result.correctCount}/{result.totalQuestions}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
