# 验收说明

本文档对应 `mvp.md` 中的 AC 条目，说明本项目的验证方式与证据路径。

## AC-CORE-001

- 目标：未登录用户可注册登录，跳转 `/dashboard` 并显示初始统计。
- 验证步骤：
  1. 打开 `/auth`，输入有效邮箱与密码注册。
  2. 注册成功后自动登录并跳转 `/dashboard`。
  3. 首次用户在无数据时看到空状态提示。
- 代码位置：
  - `apps/web/app/auth/page.tsx`
  - `apps/api/src/auth/*`
  - `apps/web/app/dashboard/page.tsx`

## AC-CORE-002

- 目标：词汇查询展示释义/例句，支持 TTS，支持加入生词本。
- 验证步骤：
  1. 登录后进入 `/vocabulary` 搜索单词。
  2. 点击“发音”触发浏览器朗读。
  3. 点击“加入生词本”创建用户词汇进度。
- 代码位置：
  - `apps/web/app/vocabulary/page.tsx`
  - `apps/api/src/words/*`
  - `apps/api/src/user-words/*`

## AC-CORE-003

- 目标：今日待复习反馈后，更新 `interval_days/ease_factor/next_review_at` 并从列表移除。
- 验证步骤：
  1. 在 `/vocabulary` 的今日待复习中点击“认识/不认识”。
  2. 刷新列表，已完成项移除。
  3. 数据库中对应字段被更新。
- 代码位置：
  - `apps/api/src/user-words/user-words.service.ts`
  - `apps/web/app/vocabulary/page.tsx`

## AC-EDGE-001

- 目标：离线时事件进入 IndexedDB 队列，恢复后同步且去重。
- 验证步骤：
  1. 断网后提交复习/语法练习。
  2. 页面提示“待同步”。
  3. 恢复网络点击“立即同步”。
  4. 重复同步同一 `clientEventId` 不重复计数。
- 代码位置：
  - `apps/web/lib/offline-queue.ts`
  - `apps/web/lib/sync.ts`
  - `apps/api/prisma/schema.prisma`（唯一约束）

## AC-ERROR-001

- 目标：错误密码/邮箱格式错误时给出明确错误提示，不泄露账号存在性。
- 验证步骤：
  1. 在登录页输入非法邮箱，前端阻止并提示。
  2. 输入错误密码，后端返回统一错误文案“邮箱或密码错误”。
- 代码位置：
  - `apps/web/lib/helpers.ts`
  - `apps/api/src/auth/auth.service.ts`
  - `apps/api/src/common/http-exception.filter.ts`

## AC-USABILITY-001

- 目标：移动端 360px 下 `/vocabulary` 与 `/grammar` 可用，无横向滚动。
- 验证步骤：
  1. 浏览器开发者工具切到 360px。
  2. 检查搜索、复习、练习主要按钮可点击且有状态反馈。
- 代码位置：
  - `apps/web/app/vocabulary/page.tsx`
  - `apps/web/app/grammar/page.tsx`
  - `apps/web/components/app-shell.tsx`

## AC-CORE-004

- 目标：语法练习可提交、保存并显示得分。
- 验证步骤：
  1. `/grammar` 选择知识点并作答。
  2. 提交后显示得分与正确题数。
  3. 数据库存在 `GrammarAttempt` 记录。
- 代码位置：
  - `apps/web/app/grammar/page.tsx`
  - `apps/api/src/grammar/*`

## AC-USABILITY-002

- 目标：`/dashboard` 与 `/progress` 统计在 2 秒内展示，空数据有引导。
- 验证步骤：
  1. 登录后进入 `/dashboard`、`/progress`。
  2. 观察数据加载与空状态文案。
- 代码位置：
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/app/progress/page.tsx`
  - `apps/api/src/stats/stats.service.ts`
