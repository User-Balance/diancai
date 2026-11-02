const cloud = require('wx-server-sdk');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('node:crypto');
const { parseLoginLink } = require('./login-link');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const URL = 'https://ybgfrckmqqfbynfepdvp.supabase.co';
const KEY = 'sb_publishable_fx4rdfw336bzKrrovgqBPA_-EvElKv9';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const fields = ['name','category','ingredients','seasonings','steps','minutes','cook_count','rating','favorite','notes','deleted_at'];
const sessionFields = s => ({ access_token:s.access_token, refresh_token:s.refresh_token, expires_at:s.expires_at, userId:s.user.id });
function unwrap(result) { if (result.error) throw result.error; return result.data; }
exports.main = async event => {
  try {
    if (!cloud.getWXContext().OPENID) throw new Error('请从微信小程序调用');
    const client = createClient(URL, KEY, options);
    if (event.action === 'sendCode') {
      unwrap(await client.auth.signInWithOtp({ email:event.email, options:{shouldCreateUser:false} }));
      return { ok:true };
    }
    if (event.action === 'verifyCode') {
      const data = unwrap(await client.auth.verifyOtp({ email:event.email, token:event.code, type:'email' }));
      return { ok:true, session:sessionFields(data.session) };
    }
    if (event.action === 'verifyLink') {
      const result = await client.auth.verifyOtp(parseLoginLink(event.link, URL));
      if (result.error || !result.data.session) throw new Error('登录链接无效、已过期或已使用，请重新发送登录邮件');
      return { ok:true, session:sessionFields(result.data.session) };
    }
    if (event.action === 'refresh') {
      const data = unwrap(await client.auth.refreshSession({ refresh_token:event.refreshToken }));
      return { ok:true, session:sessionFields(data.session) };
    }
    const identity = unwrap(await client.auth.getUser(event.token));
    // 使用已验证的 Supabase 身份和其 JWT。微信客户端无法指定 owner_id。
    const db = createClient(URL, KEY, { ...options, global:{headers:{Authorization:`Bearer ${event.token}`}} });
    let data;
    if (event.action === 'list') data = unwrap(await db.from('dishes').select('*').order('created_at'));
    else if (event.action === 'save') {
      const dish=event.dish || {};
      const safe=Object.fromEntries(fields.map(f=>[f,dish[f]]));
      if (event.existing) {
        data=unwrap(await db.from('dishes').update(safe).eq('id',dish.id).eq('version',dish.version).select());
        if (!data.length) throw new Error('菜谱已在其他设备更新，请刷新后重新编辑');
      } else data=unwrap(await db.from('dishes').insert({...safe,id:randomUUID(),owner_id:identity.user.id}).select());
    } else if (event.action === 'cook') data=unwrap(await db.rpc('record_cook',{dish_id:event.id,new_rating:event.rating ?? null}));
    else if (event.action === 'history') data=unwrap(await db.from('cooking_records').select('*').eq('dish_id',event.id).order('created_at',{ascending:false}).limit(10));
    else if (event.action === 'signOut') { unwrap(await client.auth.setSession({access_token:event.token,refresh_token:event.refreshToken})); unwrap(await client.auth.signOut({scope:'local'})); }
    else throw new Error('不支持的操作');
    return { ok:true,data };
  } catch (e) {
    return {ok:false,message:e.code==='23505'?'菜名已存在，请编辑原菜谱':e.message || '云端请求失败'};
  }
};
