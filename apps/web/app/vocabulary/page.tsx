'use client';

import type {
  ReviewRating,
  ReviewUserWordResultDto,
  SearchHistoryDto,
  UserWordProgressDto,
  WordEntryDto,
  WordGroupDto
} from '@lexigram/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  CloudOff,
  FolderTree,
  ListChecks,
  Search,
  Square,
  Tag,
  Volume2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { AssignGroupsDialog } from '../../components/assign-groups-dialog';
import { GroupSidebar, type GroupFilter } from '../../components/group-sidebar';
import { SearchHistoryPanel } from '../../components/search-history-panel';
import { SyncButton } from '../../components/sync-button';
import { WordNoteEditor } from '../../components/word-note-editor';
import { apiRequest, ApiError } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { enqueueOfflineEvent } from '../../lib/offline-queue';
import {
  addSearchHistory,
  clearSearchHistory,
  debounce,
  deleteSearchHistoryItem,
  fetchSearchHistory
} from '../../lib/search-history';
import {
  isSpeechSynthesisSupported,
  listSpeechVoices,
  speakWord,
  type SpeechVoiceOption
} from '../../lib/tts';

function useHashFocus() {
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const timer = setTimeout(() => {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setHighlightTarget(hash);
        setTimeout(() => setHighlightTarget(null), 2500);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return highlightTarget;
}

const ACCENT_OPTIONS = [
  { value: 'auto', label: '系统默认' },
  { value: 'en-US', label: '美式英语（en-US）' },
  { value: 'en-GB', label: '英式英语（en-GB）' },
  { value: 'en-AU', label: '澳式英语（en-AU）' },
  { value: 'en-CA', label: '加式英语（en-CA）' },
  { value: 'en-IN', label: '印式英语（en-IN）' }
] as const;

const AUTO_VOICE_VALUE = '__auto__';
const DEBOUNCE_ADD_HISTORY_MS = 800;

type TabType = 'review' | 'library';

interface RatingOption {
  value: ReviewRating;
  label: string;
  shortLabel: string;
  btnClass: string;
  description: string;
}

const RATING_OPTIONS: RatingOption[] = [
  {
    value: 'completely_forgot',
    label: '完全不会',
    shortLabel: '完全不会',
    btnClass: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300',
    description: '完全没印象，重新学习'
  },
  {
    value: 'fuzzy',
    label: '模糊',
    shortLabel: '模糊',
    btnClass: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:border-amber-300',
    description: '有点印象但不确定'
  },
  {
    value: 'recognized',
    label: '认识',
    shortLabel: '认识',
    btnClass: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300',
    description: '想了一下能认出来'
  },
  {
    value: 'mastered',
    label: '非常熟',
    shortLabel: '非常熟',
    btnClass: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-300',
    description: '一眼就认出来，非常熟悉'
  }
];

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

function calculateNextPreview(
  easeFactor: number,
  intervalDays: number,
  rating: ReviewRating
): { intervalDays: number; easeFactor: number; nextReviewAt: string } {
  let easeDelta: number;
  let intervalMultiplier: number;

  switch (rating) {
    case 'completely_forgot':
      easeDelta = -0.3;
      intervalMultiplier = 0;
      break;
    case 'fuzzy':
      easeDelta = -0.15;
      intervalMultiplier = 0.5;
      break;
    case 'recognized':
      easeDelta = 0.15;
      intervalMultiplier = 1;
      break;
    case 'mastered':
      easeDelta = 0.3;
      intervalMultiplier = 1.2;
      break;
    default:
      easeDelta = 0;
      intervalMultiplier = 1;
  }

  const nextEase = Math.max(MIN_EASE, Math.min(MAX_EASE, Number((easeFactor + easeDelta).toFixed(2))));

  let nextInterval: number;
  if (intervalMultiplier === 0) {
    nextInterval = 1;
  } else {
    const effectiveMultiplier = nextEase * intervalMultiplier;
    nextInterval = Math.max(1, Math.round(intervalDays * effectiveMultiplier));
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + nextInterval);

  return {
    intervalDays: nextInterval,
    easeFactor: nextEase,
    nextReviewAt: nextDate.toLocaleDateString('zh-CN')
  };
}

function formatIntervalLabel(days: number): string {
  if (days === 1) return '明天';
  if (days < 7) return `${days} 天后`;
  if (days < 30) return `${Math.round(days / 7)} 周后`;
  if (days < 365) return `${Math.round(days / 30)} 个月后`;
  return `${Math.round(days / 365)} 年后`;
}

function buildQueryParams(filter: GroupFilter) {
  const params = new URLSearchParams();
  if (filter.type === 'group') {
    params.set('groupId', filter.groupId);
  } else if (filter.type === 'ungrouped') {
    params.set('ungroupedOnly', 'true');
  }
  return params.toString();
}

export default function VocabularyPage() {
  const { ready, user } = useRequireAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [dismissedReviewIds, setDismissedReviewIds] = useState<string[]>([]);
  const [accent, setAccent] = useState<(typeof ACCENT_OPTIONS)[number]['value']>('auto');
  const [voiceOptions, setVoiceOptions] = useState<SpeechVoiceOption[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(AUTO_VOICE_VALUE);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [hoveredRating, setHoveredRating] = useState<{ progressId: string; rating: ReviewRating } | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('review');
  const [filter, setFilter] = useState<GroupFilter>({ type: 'all' });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.slice(1);
    if (hash === 'review-list') {
      setActiveTab('review');
    } else if (hash === 'library-list') {
      setActiveTab('library');
    }
  }, []);

  const [searchHistory, setSearchHistory] = useState<SearchHistoryDto[]>([]);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState(-1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchSectionRef = useRef<HTMLDivElement | null>(null);

  const highlightTarget = useHashFocus();

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

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [filter, activeTab]);

  const queryParams = useMemo(() => buildQueryParams(filter), [filter]);

  const wordsQuery = useQuery({
    queryKey: ['words-search', query],
    queryFn: () => apiRequest<WordEntryDto[]>(`/words?q=${encodeURIComponent(query)}`),
    enabled: ready && query.trim().length > 0
  });

  const reviewQuery = useQuery({
    queryKey: ['today-reviews', queryParams],
    queryFn: () =>
      apiRequest<UserWordProgressDto[]>(
        `/user-words/reviews/today${queryParams ? `?${queryParams}` : ''}`
      ),
    enabled: ready
  });

  const libraryQuery = useQuery({
    queryKey: ['user-words', queryParams],
    queryFn: () =>
      apiRequest<UserWordProgressDto[]>(
        `/user-words${queryParams ? `?${queryParams}` : ''}`
      ),
    enabled: ready
  });

  const allLibraryQuery = useQuery({
    queryKey: ['user-words', 'all'],
    queryFn: () => apiRequest<UserWordProgressDto[]>('/user-words'),
    enabled: ready
  });

  const libraryWordsSet = useMemo(() => {
    const all = allLibraryQuery.data ?? [];
    const set = new Set<string>();
    for (const item of all) {
      set.add(item.word.word.toLowerCase());
    }
    return set;
  }, [allLibraryQuery.data]);

  const groupsQuery = useQuery({
    queryKey: ['word-groups'],
    queryFn: () => apiRequest<WordGroupDto[]>('/word-groups'),
    enabled: ready
  });

  const loadSearchHistory = useCallback(async () => {
    if (!ready) return;
    setHistoryLoading(true);
    try {
      const items = await fetchSearchHistory(user?.id ?? null, libraryWordsSet);
      setSearchHistory(items);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [ready, user?.id, libraryWordsSet]);

  useEffect(() => {
    void loadSearchHistory();
  }, [loadSearchHistory]);

  useEffect(() => {
    if (searchHistory.length > 0) {
      setSearchHistory((prev) =>
        prev.map((item) => ({
          ...item,
          inLibrary: libraryWordsSet.has(item.query.toLowerCase())
        }))
      );
    }
  }, [libraryWordsSet, searchHistory.length]);

  const debouncedAddHistory = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        const normalized = searchQuery.trim();
        if (!normalized) return;
        try {
          const items = await addSearchHistory(user?.id ?? null, normalized, libraryWordsSet);
          setSearchHistory(items);
        } catch {
          // ignore
        }
      }, DEBOUNCE_ADD_HISTORY_MS),
    [user?.id, libraryWordsSet]
  );

  useEffect(() => {
    if (query.trim().length > 0) {
      debouncedAddHistory(query);
    }
  }, [query, debouncedAddHistory]);

  const handleHistorySelect = useCallback(
    (selectedQuery: string) => {
      setQuery(selectedQuery);
      setHistoryPanelOpen(false);
      setActiveHistoryIndex(-1);
      searchInputRef.current?.focus();
    },
    []
  );

  const handleHistoryDelete = useCallback(
    async (toDelete: string) => {
      try {
        const items = await deleteSearchHistoryItem(user?.id ?? null, toDelete, libraryWordsSet);
        setSearchHistory(items);
        if (activeHistoryIndex >= items.length) {
          setActiveHistoryIndex(Math.max(-1, items.length - 1));
        }
      } catch {
        // ignore
      }
    },
    [user?.id, libraryWordsSet, activeHistoryIndex]
  );

  const handleHistoryClearAll = useCallback(async () => {
    try {
      const items = await clearSearchHistory(user?.id ?? null);
      setSearchHistory(items);
      setActiveHistoryIndex(-1);
    } catch {
      // ignore
    }
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchSectionRef.current && !searchSectionRef.current.contains(target)) {
        setHistoryPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const items = searchHistory;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (items.length > 0) {
          setHistoryPanelOpen(true);
          setActiveHistoryIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        }
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (items.length > 0 && historyPanelOpen) {
          setActiveHistoryIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        }
        return;
      }

      if (event.key === 'Enter') {
        if (historyPanelOpen && activeHistoryIndex >= 0 && items[activeHistoryIndex]) {
          event.preventDefault();
          handleHistorySelect(items[activeHistoryIndex].query);
        } else {
          setHistoryPanelOpen(false);
          setActiveHistoryIndex(-1);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setHistoryPanelOpen(false);
        setActiveHistoryIndex(-1);
        return;
      }
    },
    [searchHistory, historyPanelOpen, activeHistoryIndex, handleHistorySelect]
  );

  const handleSearchFocus = useCallback(() => {
    void loadSearchHistory();
    setHistoryPanelOpen(true);
    setActiveHistoryIndex(-1);
  }, [loadSearchHistory]);

  const totalWordCount = useMemo(
    () => (allLibraryQuery.data ?? []).length,
    [allLibraryQuery.data]
  );

  const ungroupedCount = useMemo(() => {
    const all = allLibraryQuery.data ?? [];
    return all.filter((w) => w.groups.length === 0).length;
  }, [allLibraryQuery.data]);

  const addWordMutation = useMutation({
    mutationFn: (wordEntryId: string) =>
      apiRequest<UserWordProgressDto>('/user-words', {
        method: 'POST',
        body: JSON.stringify({ wordEntryId })
      }),
    onSuccess: () => {
      setNotice('已加入生词本');
      void queryClient.invalidateQueries({ queryKey: ['today-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['user-words'] });
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.message : '加入失败');
    }
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      progressId,
      rating
    }: {
      progressId: string;
      rating: ReviewRating;
    }): Promise<{ queued: boolean; result?: ReviewUserWordResultDto }> => {
      const clientEventId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      const known = rating === 'recognized' || rating === 'mastered';

      const payload = {
        known,
        rating,
        clientEventId
      };

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!online) {
        await enqueueOfflineEvent({
          type: 'WORD_REVIEW',
          clientEventId,
          payload: {
            progressId,
            known,
            rating
          },
          createdAt: new Date().toISOString()
        });

        return { queued: true };
      }

      try {
        const result = await apiRequest<ReviewUserWordResultDto>(`/user-words/${progressId}/review`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        return { queued: false, result };
      } catch (_error) {
        await enqueueOfflineEvent({
          type: 'WORD_REVIEW',
          clientEventId,
          payload: {
            progressId,
            known,
            rating
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
      void queryClient.invalidateQueries({ queryKey: ['user-words'] });
      void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
    }
  });

  const visibleReviews = useMemo(
    () => (reviewQuery.data ?? []).filter((item) => !dismissedReviewIds.includes(item.id)),
    [reviewQuery.data, dismissedReviewIds]
  );

  const libraryItems = useMemo(() => libraryQuery.data ?? [], [libraryQuery.data]);

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

  const activeItems = activeTab === 'review' ? visibleReviews : libraryItems;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === activeItems.length && activeItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeItems.map((i) => i.id)));
    }
  };

  const openAssignDialog = () => {
    if (selectedIds.size === 0) {
      setNotice('请先选择要归类的单词');
      return;
    }
    setAssignDialogOpen(true);
  };

  const computeCommonGroupIds = () => {
    const selected = activeItems.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) return [];
    const first = new Set(selected[0].groups.map((g) => g.id));
    for (let i = 1; i < selected.length; i++) {
      const cur = new Set(selected[i].groups.map((g) => g.id));
      for (const gid of Array.from(first)) {
        if (!cur.has(gid)) first.delete(gid);
      }
    }
    return Array.from(first);
  };

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
            void queryClient.invalidateQueries({ queryKey: ['user-words'] });
            void queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
            void queryClient.invalidateQueries({ queryKey: ['word-groups'] });
            void queryClient.invalidateQueries({ queryKey: ['word-note'] });
            void loadSearchHistory();
          }}
        />

        {notice ? (
          <div className={noticeTone} data-testid="vocab-notice">
            <NoticeIcon className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
            {notice}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="space-y-5">
            <GroupSidebar
              filter={filter}
              onFilterChange={setFilter}
              totalCount={totalWordCount}
              ungroupedCount={ungroupedCount}
              onNotice={setNotice}
            />
          </div>

          <div className="space-y-5">
            <section
              className="card space-y-4 bg-white/95 relative"
              data-testid="vocabulary-search-section"
              ref={searchSectionRef}
            >
              <h2 className="section-title">
                <Search className="h-4 w-4 text-brand-600" aria-hidden="true" />
                单词查询
              </h2>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  className="input-control pr-10"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={handleSearchFocus}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="请输入要查询的英文单词"
                  data-testid="word-search-input"
                  autoComplete="off"
                />
                {query ? (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    onClick={() => {
                      setQuery('');
                      searchInputRef.current?.focus();
                    }}
                    data-testid="word-search-clear"
                    aria-label="清除搜索"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}

                <SearchHistoryPanel
                  items={searchHistory}
                  activeIndex={activeHistoryIndex}
                  open={historyPanelOpen}
                  onSelect={handleHistorySelect}
                  onDelete={handleHistoryDelete}
                  onClearAll={handleHistoryClearAll}
                  onHoverIndex={setActiveHistoryIndex}
                />
              </div>
              {historyLoading ? (
                <p className="-mt-2 text-xs text-slate-400" data-testid="search-history-loading">
                  加载搜索历史...
                </p>
              ) : null}

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
                    {libraryWordsSet.has(word.word.toLowerCase()) ? (
                      <div
                        className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
                        data-testid={`word-in-lib-${word.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        已加入生词本
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary mt-3"
                        onClick={() => addWordMutation.mutate(word.id)}
                        disabled={addWordMutation.isPending}
                        data-testid={`word-add-${word.id}`}
                      >
                        加入生词本
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`nav-chip ${activeTab === 'review' ? 'nav-chip-active' : ''}`}
                  onClick={() => setActiveTab('review')}
                  data-testid="tab-review"
                >
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                  今日待复习 ({visibleReviews.length})
                </button>
                <button
                  type="button"
                  className={`nav-chip ${activeTab === 'library' ? 'nav-chip-active' : ''}`}
                  onClick={() => setActiveTab('library')}
                  data-testid="tab-library"
                >
                  <FolderTree className="h-4 w-4" aria-hidden="true" />
                  生词本 ({libraryItems.length})
                </button>
              </div>
              {activeItems.length > 0 ? (
                <div className="flex items-center gap-2">
                  {selectMode ? (
                    <>
                      <button
                        type="button"
                        className="btn-secondary h-9 px-3 text-xs"
                        onClick={toggleSelectAll}
                        data-testid="select-all-btn"
                      >
                        {selectedIds.size === activeItems.length ? (
                          <>
                            <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                            取消全选
                          </>
                        ) : (
                          <>
                            <Square className="h-3.5 w-3.5" aria-hidden="true" />
                            全选
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn-primary h-9 px-3 text-xs"
                        onClick={openAssignDialog}
                        disabled={selectedIds.size === 0}
                        data-testid="assign-groups-btn"
                      >
                        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                        归类分组 {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary h-9 px-3 text-xs"
                        onClick={() => {
                          setSelectMode(false);
                          setSelectedIds(new Set());
                        }}
                        data-testid="exit-select-mode-btn"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary h-9 px-3 text-xs"
                      onClick={() => setSelectMode(true)}
                      data-testid="enter-select-mode-btn"
                    >
                      <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      多选归类
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            {filter.type !== 'all' ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
                <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  当前筛选：
                  {filter.type === 'ungrouped'
                    ? '未分组单词'
                    : groupsQuery.data?.find((g) => g.id === filter.groupId)?.name ?? '...'}
                </span>
                <button
                  type="button"
                  className="ml-auto rounded-md p-1 text-brand-600 hover:bg-brand-100"
                  onClick={() => setFilter({ type: 'all' })}
                  data-testid="clear-filter-btn"
                  aria-label="清除筛选"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {activeTab === 'review' ? (
              <section
                id="review-list"
                className={`card space-y-4 bg-white/95 transition-all duration-500 ${
                  highlightTarget === 'review-list'
                    ? 'ring-2 ring-brand-400 ring-offset-2 shadow-lg scale-[1.01]'
                    : ''
                }`}
                data-testid="vocabulary-review-section"
              >
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
                    {filter.type !== 'all' ? '当前筛选条件下没有待复习项。' : '今日没有待复习项，先添加几个单词吧。'}
                  </p>
                ) : null}

                <div className="space-y-3" data-testid="review-list">
                  {visibleReviews.map((item) => {
                    const checked = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-[var(--radius-control)] border p-3 transition-colors ${
                          selectMode && checked
                            ? 'border-brand-300 bg-brand-50/60'
                            : 'border-slate-200 bg-slate-50/60'
                        }`}
                        data-testid={`review-item-${item.id}`}
                      >
                        <div className="flex items-start gap-2">
                          {selectMode ? (
                            <button
                              type="button"
                              className="mt-0.5 shrink-0 text-slate-600 hover:text-brand-700"
                              onClick={() => toggleSelect(item.id)}
                              data-testid={`review-select-${item.id}`}
                              aria-label={checked ? '取消选中' : '选中'}
                            >
                              {checked ? (
                                <CheckSquare className="h-5 w-5 text-brand-600" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </button>
                          ) : null}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-base font-semibold">{item.word.word}</p>
                              {item.groups.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {item.groups.map((g) => (
                                    <span
                                      key={g.id}
                                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                      style={{ backgroundColor: g.color }}
                                      data-testid={`review-tag-${item.id}-${g.id}`}
                                    >
                                      {g.name}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <p className="text-sm text-slate-700">{item.word.definition}</p>
                            <p className="mt-1 text-xs text-slate-500">例句：{item.word.exampleSentence}</p>
                            {!selectMode ? (
                              <div className="mt-3 space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  {RATING_OPTIONS.map((option) => {
                                    const preview = calculateNextPreview(
                                      item.easeFactor,
                                      item.intervalDays,
                                      option.value
                                    );
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-all ${option.btnClass}`}
                                        onClick={() =>
                                          reviewMutation.mutate({
                                            progressId: item.id,
                                            rating: option.value
                                          })
                                        }
                                        onMouseEnter={() =>
                                          setHoveredRating({ progressId: item.id, rating: option.value })
                                        }
                                        onMouseLeave={() => {
                                          if (
                                            hoveredRating?.progressId === item.id &&
                                            hoveredRating?.rating === option.value
                                          ) {
                                            setHoveredRating(null);
                                          }
                                        }}
                                        disabled={reviewMutation.isPending}
                                        data-testid={`review-${option.value}-${item.id}`}
                                        title={option.description}
                                      >
                                        <span className="flex items-center gap-1">
                                          {option.shortLabel}
                                          <span className="text-xs opacity-75">
                                            ({formatIntervalLabel(preview.intervalDays)})
                                          </span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                {hoveredRating?.progressId === item.id ? (
                                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                    {(() => {
                                      const option = RATING_OPTIONS.find(
                                        (o) => o.value === hoveredRating.rating
                                      );
                                      const preview = calculateNextPreview(
                                        item.easeFactor,
                                        item.intervalDays,
                                        hoveredRating.rating
                                      );
                                      return (
                                        <>
                                          <span className="font-medium text-slate-700">
                                            {option?.label}：
                                          </span>
                                          {option?.description}
                                          <span className="ml-2 text-slate-500">
                                            下次复习：{preview.nextReviewAt}（{preview.intervalDays} 天后）
                                          </span>
                                        </>
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-400">
                                    鼠标悬停在按钮上可查看下次复习时间预估
                                  </div>
                                )}
                              </div>
                            ) : null}

                            <WordNoteEditor progressId={item.id} testIdPrefix={`review-note-${item.id}`} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="card space-y-4 bg-white/95" data-testid="vocabulary-library-section">
                <h2 className="section-title" data-testid="library-list-title">
                  <FolderTree className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  生词本（{libraryItems.length}）
                </h2>
                {libraryQuery.isLoading ? (
                  <p className="text-sm text-slate-500" data-testid="library-loading">
                    加载生词本...
                  </p>
                ) : null}
                {libraryItems.length === 0 && !libraryQuery.isLoading ? (
                  <p className="text-sm text-slate-500" data-testid="library-empty">
                    {filter.type !== 'all' ? '当前筛选条件下没有单词。' : '生词本是空的，先去搜索并添加单词吧。'}
                  </p>
                ) : null}

                <div className="space-y-3" data-testid="library-list">
                  {libraryItems.map((item) => {
                    const checked = selectedIds.has(item.id);
                    const statusBadge =
                      item.status === 'known'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700';
                    return (
                      <div
                        key={item.id}
                        className={`rounded-[var(--radius-control)] border p-3 transition-colors ${
                          selectMode && checked
                            ? 'border-brand-300 bg-brand-50/60'
                            : 'border-slate-200 bg-slate-50/60'
                        }`}
                        data-testid={`library-item-${item.id}`}
                      >
                        <div className="flex items-start gap-2">
                          {selectMode ? (
                            <button
                              type="button"
                              className="mt-0.5 shrink-0 text-slate-600 hover:text-brand-700"
                              onClick={() => toggleSelect(item.id)}
                              data-testid={`library-select-${item.id}`}
                              aria-label={checked ? '取消选中' : '选中'}
                            >
                              {checked ? (
                                <CheckSquare className="h-5 w-5 text-brand-600" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </button>
                          ) : null}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-base font-semibold">{item.word.word}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge}`}>
                                {item.status === 'known' ? '已掌握' : '学习中'}
                              </span>
                              {item.groups.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {item.groups.map((g) => (
                                    <span
                                      key={g.id}
                                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                      style={{ backgroundColor: g.color }}
                                      data-testid={`library-tag-${item.id}-${g.id}`}
                                    >
                                      {g.name}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{item.word.phonetic || '暂无音标'}</p>
                            <p className="text-sm text-slate-700">{item.word.definition}</p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>下次复习：{new Date(item.nextReviewAt).toLocaleDateString('zh-CN')}</span>
                              {item.lastReviewedAt ? (
                                <span>上次复习：{new Date(item.lastReviewedAt).toLocaleDateString('zh-CN')}</span>
                              ) : null}
                              <span>难度系数：{item.easeFactor.toFixed(2)}</span>
                            </div>

                            <WordNoteEditor progressId={item.id} testIdPrefix={`library-note-${item.id}`} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <AssignGroupsDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        progressIds={Array.from(selectedIds)}
        currentGroupIds={computeCommonGroupIds()}
        onNotice={setNotice}
      />
    </AppShell>
  );
}
