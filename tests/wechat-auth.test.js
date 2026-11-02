import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function gateway(openid, auth) {
  const exports = {}, context = {
    exports,
    require: name => {
      if (name === 'wx-server-sdk') return { init(){}, getWXContext:()=>({ OPENID:openid }) };
      if (name === '@supabase/supabase-js') return { createClient:()=>({ auth }) };
      if (name === 'node:crypto') return { randomUUID:()=> 'test-dish' };
      if (name === './login-link') return {};
      throw new Error(name);
    }
  };
  vm.runInNewContext(readFileSync('wechat/cloudfunctions/kitchen/index.js','utf8'), context);
  return exports.main;
}

test('密码登录仍要求微信来源，缺少身份不调用 Supabase', async () => {
  let called = false;
  const main = gateway('', { signInWithPassword(){ called = true; } });
  const result = await main({action:'verifyPassword',email:'review@example.com',password:'test-only'});
  assert.equal(result.ok,false);
  assert.match(result.message,/微信小程序/);
  assert.equal(called,false);
});

test('微信登录只认可云开发身份，不返回身份标识或伪造云端会话', async () => {
  const result = await gateway('mock-wechat-identity',{} )({action:'wechatLogin'});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true,wechatAuthenticated:true});
  const rejected = await gateway('',{} )({action:'wechatLogin'});
  assert.equal(rejected.ok,false);
});

test('密码登录返回已认证会话，不回传密码或无关用户资料', async () => {
  const main = gateway('mock-wechat-identity', { async signInWithPassword(credentials){
    assert.equal(credentials.email,'review@example.com');
    assert.equal(credentials.password,' test-only ');
    return { data:{ session:{access_token:'mock-access',refresh_token:'mock-refresh',expires_at:123,user:{id:'review-user',email:credentials.email}} }, error:null };
  } });
  const result = await main({action:'verifyPassword',email:' review@example.com ',password:' test-only '});
  assert.equal(result.ok,true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.session)),{access_token:'mock-access',refresh_token:'mock-refresh',expires_at:123,userId:'review-user'});
});

test('错误密码和空会话不会建立登录，不泄露上游错误', async () => {
  for(const response of [{error:{message:'private-error'},data:{}},{error:null,data:{session:null}}]) {
    const main = gateway('mock-wechat-identity',{signInWithPassword:async()=>response});
    const result = await main({action:'verifyPassword',email:'review@example.com',password:'test-only'});
    assert.equal(result.ok,false);
    assert.equal(result.session,undefined);
    assert.equal(result.message,'邮箱或密码不正确，或账号尚未启用');
  }
});

test('页面发起请求前清空密码，离开页面清空一次性登录资料', async () => {
  let page;
  vm.runInNewContext(readFileSync('wechat/miniprogram/pages/menu/index.js','utf8'),{
    Page: p=>{page=p;}, require:()=>({cloudEnv:'mock-env'}),
    wx:{showToast(){}},
  });
  page.setData = values=>Object.assign(page.data,values);
  page.render = ()=>{};
  page.data.email='review@example.com';page.data.password='test-only';
  let saved;
  page.store={
    async request(action,payload){assert.equal(action,'verifyPassword');assert.equal(page.data.password,'');assert.equal(payload.password,'test-only');return {session:{userId:'review-user'}};},
    setSession: s=>{saved=s;}, refresh:async()=>{}
  };
  await page.loginByPassword();
  assert.equal(saved.userId,'review-user');
  page.setData({password:'test-only',code:'123456',loginLink:'test-link'});
  page.onHide();
  assert.equal(page.data.password,'');assert.equal(page.data.code,'');assert.equal(page.data.loginLink,'');
});
