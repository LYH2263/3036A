'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, FileText, Flame, Percent, RefreshCw, BookOpen, Trophy } from 'lucide-react';

import { AppShell } from '../../components/app-shell';
import { apiRequest } from '../../lib/api';
import { formatPercent } from '../../lib/helpers';
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

export default function ProgressPage() {
  const { ready } = useRequireAuth();

  const statsQuery = useQuery({
    queryKey: ['stats-overview'],
    queryFn: () => apiRequest<StatsOverview>('/stats/overview'),
    enabled: ready
  });

  const stats = statsQuery.data;

  return (
    <AppShell title="进度与成就">
      <div className="space-y-5" data-testid="progress-page">
        {statsQuery.isLoading ? (
          <div className="status-neutral" data-testid="progress-loading">
            加载中...
          </div>
        ) : null}

        {stats ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="progress-stats">
              <div className="card card-hover bg-white/95" data-testid="progress-card-vocabulary-total">
                <p className="stat-label">
                  <BookOpen className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  累计加入词汇
                </p>
                <p className="stat-value">{stats.vocabularyTotal}</p>
              </div>
              <div className="card card-hover bg-white/95" data-testid="progress-card-total-reviews">
                <p className="stat-label">
                  <RefreshCw className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  累计词汇复习
                </p>
                <p className="stat-value">{stats.totalReviews}</p>
              </div>
              <div className="card card-hover bg-white/95" data-testid="progress-card-grammar-rate">
                <p className="stat-label">
                  <Percent className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  语法练习正确率
                </p>
                <p className="stat-value">{formatPercent(stats.grammarCorrectRate)}</p>
              </div>
              <div className="card card-hover bg-white/95" data-testid="progress-card-grammar-attempts">
                <p className="stat-label">
                  <FileText className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  语法练习次数
                </p>
                <p className="stat-value">{stats.grammarAttempts}</p>
              </div>
              <div className="card card-hover bg-white/95" data-testid="progress-card-streak">
                <p className="stat-label">
                  <Flame className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  连续学习
                </p>
                <p className="stat-value">{stats.streakDays} 天</p>
              </div>
              <div className="card card-hover bg-white/95" data-testid="progress-card-today">
                <p className="stat-label">
                  <CalendarDays className="h-4 w-4 text-brand-500" aria-hidden="true" />
                  今日复习 / 新增
                </p>
                <p className="stat-value">
                  {stats.todayReviewCount} / {stats.todayNewWords}
                </p>
              </div>
            </section>

            <section className="card space-y-3 bg-white/95" data-testid="progress-achievements">
              <h2 className="section-title">
                <Trophy className="h-4 w-4 text-brand-600" aria-hidden="true" />
                已解锁成就
              </h2>
              {stats.achievements.length === 0 ? (
                <p className="status-neutral mt-1" data-testid="progress-achievements-empty">
                  暂未解锁成就，继续学习即可解锁。
                </p>
              ) : (
                <ul className="space-y-2" data-testid="progress-achievements-list">
                  {stats.achievements.map((item) => (
                    <li
                      key={item.code}
                      className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/60 p-3"
                      data-testid={`achievement-${item.code}`}
                    >
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-slate-600">{item.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
