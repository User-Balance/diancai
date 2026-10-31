const {Store,normalize} = require('../../utils/store');
const {cloudEnv} = require('../../config');
const categories=['荤菜','素菜','海鲜','汤羹','主食','早餐','甜品饮品'];
const empty=()=>({name:'',category:'荤菜',ingredients:[],seasonings:[],steps:[],minutes:20,cook_count:0,rating:null,favorite:false,notes:'',deleted_at:null,version:1});
Page({
  data:{rows:[],categories:[],category:'全部',search:'',mode:'local',selectedIds:[],panel:'',detail:null,form:{},history:[],archive:false,email:'',code:'',cloudAvailable:!!cloudEnv,feedback:''},
  onLoad(){this.store=new Store();this.selected=[];},
  onShow(){this.refresh();},
  async onPullDownRefresh(){await this.refresh();wx.stopPullDownRefresh();},
  async run(fn){try{this.setData({feedback:''});await fn();return true;}catch(e){this.setData({feedback:e.message});wx.showToast({title:e.message,icon:'none'});return false;}},
  async refresh(){if(!this.store)return;await this.run(async()=>{await this.store.refresh();this.render();});},
  render(){
    const all=this.store.dishes.filter(d=>this.data.archive?d.deleted_at:!d.deleted_at),q=normalize(this.data.search);
    const rows=all.filter(d=>(this.data.category==='全部'||d.category===this.data.category)&&normalize([d.name,...d.ingredients,...d.seasonings].join(' ')).includes(q)).map(d=>({...d,ratingText:d.rating==null?'未评分':d.rating+' 分',chosen:this.selected.includes(d.id)}));
    this.setData({rows,mode:this.store.mode,categories:['全部',...new Set([...categories,...all.map(x=>x.category)])],selectedIds:this.selected});
    if(this.data.detail){const detail=this.store.dishes.find(d=>d.id===this.data.detail.id);if(detail)this.setData({detail:{...detail,ratingText:detail.rating==null?'未评分':detail.rating+' 分'}});}
  },
  search(e){this.setData({search:e.detail.value});this.render();},
  category(e){this.setData({category:e.currentTarget.dataset.value});this.render();},
  archive(){this.setData({archive:!this.data.archive,category:'全部'});this.render();},
  toggle(e){const id=e.currentTarget.dataset.id;this.selected=this.selected.includes(id)?this.selected.filter(x=>x!==id):[...this.selected,id];this.render();},
  async detail(e){const d=this.store.dishes.find(x=>x.id===e.currentTarget.dataset.id);if(!d)return;this.setData({panel:'detail',detail:{...d,ratingText:d.rating==null?'未评分':d.rating+' 分'},history:[]});await this.run(async()=>this.setData({history:(await this.store.history(d.id)).map(x=>({...x,timeText:x.created_at.slice(0,16).replace('T',' ')}))}));},
  edit(e){const id=e.currentTarget.dataset.id,d=id?this.store.dishes.find(x=>x.id===id):empty();this.setData({panel:'edit',form:{...d,ingredientsText:d.ingredients.join('\n'),seasoningsText:d.seasonings.join('\n'),stepsText:d.steps.join('\n'),rating:d.rating==null?'':String(d.rating)},feedback:''});},
  field(e){this.setData({['form.'+e.currentTarget.dataset.key]:e.detail.value});},
  async save(){const f=this.data.form,list=t=>String(t||'').split('\n').map(s=>s.trim()).filter(Boolean);const d={...f,name:f.name.trim(),category:f.category.trim(),ingredients:list(f.ingredientsText),seasonings:list(f.seasoningsText),steps:list(f.stepsText),minutes:Number(f.minutes),cook_count:Number(f.cook_count),rating:f.rating===''?null:Number(f.rating)};if(await this.run(()=>this.store.save(d))){this.setData({panel:''});this.render();}},
  async favorite(e){const d=this.store.dishes.find(x=>x.id===e.currentTarget.dataset.id);await this.run(()=>this.store.save({...d,favorite:!d.favorite}));this.render();},
  async cook(){await this.run(async()=>{await this.store.cook(this.data.detail.id,null);this.render();this.setData({history:(await this.store.history(this.data.detail.id)).map(x=>({...x,timeText:x.created_at.slice(0,16).replace('T',' ')}))});});},
  async archiveDish(){const d=this.data.detail;await this.run(()=>this.store.save({...d,deleted_at:d.deleted_at?null:new Date().toISOString()}));this.setData({panel:''});this.render();},
  shopping(){const dishes=this.store.dishes.filter(d=>!d.deleted_at&&this.selected.includes(d.id)),items=new Map();for(const d of dishes)for(const s of d.ingredients)if(!items.has(normalize(s)))items.set(normalize(s),s);this.setData({panel:'shopping',shopping:[...items.values()],planned:dishes.map(d=>d.name)});},
  settings(){this.setData({panel:'settings',feedback:''});},close(){this.setData({panel:'',feedback:''});},
  email(e){this.setData({email:e.detail.value.trim()});},code(e){this.setData({code:e.detail.value.trim()});},
  async sendCode(){if(await this.run(()=>this.store.request('sendCode',{email:this.data.email})))this.setData({feedback:'验证码已发送，请检查收件箱。'});},
  async login(){if(await this.run(async()=>{const r=await this.store.request('verifyCode',{email:this.data.email,code:this.data.code});this.store.setSession(r.session);await this.store.refresh();})){this.render();this.setData({feedback:'已登录云端。首次可导入本地菜谱。',code:''});}},
  async signOut(){await this.run(()=>this.store.signOut());this.render();},
  async upload(){await this.run(async()=>{const n=await this.store.uploadLocal();this.setData({feedback:'已追加 '+n+' 道菜，重名已跳过。'});});this.render();}
});
