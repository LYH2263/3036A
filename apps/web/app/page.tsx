'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '../store/auth-store';

export default function HomePage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (token) {
      router.replace('/dashboard');
      return;
    }
    router.replace('/auth');
  }, [hydrated, token, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center" data-testid="root-redirecting">
      <p className="status-neutral">正在跳转...</p>
    </main>
  );
}
