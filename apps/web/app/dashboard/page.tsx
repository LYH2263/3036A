'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Flame,
  ListChecks,
  Sparkles,
  Target,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';

import { AppShell } from '../../components/app-shell';
import { OfflineQueuePanel } from '../../components/offline-queue-panel';
import { SyncButton } from '../../components/sync-button';
import { apiRequest } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';

interface StatsOverview {
  todayReviewCount: number;
  todayNewWords: number;
  vocabularyTotal: number;
  totalReviews: number;
  grammarAttempts: number;
  grammarCorrectRate: number;
  streakDays: number;
  achievements: Array<{ code: string; title: string; description: string }>;
}

interface ReminderItem {
  type: 'overdue_review' | 'today_review' | 'mistake_retry' | 'unmet_goal';
  title: string;
  count: number;
  urgency: number;
  href: string;
  description: string;
}

interface RemindersResponse {
  items: ReminderItem[];
  allCleared: boolean;
  totalCount: number;
}

function getReminderIcon(type: ReminderItem['type']) {
  switch (type) {
    case 'overdue_review':
      return AlertTriangle;
    case 'mistake_retry':
      return XCircle;
    case 'today_review':
      return ListChecks;
    case 'unmet_goal':
      return Target;
    default:
      return Clock3;
  }
}

function getReminderStyles(urgency: number) {
  switch (urgency) {
    case 1:
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-600',
        title: 'text-red-900',
        desc: 'text-red-700',
        badge: 'bg-red-100 text-red-700',
        btn: 'bg-red-600 hover:bg-red-700 text-white'
      };
    case 2:
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-600',
        title: 'text-amber-900',
        desc: 'text-amber-700',
        badge: 'bg-amber-100 text-amber-700',
        btn: 'bg-amber-600 hover:bg-amber-700 text-white'
      };
    case 3:
      return {
        bg: 'bg-brand-50',
        border: 'border-brand-200',
        icon: 'text-brand-600',
        title: 'text-brand-900',
        desc: 'text-brand-700',
        badge: 'bg-brand-100 text-brand-700',
        btn: 'bg-brand-600 hover:bg-brand-700 text-white'
      };
    case 4:
    default:
      return {
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        icon: 'text-slate-600',
        title: 'text-slate-900',
        desc: 'text-slate-700',
        badge: 'bg-slate-100 text-slate-700',
        btn: 'bg-slate-600 hover:bg-slate-700 text-white'
      };
  }
}

function useMidnightRefresh(invalidateFn: () => void) {
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    const timer = setTimeout(() => {
      invalidateFn();
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, [invalidateFn]);
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { ready } = useRequireAuth();

  const statsQuery = useQuery({
    queryKey: ['stats-overview'],
    queryFn: () => apiRequest<StatsOverview>('/stats/overview'),
    enabled: ready
  });

  const remindersQuery = useQuery({
    queryKey: ['stats-reminders'],
    queryFn: () => apiRequest<RemindersResponse>('/stats/reminders'),
    enabled: ready,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000
  });

  const stats = statsQuery.data;
  const reminders = remindersQuery.data;

  const invalidateAll = useMemo(() => {
    return () => {
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['stats-reminders'] });
    };
  }, [queryClient]);

  useMidnightRefresh(invalidateAll);

  return (
    <AppShell title="学习面板">
      <div className="space-y-5" data-testid="dashboard-page">
        <SyncButton
          onSynced={() => {
            invalidateAll();
          }}
        />

        <OfflineQueuePanel
          onSynced={() => {
            invalidateAll();
          }}
        />

        {statsQuery.isLoading && remindersQuery.isLoading ? (
          <div className="status-neutral" data-testid="dashboard-loading">
            加载中...
          </div>
        ) : null}

        {stats ? (
          <>
            {reminders ? (
              <section
                className="card space-y-4 bg-white/95"
                data-testid="dashboard-reminders"
              >
                <h2 className="section-title">
                  <Clock3 className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  今日提醒
                  {!reminders.allCleared ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {reminders.items.length} 项
                    </span>
                  ) : null}
                </h2>

                {reminders.allCleared ? (
                  <div
                    className="flex flex-col items-center justify-center py-8 text-center"
                    data-testid="reminders-cleared"
                  >
                    <CheckCircle2
                      className="h-12 w-12 text-emerald-500"
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-lg font-semibold text-emerald-700">
                      今日已清空
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      太棒了！所有待办事项都已完成，继续保持！
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reminders.items.map((item) => {
                      const Icon = getReminderIcon(item.type);
                      const styles = getReminderStyles(item.urgency);
                      return (
                        <div
                          key={item.type}
                          className={`flex items-start gap-3 rounded-[var(--radius-control)] border ${styles.border} ${styles.bg} p-3 transition-colors`}
                          data-testid={`reminder-item-${item.type}`}
                        >
                          <div className="shrink-0">
                            <Icon
                              className={`h-5 w-5 ${styles.icon}`}
                              aria-hidden="true"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${styles.title}`}>
                                {item.title}
                              </p>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}
                              >
                                {item.count}
                              </span>
                            </div>
                            <p className={`mt-0.5 text-xs ${styles.desc}`}>
                              {item.description}
                            </p>
                          </div>
                          <div className="shrink-0">
                            <Link
                              href={item.href}
                              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${styles.btn}`}
                              data-testid={`reminder-go-${item.type}`}
                            >
                              去处理
                              <ArrowRight
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-stats">
              <div className="card card-hover bg-white/95" data-testid="dashboard-card-today-review">
                <p className="stat-label">
                  <Clock3 className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  今日待复习
                </p>
                <p className="stat-value">{stats.todayReviewCount}</p>
              </div>
              <div className="card card-hover bg-white/95" data-testid="dashboard-card-today-new-words">
                <p className="stat-label">
                  <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  今日新增词汇
                </p>
                <p className="stat-value">{stats.todayNewWords}</p>
              </div>
              <div className="card card-hover bg-white/95" data-testid="dashboard-card-grammar-attempts">
                <p className="stat-label">
                  <FileText className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  语法练习次数
                </p>
                <p className="stat-value">{stats.grammarAttempts}</p>
              </div>
              <div className="card card-hover bg-white/95" data-testid="dashboard-card-streak-days">
                <p className="stat-label">
                  <Flame className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  连续学习天数
                </p>
                <p className="stat-value">{stats.streakDays}</p>
              </div>
            </section>

            {stats.vocabularyTotal === 0 && stats.grammarAttempts === 0 ? (
              <div className="status-neutral" data-testid="dashboard-empty-state">
                当前还没有学习记录，去查询并加入第一个单词吧。
              </div>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-3" data-testid="dashboard-shortcuts">
              <Link
                href="/vocabulary"
                className="card card-hover group border-slate-200/90 bg-white/95"
                data-testid="dashboard-go-vocabulary"
              >
                <p className="section-title text-sm">
                  <BookOpen className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  开始词汇学习
                </p>
                <p className="mt-1 text-sm text-slate-500">搜索词条、加入生词本并完成复习。</p>
                <span className="mt-3 inline-flex items-center text-xs font-medium text-brand-700">
                  进入
                  <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
              <Link
                href="/grammar"
                className="card card-hover group border-slate-200/90 bg-white/95"
                data-testid="dashboard-go-grammar"
              >
                <p className="section-title text-sm">
                  <FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  继续语法练习
                </p>
                <p className="mt-1 text-sm text-slate-500">按级别选择知识点并提交练习。</p>
                <span className="mt-3 inline-flex items-center text-xs font-medium text-brand-700">
                  进入
                  <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
              <Link
                href="/progress"
                className="card card-hover group border-slate-200/90 bg-white/95"
                data-testid="dashboard-go-progress"
              >
                <p className="section-title text-sm">
                  <Flame className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  查看学习进度
                </p>
                <p className="mt-1 text-sm text-slate-500">查看统计与已解锁成就。</p>
                <span className="mt-3 inline-flex items-center text-xs font-medium text-brand-700">
                  进入
                  <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
