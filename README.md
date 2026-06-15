# lexigram（词语法英语学习工具）

基于 MVP 需求实现的全栈项目：Next.js + NestJS + PostgreSQL + Prisma。

## 原始需求

> 开发一个具有高潜力的单词语法英语学习工具网页应用。该网页应包含以下核心功能模块：词汇学习系统（支持单词查询、发音、例句展示、记忆曲线复习计划）、语法教学模块（涵盖基础到高级语法知识点讲解、交互式语法练习）、用户进度追踪系统（学习数据可视化、成就解锁机制）。设计需遵循现代UI/UX原则，确保界面直观易用，响应式布局适配桌面端与移动端。实现用户注册登录功能，支持学习数据本地存储与云端同步。系统应具备良好的扩展性，便于后续添加听力练习、口语测评等功能模块。

## 目录结构

```text
.
├── apps
│   ├── api      # NestJS + Prisma
│   └── web      # Next.js + Tailwind + Zustand + React Query
├── packages
│   └── shared   # 前后端共享类型
├── docs
│   └── acceptance.md
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## 代码架构

### Monorepo 分层

- `apps/web`：Next.js 15 App Router 前端，负责页面渲染、交互与离线队列管理。
- `apps/api`：NestJS 11 后端，按模块拆分鉴权、词汇、语法、统计等 REST 接口。
- `packages/shared`：前后端共享 DTO/类型与常量，降低接口漂移风险。

### 后端模块结构（apps/api/src）

- `auth`：注册、登录、`/me` 与 JWT 鉴权守卫。
- `words`：词汇搜索查询。
- `user-words`：加入生词本、今日复习、复习反馈与记忆曲线更新。
- `grammar`：语法知识点、题目读取与提交判题。
- `stats`：Dashboard/Progress 聚合统计与成就计算。
- `common`：统一异常过滤、时间格式化、校验与跨模块公共能力。

### 前端页面结构（apps/web/app）

- `/auth`：注册/登录与错误反馈。
- `/dashboard`：学习概览、快捷入口、同步状态。
- `/vocabulary`：词汇搜索、发音、加入生词本、今日复习流。
- `/grammar`：知识点筛选、练习作答、结果反馈。
- `/progress`：学习统计与成就展示。

### 数据与同步链路

1. 前端通过 React Query 请求 API，认证信息由 Zustand 管理。
2. 在线场景直接提交学习事件；离线场景写入 IndexedDB 队列。
3. 登录后与手动点击同步按钮时回放离线事件。
4. 服务端基于 `clientEventId` 唯一约束做幂等去重，避免重复记账。

## 技术细节

### 核心技术栈

- 前端：Next.js 15 + React 19 + TypeScript + Tailwind CSS + Zustand + React Query + idb。
- 后端：NestJS 11 + Prisma 6 + PostgreSQL 16 + JWT + class-validator。
- 测试：Vitest（单测）+ Playwright（E2E，smoke/full 分层）。
- 工程：pnpm workspace + TypeScript 项目引用 + Docker Compose。

### API 与数据建模要点

- 按 MVP 约束实现核心实体：`User`、`WordEntry`、`UserWordProgress`、`GrammarLesson`、`GrammarAttempt`。
- 复习与语法提交支持 `clientEventId` 幂等语义，适配离线重放。
- 对外时间字段统一输出常规格式：`YYYY-MM-DD HH:mm:ss`。
- 后端统一错误结构与中文错误消息，便于前端稳定展示。

### 记忆曲线规则

- 初始：`ease_factor=2.5`、`interval_days=1`、`next_review_at=now`。
- 认识：提升难度因子并按因子扩大间隔天数。
- 不认识：降低难度因子并重置为 1 天复习。
- 每次反馈写入复习事件，驱动统计页与仪表盘更新。

### 可测试性与交付

- 全页面关键交互提供稳定 `data-testid`，保障 E2E 可维护。
- 根脚本统一提供 `lint/test/build/e2e` 命令，支持本地与容器一致执行。
- Docker 镜像固定为非 Alpine：Web/API `node:22-bookworm-slim`，DB `postgres:16`。

## 环境准备

- Node.js >= 22
- pnpm >= 10
- PostgreSQL 16（或直接用 Docker Compose）

## 本地启动（非 Docker）

1. 安装依赖

```bash
pnpm install
```

2. 配置环境变量

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. 初始化数据库

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

4. 使用测试账号登录（执行 `pnpm prisma:seed` 后可用）

- 邮箱：`test@lexigram.local`
- 密码：`Test123456`

5. 启动前后端

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api

## Docker 一键启动

```bash
docker compose up --build
```

镜像说明：

- Web/API: `node:22-bookworm-slim`
- DB: `postgres:16`

## 常用命令

```bash
pnpm lint
pnpm test
pnpm build
pnpm e2e:install
pnpm e2e:smoke
pnpm e2e:full
```

## 已实现能力（MVP）

- 账号注册/登录/JWT 会话
- 词汇搜索、发音（Web Speech API）、加入生词本
- 今日待复习与“认识/不认识”反馈（记忆曲线）
- 语法知识点列表、详情、练习提交与评分
- 学习统计与基础成就展示
- IndexedDB 离线队列 + 登录后/手动同步 + 服务端幂等去重
