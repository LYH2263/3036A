import { expect, test } from '@playwright/test';

import { buildGenericAnswers } from '../../fixtures/answers';
import { createE2EUser } from '../../fixtures/users';
import { ensureSession } from '../../helpers/auth.helper';
import { apiGet, apiPost } from '../../helpers/api.helper';
import {
  addWordToNotebook,
  fetchLessonDetail,
  fetchLessons,
  fetchStats,
  fetchTodayReviews,
  reviewWord,
  searchWords,
  submitGrammarAttempt
} from '../../helpers/db.helper';

test.describe('API branches full', () => {
  test('review 接口 clientEventId 幂等去重 @full', async ({ request }) => {
    const user = createE2EUser('api-review-dedupe');
    const session = await ensureSession(request, user);

    const words = await searchWords(request, session.accessToken, 'ability');
    await addWordToNotebook(request, session.accessToken, words[0].id);
    const reviews = await fetchTodayReviews(request, session.accessToken);

    const eventId = `review-dedupe-${Date.now()}`;
    const first = await reviewWord(request, session.accessToken, reviews[0].id, true, eventId);
    const second = await reviewWord(request, session.accessToken, reviews[0].id, true, eventId);

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
  });

  test('grammar attempts 接口 clientEventId 幂等去重 @full', async ({ request }) => {
    const user = createE2EUser('api-grammar-dedupe');
    const session = await ensureSession(request, user);

    const lessons = await fetchLessons(request, session.accessToken);
    const detail = await fetchLessonDetail(request, session.accessToken, lessons[0].id);

    const eventId = `grammar-dedupe-${Date.now()}`;
    const answers = buildGenericAnswers(detail);

    const first = await submitGrammarAttempt(
      request,
      session.accessToken,
      detail.id,
      answers,
      eventId
    );
    const second = await submitGrammarAttempt(
      request,
      session.accessToken,
      detail.id,
      answers,
      eventId
    );

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
  });

  test('words 空查询边界返回空数组 @full', async ({ request }) => {
    const user = createE2EUser('api-words-empty');
    const session = await ensureSession(request, user);

    const { status, body } = await apiGet<unknown[]>(request, '/words?q=', session.accessToken);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('auth login 错误凭证返回统一文案 @full', async ({ request }) => {
    const user = createE2EUser('api-login-fail');
    await ensureSession(request, user);

    const { status, body } = await apiPost<{ message: string }>(request, '/auth/login', {
      email: user.email,
      password: `${user.password}-wrong`
    });

    expect(status).toBe(401);
    expect(body.message).toContain('邮箱或密码错误');
  });

  test('stats overview 空用户与有数据用户口径 @full', async ({ request }) => {
    const emptyUser = createE2EUser('api-stats-empty');
    const emptySession = await ensureSession(request, emptyUser);

    const emptyStats = await fetchStats(request, emptySession.accessToken);
    expect(emptyStats.vocabularyTotal).toBe(0);
    expect(emptyStats.totalReviews).toBe(0);

    const activeUser = createE2EUser('api-stats-active');
    const activeSession = await ensureSession(request, activeUser);

    const words = await searchWords(request, activeSession.accessToken, 'ability');
    await addWordToNotebook(request, activeSession.accessToken, words[0].id);
    const reviews = await fetchTodayReviews(request, activeSession.accessToken);
    await reviewWord(request, activeSession.accessToken, reviews[0].id, true);

    const lessons = await fetchLessons(request, activeSession.accessToken);
    const detail = await fetchLessonDetail(request, activeSession.accessToken, lessons[0].id);
    await submitGrammarAttempt(request, activeSession.accessToken, detail.id, buildGenericAnswers(detail));

    const activeStats = await fetchStats(request, activeSession.accessToken);
    expect(activeStats.vocabularyTotal).toBeGreaterThan(0);
    expect(activeStats.totalReviews).toBeGreaterThan(0);
    expect(activeStats.grammarAttempts).toBeGreaterThan(0);
  });
});
