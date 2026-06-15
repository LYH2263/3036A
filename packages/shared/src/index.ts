export type GrammarLevel = 'basic' | 'intermediate' | 'advanced';

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

export interface UserWordProgressDto {
  id: string;
  wordEntryId: string;
  status: 'learning' | 'known';
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  word: WordEntryDto;
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

export interface GrammarAttemptDto {
  id: string;
  lessonId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: string;
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

export type OfflineQueueEvent = WordReviewEvent | GrammarAttemptEvent;

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
    answers: Array<{ questionId: string; answer: string }>;
  };
  createdAt: string;
}
