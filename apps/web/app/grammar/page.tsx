'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  BookX,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  CloudOff,
  FileText,
  Filter,
  Lightbulb,
  ListChecks,
  Lock,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Unlock,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { SyncButton } from '../../components/sync-button';
import { apiRequest } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { enqueueOfflineEvent } from '../../lib/offline-queue';
import type {
  GrammarAttemptDto,
  GrammarLessonProgressDto,
  GrammarLessonsProgressOverviewDto,
  GrammarProgressStatus,
  GrammarRecommendationResponse,
  QuestionResultDetail,
  RecommendationReasonItem,
  RecommendedQuestion,
  TimeLimitMode
} from '@lexigram/shared';

interface GrammarLessonDetail {
  id: string;
  title: string;
  level: 'basic' | 'intermediate' | 'advanced';
  content: string;
  questions: Array<{
    id: string;
    type: 'single_choice' | 'fill_blank';
    prompt: string;
    options: string[];
    explanation: string;
  }>;
}

interface AttemptAnswer {
  questionId: string;
  answer: string;
  timedOut?: boolean;
  timeTakenMs?: number;
}

type PageMode = 'select' | 'configure' | 'quiz' | 'result' | 'recommend-overview';
type PracticeMode = 'normal' | 'timed' | 'recommend';

const DEFAULT_PER_QUESTION_SEC = 20;
const DEFAULT_PER_QUIZ_SEC = 300;

function formatLessonLevel(level: 'basic' | 'intermediate' | 'advanced'): string {
  if (level === 'basic') return '基础';
  if (level === 'intermediate') return '进阶';
  return '高级';
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getStatusInfo(status: GrammarProgressStatus) {
  switch (status) {
    case 'not_started':
      return { label: '未开始', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    case 'learning':
      return { label: '学习中', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'mastered':
      return { label: '已掌握', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
}

function getStatusIcon(status: GrammarProgressStatus) {
  switch (status) {
    case 'not_started':
      return <BookOpen className="h-3 w-3" aria-hidden="true" />;
    case 'learning':
      return <Target className="h-3 w-3" aria-hidden="true" />;
    case 'mastered':
      return <CheckCircle2 className="h-3 w-3" aria-hidden="true" />;
  }
}

function getProgressBarColor(status: GrammarProgressStatus) {
  switch (status) {
    case 'not_started':
      return 'bg-slate-300';
    case 'learning':
      return 'bg-gradient-to-r from-amber-400 to-orange-500';
    case 'mastered':
      return 'bg-gradient-to-r from-emerald-400 to-green-500';
  }
}

export default function GrammarPage() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();

  const [pageMode, setPageMode] = useState<PageMode>('select');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('normal');

  const [level, setLevel] = useState<'all' | 'basic' | 'intermediate' | 'advanced'>('all');
  const [selectedLessonId, setSelectedLessonId] = useState('');

  const [timeLimitMode, setTimeLimitMode] = useState<TimeLimitMode>('per_question');
  const [perQuestionSec, setPerQuestionSec] = useState(DEFAULT_PER_QUESTION_SEC);
  const [perQuizSec, setPerQuizSec] = useState(DEFAULT_PER_QUIZ_SEC);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AttemptAnswer>>({});
  const [questionStartTs, setQuestionStartTs] = useState<number>(0);

  const [remainingMs, setRemainingMs] = useState(0);
  const [quizStartTs, setQuizStartTs] = useState<number>(0);
  const timerRef = useRef<number | null>(null);
  const hiddenRef = useRef(false);
  const visibilityChangeHandlerRef = useRef<((event: Event) => void) | null>(null);

  const [submitMessage, setSubmitMessage] = useState('');
  const [result, setResult] = useState<GrammarAttemptDto | null>(null);

  const [unlockingLessonIds, setUnlockingLessonIds] = useState<Set<string>>(new Set());
  const prevLockedMapRef = useRef<Map<string, boolean>>(new Map());

  const [recommendationResult, setRecommendationResult] = useState<GrammarRecommendationResponse | null>(null);
  const [recommendQuestionCount, setRecommendQuestionCount] = useState(10);

  const progressQuery = useQuery({
    queryKey: ['grammar-progress', level],
    queryFn: () =>
      apiRequest<GrammarLessonsProgressOverviewDto>(
        level === 'all' ? '/grammar/progress' : `/grammar/progress?level=${level}`
      ),
    enabled: ready
  });

  useEffect(() => {
    if (!progressQuery.data) return;
    const curr = progressQuery.data.lessons;
    const prev = prevLockedMapRef.current;

    const newlyUnlocked: string[] = [];
    for (const lesson of curr) {
      const wasLocked = prev.get(lesson.lessonId);
      if (wasLocked === true && !lesson.locked) {
        newlyUnlocked.push(lesson.lessonId);
      }
      prev.set(lesson.lessonId, lesson.locked);
    }
    prevLockedMapRef.current = new Map(curr.map((l) => [l.lessonId, l.locked]));

    if (newlyUnlocked.length > 0) {
      const set = new Set(newlyUnlocked);
      setUnlockingLessonIds(set);
      window.setTimeout(() => {
        setUnlockingLessonIds((current) => {
          const next = new Set(current);
          for (const id of newlyUnlocked) next.delete(id);
          return next;
        });
      }, 800);
    }
  }, [progressQuery.data]);

  const lessons: GrammarLessonProgressDto[] = progressQuery.data?.lessons ?? [];
  const levelMastery = progressQuery.data?.levelMastery;

  useEffect(() => {
    if (!selectedLessonId && lessons.length > 0) {
      const firstUnlocked = lessons.find((l) => !l.locked);
      setSelectedLessonId((firstUnlocked ?? lessons[0]).lessonId);
    }
  }, [lessons, selectedLessonId]);

  const recommendationQuery = useQuery({
    queryKey: ['grammar-recommendation', recommendQuestionCount],
    queryFn: () =>
      apiRequest<GrammarRecommendationResponse>(
        `/grammar/recommendation?questionCount=${recommendQuestionCount}`
      ),
    enabled: false
  });

  const fetchRecommendation = useCallback(() => {
    void recommendationQuery.refetch();
  }, [recommendationQuery]);

  useEffect(() => {
    if (recommendationQuery.data && pageMode === 'select') {
      setRecommendationResult(recommendationQuery.data);
      setPageMode('recommend-overview');
    }
  }, [recommendationQuery.data, pageMode]);

  const selectedLessonProgress = useMemo(
    () => lessons.find((l) => l.lessonId === selectedLessonId),
    [lessons, selectedLessonId]
  );

  const lessonDetailQuery = useQuery({
    queryKey: ['grammar-lesson-detail', selectedLessonId],
    queryFn: () => apiRequest<GrammarLessonDetail>(`/grammar/lessons/${selectedLessonId}`),
    enabled: ready && Boolean(selectedLessonId) && !selectedLessonProgress?.locked
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishTimedQuiz = useCallback(() => {
    clearTimer();
    const timeTakenMs = Date.now() - quizStartTs;

    const currentLesson = lessonDetailQuery.data;
    if (!currentLesson) return;

    currentLesson.questions.forEach((q, idx) => {
      setAnswers((prev) => {
        if (prev[q.id]) return prev;
        const isCurrentQuestion = idx === currentQuestionIndex;
        return {
          ...prev,
          [q.id]: {
            questionId: q.id,
            answer: '',
            timedOut: true,
            timeTakenMs: isCurrentQuestion ? Date.now() - questionStartTs : 0
          }
        };
      });
    });

    setTimeout(() => {
      submitMutation.mutate({ forceFinish: true, timeTakenMsOverride: timeTakenMs });
    }, 0);
  }, [clearTimer, lessonDetailQuery.data, currentQuestionIndex, questionStartTs, quizStartTs]);

  const advanceToNextQuestion = useCallback(
    (currentIdx: number, timedOut: boolean) => {
      if (practiceMode === 'recommend') {
        const questions = recommendationResult?.questions;
        if (!questions) return;

        const currentQ = questions[currentIdx];
        if (currentQ) {
          const taken = Date.now() - questionStartTs;
          setAnswers((prev) => {
            const existing = prev[currentQ.id];
            const hasAnswered = existing && existing.answer.trim() !== '';
            return {
              ...prev,
              [currentQ.id]: {
                questionId: currentQ.id,
                answer: existing?.answer ?? '',
                timedOut: !hasAnswered && timedOut,
                timeTakenMs: existing?.timeTakenMs ?? taken
              }
            };
          });
        }

        if (currentIdx + 1 >= questions.length) {
          const totalTime = Date.now() - quizStartTs;
          setTimeout(() => {
            submitMutation.mutate({ forceFinish: true, timeTakenMsOverride: totalTime });
          }, 0);
          return;
        }

        const nextIdx = currentIdx + 1;
        setCurrentQuestionIndex(nextIdx);
        setQuestionStartTs(Date.now());
        return;
      }

      const currentLesson = lessonDetailQuery.data;
      if (!currentLesson) return;

      const currentQ = currentLesson.questions[currentIdx];
      if (currentQ) {
        const taken = Date.now() - questionStartTs;
        setAnswers((prev) => {
          const existing = prev[currentQ.id];
          const hasAnswered = existing && existing.answer.trim() !== '';
          return {
            ...prev,
            [currentQ.id]: {
              questionId: currentQ.id,
              answer: existing?.answer ?? '',
              timedOut: !hasAnswered && timedOut,
              timeTakenMs: existing?.timeTakenMs ?? taken
            }
          };
        });
      }

      if (currentIdx + 1 >= currentLesson.questions.length) {
        const totalTime = Date.now() - quizStartTs;
        setTimeout(() => {
          submitMutation.mutate({ forceFinish: true, timeTakenMsOverride: totalTime });
        }, 0);
        return;
      }

      const nextIdx = currentIdx + 1;
      setCurrentQuestionIndex(nextIdx);
      setQuestionStartTs(Date.now());

      if (timeLimitMode === 'per_question') {
        setRemainingMs(perQuestionSec * 1000);
      }
    },
    [practiceMode, recommendationResult?.questions, lessonDetailQuery.data, questionStartTs, quizStartTs, timeLimitMode, perQuestionSec]
  );

  useEffect(() => {
    if (pageMode !== 'quiz' || practiceMode !== 'timed') return;

    const tick = () => {
      if (hiddenRef.current) return;
      setRemainingMs((prev) => {
        const next = prev - 250;
        if (next <= 0) {
          if (timeLimitMode === 'per_question') {
            advanceToNextQuestion(currentQuestionIndex, true);
            return perQuestionSec * 1000;
          } else {
            finishTimedQuiz();
            return 0;
          }
        }
        return next;
      });
    };

    timerRef.current = window.setInterval(tick, 250);
    return () => {
      clearTimer();
    };
  }, [
    pageMode,
    practiceMode,
    timeLimitMode,
    perQuestionSec,
    currentQuestionIndex,
    advanceToNextQuestion,
    finishTimedQuiz,
    clearTimer
  ]);

  useEffect(() => {
    if (pageMode !== 'quiz' || practiceMode !== 'timed') return;

    const handler = () => {
      hiddenRef.current = document.hidden;
    };
    visibilityChangeHandlerRef.current = handler;
    document.addEventListener('visibilitychange', handler);

    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '限时测验进行中，离开将被视为放弃，所有未提交的答案将记为超时错误。';
      return event.returnValue;
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    return () => {
      if (visibilityChangeHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityChangeHandlerRef.current);
      }
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, [pageMode, practiceMode]);

  const startQuiz = useCallback(() => {
    if (practiceMode === 'recommend') {
      if (!recommendationResult) return;

      setAnswers({});
      setCurrentQuestionIndex(0);
      setSubmitMessage('');
      setResult(null);

      const now = Date.now();
      setQuizStartTs(now);
      setQuestionStartTs(now);

      setPageMode('quiz');
      return;
    }

    if (!lessonDetailQuery.data) return;

    setAnswers({});
    setCurrentQuestionIndex(0);
    setSubmitMessage('');
    setResult(null);

    const now = Date.now();
    setQuizStartTs(now);
    setQuestionStartTs(now);

    if (practiceMode === 'timed') {
      const initialMs =
        timeLimitMode === 'per_question' ? perQuestionSec * 1000 : perQuizSec * 1000;
      setRemainingMs(initialMs);
    }

    setPageMode('quiz');
  }, [practiceMode, recommendationResult, lessonDetailQuery.data, timeLimitMode, perQuestionSec, perQuizSec]);

  const submitMutation = useMutation({
    mutationFn: async (opts?: { forceFinish?: boolean; timeTakenMsOverride?: number }) => {
      if (practiceMode === 'recommend') {
        if (!recommendationResult) {
          throw new Error('推荐数据不存在');
        }

        const now = Date.now();
        const timeTakenMs = opts?.timeTakenMsOverride ?? now - quizStartTs;

        const questions = recommendationResult.questions;
        const finalAnswers: AttemptAnswer[] = questions.map((q, idx) => {
          const existing = answers[q.id];
          if (existing) return existing;
          const isCurrentQuestion = idx === currentQuestionIndex;
          return {
            questionId: q.id,
            answer: '',
            timedOut: false,
            timeTakenMs: isCurrentQuestion ? now - questionStartTs : 0
          };
        });

        const answersByLesson = new Map<string, AttemptAnswer[]>();
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const answer = finalAnswers[i];
          const list = answersByLesson.get(q.lessonId) ?? [];
          list.push(answer);
          answersByLesson.set(q.lessonId, list);
        }

        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        const results: Array<{
          queued: boolean;
          response?: GrammarAttemptDto;
          lessonId: string;
        }> = [];

        for (const [lessonId, lessonAnswers] of answersByLesson) {
          const clientEventId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}-${lessonId}`;

          const payload: Record<string, unknown> = {
            answers: lessonAnswers,
            clientEventId
          };

          if (!online) {
            await enqueueOfflineEvent({
              type: 'GRAMMAR_ATTEMPT',
              clientEventId,
              payload: {
                lessonId,
                answers: lessonAnswers
              },
              createdAt: new Date().toISOString()
            });
            results.push({ queued: true, lessonId });
            continue;
          }

          try {
            const response = await apiRequest<GrammarAttemptDto>(
              `/grammar/lessons/${lessonId}/attempts`,
              {
                method: 'POST',
                body: JSON.stringify(payload)
              }
            );
            results.push({ queued: false, response, lessonId });
          } catch (_error) {
            await enqueueOfflineEvent({
              type: 'GRAMMAR_ATTEMPT',
              clientEventId,
              payload: {
                lessonId,
                answers: lessonAnswers
              },
              createdAt: new Date().toISOString()
            });
            results.push({ queued: true, lessonId });
          }
        }

        const questionMap = new Map(questions.map((q) => [q.id, q]));
        const totalQuestions = finalAnswers.length;
        let correctCount = 0;
        const details: QuestionResultDetail[] = [];

        for (const answer of finalAnswers) {
          const question = questionMap.get(answer.questionId);
          if (!question) continue;

          const expected = question.answer.trim().toLowerCase();
          const actual = answer.answer.trim().toLowerCase();
          const correct = expected === actual;

          if (correct) correctCount++;

          details.push({
            questionId: question.id,
            correct,
            timedOut: answer.timedOut ?? false,
            userAnswer: answer.answer,
            correctAnswer: question.answer,
            explanation: question.explanation,
            prompt: question.prompt,
            type: question.type,
            options: question.options,
            timeTakenMs: answer.timeTakenMs
          });
        }

        const score = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
        const queued = results.some((r) => r.queued);

        const mergedResult: GrammarAttemptDto = {
          id: `recommend-${Date.now()}`,
          lessonId: 'recommend',
          score,
          totalQuestions,
          correctCount,
          createdAt: new Date().toISOString(),
          details
        };

        return { queued, response: mergedResult, isRecommend: true };
      }

      if (!lessonDetailQuery.data) {
        throw new Error('请先选择知识点');
      }

      const clientEventId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      const now = Date.now();
      const timeTakenMs = opts?.timeTakenMsOverride ?? now - quizStartTs;

      const finalAnswers: AttemptAnswer[] = lessonDetailQuery.data.questions.map((q, idx) => {
        const existing = answers[q.id];
        if (existing) {
          const hasAnswered = existing.answer.trim() !== '';
          return {
            questionId: existing.questionId,
            answer: existing.answer,
            timedOut: !hasAnswered && (existing.timedOut ?? false),
            timeTakenMs: existing.timeTakenMs
          };
        }
        const isCurrentQuestion = idx === currentQuestionIndex;
        const isUnanswered = practiceMode === 'timed' && opts?.forceFinish;
        return {
          questionId: q.id,
          answer: '',
          timedOut: isUnanswered,
          timeTakenMs: isCurrentQuestion ? now - questionStartTs : 0
        };
      });

      const payload: Record<string, unknown> = {
        answers: finalAnswers,
        clientEventId
      };

      if (practiceMode === 'timed') {
        payload.isTimedMode = true;
        payload.timeLimitMode = timeLimitMode;
        payload.timeLimitSec =
          timeLimitMode === 'per_question' ? perQuestionSec : perQuizSec;
        payload.timeTakenMs = timeTakenMs;
      }

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!online) {
        await enqueueOfflineEvent({
          type: 'GRAMMAR_ATTEMPT',
          clientEventId,
          payload: {
            lessonId: lessonDetailQuery.data.id,
            answers: finalAnswers,
            isTimedMode: practiceMode === 'timed' ? true : undefined,
            timeLimitMode: practiceMode === 'timed' ? timeLimitMode : undefined,
            timeLimitSec:
              practiceMode === 'timed'
                ? timeLimitMode === 'per_question'
                  ? perQuestionSec
                  : perQuizSec
                : undefined,
            timeTakenMs: practiceMode === 'timed' ? timeTakenMs : undefined
          },
          createdAt: new Date().toISOString()
        });
        return { queued: true };
      }

      try {
        const response = await apiRequest<GrammarAttemptDto>(
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
            answers: finalAnswers,
            isTimedMode: practiceMode === 'timed' ? true : undefined,
            timeLimitMode: practiceMode === 'timed' ? timeLimitMode : undefined,
            timeLimitSec:
              practiceMode === 'timed'
                ? timeLimitMode === 'per_question'
                  ? perQuestionSec
                  : perQuizSec
                : undefined,
            timeTakenMs: practiceMode === 'timed' ? timeTakenMs : undefined
          },
          createdAt: new Date().toISOString()
        });
        return { queued: true };
      }
    },
    onSuccess: (payload) => {
      clearTimer();
      if (payload.queued) {
        setSubmitMessage('当前离线，练习结果已加入待同步队列');
        setResult(null);
      } else {
        setResult(payload.response ?? null);
        setSubmitMessage('提交成功');
      }
      setPageMode('result');
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['grammar-progress'] });

      if (practiceMode === 'recommend' && !payload.queued) {
        void recommendationQuery.refetch();
      }
    }
  });

  const handleSelectAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        answer,
        timedOut: false
      }
    }));
  };

  const handleNextQuestion = () => {
    if (practiceMode === 'recommend') {
      const questions = recommendationResult?.questions;
      if (!questions) return;

      const currentQ = questions[currentQuestionIndex];
      if (currentQ) {
        const taken = Date.now() - questionStartTs;
        setAnswers((prev) => {
          const existing = prev[currentQ.id];
          return {
            ...prev,
            [currentQ.id]: {
              questionId: currentQ.id,
              answer: existing?.answer ?? '',
              timedOut: false,
              timeTakenMs: existing?.timeTakenMs ?? taken
            }
          };
        });
      }

      if (currentQuestionIndex + 1 >= questions.length) {
        submitMutation.mutate({});
        return;
      }

      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      setQuestionStartTs(Date.now());
      return;
    }

    if (!lessonDetailQuery.data) return;

    const currentQ = lessonDetailQuery.data.questions[currentQuestionIndex];
    if (currentQ) {
      const taken = Date.now() - questionStartTs;
      setAnswers((prev) => {
        const existing = prev[currentQ.id];
        return {
          ...prev,
          [currentQ.id]: {
            questionId: currentQ.id,
            answer: existing?.answer ?? '',
            timedOut: false,
            timeTakenMs: existing?.timeTakenMs ?? taken
          }
        };
      });
    }

    if (currentQuestionIndex + 1 >= lessonDetailQuery.data.questions.length) {
      submitMutation.mutate({});
      return;
    }

    const nextIdx = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIdx);
    setQuestionStartTs(Date.now());

    if (practiceMode === 'timed' && timeLimitMode === 'per_question') {
      setRemainingMs(perQuestionSec * 1000);
    }
  };

  const exitQuiz = () => {
    clearTimer();
    if (practiceMode === 'recommend') {
      setPageMode('recommend-overview');
    } else {
      setPageMode('select');
    }
    setAnswers({});
    setSubmitMessage('');
    setResult(null);
  };

  const goToConfigure = (mode: PracticeMode) => {
    setPracticeMode(mode);
    if (mode === 'normal') {
      startQuiz();
    } else if (mode === 'recommend') {
      fetchRecommendation();
    } else {
      setPageMode('configure');
    }
  };

  function getReasonTypeInfo(type: RecommendationReasonItem['type']) {
    switch (type) {
      case 'weak_point':
        return { label: '薄弱知识点', color: 'bg-red-50 text-red-700 border-red-200', icon: <Target className="h-3 w-3" /> };
      case 'mistake_frequent':
        return { label: '高频错题', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: <AlertTriangle className="h-3 w-3" /> };
      case 'level_up':
        return { label: '进阶挑战', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <TrendingUp className="h-3 w-3" /> };
      case 'review':
        return { label: '复习巩固', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <BookOpen className="h-3 w-3" /> };
      case 'cold_start':
        return { label: '新用户引导', color: 'bg-brand-50 text-brand-700 border-brand-200', icon: <Lightbulb className="h-3 w-3" /> };
      case 'all_mastered':
        return { label: '复习巩固', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> };
    }
  }

  const levelLabel = useMemo(() => {
    if (level === 'all') return '全部级别';
    return formatLessonLevel(level);
  }, [level]);

  const grammarMessageTone = submitMessage.includes('离线') ? 'status-warning' : 'status-success';

  const currentLesson = lessonDetailQuery.data;
  const currentQuestion = currentLesson?.questions[currentQuestionIndex];

  const totalLimitMs =
    practiceMode === 'timed'
      ? timeLimitMode === 'per_question'
        ? perQuestionSec * 1000
        : perQuizSec * 1000
      : 0;
  const remainingPercent = totalLimitMs > 0 ? Math.max(0, (remainingMs / totalLimitMs) * 100) : 100;
  const isNearTimeout = practiceMode === 'timed' && remainingMs < 5000 && remainingMs > 0;
  const isCriticalTimeout = practiceMode === 'timed' && remainingMs < 3000 && remainingMs > 0;

  if (pageMode === 'configure') {
    return (
      <AppShell title="限时测验配置">
        <div className="space-y-5" data-testid="grammar-page">
          <SyncButton
            onSynced={() => {
              void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
              void queryClient.invalidateQueries({ queryKey: ['grammar-progress'] });
            }}
          />

          <section className="card space-y-4 bg-white/95">
            <h2 className="section-title flex items-center gap-2">
              <Settings className="h-4 w-4 text-brand-600" aria-hidden="true" />
              限时测验配置
            </h2>
            <p className="section-subtitle">知识点：{currentLesson?.title ?? '未选择'}</p>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">计时方式</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTimeLimitMode('per_question')}
                  className={`rounded-[var(--radius-control)] border p-4 text-left transition-all ${
                    timeLimitMode === 'per_question'
                      ? 'border-brand-400 bg-brand-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-brand-300'
                  }`}
                  data-testid="timed-mode-per-question"
                >
                  <p className="font-medium">每题限时</p>
                  <p className="mt-1 text-xs text-slate-500">每道题单独倒计时，超时自动跳下一题</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTimeLimitMode('per_quiz')}
                  className={`rounded-[var(--radius-control)] border p-4 text-left transition-all ${
                    timeLimitMode === 'per_quiz'
                      ? 'border-brand-400 bg-brand-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-brand-300'
                  }`}
                  data-testid="timed-mode-per-quiz"
                >
                  <p className="font-medium">整卷限时</p>
                  <p className="mt-1 text-xs text-slate-500">整张试卷统一倒计时，时间耗尽自动提交</p>
                </button>
              </div>
            </div>

            {timeLimitMode === 'per_question' ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  每题限时（秒）：{perQuestionSec}s
                </label>
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={perQuestionSec}
                  onChange={(e) => setPerQuestionSec(Number(e.target.value))}
                  className="w-full accent-brand-600"
                  data-testid="per-question-slider"
                />
                <div className="flex flex-wrap gap-2">
                  {[10, 20, 30, 60].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPerQuestionSec(s)}
                      className={`rounded-full border px-3 py-1 text-xs transition-all ${
                        perQuestionSec === s
                          ? 'border-brand-400 bg-brand-100 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  整卷限时：{formatSeconds(perQuizSec)}
                </label>
                <input
                  type="range"
                  min={60}
                  max={1800}
                  step={30}
                  value={perQuizSec}
                  onChange={(e) => setPerQuizSec(Number(e.target.value))}
                  className="w-full accent-brand-600"
                  data-testid="per-quiz-slider"
                />
                <div className="flex flex-wrap gap-2">
                  {[180, 300, 600, 900].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPerQuizSec(s)}
                      className={`rounded-full border px-3 py-1 text-xs transition-all ${
                        perQuizSec === s
                          ? 'border-brand-400 bg-brand-100 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                      }`}
                    >
                      {formatSeconds(s)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPageMode('select')}
                data-testid="configure-back"
              >
                返回
              </button>
              <button
                type="button"
                className="btn-primary flex items-center gap-1.5"
                onClick={startQuiz}
                data-testid="start-timed-quiz"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                开始限时测验
              </button>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  if (pageMode === 'recommend-overview' && recommendationResult) {
    const questions = recommendationResult.questions;
    const reasons = recommendationResult.reasons;

    const lessonQuestionCount = new Map<string, number>();
    for (const q of questions) {
      const count = lessonQuestionCount.get(q.lessonId) ?? 0;
      lessonQuestionCount.set(q.lessonId, count + 1);
    }

    return (
      <AppShell title="智能推荐练习">
        <div className="space-y-5" data-testid="recommend-overview-page">
          <SyncButton
            onSynced={() => {
              void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
              void queryClient.invalidateQueries({ queryKey: ['grammar-progress'] });
            }}
          />

          {recommendationQuery.isFetching ? (
            <div className="card bg-white/95 p-8 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
              <p className="mt-3 text-sm text-slate-600">正在为您生成个性化推荐...</p>
            </div>
          ) : null}

          <section className="card space-y-4 bg-white/95" data-testid="recommend-summary-section">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Brain className="h-5 w-5 text-purple-600" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="section-title text-lg" data-testid="recommend-summary-title">
                    智能推荐结果
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{recommendationResult.summary}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchRecommendation}
                disabled={recommendationQuery.isFetching}
                className="btn-secondary text-xs flex items-center gap-1"
                data-testid="refresh-recommendation"
              >
                <RefreshCw
                  className={`h-3 w-3 ${recommendationQuery.isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                刷新推荐
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-control)] border border-purple-200 bg-purple-50 p-4">
                <p className="text-xs text-purple-600">推荐题目</p>
                <p className="mt-1 text-2xl font-bold text-purple-700 tabular-nums">
                  {questions.length}
                  <span className="text-sm font-medium text-purple-500"> 题</span>
                </p>
              </div>
              <div className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-600">覆盖知识点</p>
                <p className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">
                  {reasons.length}
                  <span className="text-sm font-medium text-slate-500"> 个</span>
                </p>
              </div>
              <div className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-600">推荐类型</p>
                <p className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">
                  {recommendationResult.isColdStart
                    ? '新用户'
                    : recommendationResult.allMastered
                      ? '复习'
                      : '薄弱优先'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <label className="text-sm font-medium text-slate-700">题目数量：</label>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setRecommendQuestionCount(num);
                      void recommendationQuery.refetch();
                    }}
                    className={`rounded-full border px-3 py-1 text-xs transition-all ${
                      recommendQuestionCount === num
                        ? 'border-purple-400 bg-purple-100 text-purple-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300'
                    }`}
                    data-testid={`recommend-count-${num}`}
                  >
                    {num} 题
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card space-y-4 bg-white/95" data-testid="recommend-reasons-section">
            <h2 className="section-title flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden="true" />
              为什么推荐这些？
            </h2>

            <div className="space-y-3">
              {reasons.map((reason, idx) => {
                const reasonInfo = getReasonTypeInfo(reason.type);
                const qCount = lessonQuestionCount.get(reason.lessonId) ?? 0;
                return (
                  <div
                    key={reason.lessonId}
                    className={`rounded-[var(--radius-control)] border p-4 ${reasonInfo.color.replace('text-', 'border-').split(' ')[1]} ${reasonInfo.color.split(' ')[0]}`}
                    data-testid={`recommend-reason-${reason.lessonId}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 shadow-sm"
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-800">{reason.lessonTitle}</p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${reasonInfo.color}`}
                            >
                              {reasonInfo.icon}
                              {reasonInfo.label}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {formatLessonLevel(reason.level)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{reason.description}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                            {reason.score !== undefined && reason.score > 0 && (
                              <span>最近得分：{reason.score}%</span>
                            )}
                            {reason.correctRate !== undefined && reason.correctRate > 0 && (
                              <span>正确率：{reason.correctRate}%</span>
                            )}
                            {reason.mistakeCount !== undefined && reason.mistakeCount > 0 && (
                              <span>错题次数：{reason.mistakeCount}</span>
                            )}
                            <span>包含题目：{qCount} 题</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setPageMode('select');
                setRecommendationResult(null);
              }}
              data-testid="recommend-back"
            >
              返回知识点
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5"
              onClick={startQuiz}
              data-testid="start-recommend-practice"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              开始推荐练习
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (pageMode === 'quiz') {
    const recommendQuestions = recommendationResult?.questions;
    const isRecommendQuiz = practiceMode === 'recommend' && recommendQuestions;

    const displayLesson = isRecommendQuiz
      ? {
          id: 'recommend',
          title: '智能推荐练习',
          level: 'basic' as const,
          content: '',
          questions: recommendQuestions
        }
      : currentLesson;
    const displayQuestion = isRecommendQuiz
      ? recommendQuestions[currentQuestionIndex]
      : currentQuestion;

    if (!displayLesson || !displayQuestion) {
      return null;
    }
    const progressPercent =
      ((currentQuestionIndex + 1) / displayLesson.questions.length) * 100;

    return (
      <AppShell title="语法测验">
        <div className="space-y-5" data-testid="grammar-quiz-page">
          {practiceMode === 'timed' ? (
            <section
              className={`card space-y-3 ${
                isCriticalTimeout
                  ? 'border-red-400 bg-red-50/95 animate-pulse'
                  : isNearTimeout
                    ? 'border-amber-400 bg-amber-50/95'
                    : 'bg-white/95'
              }`}
              data-testid="timer-section"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer
                    className={`h-5 w-5 ${
                      isCriticalTimeout
                        ? 'text-red-600'
                        : isNearTimeout
                          ? 'text-amber-600'
                          : 'text-brand-600'
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-lg font-semibold tabular-nums ${
                      isCriticalTimeout
                        ? 'text-red-700'
                        : isNearTimeout
                          ? 'text-amber-700'
                          : 'text-slate-800'
                    }`}
                  >
                    {formatDuration(Math.max(0, remainingMs))}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  {timeLimitMode === 'per_question' ? '每题限时' : '整卷限时'}
                  <span className="ml-1 text-slate-400">
                    {formatSeconds(
                      timeLimitMode === 'per_question' ? perQuestionSec : perQuizSec
                    )}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-200 ease-linear ${
                    isCriticalTimeout
                      ? 'bg-red-500'
                      : isNearTimeout
                        ? 'bg-amber-500'
                        : 'bg-brand-600'
                  }`}
                  style={{ width: `${remainingPercent}%` }}
                  data-testid="timer-progress-bar"
                />
              </div>
              {(isNearTimeout || isCriticalTimeout) && (
                <div
                  className={`flex items-center gap-1.5 text-xs ${
                    isCriticalTimeout ? 'text-red-700' : 'text-amber-700'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  {isCriticalTimeout ? '即将超时，请尽快作答！' : '临近超时，请加快速度'}
                </div>
              )}
            </section>
          ) : null}

          <section className="card space-y-4 bg-white/95">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title text-sm" data-testid="quiz-lesson-title">
                  <FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  {displayLesson.title}
                </h2>
                {isRecommendQuiz && 'lessonTitle' in displayQuestion && 'level' in displayQuestion ? (
                  <p className="mt-0.5 text-xs text-purple-600">
                    知识点：{String(displayQuestion.lessonTitle)} · {formatLessonLevel(displayQuestion.level as 'basic' | 'intermediate' | 'advanced')}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-slate-500">
                  第 {currentQuestionIndex + 1} / {displayLesson.questions.length} 题
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={exitQuiz}
                data-testid="exit-quiz"
              >
                退出
              </button>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div
              key={displayQuestion.id}
              className="animate-fadeIn rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 p-4"
              data-testid={`quiz-question-${displayQuestion.id}`}
            >
              <p className="inline-flex items-start gap-1.5 text-sm font-medium">
                <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                {currentQuestionIndex + 1}. {displayQuestion.prompt}
              </p>

              {displayQuestion.type === 'single_choice' ? (
                <div className="mt-3 grid gap-2">
                  {displayQuestion.options.map((option, optionIndex) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
                        answers[displayQuestion.id]?.answer === option
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-slate-200 bg-white hover:border-brand-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={displayQuestion.id}
                        className="h-4 w-4 accent-brand-600"
                        value={option}
                        checked={answers[displayQuestion.id]?.answer === option}
                        onChange={(event) =>
                          handleSelectAnswer(displayQuestion.id, event.target.value)
                        }
                        data-testid={`quiz-option-${displayQuestion.id}-${optionIndex}`}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  className="input-control mt-3"
                  value={answers[displayQuestion.id]?.answer ?? ''}
                  onChange={(event) =>
                    handleSelectAnswer(displayQuestion.id, event.target.value)
                  }
                  placeholder="请输入答案"
                  data-testid={`quiz-input-${displayQuestion.id}`}
                />
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary flex items-center gap-1.5"
                onClick={handleNextQuestion}
                data-testid="quiz-next"
              >
                {currentQuestionIndex + 1 >= displayLesson.questions.length
                  ? '提交试卷'
                  : '下一题'}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  if (pageMode === 'result') {
    const details = result?.details ?? [];

    return (
      <AppShell title="测验结果">
        <div className="space-y-5" data-testid="grammar-result-page">
          <SyncButton
            onSynced={() => {
              void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
              void queryClient.invalidateQueries({ queryKey: ['grammar-progress'] });
            }}
          />

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
            <>
              <section className="card space-y-4 bg-white/95" data-testid="result-summary">
                <h2 className="section-title flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-brand-600" aria-hidden="true" />
                  测验结果
                </h2>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-[var(--radius-control)] border border-brand-200 bg-brand-50 p-4">
                    <p className="text-xs text-brand-600">得分</p>
                    <p className="mt-1 text-2xl font-bold text-brand-700 tabular-nums">
                      {result.score}
                      <span className="text-sm font-medium text-brand-500">/100</span>
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-600">正确率</p>
                    <p className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">
                      {result.correctCount}
                      <span className="text-sm font-medium text-slate-500">
                        /{result.totalQuestions}
                      </span>
                    </p>
                  </div>
                  {result.isTimedMode ? (
                    <>
                      <div className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs text-slate-600">用时</p>
                        <p className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">
                          {formatDuration(result.timeTakenMs ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-[var(--radius-control)] border border-red-200 bg-red-50 p-4">
                        <p className="text-xs text-red-600">超时未答</p>
                        <p className="mt-1 text-2xl font-bold text-red-700 tabular-nums">
                          {result.timeoutCount ?? 0}
                          <span className="text-sm font-medium text-red-500">题</span>
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>

                {result.isTimedMode ? (
                  <div className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-600">
                    <Clock className="mr-1 inline-block h-4 w-4 text-slate-500" aria-hidden="true" />
                    限时模式：
                    {result.timeLimitMode === 'per_question' ? '每题限时' : '整卷限时'}
                    <span className="ml-1 text-slate-500">
                      （{formatSeconds(result.timeLimitSec ?? 0)}）
                    </span>
                  </div>
                ) : null}

                {result.isTimedMode ? (
                  <div
                    className="rounded-[var(--radius-control)] border border-blue-200 bg-blue-50/60 p-3 text-sm"
                    data-testid="time-comparison"
                  >
                    {result.historicalAvgTimeMs != null && result.timedAttemptCount != null && result.timedAttemptCount > 0 ? (
                      <>
                        <Clock className="mr-1 inline-block h-4 w-4 text-blue-500" aria-hidden="true" />
                        <span className="text-slate-700">历史平均用时</span>
                        <span className="mx-1 font-medium text-blue-700 tabular-nums">
                          {formatDuration(result.historicalAvgTimeMs)}
                        </span>
                        <span className="text-slate-500">（{result.timedAttemptCount} 次限时测验）</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        {(() => {
                          const diff = (result.historicalAvgTimeMs ?? 0) - (result.timeTakenMs ?? 0);
                          const diffSec = Math.abs(Math.round(diff / 1000));
                          if (diff > 0) {
                            return (
                              <span className="font-medium text-emerald-700">
                                比平均快 {diffSec} 秒
                              </span>
                            );
                          } else if (diff < 0) {
                            return (
                              <span className="font-medium text-amber-700">
                                比平均慢 {diffSec} 秒
                              </span>
                            );
                          } else {
                            return (
                              <span className="font-medium text-slate-600">
                                与平均用时相同
                              </span>
                            );
                          }
                        })()}
                      </>
                    ) : (
                      <>
                        <Clock className="mr-1 inline-block h-4 w-4 text-blue-500" aria-hidden="true" />
                        <span className="text-slate-600">该知识点首次限时测验，暂无历史平均用时对比</span>
                      </>
                    )}
                  </div>
                ) : null}
              </section>

              {details.length > 0 ? (
                <section className="card space-y-4 bg-white/95" data-testid="result-details">
                  <h2 className="section-title flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-brand-600" aria-hidden="true" />
                    逐题解析
                  </h2>

                  <div className="space-y-3">
                    {details.map((item: QuestionResultDetail, idx: number) => (
                      <div
                        key={item.questionId}
                        className={`rounded-[var(--radius-control)] border p-4 ${
                          item.correct
                            ? 'border-green-200 bg-green-50/70'
                            : item.timedOut
                              ? 'border-red-200 bg-red-50/70'
                              : 'border-amber-200 bg-amber-50/70'
                        }`}
                        data-testid={`detail-${item.questionId}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 shadow-sm">
                              {idx + 1}
                            </span>
                            <p className="text-sm font-medium text-slate-800">{item.prompt}</p>
                          </div>
                          <div className="shrink-0">
                            {item.correct ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                正确
                              </span>
                            ) : item.timedOut ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                                超时
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                错误
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-500">你的答案</p>
                            <p
                              className={`mt-1 font-medium ${
                                item.correct
                                  ? 'text-green-700'
                                  : item.timedOut
                                    ? 'text-red-700 italic'
                                    : 'text-amber-700'
                              }`}
                            >
                              {item.userAnswer ? item.userAnswer : '(未作答)'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">正确答案</p>
                            <p className="mt-1 font-medium text-green-700">{item.correctAnswer}</p>
                          </div>
                        </div>

                        {item.timeTakenMs !== undefined && result.isTimedMode ? (
                          <p className="mt-2 text-xs text-slate-500">
                            用时：{(item.timeTakenMs / 1000).toFixed(1)}s
                          </p>
                        ) : null}

                        <div className="mt-3 rounded-lg border border-slate-200 bg-white/70 p-3">
                          <p className="text-xs font-medium text-slate-600">解析</p>
                          <p className="mt-1 text-sm text-slate-700">{item.explanation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={exitQuiz}
              data-testid="result-back"
            >
              {practiceMode === 'recommend' ? '返回推荐' : '返回知识点'}
            </button>
            {practiceMode === 'timed' ? (
              <button
                type="button"
                className="btn-primary flex items-center gap-1.5"
                onClick={() => setPageMode('configure')}
                data-testid="retry-timed"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                再来一次（限时）
              </button>
            ) : null}
            {practiceMode === 'recommend' ? (
              <button
                type="button"
                className="btn-primary flex items-center gap-1.5"
                onClick={() => {
                  void recommendationQuery.refetch();
                  setPageMode('recommend-overview');
                }}
                data-testid="continue-recommend"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                刷新推荐继续练习
              </button>
            ) : null}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="语法学习与练习">
      <div className="space-y-5" data-testid="grammar-page">
        <SyncButton
          onSynced={() => {
            void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
            void queryClient.invalidateQueries({ queryKey: ['grammar-progress'] });
          }}
        />

        <section className="card bg-white/95">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/grammar/mistakes"
              className="flex items-center justify-between rounded-[var(--radius-control)] border border-brand-200 bg-brand-50 p-4 transition-all hover:border-brand-400 hover:bg-brand-100/80"
              data-testid="mistakes-entry"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
                  <BookX className="h-5 w-5 text-brand-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-brand-800">语法错题本</p>
                  <p className="text-xs text-brand-600">查看答错的题目，支持重练巩固</p>
                </div>
              </div>
              <span className="text-sm text-brand-600">进入 →</span>
            </Link>

            <button
              type="button"
              onClick={() => goToConfigure('recommend')}
              className="flex items-center justify-between rounded-[var(--radius-control)] border border-purple-200 bg-purple-50 p-4 text-left transition-all hover:border-purple-400 hover:bg-purple-100/80"
              data-testid="recommend-entry"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Brain className="h-5 w-5 text-purple-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-purple-800">智能推荐练习</p>
                  <p className="text-xs text-purple-600">根据学习数据，个性化推荐练习内容</p>
                </div>
              </div>
              <span className="text-sm text-purple-600">开始 →</span>
            </button>
          </div>
        </section>

        {levelMastery ? (
          <section className="card space-y-4 bg-white/95" data-testid="level-mastery-section">
            <h2 className="section-title">
              <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
              等级掌握度概览
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['basic', 'intermediate', 'advanced'] as const).map((lv) => {
                const mastery = levelMastery[lv];
                const percent = mastery.masteryPercent;
                const isUnlocked =
                  lv === 'basic' ||
                  (lv === 'intermediate' &&
                    (mastery.total === 0 ||
                      levelMastery.basic.mastered >= 1)) ||
                  (lv === 'advanced' &&
                    (levelMastery.intermediate.total === 0
                      ? levelMastery.basic.total === 0 || levelMastery.basic.mastered >= 1
                      : levelMastery.intermediate.mastered >= 1));
                return (
                  <div
                    key={lv}
                    className={`rounded-[var(--radius-control)] border p-4 transition-all ${
                      isUnlocked
                        ? 'border-slate-200 bg-slate-50/50'
                        : 'border-slate-200 bg-slate-100/70 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">
                        {formatLessonLevel(lv)}
                      </p>
                      {!isUnlocked && (
                        <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-slate-900 tabular-nums">
                        {mastery.mastered}
                      </span>
                      <span className="text-xs text-slate-500">/ {mastery.total} 已掌握</span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isUnlocked
                            ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                            : 'bg-gradient-to-r from-slate-400 to-slate-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500 tabular-nums">
                      掌握度 {percent}%
                      {!isUnlocked && mastery.total > 0 && lv !== 'basic' ? ' · 待解锁' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

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

          <p className="section-subtitle" data-testid="grammar-level-label">
            当前筛选：{levelLabel}
          </p>

          <div className="grid gap-3 sm:grid-cols-2" data-testid="grammar-lesson-list">
            {lessons.map((lesson) => {
              const statusInfo = getStatusInfo(lesson.status);
              const isUnlocking = unlockingLessonIds.has(lesson.lessonId);
              const isSelected = lesson.lessonId === selectedLessonId;

              return (
                <div key={lesson.lessonId} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (lesson.locked) return;
                      setSelectedLessonId(lesson.lessonId);
                      setAnswers({});
                      setResult(null);
                      setSubmitMessage('');
                    }}
                    disabled={lesson.locked}
                    className={`relative w-full overflow-hidden rounded-[var(--radius-control)] border p-3 text-left transition-all ${
                      lesson.locked
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50/70 opacity-80'
                        : isSelected
                          ? 'border-brand-400 bg-brand-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm'
                    }`}
                    data-testid={`lesson-item-${lesson.lessonId}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-medium text-slate-900">
                          {lesson.title}
                          {lesson.status === 'mastered' && !lesson.locked && (
                            <CheckCircle2
                              className="h-4 w-4 shrink-0 text-emerald-500"
                              aria-hidden="true"
                            />
                          )}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                          >
                            {getStatusIcon(lesson.status)}
                            {statusInfo.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatLessonLevel(lesson.level)}
                          </span>
                          {lesson.attemptCount > 0 && (
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              · 练习 {lesson.attemptCount} 次
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {lesson.locked ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
                              <Lock className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                              锁定
                            </span>
                          </div>
                        ) : (
                          <p
                            className={`text-lg font-bold tabular-nums ${
                              lesson.status === 'mastered'
                                ? 'text-emerald-600'
                                : lesson.status === 'learning'
                                  ? 'text-amber-600'
                                  : 'text-slate-400'
                            }`}
                          >
                            {lesson.progressPercent}
                            <span className="text-xs font-medium">%</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {!lesson.locked ? (
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${getProgressBarColor(lesson.status)} animate-progressGrow`}
                          style={{ width: `${lesson.progressPercent}%` }}
                        />
                      </div>
                    ) : lesson.lockReason ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        <Lock className="mr-0.5 inline h-3 w-3 align-middle" aria-hidden="true" />
                        {lesson.lockReason}
                      </p>
                    ) : null}

                    {isUnlocking && (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-control)] bg-white/40 backdrop-blur-sm">
                        <div className="animate-unlock">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 shadow-lg ring-4 ring-emerald-200">
                            <Unlock className="h-7 w-7 text-emerald-600" aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {selectedLessonProgress && !selectedLessonProgress.locked ? (
          <section
            className="card space-y-4 bg-white/95 animate-fadeIn"
            data-testid="grammar-detail-section"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="section-title text-lg" data-testid="grammar-lesson-title">
                  <FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  {lessonDetailQuery.data?.title ?? selectedLessonProgress.title}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusInfo(selectedLessonProgress.status).color} animate-popIn`}
                >
                  {getStatusIcon(selectedLessonProgress.status)}
                  {getStatusInfo(selectedLessonProgress.status).label}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {lessonDetailQuery.data?.content ?? selectedLessonProgress.content}
              </p>
              <div className="mt-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">学习进度</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      selectedLessonProgress.status === 'mastered'
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {selectedLessonProgress.progressPercent}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${getProgressBarColor(selectedLessonProgress.status)}`}
                    style={{ width: `${selectedLessonProgress.progressPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span>最近得分：{selectedLessonProgress.lastScore ?? '—'}</span>
                  <span>练习次数：{selectedLessonProgress.attemptCount}</span>
                  {selectedLessonProgress.lastAttemptAt && (
                    <span>上次练习：{selectedLessonProgress.lastAttemptAt.slice(0, 10)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="btn-secondary flex items-center justify-center gap-2"
                onClick={() => goToConfigure('normal')}
                data-testid="start-normal-practice"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                普通练习
              </button>
              <button
                type="button"
                className="btn-primary flex items-center justify-center gap-2"
                onClick={() => goToConfigure('timed')}
                data-testid="start-timed-entry"
              >
                <Timer className="h-4 w-4" aria-hidden="true" />
                限时测验
              </button>
            </div>

            {lessonDetailQuery.data ? (
              <div className="space-y-4" data-testid="grammar-questions">
                {lessonDetailQuery.data.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 p-3"
                    data-testid={`question-${question.id}`}
                  >
                    <p className="inline-flex items-start gap-1.5 text-sm font-medium">
                      <ListChecks
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                        aria-hidden="true"
                      />
                      {index + 1}. {question.prompt}
                    </p>

                    {question.type === 'single_choice' ? (
                      <div className="mt-2 grid gap-2">
                        {question.options.map((option, optionIndex) => (
                          <label
                            key={option}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="radio"
                              name={question.id}
                              className="h-4 w-4 accent-brand-600"
                              value={option}
                              checked={answers[question.id]?.answer === option}
                              onChange={(event) =>
                                handleSelectAnswer(question.id, event.target.value)
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
                        value={answers[question.id]?.answer ?? ''}
                        onChange={(event) =>
                          handleSelectAnswer(question.id, event.target.value)
                        }
                        placeholder="请输入答案"
                        data-testid={`question-input-${question.id}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {lessonDetailQuery.data ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => submitMutation.mutate({})}
                data-testid="submit-attempt"
              >
                {submitMutation.isPending ? '提交中...' : '提交练习'}
              </button>
            ) : null}

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

            {result && !result.details ? (
              <div className="status-success" data-testid="attempt-result">
                <CheckCircle2 className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
                得分：{result.score}，正确 {result.correctCount}/{result.totalQuestions}
              </div>
            ) : null}
          </section>
        ) : selectedLessonProgress && selectedLessonProgress.locked ? (
          <section
            className="card space-y-4 bg-slate-50/80 border-slate-200 animate-fadeIn"
            data-testid="locked-lesson-section"
          >
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-200">
                <Lock className="h-7 w-7 text-slate-500" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                知识点已锁定：{selectedLessonProgress.title}
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                {selectedLessonProgress.lockReason ??
                  '请先完成前置等级知识点的学习并达到掌握要求。'}
              </p>
              <p className="mt-4 text-xs text-slate-400">
                级别：{formatLessonLevel(selectedLessonProgress.level)}
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}