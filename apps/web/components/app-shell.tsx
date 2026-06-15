'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  Sparkles
} from 'lucide-react';
import { PropsWithChildren } from 'react';

import { useAuthStore } from '../store/auth-store';

const navItems = [
  { href: '/dashboard', label: '面板', icon: LayoutDashboard },
  { href: '/vocabulary', label: '词汇', icon: BookOpen },
  { href: '/grammar', label: '语法', icon: FileText },
  { href: '/progress', label: '进度', icon: BarChart3 }
];

export function AppShell({ children, title }: PropsWithChildren<{ title: string }>) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleLogout = () => {
    clearAuth();
    router.replace('/auth');
  };

  return (
    <div className="min-h-screen" data-testid="shell-root">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-0.5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              词跃学习
            </p>
            <h1 className="page-title text-lg sm:text-xl">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-600 sm:inline">
              {user?.email}
            </span>
            <button
              type="button"
              className="btn-secondary h-9 px-3"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              退出登录
            </button>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-2 overflow-x-auto px-4 pb-3 pt-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.href.slice(1)}`}
                className={`nav-chip ${active ? 'nav-chip-active' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-8 pt-5">{children}</main>
    </div>
  );
}
