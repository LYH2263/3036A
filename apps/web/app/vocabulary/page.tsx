'use client';

import type { UserWordProgressDto, WordEntryDto } from '@lexigram/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  CloudOff,
  ListChecks,
  Search,
  Volume2
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { SyncButton } from '../../components/sync-button';
import { apiRequest, ApiError } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { enqueueOfflineEvent } from '../../lib/offline-queue';
import {
  isSpeechSynthesisSupported,
  listSpeechVoices,
  speakWord,
  type SpeechVoiceOption
} from '../../lib/tts';

const ACCENT_OPTIONS = [
  { value: 'auto', label: '系统默认' },
  { value: 'en-US', label: '美式英语（en-US）' },
  { value: 'en-GB', label: '英式英语（en-GB）' },
  { value: 'en-AU', label: '澳式英语（en-AU）' },
  { value: 'en-CA', label: '加式英语（en-CA）' },
  { value: 'en-IN', label: '印式英语（en-IN）' }
] as const;

const AUTO_VOICE_VALUE = '__auto__';

export default function VocabularyPage() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [dismissedReviewIds, setDismissedReviewIds] = useState<string[]>([]);
  const [accent, setAccent] = useState<(typeof ACCENT_OPTIONS)[number]['value']>('auto');
  const [voiceOptions, setVoiceOptions] = useState<SpeechVoiceOption[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(AUTO_VOICE_VALUE);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const supported = isSpeechSynthesisSupported();
    setSpeechSupported(supported);

    if (!supported) {
      return;
    }

    const syncVoices = () => {
      setVoiceOptions(listSpeechVoices());
    };

    syncVoices();

    const synth = window.speechSynthesis as SpeechSynthesis & {
      addEventListener?: (type: string, callback: () => void) => void;
      removeEventListener?: (type: string, callback: () => void) => void;
    };

    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', syncVoices);
      return () => {
        if (typeof synth.removeEventListener === 'function') {
          synth.removeEventListener('voiceschanged', syncVoices);
        }
      };
    }

    return;
  }, []);

  const wordsQuery = useQuery({
    queryKey: ['words-search', query],
    queryFn: () => apiRequest<WordEntryDto[]>(`/words?q=${encodeURIComponent(query)}`),
    enabled: ready && query.trim().length > 0
  });

  const reviewQuery = useQuery({
    queryKey: ['today-reviews'],
    queryFn: () => apiRequest<UserWordProgressDto[]>('/user-words/reviews/today'),
    enabled: ready
  });

  const addWordMutation = useMutation({
    mutationFn: (wordEntryId: string) =>
      apiRequest<UserWordProgressDto>('/user-words', {
        method: 'POST',
        body: JSON.stringify({ wordEntryId })
      }),
    onSuccess: () => {
      setNotice('已加入生词本');
      void queryClient.invalidateQueries({ queryKey: ['today-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.message : '加入失败');
    }
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ progressId, known }: { progressId: string; known: boolean }) => {
      const clientEventId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      const payload = {
        known,
        clientEventId
      };

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!online) {
        await enqueueOfflineEvent({
          type: 'WORD_REVIEW',
          clientEventId,
          payload: {
            progressId,
            known
          },
          createdAt: new Date().toISOString()
        });

        return { queued: true };
      }

      try {
        await apiRequest(`/user-words/${progressId}/review`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        return { queued: false };
      } catch (_error) {
        await enqueueOfflineEvent({
          type: 'WORD_REVIEW',
          clientEventId,
          payload: {
            progressId,
            known
          },
          createdAt: new Date().toISOString()
        });

        return { queued: true };
      }
    },
    onSuccess: (result, variables) => {
      setDismissedReviewIds((prev) => [...prev, variables.progressId]);
      setNotice(result.queued ? '当前离线，复习记录已加入待同步队列' : '复习结果已提交');
      void queryClient.invalidateQueries({ queryKey: ['today-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
    }
  });

  const visibleReviews = useMemo(
    () => (reviewQuery.data ?? []).filter((item) => !dismissedReviewIds.includes(item.id)),
    [reviewQuery.data, dismissedReviewIds]
  );

  const filteredVoiceOptions = useMemo(() => {
    if (accent === 'auto') {
      return voiceOptions;
    }

    const target = accent.toLowerCase();
    const prefix = target.split('-')[0];
    return voiceOptions.filter((voice) => {
      const lang = voice.lang.toLowerCase();
      return lang === target || lang.startsWith(`${prefix}-`);
    });
  }, [accent, voiceOptions]);

  useEffect(() => {
    if (selectedVoiceURI === AUTO_VOICE_VALUE) {
      return;
    }

    const matched = filteredVoiceOptions.some((item) => item.voiceURI === selectedVoiceURI);
    if (!matched) {
      setSelectedVoiceURI(AUTO_VOICE_VALUE);
    }
  }, [filteredVoiceOptions, selectedVoiceURI]);

  const noticeTone =
    notice.includes('离线')
      ? 'status-warning'
      : notice.includes('失败') || notice.includes('错误')
        ? 'status-error'
        : 'status-success';

  const NoticeIcon = notice.includes('离线')
    ? CloudOff
    : notice.includes('失败') || notice.includes('错误')
      ? AlertCircle
      : CheckCircle2;

  return (
    <AppShell title="词汇学习">
      <div className="space-y-5" data-testid="vocabulary-page">
        <SyncButton
          onSynced={() => {
            setDismissedReviewIds([]);
            void queryClient.invalidateQueries({ queryKey: ['today-reviews'] });
            void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
          }}
        />

        {notice ? (
          <div className={noticeTone} data-testid="vocab-notice">
            <NoticeIcon className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
            {notice}
          </div>
        ) : null}

        <section className="card space-y-4 bg-white/95" data-testid="vocabulary-search-section">
          <h2 className="section-title">
            <Search className="h-4 w-4 text-brand-600" aria-hidden="true" />
            单词查询
          </h2>
          <input
            className="input-control"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="请输入要查询的英文单词"
            data-testid="word-search-input"
          />

          <div className="grid gap-3 sm:grid-cols-2" data-testid="speech-controls">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">发音口音</span>
              <select
                className="input-control"
                value={accent}
                onChange={(event) => setAccent(event.target.value as (typeof ACCENT_OPTIONS)[number]['value'])}
                data-testid="speech-accent-select"
              >
                {ACCENT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">发音人</span>
              <select
                className="input-control"
                value={selectedVoiceURI}
                onChange={(event) => setSelectedVoiceURI(event.target.value)}
                data-testid="speech-voice-select"
                disabled={!speechSupported}
              >
                <option value={AUTO_VOICE_VALUE}>系统自动匹配</option>
                {filteredVoiceOptions.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name}（{voice.lang}）
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!speechSupported ? (
            <p className="status-neutral" data-testid="speech-support-hint">
              当前浏览器不支持语音播放，可更换到最新版 Chrome 或 Edge 体验发音。
            </p>
          ) : (
            <p className="text-xs text-slate-500" data-testid="speech-voice-count">
              已检测到 {filteredVoiceOptions.length} 个可用发音人，可切换试听不同口音。
            </p>
          )}

          {wordsQuery.isLoading ? (
            <p className="text-sm text-slate-500" data-testid="word-search-loading">
              搜索中...
            </p>
          ) : null}
          {wordsQuery.data?.length === 0 && query.trim() ? (
            <p className="text-sm text-slate-500" data-testid="word-search-empty">
              未匹配到词条
            </p>
          ) : null}

          <div className="grid gap-3" data-testid="word-search-results">
            {wordsQuery.data?.map((word) => (
              <article
                key={word.id}
                className="card card-hover border-slate-200/90 p-3"
                data-testid={`word-card-${word.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">{word.word}</h3>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const spoken = speakWord(word.word, {
                        lang: accent === 'auto' ? undefined : accent,
                        voiceURI:
                          selectedVoiceURI === AUTO_VOICE_VALUE ? undefined : selectedVoiceURI
                      });

                      if (!spoken) {
                        setNotice('当前浏览器不支持语音播放，请尝试更换浏览器');
                      }
                    }}
                    data-testid={`word-pronounce-${word.id}`}
                  >
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                    发音
                  </button>
                </div>
                <p className="mt-1 text-sm text-slate-600">{word.phonetic || '暂无音标'}</p>
                <p className="mt-2 text-sm text-slate-800">{word.definition}</p>
                <p className="mt-1 text-sm text-slate-500">例句：{word.exampleSentence}</p>
                <button
                  type="button"
                  className="btn-primary mt-3"
                  onClick={() => addWordMutation.mutate(word.id)}
                  disabled={addWordMutation.isPending}
                  data-testid={`word-add-${word.id}`}
                >
                  加入生词本
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="card space-y-4 bg-white/95" data-testid="vocabulary-review-section">
          <h2 className="section-title" data-testid="review-list-title">
            <ListChecks className="h-4 w-4 text-brand-600" aria-hidden="true" />
            今日待复习（{visibleReviews.length}）
          </h2>
          {reviewQuery.isLoading ? (
            <p className="text-sm text-slate-500" data-testid="review-loading">
              加载复习列表...
            </p>
          ) : null}
          {visibleReviews.length === 0 && !reviewQuery.isLoading ? (
            <p className="text-sm text-slate-500" data-testid="review-empty">
              今日没有待复习项，先添加几个单词吧。
            </p>
          ) : null}

          <div className="space-y-3" data-testid="review-list">
            {visibleReviews.map((item) => (
              <div
                key={item.id}
                className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/60 p-3"
                data-testid={`review-item-${item.id}`}
              >
                <p className="text-base font-semibold">{item.word.word}</p>
                <p className="text-sm text-slate-700">{item.word.definition}</p>
                <p className="mt-1 text-xs text-slate-500">例句：{item.word.exampleSentence}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => reviewMutation.mutate({ progressId: item.id, known: true })}
                    disabled={reviewMutation.isPending}
                    data-testid={`review-known-${item.id}`}
                  >
                    认识
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => reviewMutation.mutate({ progressId: item.id, known: false })}
                    disabled={reviewMutation.isPending}
                    data-testid={`review-unknown-${item.id}`}
                  >
                    不认识
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
