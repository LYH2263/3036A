# E2E 测试说明（Playwright）

本目录包含 lexigram 的全链路 E2E 测试：

- `specs/smoke`: PR 快速回归
- `specs/full`: 发布前完整分支与边界覆盖（包含 smoke）
- `pages`: Page Object
- `helpers`: API/鉴权/离线辅助函数
- `fixtures`: 测试数据工厂

## 运行命令

```bash
pnpm e2e:install
pnpm e2e:smoke
pnpm e2e:full
```

## 环境策略

- 通过 `docker compose up -d --build` 启动 `web/api/db`
- Playwright 在宿主机执行，访问 `http://localhost:3000`
- smoke 默认保留容器，full 默认清理容器与卷

## 常见排查

1. 端口占用：确认 `3000/4000/5432` 未被其他进程占用。
2. 浏览器未安装：执行 `pnpm e2e:install`。
3. 某用例偶发失败：查看 `e2e-report` 中 trace/video/screenshot。
