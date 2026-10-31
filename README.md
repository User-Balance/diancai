# 点菜本

个人厨房的小菜谱。分类收好喜欢的菜，安排今日菜单，记录每一次认真下厨。

- 在线应用：https://user-balance.github.io/diancai/
- 在线接入指南：https://user-balance.github.io/diancai/setup.html
- 源码仓库：https://github.com/User-Balance/diancai

## 已实现

| 能力 | 实现 |
| --- | --- |
| 分类菜单 | 7 个初始分类，允许在菜谱表单填写新分类 |
| 菜品不重复 | 全局按菜名去重，忽略空格、大小写、全角差异；云端有唯一索引 |
| 手动管理 | 新增、编辑、收藏、归档、恢复；归档可撤销 |
| 菜品详情 | 食材、调料、分步制作方法、制作次数、个人评分、耗时和小记 |
| 下厨记录 | 「做过一次 +1」、可选本次评分、最近 10 次历史 |
| 点菜 | 今日菜单、随机选菜、采购清单、复制清单 |
| 备份 | JSON 导出、追加导入、跳过重名 |
| 云端接入 | Supabase Auth、PostgreSQL、RLS、Realtime 订阅；通过界面配置 |
| 手机使用 | 响应式网页，可在手机浏览器或微信内打开 |

初次打开提供 12 份入门菜谱。制作次数均为 0、评分为空，不伪造个人记录。添加了两个示例收藏，可取消。

当前默认本地模式，数据保存在当前浏览器。按使用者要求，暂未创建 Supabase 项目，也未接入真实云端。云端接入代码、SQL 和步骤已经准备；真实 Auth / Realtime / 跨设备同步需创建项目后验收。

## 开发

Node.js 22.12+ 或 24+。

```bash
npm ci
npm run dev
npm test
npm run build
```

本地开发在终端显示的 `127.0.0.1` 地址打开。纯网页部署由 `dist/` 产生，资源使用相对路径，可发布在子路径。

## 后续更新 GitHub Pages

当前使用独立项目仓库，Pages 从 `main /docs` 发布。

```bash
npm ci
npm test
npm run pages:prepare
git add src public scripts supabase guides tests package.json package-lock.json docs
git diff --cached --check
git commit -m "Update kitchen recipes app"
git push origin main
```

提交前检查 `git status` 和变更范围。不要提交 `.env`、真实账号数据、密钥或浏览器导出的个人菜谱。等待 Pages build 成功，再打开公开页面验证，推送本身不等于完成部署。

## 接入和发布文档

- [实时数据库接入](guides/database.md)
- [GitHub Pages 的数据库能力和发布](guides/github-pages.md)
- [微信小程序发布流程](guides/wechat.md)
- [OpenAI Sites 域名托管流程](guides/openai-sites.md)
- [验证范围](guides/validation.md)

## 数据规则

制作次数和评分可以在编辑页面初始化 / 更正。「做过一次」同时追加一条历史记录；云端通过数据库事务和行锁实现。评分是个人最近一次给出的评分，不计算社区平均分。未评分的下厨记录保留原有个人评分。

JSON 备份只包含当前未归档菜谱，不含归档记录、下厨历史、今日菜单、账号或登录凭据。导入不会覆盖现有重名菜谱。今天的菜单是每个账号在当前设备上的临时安排，不在云端同步。

本地菜谱与云端菜谱分开；登录后可主动将本地菜谱追加导入云端，退出后回到本地菜谱。云端错误不会静默写成本地记录。多端编辑通过版本号拦截过期保存，需要重新打开编辑页面。

食材清单只合并文字和用量完全相同的条目，不推测或累加不同单位、不同份量。所有用户输入按纯文本渲染。
