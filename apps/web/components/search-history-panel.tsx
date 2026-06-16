'use client';

import type { SearchHistoryDto } from '@lexigram/shared';
import { CheckCircle2, Clock, Trash2, X } from 'lucide-react';

export interface SearchHistoryPanelProps {
  items: SearchHistoryDto[];
  activeIndex: number;
  open: boolean;
  onSelect: (query: string) => void;
  onDelete: (query: string) => void;
  onClearAll: () => void;
  onHoverIndex: (index: number) => void;
}

export function SearchHistoryPanel({
  items,
  activeIndex,
  open,
  onSelect,
  onDelete,
  onClearAll,
  onHoverIndex
}: SearchHistoryPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[var(--radius-card)] border border-slate-200 bg-white shadow-lg"
      data-testid="search-history-panel"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          搜索历史
          {items.length > 0 ? <span className="text-slate-400">({items.length})</span> : null}
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClearAll();
            }}
            data-testid="search-history-clear-all"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            清空
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400" data-testid="search-history-empty">
          暂无搜索历史
        </div>
      ) : (
        <ul className="max-h-80 overflow-y-auto py-1">
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={item.id}
                className="group"
                data-testid={`search-history-item-${index}`}
                onMouseEnter={() => onHoverIndex(index)}
              >
                <div
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors ${
                    isActive ? 'bg-brand-50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => onSelect(item.query)}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-brand-100 group-hover:text-brand-600">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`truncate text-sm ${isActive ? 'text-brand-700 font-medium' : 'text-slate-700'}`}>
                        {item.query}
                      </span>
                      {item.inLibrary ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                          data-testid={`search-history-in-lib-${index}`}
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                          已加入
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-400">
                      <span>{formatSearchedAt(item.searchedAt)}</span>
                      {item.searchCount > 1 ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5">
                          搜索 {item.searchCount} 次
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1.5 text-slate-400 opacity-0 transition-all hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDelete(item.query);
                    }}
                    aria-label={`删除搜索历史：${item.query}`}
                    data-testid={`search-history-delete-${index}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 ? (
        <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">↑</kbd>
          <kbd className="ml-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">↓</kbd>
          <span className="mx-1.5">选择</span>
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
          <span className="mx-1.5">搜索</span>
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
          <span className="mx-1.5">关闭</span>
        </div>
      ) : null}
    </div>
  );
}

function formatSearchedAt(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } catch {
    return isoString;
  }
}
