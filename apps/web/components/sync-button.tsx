'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

import { readOfflineEvents } from '../lib/offline-queue';
import { syncOfflineQueue } from '../lib/sync';

export function SyncButton({ onSynced }: { onSynced?: () => void }) {
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadPending = async () => {
    const rows = await readOfflineEvents();
    setPending(rows.length);
  };

  useEffect(() => {
    void loadPending();
  }, []);

  const handleSync = async () => {
    setLoading(true);
    setMessage('');

    try {
      const result = await syncOfflineQueue();
      await loadPending();
      onSynced?.();
      if (result.failed > 0) {
        setMessage(`已同步 ${result.synced} 条，失败 ${result.failed} 条`);
      } else {
        setMessage(`同步完成，共 ${result.synced} 条`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isFailed = message.includes('失败');
  const isSuccess = (message.includes('同步完成') || message.includes('已同步')) && !isFailed;

  return (
    <div className="card flex flex-col items-start gap-3 bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="section-title text-sm">
          <RefreshCw className="h-4 w-4 text-brand-600" aria-hidden="true" />
          数据同步
        </p>
        <span className="text-xs text-slate-500" data-testid="sync-pending-count">
          待同步 {pending}
        </span>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <button
          type="button"
          className="btn-secondary h-9"
          onClick={handleSync}
          disabled={loading}
          data-testid="sync-btn"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? '同步中...' : `立即同步（待同步 ${pending}）`}
        </button>
        {message ? (
          <p
            className={
              isFailed ? 'status-warning' : isSuccess ? 'status-success' : 'status-neutral'
            }
            data-testid="sync-msg"
          >
            {isFailed ? <AlertTriangle className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" /> : null}
            {isSuccess ? <CheckCircle2 className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" /> : null}
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
