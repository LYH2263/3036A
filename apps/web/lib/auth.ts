import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import type { AuthUser } from '@lexigram/shared';

import { useAuthStore } from '../store/auth-store';

export function useRequireAuth() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!token) {
      router.replace('/auth');
    }
  }, [hydrated, token, router]);

  return {
    token,
    user: user as AuthUser | null,
    hydrated,
    ready: hydrated && Boolean(token)
  };
}
