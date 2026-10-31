import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('微信入口页面及其配置文件完整',()=>{
  const project=JSON.parse(readFileSync('wechat/project.config.json','utf8'));
  const root='wechat/'+project.miniprogramRoot;
  const app=JSON.parse(readFileSync(root+'app.json','utf8'));
  for(const page of app.pages){
    JSON.parse(readFileSync(root+page+'.json','utf8'));
    assert.ok(readFileSync(root+page+'.wxml','utf8').length);
    assert.ok(readFileSync(root+page+'.js','utf8').length);
  }
});
function loadStore(cloudEnv='',callFunction) {
  const data=new Map(), wx={getStorageSync:k=>data.has(k)?structuredClone(data.get(k)):undefined,setStorageSync:(k,v)=>data.set(k,structuredClone(v)),removeStorageSync:k=>data.delete(k),cloud:{callFunction}};
  function load(path,require){const context={module:{exports:{}},require,wx,Date,Math,console};vm.runInNewContext(readFileSync(path,'utf8'),context,{filename:path});return context.module.exports;}
  const seed=load('wechat/miniprogram/utils/seed.js');
  const result=load('wechat/miniprogram/utils/store.js',p=>p==='./seed'?seed:{cloudEnv});
  return {...result,data};
}
test('微信本地持久化、去重、评分、历史与过期编辑',async()=>{
  const {Store}=loadStore();const s=new Store();await s.refresh();assert.equal(s.dishes.length,12);
  const d=s.dishes[0];await assert.rejects(()=>s.save({...d,id:null,name:' 番 茄 炒 蛋 '}),/菜名已存在/);
  await s.cook(d.id,4.5);assert.equal(s.dishes[0].cook_count,1);assert.equal(s.dishes[0].rating,4.5);assert.equal((await s.history(d.id)).length,1);
  await assert.rejects(()=>s.save({...d,notes:'旧版本'}),/菜谱已更新/);
  const again=new Store();await again.refresh();assert.equal(again.dishes[0].cook_count,1);
  await s.save({...s.dishes[0],deleted_at:new Date().toISOString()});await s.save({...s.dishes[0],deleted_at:null});assert.equal(s.dishes[0].deleted_at,null);
  await assert.rejects(()=>s.request('list'),/云开发环境尚未配置/);
});
test('微信云端失败不会改写本地菜谱',async()=>{
  const {Store,data}=loadStore('test',async()=>({result:{ok:false,message:'数据库错误'}}));const s=new Store();await s.refresh();const local=JSON.stringify(data.get('jiajia.recipes.v1'));const d=s.dishes[0];s.setSession({access_token:'test',refresh_token:'test',expires_at:Date.now()/1000+3600});
  await assert.rejects(()=>s.save({...d,notes:'不应保存'}),/数据库错误/);assert.equal(JSON.stringify(data.get('jiajia.recipes.v1')),local);
});
