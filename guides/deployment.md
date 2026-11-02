# GitHub Pages 部署记录

更新：2026-11-02。最新功能发布提交 `bddfbb7aaa584bf8f7687cbcd73068ba89945547`；Pages API 确认同提交 `status=built`，`updated_at=2026-11-02T07:01:47Z`，无构建错误。正式网页已确认云端登录、真实保存和手机到电脑 Realtime；完整验收边界见 [同步验收记录](sync-acceptance.md)。

目标账号已通过 GitHub API 和已有认证核实为 `User-Balance`。

采用独立仓库 `User-Balance/diancai`，Pages 从 `main /docs` 发布。公开 URL：`https://user-balance.github.io/diancai/`。

实际发布后需同时核对：Pages API 状态、构建提交与远端 main 一致、公开页面真实渲染和交互正常。推送成功本身不作为部署完成证据。
