'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Clock3, FileText, Flame, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
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

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { ready } = useRequireAuth();

  const statsQuery = useQuery({
    queryKey: ['stats-overview'],
    queryFn: () => apiRequest<StatsOverview>('/stats/overview'),
    enabled: ready
  });

  const stats = statsQuery.data;

  return (
    <AppShell title="学习面板">
      <div className="space-y-5" data-testid="dashboard-page">
        <SyncButton
          onSynced={() => {
            void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
          }}
        />

        {statsQuery.isLoading ? (
          <div className="status-neutral" data-testid="dashboard-loading">
            加载中...
          </div>
        ) : null}

        {stats ? (
          <>
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
