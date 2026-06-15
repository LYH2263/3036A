'use client';

import type { AuthResponse } from '@lexigram/shared';
import { LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { apiRequest, ApiError } from '../../lib/api';
import { emailValid } from '../../lib/helpers';
import { syncOfflineQueue } from '../../lib/sync';
import { useAuthStore } from '../../store/auth-store';

export default function AuthPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const setAuth = useAuthStore((state) => state.setAuth);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && token) {
      router.replace('/dashboard');
    }
  }, [hydrated, token, router]);

  if (hydrated && token) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center" data-testid="auth-redirecting">
        <p className="status-neutral">正在跳转...</p>
      </main>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!emailValid(email)) {
      setError('请输入有效邮箱地址');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少 6 位');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const result = await apiRequest<AuthResponse>(endpoint, {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password })
      });

      setAuth(result.accessToken, result.user);
      await syncOfflineQueue();
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('请求失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 py-8"
      data-testid="auth-page"
    >
      <div className="card w-full space-y-5 border-slate-200/90 bg-white/95" data-testid={`auth-mode-${mode}`}>
        <div className="space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            词跃学习
          </p>
          <h1 className="page-title text-2xl">{mode === 'login' ? '登录账号' : '注册账号'}</h1>
          <p className="page-subtitle">登录后可同步你的学习数据。</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              邮箱
            </span>
            <input
              className="input-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="请输入邮箱地址"
              type="email"
              autoComplete="email"
              data-testid="auth-email"
            />
          </label>

          <label className="block space-y-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              密码
            </span>
            <input
              className="input-control"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 6 位"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              data-testid="auth-password"
            />
          </label>

          {error ? (
            <p className="status-error" data-testid="auth-error">
              {error}
            </p>
          ) : null}

          <button
            className="btn-primary w-full"
            disabled={loading}
            type="submit"
            data-testid="auth-submit"
          >
            {loading ? '提交中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <button
          type="button"
          className="text-sm font-medium text-brand-700 transition-colors hover:text-brand-800"
          onClick={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
          data-testid="auth-toggle"
        >
          {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
        </button>
      </div>
    </main>
  );
}
