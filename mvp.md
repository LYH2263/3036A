# 词语法英语学习工具（MVP） MVP 规划
*lexigram*

## 项目概述

**描述**: 一个面向英语学习者的 Web 应用（全栈），提供词汇查询与记忆曲线复习、语法知识点学习与交互练习、学习进度可视化与基础成就机制。支持注册登录、学习数据本地存储与云端同步，采用响应式 UI 以适配桌面与移动端，并保留可扩展的模块化架构以便后续加入听力/口语等能力。

**目标用户**:
- 想系统背单词并按复习计划巩固的英语学习者（A2-C1）
- 需要按语法知识点学习并进行练习的自学者/学生
- 希望在手机与电脑间同步学习进度的用户

## 原始需求

> 开发一个具有高潜力的单词语法英语学习工具网页应用。该网页应包含以下核心功能模块：词汇学习系统（支持单词查询、发音、例句展示、记忆曲线复习计划）、语法教学模块（涵盖基础到高级语法知识点讲解、交互式语法练习）、用户进度追踪系统（学习数据可视化、成就解锁机制）。设计需遵循现代UI/UX原则，确保界面直观易用，响应式布局适配桌面端与移动端。实现用户注册登录功能，支持学习数据本地存储与云端同步。系统应具备良好的扩展性，便于后续添加听力练习、口语测评等功能模块。

## 评分信息

| 维度 | 分值 |
|------|------|
| 等级 | B |
| 总分 | 3.37 |
| 类型权重 | 3.25 |
| 加权总分 | 10.95 |
| 清晰度 | 4 |
| 复杂度 | 3.7 |
| 验证难度 | 1.8 |

## 技术栈

- **前端**: Next.js (React) + TypeScript + Tailwind CSS + Zustand + React Query
- **后端**: Node.js (NestJS) + REST API + JWT Auth
- **数据库**: PostgreSQL (via Prisma ORM)
- **选型理由**: Next.js 便于快速构建响应式页面与组件复用；NestJS 提供清晰的模块化架构与可扩展性；PostgreSQL 适合结构化学习数据与统计查询；Prisma 提升开发效率并保证数据一致性。发音在 MVP 使用浏览器 Web Speech API（TTS）避免依赖付费外部服务。

## 核心功能

### 账号与同步 (P0)

- [ ] 邮箱注册/登录（JWT），退出登录
- [ ] 云端保存用户学习数据（单词进度、语法练习记录）
- [ ] 本地存储（IndexedDB）缓存学习记录，登录后可一键同步到云端

### 词汇学习与复习 (P0)

- [ ] 单词查询（基于内置词库/自建词条），展示释义、音标（可选）、例句
- [ ] 发音播放（浏览器 TTS）
- [ ] 加入生词本并生成复习计划（简化记忆曲线：基于间隔与正确率调整下次复习时间）
- [ ] 今日待复习列表与“认识/不认识”复习反馈

### 语法教学与练习 (P0)

- [ ] 语法知识点列表与详情（分级：基础/进阶/高级标签）
- [ ] 每个知识点配套 3-10 道选择题/填空题（MVP 题型）
- [ ] 练习提交与即时判题，记录正确率与错题

### 进度追踪与成就 (P1)

- [ ] 学习数据概览：今日学习/复习数量、连续学习天数、语法练习正确率
- [ ] 基础成就解锁：例如“累计加入 20 个单词”“连续学习 3 天”（仅展示已解锁列表）

## 页面结构

| 路由 | 页面 | 描述 |
|------|------|------|
| `/auth` | 登录/注册 | 用户注册、登录与进入应用。 |
| `/dashboard` | 学习面板 | 展示学习概览与快捷入口（待复习、继续语法练习）。 |
| `/vocabulary` | 词汇学习 | 单词查询、加入生词本、待复习列表与复习流程。 |
| `/grammar` | 语法学习与练习 | 语法知识点浏览、详情阅读与交互练习。 |
| `/progress` | 进度与成就 | 学习数据可视化与已解锁成就展示。 |

## 数据模型

### User

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 用户唯一标识 |
| email | string | 登录邮箱（唯一） |
| password_hash | string | 密码哈希 |
| created_at | timestamp | 注册时间 |

### WordEntry

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 词条唯一标识 |
| word | string | 单词（小写存储，索引查询） |
| definition | text | 释义（MVP 可为简要释义） |
| example_sentence | text | 例句（至少 1 条） |
| phonetic | string | 音标/读音提示（可为空字符串但字段存在） |

### UserWordProgress

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 进度记录唯一标识 |
| user_id | uuid | 所属用户 |
| word_entry_id | uuid | 对应词条 |
| status | string | 学习状态：learning|known |
| ease_factor | float | 记忆难度系数（用于调整复习间隔，MVP 默认 2.5） |
| interval_days | int | 当前复习间隔天数（MVP 从 1 开始） |
| next_review_at | timestamp | 下次复习时间 |
| last_reviewed_at | timestamp | 上次复习时间 |

### GrammarLesson

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 语法知识点唯一标识 |
| title | string | 标题 |
| level | string | 级别：basic|intermediate|advanced |
| content | text | 讲解内容（富文本简化为 HTML/Markdown 字符串存储） |

### GrammarAttempt

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 练习记录唯一标识 |
| user_id | uuid | 所属用户 |
| lesson_id | uuid | 所属语法知识点 |
| score | int | 得分（例如 0-100 或正确题数） |
| total_questions | int | 题目总数 |
| created_at | timestamp | 提交时间 |

## API 端点

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | `none` | 邮箱注册，创建用户并返回 JWT |
| `POST` | `/api/auth/login` | `none` | 邮箱登录，校验密码并返回 JWT |
| `GET` | `/api/auth/me` | `required` | 获取当前用户信息（用于会话校验与初始化） |
| `GET` | `/api/words` | `required` | 查询词库（query: q），返回匹配词条列表（分页可选，MVP 返回前 N 条） |
| `POST` | `/api/user-words` | `required` | 加入生词本：为用户创建 UserWordProgress（若已存在则返回现有记录） |
| `GET` | `/api/user-words/reviews/today` | `required` | 获取今日待复习列表（next_review_at <= now） |
| `POST` | `/api/user-words/:id/review` | `required` | 提交复习反馈（known: true/false），更新记忆曲线参数与 next_review_at |
| `GET` | `/api/grammar/lessons` | `required` | 获取语法知识点列表（可按 level 过滤） |
| `GET` | `/api/grammar/lessons/:id` | `required` | 获取语法知识点详情与练习题（MVP：题目内嵌返回） |
| `POST` | `/api/grammar/lessons/:id/attempts` | `required` | 提交一次练习结果并保存 GrammarAttempt，返回得分与统计 |
| `GET` | `/api/stats/overview` | `required` | 获取用户学习概览统计（单词加入/复习、语法练习、连续天数、已解锁成就简版） |

## 验收标准

### AC-CORE-001 (core)

- **Given**: 用户在未登录状态访问应用
- **When**: 用户使用有效邮箱与密码完成注册并登录
- **Then**: 系统返回有效 JWT，会话保持，页面跳转至 /dashboard 并显示该用户的空白初始统计

### AC-CORE-002 (core)

- **Given**: 用户已登录且词库中存在目标单词
- **When**: 用户在 /vocabulary 输入单词进行搜索并打开词条详情
- **Then**: 页面展示释义、例句，点击发音按钮可通过浏览器 TTS 发声，并可将该词加入生词本生成 next_review_at

### AC-CORE-003 (core)

- **Given**: 用户已加入至少 1 个生词且到达 next_review_at
- **When**: 用户进入 /vocabulary 的今日待复习并完成“认识/不认识”反馈
- **Then**: 系统根据反馈更新 interval_days/ease_factor 与 next_review_at，并在复习列表中移除已完成项

### AC-EDGE-001 (edge)

- **Given**: 用户在离线或网络不稳定场景学习（浏览器可写入 IndexedDB）
- **When**: 用户进行复习或提交语法练习结果
- **Then**: 数据先保存到本地队列且页面提示“待同步”，当网络恢复并重新登录/触发同步后，云端数据与本地数据合并且不产生重复记录

### AC-ERROR-001 (error)

- **Given**: 用户输入错误密码或无效邮箱格式
- **When**: 用户提交登录请求
- **Then**: 系统返回明确错误信息（不泄露账号是否存在的敏感细节），前端以表单级提示展示且不跳转页面

### AC-USABILITY-001 (usability)

- **Given**: 用户使用移动端屏幕访问 /vocabulary 与 /grammar
- **When**: 用户进行搜索、开始复习或开始练习
- **Then**: 页面布局在 360px 宽度下可用（无横向滚动），主要按钮可触达且交互反馈清晰（加载态/禁用态/结果提示）

### AC-CORE-004 (core)

- **Given**: 用户已登录且存在语法知识点与题目
- **When**: 用户在 /grammar 选择一个知识点并提交练习
- **Then**: 系统保存一次 GrammarAttempt 并在页面展示得分与正确率（简版）

### AC-USABILITY-002 (usability)

- **Given**: 用户在 /dashboard 或 /progress 查看统计
- **When**: 系统计算并渲染学习数据
- **Then**: 统计数字在 2 秒内展示完成，且为空数据时显示友好的空状态引导（例如“去查询并加入第一个单词”）

## 不在 MVP 范围内

- 听力练习、口语测评、录音与语音识别评分
- 付费订阅、支付、广告投放与增值服务
- 社交功能（好友、排行榜、分享打卡）
- 多语言界面与国际化完整方案
- 复杂题型（写作批改、开放式问答的智能评测）
- 第三方付费词典/翻译 API 集成（MVP 使用自建词库与浏览器 TTS）
- 完整离线词库下载包与端到端加密同步

## 实现里程碑

### Phase 1 - 基础架构与认证

- [ ] 搭建 Next.js 前端工程：路由、全局状态、基础 UI 组件与响应式布局规范
- [ ] 搭建 NestJS 后端工程：模块划分、JWT 鉴权、中间件与统一错误处理
- [ ] 搭建 PostgreSQL + Prisma：User/WordEntry/UserWordProgress/GrammarLesson/GrammarAttempt 表结构与迁移
- [ ] 实现 /auth 页面与注册登录接口联调（register/login/me）

**验收**: ['用户可注册登录并访问受保护页面（/dashboard 等），未登录访问会跳转 /auth', '后端接口返回格式统一，错误码与错误信息可被前端正确展示']

### Phase 2 - 词汇学习 MVP

- [ ] 导入最小可用词库（例如 2000 高频词）到 WordEntry（含释义与例句）
- [ ] 实现词汇查询接口与 /vocabulary 页面搜索结果列表与详情展示
- [ ] 实现浏览器 TTS 发音按钮（前端）
- [ ] 实现加入生词本、今日待复习列表、复习反馈更新记忆曲线（简化算法）

**验收**: ['用户可以搜索到词条并查看释义/例句，发音按钮可播放', '用户可加入生词本并在到期后出现在今日待复习，复习后 next_review_at 会更新']

### Phase 3 - 语法练习与进度统计

- [ ] 导入最小语法知识点与题目（例如 15 个知识点，每个 3-10 题）
- [ ] 实现 /grammar 列表、详情与练习提交流程（保存 GrammarAttempt）
- [ ] 实现 /dashboard 与 /progress 页面展示 overview 统计与空状态
- [ ] 实现本地缓存与云端同步最小闭环：离线写入 IndexedDB 队列、在线后提交到后端并去重（以本地生成的 client_event_id 或 attempt id 去重）

**验收**: ['用户可完成语法练习并看到得分，记录可在 /progress 反映出来', '离线产生的复习/练习记录在恢复网络后可同步到云端且不会重复计数']
