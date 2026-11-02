import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { parseLoginLink } from '../src/login-link.js';

const project = 'https://ybgfrckmqqfbynfepdvp.supabase.co';
const token = 'a'.repeat(64); // synthetic token; never use a real login link in fixtures.
const context = { module: { exports: {} }, URL };
vm.runInNewContext(readFileSync('wechat/cloudfunctions/kitchen/login-link.js', 'utf8'), context);
const parsers = [parseLoginLink, context.module.exports.parseLoginLink];

test('网页和微信只验证本项目的一次性邮箱链接，不跟随回跳地址', () => {
  for (const parse of parsers) {
    for (const key of ['token', 'token_hash']) {
      for (const type of ['magiclink', 'email']) {
        const result = parse(` ${project}/auth/v1/verify?${key}=${token}&type=${type}&redirect_to=https%3A%2F%2Fexample.com `, project);
        assert.equal(result.token_hash, token);
        assert.equal(result.type, 'email');
        assert.deepEqual(Object.keys(result).sort(), ['token_hash', 'type']);
      }
    }
  }
});

test('登录入口拒绝外部地址、恢复密码、已打开的链接和歧义参数', () => {
  const valid = `${project}/auth/v1/verify?token=${token}&type=magiclink`;
  const invalid = [
    '', 'not a url', valid.replace('https:', 'http:'),
    valid.replace(project, 'https://other.supabase.co'),
    valid.replace(project, project + '.example.com'),
    valid.replace(project, project + '@example.com'),
    valid.replace('/auth/v1/verify', '/auth/v1/verify/'),
    valid.replace('type=magiclink', 'type=recovery'),
    valid.replace('type=magiclink', 'type=invite'),
    `${valid}&type=email`, `${valid}&token=${token}`, `${valid}&token_hash=${token}`,
    `${valid}#access_token=synthetic`, valid.replace(token, '123456'), 'x'.repeat(4097),
    `https://example.com/redirect?url=${encodeURIComponent(valid)}`
  ];
  for (const parse of parsers) for (const link of invalid) {
    assert.throws(() => parse(link, project), error => {
      assert.equal(error.message, '请复制本项目邮件中尚未点击的完整登录链接');
      return true;
    });
  }
});

test('微信网关在验证成功后返回会话，验证失败不泄露登录链接', async () => {
  let received;
  const session = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_at: 1234, user: { id: 'test-user' } };
  const sandbox = {
    exports: {},
    require: name => {
      if (name === 'wx-server-sdk') return { init() {}, getWXContext: () => ({ OPENID: 'test-openid' }) };
      if (name === '@supabase/supabase-js') return { createClient: () => ({ auth: { verifyOtp: async params => { received = params; return { data: { session } }; } } }) };
      if (name === 'node:crypto') return { randomUUID: () => 'unused' };
      if (name === './login-link') return context.module.exports;
      throw new Error('unexpected dependency');
    }
  };
  vm.runInNewContext(readFileSync('wechat/cloudfunctions/kitchen/index.js', 'utf8'), sandbox);
  const response = await sandbox.exports.main({ action: 'verifyLink', link: `${project}/auth/v1/verify?token=${token}&type=magiclink` });
  assert.equal(response.ok, true);
  assert.equal(response.session.userId, 'test-user');
  assert.equal(received.token_hash, token);
  received = null;
  const failed = await sandbox.exports.main({ action: 'verifyLink', link: 'https://example.com/' + token });
  assert.equal(failed.ok, false);
  assert.equal(received, null);
  assert.ok(!failed.message.includes(token));
});
