const {seedDishes} = require('./seed');
const {cloudEnv} = require('../config');
const LOCAL='jiajia.recipes.v1', SESSION='jiajia.session.v1';
const normalize = n => String(n).normalize('NFKC').replace(/\s/g,'').toLowerCase();
const readLocal = () => wx.getStorageSync(LOCAL) || {dishes:seedDishes(),history:[]};
function validate(d, dishes) {
  if (!d.name || !d.name.trim() || d.name.length>60) throw new Error('菜名需为 1–60 字');
  if (!d.category || !d.category.trim() || d.category.length>20) throw new Error('分类需为 1–20 字');
  if (!Array.isArray(d.ingredients) || !d.ingredients.length || !Array.isArray(d.steps) || !d.steps.length) throw new Error('食材和制作步骤不能为空');
  if (![d.ingredients,d.seasonings,d.steps].every(a=>Array.isArray(a)&&a.length<=100&&a.every(s=>typeof s==='string'&&s.length<=2000))) throw new Error('每项最多 100 行，每行不超过 2000 字');
  if (!Number.isInteger(d.minutes)||d.minutes<1||d.minutes>1440 || !Number.isInteger(d.cook_count)||d.cook_count<0||d.cook_count>1000000) throw new Error('请检查耗时和制作次数');
  if (d.rating!=null && (!Number.isFinite(d.rating)||d.rating<1||d.rating>5)) throw new Error('评分需为 1–5 分');
  if (typeof d.notes!=='string'||d.notes.length>4000) throw new Error('小记最多 4000 字');
  if (dishes.some(x=>!x.deleted_at&&x.id!==d.id&&normalize(x.name)===normalize(d.name))) throw new Error('菜名已存在');
}
class Store {
  constructor() {this.session=wx.getStorageSync(SESSION)||null;this.dishes=[];if(!wx.getStorageSync(LOCAL))wx.setStorageSync(LOCAL,readLocal());}
  get mode() {return this.session?'cloud':'local';}
  async request(action,payload={}) {
    if(!cloudEnv)throw new Error('云开发环境尚未配置，当前可使用本地菜谱');
    if(this.session&&this.session.expires_at<Date.now()/1000+60&&action!=='refresh') {
      const r=await this.request('refresh',{refreshToken:this.session.refresh_token});this.setSession(r.session);
    }
    const {result}=await wx.cloud.callFunction({name:'kitchen',data:{action,...payload,token:this.session&&this.session.access_token}});
    if(!result||!result.ok)throw new Error(result&&result.message||'网络请求失败');
    return result;
  }
  setSession(s) {this.session=s;wx.setStorageSync(SESSION,s);}
  async refresh(){this.dishes=this.session?(await this.request('list')).data:readLocal().dishes;return this.dishes;}
  async save(d) {
    validate(d,this.dishes);const existing=this.dishes.find(x=>x.id===d.id);
    if(this.session)await this.request('save',{dish:d,existing:!!existing});
    else {
      const state=readLocal(),old=state.dishes.find(x=>x.id===d.id);validate(d,state.dishes);
      if(old&&old.version!==d.version)throw new Error('菜谱已更新，请重新编辑');
      const row={...d,id:d.id||'wx-'+Date.now()+'-'+Math.random().toString(36).slice(2),version:old?old.version+1:1,updated_at:new Date().toISOString()};
      if(old)state.dishes=state.dishes.map(x=>x.id===row.id?row:x);else state.dishes.push(row);
      wx.setStorageSync(LOCAL,state);
    }
    return this.refresh();
  }
  async cook(id,rating) {
    if(this.session)await this.request('cook',{id,rating});
    else {
      const state=readLocal(),d=state.dishes.find(x=>x.id===id&&!x.deleted_at);
      if(!d||d.cook_count>=1000000)throw new Error('菜谱不存在或次数已达上限');
      if(rating!=null&&(!Number.isFinite(rating)||rating<1||rating>5))throw new Error('评分需为 1–5 分');
      d.cook_count++;d.version++;if(rating!=null)d.rating=rating;
      state.history.push({dish_id:id,rating,created_at:new Date().toISOString()});wx.setStorageSync(LOCAL,state);
    }
    return this.refresh();
  }
  async history(id){return this.session?(await this.request('history',{id})).data:readLocal().history.filter(x=>x.dish_id===id).reverse().slice(0,10);}
  async signOut(){if(this.session)await this.request('signOut',{refreshToken:this.session.refresh_token});this.session=null;wx.removeStorageSync(SESSION);return this.refresh();}
  async uploadLocal(){if(!this.session)throw new Error('请先登录');let added=0;for(const d of readLocal().dishes.filter(x=>!x.deleted_at)){if(this.dishes.some(x=>!x.deleted_at&&normalize(x.name)===normalize(d.name)))continue;await this.save({...d,id:null});added++;}return added;}
}
module.exports={Store,validate,normalize};
