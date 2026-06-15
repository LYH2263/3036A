# E2E 分支覆盖矩阵

> 口径：业务全分支 + 关键边界（不含视觉像素级）

## 路由与鉴权

| 分支 | 规格文件 | 用例标题 |
|---|---|---|
| 未登录访问 `/` -> `/auth` | `e2e/specs/smoke/guards.smoke.spec.ts` | 未登录访问根路由重定向到 auth |
| 已登录访问 `/` -> `/dashboard` | `e2e/specs/smoke/guards.smoke.spec.ts` | 已登录访问根路由重定向到 dashboard |
| 未登录访问受保护页 -> `/auth` | `e2e/specs/smoke/guards.smoke.spec.ts` + `e2e/specs/full/routes.full.spec.ts` | 未登录访问受保护页重定向到 auth / 未登录访问各受保护页会回到 auth |

## `/auth`

| 分支 | 规格文件 | 用例标题 |
|---|---|---|
| 默认登录模式 | `e2e/specs/full/auth.full.spec.ts` | 登录/注册模式切换文案正确 |
| 登录/注册切换 | `e2e/specs/smoke/auth.smoke.spec.ts` | auth 表单校验与模式切换 |
| 非法邮箱校验 | `e2e/specs/smoke/auth.smoke.spec.ts` | auth 表单校验与模式切换 |
| 短密码校验 | `e2e/specs/smoke/auth.smoke.spec.ts` | auth 表单校验与模式切换 |
| 注册成功跳转 | `e2e/specs/smoke/auth.smoke.spec.ts` | auth 注册成功后跳转 dashboard |
| 重复注册失败 | `e2e/specs/full/auth.full.spec.ts` | 重复注册显示后端错误提示 |
| 错误密码登录失败 | `e2e/specs/smoke/auth.smoke.spec.ts` + `e2e/specs/full/api-branches.spec.ts` | auth 错误密码提示统一文案 / auth login 错误凭证返回统一文案 |
| 已登录访问 auth 自动跳转 | `e2e/specs/full/auth.full.spec.ts` | 已登录访问 auth 自动跳转 dashboard |

## `/dashboard`

| 分支 | 规格文件 | 用例标题 |
|---|---|---|
| 统计卡片渲染 | `e2e/specs/full/dashboard.full.spec.ts` | 有学习数据时卡片渲染且空态隐藏 |
| 空数据空态 | `e2e/specs/smoke/dashboard.smoke.spec.ts` | 空态展示、快捷入口与退出登录 |
| 快捷入口跳转 | `e2e/specs/smoke/dashboard.smoke.spec.ts` | 空态展示、快捷入口与退出登录 |
| 同步成功分支 | `e2e/specs/full/dashboard.full.spec.ts` | 同步按钮成功分支消费队列事件 |
| 同步失败分支 | `e2e/specs/full/dashboard.full.spec.ts` | 同步按钮失败分支显示失败计数 |
| 退出登录 | `e2e/specs/smoke/dashboard.smoke.spec.ts` | 空态展示、快捷入口与退出登录 |

## `/vocabulary`

| 分支 | 规格文件 | 用例标题 |
|---|---|---|
| 空查询不渲染结果 | `e2e/specs/full/vocabulary.full.spec.ts` | 空查询、无结果、有结果三种分支渲染 |
| 查询无结果 | `e2e/specs/full/vocabulary.full.spec.ts` | 空查询、无结果、有结果三种分支渲染 |
| 查询有结果 | `e2e/specs/smoke/vocabulary.smoke.spec.ts` + `e2e/specs/full/vocabulary.full.spec.ts` | 搜索、加入生词本、在线复习提交流程 / 空查询、无结果、有结果三种分支渲染 |
| 发音（支持） | `e2e/specs/full/vocabulary.full.spec.ts` | 发音按钮在 speechSynthesis 存在时被调用 |
| 发音（不支持降级） | `e2e/specs/full/vocabulary.full.spec.ts` | 发音按钮在 speechSynthesis 缺失时安全降级 |
| 加入生词本成功 | `e2e/specs/smoke/vocabulary.smoke.spec.ts` | 搜索、加入生词本、在线复习提交流程 |
| 加入生词本失败 | `e2e/specs/full/vocabulary.full.spec.ts` | 加入生词本失败分支显示错误提示 |
| 今日复习空态 | `e2e/specs/full/vocabulary.full.spec.ts` | 今日复习空态与不认识反馈分支 |
| 今日复习非空 | `e2e/specs/smoke/vocabulary.smoke.spec.ts` | 搜索、加入生词本、在线复习提交流程 |
| 在线 known/unknown | `e2e/specs/smoke/vocabulary.smoke.spec.ts` + `e2e/specs/full/vocabulary.full.spec.ts` | 搜索、加入生词本、在线复习提交流程 / 今日复习空态与不认识反馈分支 |
| 离线入队 | `e2e/specs/smoke/offline-sync.smoke.spec.ts` + `e2e/specs/full/vocabulary.full.spec.ts` | 离线队列事件可被同步消费 / 离线复习后恢复网络可同步并清空队列 |
| 在线失败回退入队 | `e2e/specs/full/vocabulary.full.spec.ts` | 在线请求失败回退到离线队列 |
| 同步后联动更新 | `e2e/specs/smoke/offline-sync.smoke.spec.ts` + `e2e/specs/full/vocabulary.full.spec.ts` | 离线队列事件可被同步消费 / 离线复习后恢复网络可同步并清空队列 |

## `/grammar`

| 分支 | 规格文件 | 用例标题 |
|---|---|---|
| level 过滤 all/basic/intermediate/advanced | `e2e/specs/full/grammar.full.spec.ts` | 级别过滤分支全部可切换 |
| 自动选中首个 lesson | `e2e/specs/full/grammar.full.spec.ts` | 自动选中首个 lesson 且切换 lesson 会重置结果 |
| 切换 lesson 重置结果 | `e2e/specs/full/grammar.full.spec.ts` | 自动选中首个 lesson 且切换 lesson 会重置结果 |
| 选择题/填空题作答 | `e2e/specs/full/grammar.full.spec.ts` | 选择题与填空题都可渲染作答 |
| 在线提交成功 | `e2e/specs/smoke/grammar.smoke.spec.ts` | 语法练习在线提交流程 |
| 离线提交入队 | `e2e/specs/full/grammar.full.spec.ts` | 离线提交会进入本地队列 |
| 在线失败回退入队 | `e2e/specs/full/grammar.full.spec.ts` | 在线提交失败会回退进入本地队列 |
| 同步后联动更新 | `e2e/specs/full/grammar.full.spec.ts` | 离线语法事件恢复网络后可同步 |

## `/progress`

| 分支 | 规格文件 | 用例标题 |
|---|---|---|
| 加载与统计卡片 | `e2e/specs/smoke/progress.smoke.spec.ts` | 进度页渲染与空成就态 |
| 无成就空态 | `e2e/specs/smoke/progress.smoke.spec.ts` + `e2e/specs/full/progress.full.spec.ts` | 进度页渲染与空成就态 / 空数据用户显示空成就提示 |
| 有成就列表 | `e2e/specs/full/progress.full.spec.ts` | 达成阈值后显示成就列表 |

## API 关键分支补充

| 分支 | 规格文件 | 用例标题 |
|---|---|---|
| review 幂等去重 | `e2e/specs/full/api-branches.spec.ts` | review 接口 clientEventId 幂等去重 |
| grammar attempt 幂等去重 | `e2e/specs/full/api-branches.spec.ts` | grammar attempts 接口 clientEventId 幂等去重 |
| words 空查询边界 | `e2e/specs/full/api-branches.spec.ts` | words 空查询边界返回空数组 |
| login 错误凭证统一文案 | `e2e/specs/full/api-branches.spec.ts` | auth login 错误凭证返回统一文案 |
| stats 空/非空口径 | `e2e/specs/full/api-branches.spec.ts` | stats overview 空用户与有数据用户口径 |

## 移动端 360 可用性

| 分支 | 规格文件 | 用例标题 |
|---|---|---|
| `/vocabulary` 360 可用无横向滚动 | `e2e/specs/full/responsive.mobile.spec.ts` | vocabulary 在 360 宽度无横向滚动且主操作可见 |
| `/grammar` 360 可用无横向滚动 | `e2e/specs/full/responsive.mobile.spec.ts` | grammar 在 360 宽度无横向滚动且提交按钮可达 |
