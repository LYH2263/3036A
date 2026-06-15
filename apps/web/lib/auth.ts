import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '../store/auth-store';

export function useRequireAuth() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
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
    hydrated,
    ready: hydrated && Boolean(token)
  };
}
