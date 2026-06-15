import type { APIRequestContext } from '@playwright/test';

import { apiGet, apiPost } from './api.helper';

export interface ApiWord {
  id: string;
  word: string;
  definition: string;
  exampleSentence: string;
  phonetic: string;
}

export interface ApiUserWordProgress {
  id: string;
  wordEntryId: string;
  status: 'learning' | 'known';
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  word: ApiWord;
}

export interface ApiLesson {
  id: string;
  title: string;
  level: 'basic' | 'intermediate' | 'advanced';
  content: string;
}

export interface ApiLessonDetail extends ApiLesson {
  questions: Array<{
    id: string;
    type: 'single_choice' | 'fill_blank';
    prompt: string;
    options: string[];
    explanation: string;
  }>;
}

export async function searchWords(
  request: APIRequestContext,
  token: string,
  query: string
): Promise<ApiWord[]> {
  const { status, body } = await apiGet<ApiWord[]>(request, `/words?q=${encodeURIComponent(query)}`, token);

  if (status !== 200) {
    throw new Error(`searchWords failed: ${status}`);
  }

  return body;
}

export async function addWordToNotebook(
  request: APIRequestContext,
  token: string,
  wordEntryId: string
): Promise<ApiUserWordProgress> {
  const { status, body } = await apiPost<ApiUserWordProgress>(
    request,
    '/user-words',
    { wordEntryId },
    token
  );

  if (status !== 201 && status !== 200) {
    throw new Error(`addWordToNotebook failed: ${status}`);
  }

  return body;
}

export async function fetchTodayReviews(
  request: APIRequestContext,
  token: string
): Promise<ApiUserWordProgress[]> {
  const { status, body } = await apiGet<ApiUserWordProgress[]>(request, '/user-words/reviews/today', token);

  if (status !== 200) {
    throw new Error(`fetchTodayReviews failed: ${status}`);
  }

  return body;
}

export async function reviewWord(
  request: APIRequestContext,
  token: string,
  progressId: string,
  known: boolean,
  clientEventId?: string
): Promise<{ deduplicated: boolean; progress: ApiUserWordProgress }> {
  const { status, body } = await apiPost<{ deduplicated: boolean; progress: ApiUserWordProgress }>(
    request,
    `/user-words/${progressId}/review`,
    {
      known,
      clientEventId
    },
    token
  );

  if (status !== 201 && status !== 200) {
    throw new Error(`reviewWord failed: ${status}`);
  }

  return body;
}

export async function fetchLessons(
  request: APIRequestContext,
  token: string,
  level: 'basic' | 'intermediate' | 'advanced' | 'all' = 'all'
): Promise<ApiLesson[]> {
  const path = level === 'all' ? '/grammar/lessons' : `/grammar/lessons?level=${level}`;
  const { status, body } = await apiGet<ApiLesson[]>(request, path, token);

  if (status !== 200) {
    throw new Error(`fetchLessons failed: ${status}`);
  }

  return body;
}

export async function fetchLessonDetail(
  request: APIRequestContext,
  token: string,
  lessonId: string
): Promise<ApiLessonDetail> {
  const { status, body } = await apiGet<ApiLessonDetail>(request, `/grammar/lessons/${lessonId}`, token);

  if (status !== 200) {
    throw new Error(`fetchLessonDetail failed: ${status}`);
  }

  return body;
}

export async function submitGrammarAttempt(
  request: APIRequestContext,
  token: string,
  lessonId: string,
  answers: Array<{ questionId: string; answer: string }>,
  clientEventId?: string
): Promise<{
  deduplicated: boolean;
  id: string;
  lessonId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: string;
}> {
  const { status, body } = await apiPost<{
    deduplicated: boolean;
    id: string;
    lessonId: string;
    score: number;
    totalQuestions: number;
    correctCount: number;
    createdAt: string;
  }>(
    request,
    `/grammar/lessons/${lessonId}/attempts`,
    {
      answers,
      clientEventId
    },
    token
  );

  if (status !== 201 && status !== 200) {
    throw new Error(`submitGrammarAttempt failed: ${status}`);
  }

  return body;
}

export async function fetchStats(
  request: APIRequestContext,
  token: string
): Promise<{
  todayReviewCount: number;
  todayNewWords: number;
  vocabularyTotal: number;
  totalReviews: number;
  grammarAttempts: number;
  grammarCorrectRate: number;
  streakDays: number;
  achievements: Array<{ code: string; title: string; description: string }>;
}> {
  const { status, body } = await apiGet<{
    todayReviewCount: number;
    todayNewWords: number;
    vocabularyTotal: number;
    totalReviews: number;
    grammarAttempts: number;
    grammarCorrectRate: number;
    streakDays: number;
    achievements: Array<{ code: string; title: string; description: string }>;
  }>(request, '/stats/overview', token);

  if (status !== 200) {
    throw new Error(`fetchStats failed: ${status}`);
  }

  return body;
}
