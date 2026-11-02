import { createClient } from '@supabase/supabase-js';
import { seedDishes } from './seed.js';
import { validateDish, migrateBackup } from './domain.js';
import { defaultCloudConfig } from './cloud-config.js';
import { parseLoginLink } from './login-link.js';
const DATA = 'diancai.local.v1', CONFIG = 'diancai.cloud.v1';
const parse = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const cloudMessage = (e) => e.code === '23505' ? '这道菜已经存在，请编辑原有菜品' : e.message || '云端操作失败，请检查网络或数据库配置';
export class RecipeStore {
  constructor(onChange, onStatus) {
    this.onChange = onChange; this.onStatus = onStatus; this.mode = 'local'; this.user = null; this.dishes = [];
    this.config = parse(CONFIG, defaultCloudConfig) || null; this.client = null; this.channel = null; this.authSubscription = null;
    this.cloudReady = false; this.generation = 0;
    if (!localStorage.getItem(DATA)) localStorage.setItem(DATA, JSON.stringify({ dishes: seedDishes(), history: [] }));
    window.addEventListener('storage', e => { if (e.key === DATA && this.mode === 'local') this.refresh(); });
  }
  async init() {
    await this.refresh();
    if (this.config) { try { await this.connect(this.config); } catch(e) { this.onStatus(`连接失败：${e.message}`); } }
  }
  async connect(config) {
    const url = new URL(config.url);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.pathname !== '/' || url.search || url.hash) throw new Error('请输入 https://项目编号.supabase.co 格式的项目 URL');
    const key = config.key.trim();
    if (key.startsWith('sb_secret_')) throw new Error('请使用 publishable key，不能使用 secret key');
    if (key.startsWith('eyJ')) {
      try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role !== 'anon') throw new Error(); }
      catch { throw new Error('JWT key 必须是 anon 公钥，不能使用 service_role'); }
    } else if (!key.startsWith('sb_publishable_')) throw new Error('请填写 Supabase publishable key 或旧版 anon key');
    await this.dispose(); this.config = { url: url.origin, key }; localStorage.setItem(CONFIG, JSON.stringify(this.config));
    this.client = createClient(url.origin, key);
    const { data, error } = await this.client.auth.getSession(); if (error) throw error;
    await this.setUser(data.session?.user ?? null);
    const { data: auth } = this.client.auth.onAuthStateChange((_event, session) => {
      // Run queries after the SDK releases the auth lock.
      setTimeout(() => { this.setUser(session?.user ?? null).catch(e => this.onStatus(e.message)); }, 0);
    });
    this.authSubscription = auth.subscription;
  }
  async dispose() {
    this.generation++; this.authSubscription?.unsubscribe(); this.authSubscription = null;
    if (this.client && this.channel) await this.client.removeChannel(this.channel);
    this.channel = null; this.cloudReady = false;
  }
  async setUser(user) {
    if (this.channel) { await this.client.removeChannel(this.channel); this.channel = null; }
    this.user = user; this.mode = user ? 'cloud' : 'local'; this.cloudReady = false; this.generation++;
    await this.refresh();
    if (user && this.cloudReady) {
      this.onStatus('云端已载入 · 正在订阅');
      this.channel = this.client.channel(`recipes-${user.id}`).on('postgres_changes', {
        event: '*', schema: 'public', table: 'dishes', filter: `owner_id=eq.${user.id}`
      }, () => this.refresh().catch(e => this.onStatus(e.message))).subscribe(status => {
        const messages = { SUBSCRIBED:'实时同步已连接', CHANNEL_ERROR:'实时订阅失败 · 可点击刷新', TIMED_OUT:'实时订阅超时 · 可点击刷新', CLOSED:'实时订阅已断开' };
        if(messages[status]) this.onStatus(messages[status]);
      });
    } else if (!user) this.onStatus(this.config ? '本地模式 · 云端未登录' : '本地模式 · 已自动保存');
  }
  async signIn(email) {
    if (!this.client) throw new Error('请先保存云端项目配置');
    const { error } = await this.client.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw new Error(cloudMessage(error));
  }
  async verifyCode(email, code) {
    if (!this.client) throw new Error('请先保存云端项目配置');
    const token = String(code).trim();
    if (!/^\d{6}$/.test(token)) throw new Error('请输入邮件里的 6 位验证码');
    const { data, error } = await this.client.auth.verifyOtp({ email:email.trim(), token, type:'email' });
    if (error) throw new Error(cloudMessage(error));
    if (!data.session?.user) throw new Error('登录未完成，请重新发送验证码');
    await this.setUser(data.session.user);
  }
  async verifyLink(link) {
    if (!this.client) throw new Error('请先保存云端项目配置');
    const { data, error } = await this.client.auth.verifyOtp(parseLoginLink(link, this.config.url));
    if (error || !data.session?.user) throw new Error('登录链接无效、已过期或已使用，请重新发送登录邮件');
    await this.setUser(data.session.user);
  }
  async signOut() { const { error } = await this.client.auth.signOut(); if (error) throw error; await this.setUser(null); }
  async disconnect() { await this.dispose(); this.client = null; this.config = null; this.user = null; this.mode = 'local'; localStorage.setItem(CONFIG, 'false'); await this.refresh(); this.onStatus('本地模式 · 已自动保存'); }
  async refresh() {
    const generation = this.generation;
    if (this.mode === 'cloud') {
      const { data, error } = await this.client.from('dishes').select('*').order('created_at');
      if (error) { this.cloudReady = false; this.onStatus(`数据库未就绪：${cloudMessage(error)}`); this.dishes = []; this.onChange(); throw new Error(cloudMessage(error)); }
      if (generation !== this.generation) return;
      this.dishes = data; this.cloudReady = true;
    } else this.dishes = parse(DATA, { dishes: [], history: [] }).dishes;
    this.onChange();
  }
  requireReady() { if (this.mode === 'cloud' && !this.cloudReady) throw new Error('云端数据未载入，请检查数据库后点击刷新'); }
  async save(dish, { importing = false } = {}) {
    this.requireReady(); validateDish(dish, this.dishes);
    const now = new Date().toISOString();
    const fields = Object.fromEntries(['name','category','ingredients','seasonings','steps','minutes','cook_count','rating','favorite','notes','deleted_at'].map(k => [k,dish[k] ?? (k === 'deleted_at' ? null : dish[k])]));
    fields.name = fields.name.trim(); fields.category = fields.category.trim();
    if (this.mode === 'cloud') {
      const exists = !importing && this.dishes.find(d => d.id === dish.id);
      const query = exists
        ? this.client.from('dishes').update({ ...fields, version: dish.version + 1 }).eq('id', dish.id).eq('version', dish.version).select()
        : this.client.from('dishes').insert({ ...fields, id: dish.id, owner_id: this.user.id }).select();
      const { data, error } = await query; if (error) throw new Error(cloudMessage(error));
      if (!data.length) { await this.refresh(); throw new Error('这道菜刚在其他设备更新了，请关闭编辑页后重新编辑'); }
    } else {
      const state = parse(DATA, { dishes: [], history: [] }); const index = state.dishes.findIndex(d => d.id === dish.id);
      validateDish(dish, state.dishes);
      if (index >= 0 && state.dishes[index].version !== dish.version) { await this.refresh(); throw new Error('另一个页面更新了这道菜，请关闭编辑页后重试'); }
      const record = { ...dish, ...fields, updated_at: now, version: index >= 0 ? dish.version + 1 : 1 };
      if (index >= 0) state.dishes[index] = record; else state.dishes.push(record);
      localStorage.setItem(DATA, JSON.stringify(state));
    }
    await this.refresh();
  }
  async cook(id, rating) {
    this.requireReady();
    if (this.mode === 'cloud') {
      const { error } = await this.client.rpc('record_cook', { dish_id: id, new_rating: rating });
      if (error) throw new Error(cloudMessage(error));
    } else {
      const state = parse(DATA, { dishes: [], history: [] }); const dish = state.dishes.find(d => d.id === id && !d.deleted_at);
      if (!dish) throw new Error('菜品已归档或不存在');
      if (dish.cook_count >= 1000000) throw new Error('制作次数已达到上限');
      dish.cook_count++; if (rating != null) dish.rating = rating; dish.version++; dish.updated_at = new Date().toISOString();
      state.history.push({ id: crypto.randomUUID(), dish_id: id, rating, created_at: dish.updated_at });
      localStorage.setItem(DATA, JSON.stringify(state));
    }
    await this.refresh();
  }
  async history(id) {
    if (this.mode === 'cloud') {
      const { data, error } = await this.client.from('cooking_records').select('*').eq('dish_id',id).order('created_at',{ascending:false}).limit(10);
      if (error) throw new Error(cloudMessage(error)); return data;
    }
    return parse(DATA,{history:[]}).history.filter(r => r.dish_id === id).reverse().slice(0,10);
  }
  async importBackup(input) {
    this.requireReady(); const result = migrateBackup(input, this.dishes);
    if (this.mode === 'local') {
      const state = parse(DATA,{dishes:[],history:[]}); const fresh = migrateBackup(input,state.dishes);
      localStorage.setItem(DATA,JSON.stringify({...state,dishes:fresh.dishes})); await this.refresh(); return fresh;
    }
    const addedDishes = result.dishes.slice(this.dishes.length);
    if (addedDishes.length) {
      const rows = addedDishes.map(d => ({...d,owner_id:this.user.id}));
      const {error} = await this.client.from('dishes').insert(rows); if(error) throw new Error(cloudMessage(error));
    }
    await this.refresh(); return result;
  }
  localBackup() { return { format:'diancai-ben',version:1,dishes:parse(DATA,{dishes:[]}).dishes.filter(d=>!d.deleted_at) }; }
}
