export type GrammarLevel = 'basic' | 'intermediate' | 'advanced';

export type TimeLimitMode = 'per_question' | 'per_quiz';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface WordEntryDto {
  id: string;
  word: string;
  definition: string;
  exampleSentence: string;
  phonetic: string;
}

export interface WordGroupDto {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
}

export interface WordGroupDetailDto {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface WordNoteDto {
  id: string;
  progressId: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertWordNoteResultDto {
  created?: boolean;
  updated?: boolean;
  deleted?: boolean;
  note: WordNoteDto | null;
  clientEventId?: string;
}

export interface UserWordProgressDto {
  id: string;
  wordEntryId: string;
  status: 'learning' | 'known';
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  word: WordEntryDto;
  groups: WordGroupDetailDto[];
}

export interface CreateWordGroupDto {
  name: string;
  color?: string;
}

export interface UpdateWordGroupDto {
  name?: string;
  color?: string;
}

export interface AssignWordsToGroupDto {
  progressIds: string[];
}

export interface RemoveWordsFromGroupDto {
  progressIds: string[];
}

export interface GrammarQuestionDto {
  id: string;
  type: 'single_choice' | 'fill_blank';
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface GrammarLessonDto {
  id: string;
  title: string;
  level: GrammarLevel;
  content: string;
  questions: GrammarQuestionDto[];
}

export interface GrammarAttemptAnswer {
  questionId: string;
  answer: string;
  timedOut?: boolean;
  timeTakenMs?: number;
}

export interface QuestionResultDetail {
  questionId: string;
  correct: boolean;
  timedOut: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  prompt: string;
  type: 'single_choice' | 'fill_blank';
  options: string[];
  timeTakenMs?: number;
}

export interface GrammarAttemptDto {
  id: string;
  lessonId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: string;
  isTimedMode?: boolean;
  timeLimitMode?: TimeLimitMode;
  timeLimitSec?: number;
  timeTakenMs?: number;
  timeoutCount?: number;
  details?: QuestionResultDetail[];
}

export interface GrammarMistakeDto {
  id: string;
  questionId: string;
  lessonId: string;
  lessonTitle: string;
  level: GrammarLevel;
  questionType: 'single_choice' | 'fill_blank';
  prompt: string;
  options: string[];
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  errorCount: number;
  lastAttemptAt: string;
  createdAt: string;
}

export interface GrammarMistakeLessonDto {
  lessonId: string;
  lessonTitle: string;
  level: GrammarLevel;
  count: number;
}

export interface GrammarMistakeRetryResultDto {
  deduplicated: boolean;
  id: string;
  correctCount: number;
  totalQuestions: number;
  removedCount: number;
  createdAt: string;
}

export type GrammarProgressStatus = 'not_started' | 'learning' | 'mastered';

export interface GrammarLessonProgressDto {
  lessonId: string;
  title: string;
  level: GrammarLevel;
  content: string;
  status: GrammarProgressStatus;
  progressPercent: number;
  lastScore: number | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  locked: boolean;
  lockReason?: string;
}

export interface GrammarLessonsProgressOverviewDto {
  lessons: GrammarLessonProgressDto[];
  levelMastery: {
    basic: { total: number; mastered: number; masteryPercent: number };
    intermediate: { total: number; mastered: number; masteryPercent: number };
    advanced: { total: number; mastered: number; masteryPercent: number };
  };
}

export interface AchievementDto {
  code: string;
  title: string;
  description: string;
}

export interface StatsOverviewDto {
  todayReviewCount: number;
  todayNewWords: number;
  vocabularyTotal: number;
  totalReviews: number;
  grammarAttempts: number;
  grammarCorrectRate: number;
  streakDays: number;
  achievements: AchievementDto[];
}

export type OfflineQueueEvent =
  | WordReviewEvent
  | GrammarAttemptEvent
  | GrammarMistakeRetryEvent
  | WordNoteUpsertEvent
  | WordNoteDeleteEvent
  | SearchHistoryAddEvent
  | SearchHistoryDeleteEvent
  | SearchHistoryClearEvent;

export interface WordReviewEvent {
  type: 'WORD_REVIEW';
  clientEventId: string;
  payload: {
    progressId: string;
    known: boolean;
  };
  createdAt: string;
}

export interface GrammarAttemptEvent {
  type: 'GRAMMAR_ATTEMPT';
  clientEventId: string;
  payload: {
    lessonId: string;
    answers: GrammarAttemptAnswer[];
    isTimedMode?: boolean;
    timeLimitMode?: TimeLimitMode;
    timeLimitSec?: number;
    timeTakenMs?: number;
  };
  createdAt: string;
}

export interface GrammarMistakeRetryEvent {
  type: 'GRAMMAR_MISTAKE_RETRY';
  clientEventId: string;
  payload: {
    answers: Array<{ mistakeId: string; answer: string }>;
  };
  createdAt: string;
}

export interface WordNoteUpsertEvent {
  type: 'WORD_NOTE_UPSERT';
  clientEventId: string;
  payload: {
    progressId: string;
    content: string;
    expectedVersion?: number;
  };
  createdAt: string;
}

export interface WordNoteDeleteEvent {
  type: 'WORD_NOTE_DELETE';
  clientEventId: string;
  payload: {
    progressId: string;
  };
  createdAt: string;
}

export interface SearchHistoryDto {
  id: string;
  query: string;
  searchedAt: string;
  inLibrary: boolean;
}

export interface SearchHistoryAddEvent {
  type: 'SEARCH_HISTORY_ADD';
  clientEventId: string;
  payload: {
    query: string;
  };
  createdAt: string;
}

export interface SearchHistoryDeleteEvent {
  type: 'SEARCH_HISTORY_DELETE';
  clientEventId: string;
  payload: {
    query: string;
  };
  createdAt: string;
}

export interface SearchHistoryClearEvent {
  type: 'SEARCH_HISTORY_CLEAR';
  clientEventId: string;
  payload: Record<string, never>;
  createdAt: string;
}
