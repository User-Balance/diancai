# 实际接入状态（2026-10-31）

Supabase 项目 `ybgfrckmqqfbynfepdvp` 已执行 `supabase/schema.sql`。真实 PostgreSQL 检查返回：`dishes` RLS=true、3 条策略、Realtime=true；`cooking_records` RLS=true、1 条策略。已有 `record_cook` 原子记录函数。

Site URL 与唯一允许的 Redirect URL 均为 `https://user-balance.github.io/diancai/`。本人登录用户已通过后台邀请，未在公开仓库保存邮箱、用户 ID 或登录凭据。前端只预置 publishable 公钥，私有菜谱由登录和 RLS 保护。

使用步骤：打开邀请邮件 → 返回网页 → 数据与设置 → 将本地菜谱导入云端。首次登录云端为空属于正常情况。本地数据不会自动上传；导入会跳过重复菜名。

已完成离线 PostgreSQL 与领域测试 12 项、生产构建。真实登录后 CRUD、制作记录、跨页面 Realtime 还等待本人登录验收，不能把建表成功等同于完整端到端通过。

微信账号为个人主体，名称准备使用「佳佳食府」。已接受本人确认的认证协议，停在本人扫码人脸验证、手机号和短信验证步骤。尚无已发布版本；基础信息、类目、备案、原生代码上传与审核仍需完成。
