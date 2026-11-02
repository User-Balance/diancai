# 佳佳食府云开发接入清单

2026-11-02 核对：成长计划免费环境已领取，名称 `jiajiashifu`，ID `jiajiashifu-d6gsr0cor58d2d384`，属于佳佳食府。个人版有效期至 2027-05-02。控制台配额显示调用 20 万次、容量 3 GB、云函数资源使用量 15 万 GBs、外网出流量 4 GB、CDN 流量及回源各 10 GB。已验证按量付费关闭，并经本人授权关闭自动续费。页面续费标价 ¥19.9/月，未付款或订阅新增服务。

赠送环境具有本项目需要的云函数能力；是否足够长期使用以实际消耗为准。当前只需要微信调用网关，菜谱继续保存在 Supabase，不启用额外云数据库、对象存储、AI 或付费日志服务。AI Token 不属于云函数配额。到期或额度耗尽后的实际停服和保留规则需在接近续期时再核对。

## 环境与云函数

`miniprogram/config.js` 已填写真实环境 ID。事件型函数固定名称 `kitchen`，代码目录 `cloudfunctions/kitchen`，入口 `index.main`。控制台已实际提供 Node.js 22.21（公测中），符合固定依赖 `@supabase/supabase-js@2.118.0` 的 Node >=22 要求；微信 SDK 为 3.0.4，依赖锁文件已准备。

目标配置：Nodejs22.21、256 MB、20 秒、不配置触发器、不公开 HTTP 网关。`cloudbaserc.example.json` 仅为 CLI 示例，不会自动应用到开发者工具。需在版本配置页逐项核对。

部署步骤：

1. 开发者工具选择 `jiajiashifu-d6gsr0cor58d2d384`。
2. 右键本地 `kitchen` → 上传并部署 → 云端安装依赖。保留当前锁文件。
3. 控制台确认业务代码部署成功和配置正确；占位函数创建不等于业务部署完成。
4. 通过小程序调用确认依赖可加载、Supabase 外网请求可达、未登录请求被拒绝。
5. 真机登录验证后再上传小程序版本；后台实际出现版本才能继续体验及审核流程。

只使用 Supabase publishable 公钥，用户 JWT 和数据库 RLS 决定数据权限。客户端不能指定 owner_id；不使用 service_role、数据库密码、微信 AppSecret，不添加公开 HTTP 入口。

## 免费邮箱登录与网页共用账号

当前 Supabase Free 后台要求配置自定义 SMTP 才能编辑 Magic Link 模板，默认邮件没有可见六位验证码。模板保持原样；未升级套餐或申请 SMTP。

本人使用已邀请邮箱发送登录邮件，`shouldCreateUser:false`。在手机邮件中长按登录按钮，复制**尚未点击的完整链接**，粘贴进本人需要登录的网页或小程序。电脑无需打开邮箱，也不要把链接发给协作者。

应用严格检查本 Supabase 项目 HTTPS 地址、`/auth/v1/verify` 和邮箱验证类型，提取 token hash，调用 `verifyOtp({ token_hash, type:'email' })`。不会打开提供的链接或跟随 redirect_to；提交后清空输入，不在日志及错误中输出凭据。已经打开或使用的链接不能再用，需重新发送。若后续邮件已有六位验证码，可以使用备用验证码入口。

官方 API：https://supabase.com/docs/reference/javascript/auth-verifyotp

## 验收与发布

- 真机 wx.cloud.init 成功、kitchen 可调用，未登录不能读取菜谱。
- 登录后看到既有 Supabase 菜谱；编辑、评分、下厨 +1 和历史保存真实执行。
- 网页实时看到微信保存的修改；微信下拉刷新看到网页保存的修改。小程序目前使用刷新同步。
- 测试会话刷新与退出，日志不能输出 OTP、JWT、完整调用事件。
- 新预览二维码扫码验收后上传开发版，后台核对版本，然后处理隐私说明、代码审核及备案。

完整双设备步骤见 `../guides/sync-acceptance.md`。本地编译、单元测试、模拟器运行不能替代真实调用或发布证据。

官方资料：https://docs.cloudbase.net/ai/ai-inspire-plan 、https://docs.cloudbase.net/en/cli-v1/functions/configs
