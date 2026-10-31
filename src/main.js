import './style.css';
import { CATEGORIES, lines, stars, shoppingItems } from './domain.js';
import { FOOD } from './seed.js';
import { RecipeStore } from './store.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  plus:'M12 5v14M5 12h14', search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  book:'M4 3h14a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V3Zm0 14h16M8 7h8M8 11h6',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  cloud:'M6 19a5 5 0 1 1 1-10 7 7 0 0 1 13 2 4 4 0 0 1-1 8H6',
  clock:'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',shuffle:'m3 4 18 16m-5 0h5v-5M3 20l6-6m5-5 7-5m-5 0h5v5',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  edit:'m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  basket:'m5 9 5-6m9 6-5-6M3 9h18l-2 12H5L3 9Zm6 4v4m6-4v4',chevron:'m9 5 7 7-7 7',archive:'M3 3h18v5H3zM5 8v13h14V8m-9 4h4'
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.book}"/></svg>`;
let category = '全部', favoriteOnly = false, archiveView = false, search = '', sort = 'default', status = '本地模式 · 已自动保存', activeDish = null;
let selected = new Set(); let busy = false; let planScope = '';
const store = new RecipeStore(() => {
  const scope = store.user?.id || 'local';
  if (scope !== planScope) { planScope = scope; try { selected = new Set(JSON.parse(localStorage.getItem(`diancai.plan.${scope}`)) || []); } catch { selected = new Set(); } }
  render();
}, (message) => { status = message; if ($('#sync-status')) $('#sync-status').textContent = message; if ($('#cloud-badge')) $('#cloud-badge').textContent = store.mode === 'cloud' ? '云端菜谱' : '本地菜谱'; });
const active = () => store.dishes.filter(d => !d.deleted_at);
const categories = () => [...new Set([...CATEGORIES.map(c=>c.name),...active().map(d=>d.category)])];
const categoryInfo = (name) => CATEGORIES.find(c=>c.name===name) || { icon:'🍽️',color:'#e4e8db' };
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4000); }
async function action(fn, success) { if(busy) return false; busy=true; document.body.classList.add('busy'); try { await fn(); if(success) toast(success); return true; } catch(e) { toast(e.message || '操作失败'); return false; } finally { busy=false; document.body.classList.remove('busy'); } }
function savePlan() { localStorage.setItem(`diancai.plan.${planScope}`,JSON.stringify([...selected])); }
function togglePlan(id) { if(selected.has(id)) selected.delete(id); else selected.add(id); savePlan(); renderCards(); renderPlan(); if($('#detail-dialog')?.open) showDetail(id); }
function filtered() {
  let dishes = store.dishes.filter(d=>archiveView?!!d.deleted_at:!d.deleted_at).filter(d=>(category==='全部'||d.category===category)&&(!favoriteOnly||d.favorite));
  const query=search.trim().toLowerCase(); if(query) dishes=dishes.filter(d=>[d.name,...d.ingredients,...d.seasonings].join(' ').toLowerCase().includes(query));
  if(sort==='rating') dishes.sort((a,b)=>(b.rating||0)-(a.rating||0));
  if(sort==='count') dishes.sort((a,b)=>b.cook_count-a.cook_count);
  if(sort==='time') dishes.sort((a,b)=>a.minutes-b.minutes);
  if(sort==='recent') dishes.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return dishes;
}
function render() {
  const all=active(), count=all.reduce((sum,d)=>sum+d.cook_count,0);
  $('#app').innerHTML=`
  <aside class="sidebar">
    <a class="brand" href="./"><img src="./favicon.svg" alt=""/><span>点菜本<small>MY LITTLE KITCHEN</small></span></a>
    <div class="nav-label">我的厨房</div>
    <button class="nav-item ${!favoriteOnly&&!archiveView?'active':''}" data-nav="all" aria-label="我的菜谱 ${all.length}">${icon('book')}<span>我的菜谱</span><b>${all.length}</b></button>
    <button class="nav-item ${favoriteOnly?'active':''}" data-nav="favorites" aria-label="心头好 ${all.filter(d=>d.favorite).length}">${icon('heart')}<span>心头好</span><b>${all.filter(d=>d.favorite).length}</b></button>
    <button class="nav-item ${archiveView?'active':''}" data-nav="archive" aria-label="归档菜谱 ${store.dishes.filter(d=>d.deleted_at).length}">${icon('archive')}<span>归档菜谱</span><b>${store.dishes.filter(d=>d.deleted_at).length}</b></button>
    <div class="sidebar-note"><span class="note-leaf">🌿</span><p>好好吃饭，<br/>就是日常的小确幸。</p><small>每一份菜谱，都有家的味道</small></div>
    <button class="nav-item sidebar-bottom" id="settings-button" aria-label="数据与设置">${icon('settings')}<span>数据与设置</span></button>
    <div class="profile"><span class="avatar">${icon('basket')}</span><div><strong>我的私人厨房</strong><small id="cloud-badge">${store.mode==='cloud'?'云端菜谱':'本地菜谱'}</small></div><span class="status-dot ${store.mode==='cloud'?'online':''}"></span></div>
  </aside>
  <main>
    <header class="topbar"><div class="breadcrumb">我的厨房 <span>/</span> <b>${archiveView?'归档菜谱':favoriteOnly?'心头好':'我的菜谱'}</b></div><button class="sync-button" id="sync-button" title="打开云端数据设置">${icon('cloud')}<span id="sync-status">${esc(status)}</span></button></header>
    <div class="workspace"><section class="intro"><div><div class="eyebrow">COOK SOMETHING GOOD</div><h1>${archiveView?'把味道留着，以后再做。':favoriteOnly?'喜欢的味道，值得常做。':'今天，吃点什么？'}</h1><p>收好喜欢的菜谱，把每一餐过成想要的样子。</p></div><button class="primary" id="add-button">${icon('plus')} 添加菜品</button></section>
    <section class="hero"><div class="hero-copy"><span class="hero-tag">${icon('book')} 只属于你的家常菜单</span><h2>厨房里的烟火气，<br/>生活里的小欢喜。</h2><p>从一份菜谱开始，让「吃什么」变成期待。</p><div class="hero-stats"><div><strong>${all.length}</strong><span>道收藏菜谱</span></div><i></i><div><strong>${count}</strong><span>次用心下厨</span></div><i></i><div><strong>${categories().filter(c=>all.some(d=>d.category===c)).length}</strong><span>种餐桌风味</span></div></div></div><div class="hero-art" aria-hidden="true"><span class="art-leaf leaf-one">✦</span><span class="art-leaf leaf-two">✦</span><div class="hero-plate"><div class="plate-inner"><span>🥗</span></div></div><div class="art-note">made with love <span>♡</span></div><div class="chopstick c1"></div><div class="chopstick c2"></div></div></section>
    <div class="menu-layout"><section class="menu-section"><div class="section-title"><h2>${archiveView?'归档菜谱':favoriteOnly?'我的心头好':'我的菜谱'} <span id="result-count">${filtered().length}</span></h2><button class="text-button" id="random-button">${icon('shuffle')} 帮我选一道</button></div>
      <div class="tools"><label class="search">${icon('search')}<input id="search" aria-label="搜索菜名或食材" placeholder="搜索菜名、食材或调料" value="${esc(search)}"/></label><select id="sort" aria-label="菜品排序"><option value="default">默认排序</option><option value="recent">最近添加</option><option value="rating">评分优先</option><option value="count">常做优先</option><option value="time">快手优先</option></select></div>
      <div class="categories" role="group" aria-label="菜品分类"><button class="category ${category==='全部'?'selected':''}" data-category="全部">${icon('grid')}全部<span>${all.length}</span></button>${categories().map(c=>`<button class="category ${category===c?'selected':''}" data-category="${esc(c)}"><span class="category-emoji">${categoryInfo(c).icon}</span>${esc(c)}<span>${all.filter(d=>d.category===c).length}</span></button>`).join('')}</div>
      <div id="dish-grid" class="dish-grid"></div><div class="menu-footnote">${icon('check')} 每道菜只收录一次 · 菜名忽略空格与全角差异</div>
    </section><aside id="plan" class="plan"></aside></div>
    <footer>点菜本 <span>·</span> 慢慢做饭，好好生活 <span class="footer-right">${store.mode==='cloud'?'登录后菜谱实时同步':'当前菜谱保存在此浏览器，可在设置中导出备份'}</span></footer></div>
  </main>`;
  $('#sort').value=sort;
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{ favoriteOnly=b.dataset.nav==='favorites';archiveView=b.dataset.nav==='archive';category='全部';render(); });
  document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;render();});
  $('#search').oninput=e=>{search=e.target.value;renderCards();};
  $('#sort').onchange=e=>{sort=e.target.value;renderCards();};
  $('#add-button').onclick=()=>showEditor();
  $('#settings-button').onclick=showSettings; $('#sync-button').onclick=showSettings;
  $('#random-button').onclick=()=>{const pool=filtered();if(!pool.length)return toast('当前分类还没有菜品');const dish=pool[Math.floor(Math.random()*pool.length)];showDetail(dish.id);toast(`今天试试「${dish.name}」吧`);};
  renderCards(); renderPlan();
}
function renderCards() {
  const dishes=filtered(); if(!$('#dish-grid'))return;
  $('#result-count').textContent=dishes.length;
  $('#dish-grid').innerHTML=dishes.length?dishes.map(d=>{
    const info=categoryInfo(d.category),chosen=selected.has(d.id);
    return `<article class="dish-card ${chosen?'chosen':''}"><div class="food-art" style="--food-bg:${info.color}"><button class="food-open" data-detail="${d.id}" aria-label="查看${esc(d.name)}详情"><div class="food-plate"><span>${FOOD[d.name]||info.icon}</span></div><span class="art-sprinkle s1"></span><span class="art-sprinkle s2"></span><span class="art-sprinkle s3"></span></button><span class="dish-tag">${esc(d.category)}</span><button class="favorite ${d.favorite?'is-favorite':''}" data-favorite="${d.id}" aria-label="${d.favorite?'取消收藏':'收藏'}${esc(d.name)}" aria-pressed="${d.favorite}">${icon('heart')}</button>${chosen?`<span class="selected-ribbon">${icon('check')} 今日菜单</span>`:''}</div><div class="dish-content"><button class="dish-title" data-detail="${d.id}">${esc(d.name)}</button><p>${esc(d.notes||d.ingredients.join(' · '))}</p><div class="dish-metadata"><span>${icon('clock')}${d.minutes} 分钟</span><span class="rating ${d.rating?'rated':''}">${stars(d.rating)}</span></div><div class="dish-card-bottom"><small>已做 <b>${d.cook_count}</b> 次</small>${archiveView?`<button class="small-button" data-restore="${d.id}">恢复菜谱</button>`:`<button class="add-menu ${chosen?'selected':''}" data-plan="${d.id}" aria-label="${chosen?'从菜单移除':'加入菜单'}${esc(d.name)}">${icon(chosen?'check':'plus')}${chosen?'已加入':'加入菜单'}</button>`}</div></div></article>`;
  }).join(''):`<div class="empty-state"><span>🍽️</span><h3>${search?'没找到这道菜':archiveView?'这里还没有归档菜谱':'你的新味道，从这里开始'}</h3><p>${search?'试试其他菜名或食材关键词':'点击「添加菜品」，写下你喜欢的做法。'}</p></div>`;
  $('#dish-grid').querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>showDetail(b.dataset.detail));
  $('#dish-grid').querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>togglePlan(b.dataset.plan));
  $('#dish-grid').querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>{const d=store.dishes.find(d=>d.id===b.dataset.favorite);action(()=>store.save({...d,favorite:!d.favorite}));});
  $('#dish-grid').querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const d=store.dishes.find(d=>d.id===b.dataset.restore);action(()=>store.save({...d,deleted_at:null}),'菜谱已恢复');});
}
function renderPlan() {
  const dishes=active().filter(d=>selected.has(d.id)); if(!$('#plan')) return;
  $('#plan').innerHTML=`<div class="plan-heading"><span class="plan-symbol">${icon('basket')}</span><div><h2>今天的菜单</h2><p>一餐一饭，都值得认真</p></div></div><div class="plan-counter"><strong>${dishes.length}</strong><span>道菜已就位</span><span class="plan-doodle">♡</span></div>${dishes.length?`<ul class="plan-list">${dishes.map(d=>`<li><span class="plan-food">${FOOD[d.name]||categoryInfo(d.category).icon}</span><button data-plan-detail="${d.id}"><strong>${esc(d.name)}</strong><small>${esc(d.category)} · ${d.minutes} 分钟</small></button><button class="icon-button" data-remove="${d.id}" aria-label="移除${esc(d.name)}">${icon('close')}</button></li>`).join('')}</ul>`:`<div class="plan-empty"><span>🍴</span><p>想吃哪道，就把它加进来。<br/>荤素搭配，汤饭都齐全。</p></div>`}<button class="primary shopping-button" id="shopping-button" ${dishes.length?'':'disabled'}>${icon('basket')} 查看采购清单 ${icon('chevron')}</button>${dishes.length?'<button class="text-button clear-plan" id="clear-plan">清空今日菜单</button>':''}<div class="kitchen-tip"><span>💡</span><p>厨房小贴士<br/><small>不知道吃什么？试试「帮我选一道」，让今天多一点惊喜。</small></p></div>`;
  $('#plan').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>togglePlan(b.dataset.remove));
  $('#plan').querySelectorAll('[data-plan-detail]').forEach(b=>b.onclick=()=>showDetail(b.dataset.planDetail));
  $('#shopping-button').onclick=showShopping;
  if($('#clear-plan'))$('#clear-plan').onclick=()=>{selected.clear();savePlan();renderCards();renderPlan();};
}
function dialog(id,html,className='') {
  let el=$(`#${id}`); if(!el){el=document.createElement('dialog');el.id=id;document.body.appendChild(el);}
  el.className=`dialog ${className}`;el.innerHTML=html;
  el.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>el.close());
  el.onclick=e=>{if(e.target===el){const r=el.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)el.close();}};
  if(!el.open) el.showModal(); return el;
}
const closeButton = `<button class="icon-button dialog-close" data-close aria-label="关闭">${icon('close')}</button>`;
async function showDetail(id) {
  const d=store.dishes.find(d=>d.id===id);if(!d)return;activeDish=id;
  const info=categoryInfo(d.category);
  const el=dialog('detail-dialog',`${closeButton}<div class="detail-cover" style="--food-bg:${info.color}"><div class="food-plate"><span>${FOOD[d.name]||info.icon}</span></div><span class="detail-cover-note">YOUR RECIPE, YOUR WAY.</span></div><div class="dialog-body"><div class="detail-top"><div><span class="eyebrow">${esc(d.category)} · ${d.minutes} 分钟</span><h2>${esc(d.name)}</h2></div><button class="secondary" id="edit-dish">${icon('edit')}编辑</button></div><p class="detail-notes">${esc(d.notes)}</p><div class="detail-stats"><span>已做 <strong>${d.cook_count}</strong> 次</span><span>${stars(d.rating)} <small>我的评分</small></span><button class="text-button" id="detail-favorite">${icon('heart')}${d.favorite?'已收藏':'收藏菜谱'}</button></div><div class="ingredients-grid"><section><h3>食材 <small>按自己的食量调整</small></h3><ul>${d.ingredients.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></section><section><h3>调料</h3><ul>${d.seasonings.length?d.seasonings.map(s=>`<li>${esc(s)}</li>`).join(''):'<li>无需额外调料</li>'}</ul></section></div><section class="steps"><h3>制作方法</h3><ol>${d.steps.map((s,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><p>${esc(s)}</p></li>`).join('')}</ol></section><section class="cook-record"><h3>今天也好好做饭了</h3><p>记录一次下厨，评分会更新为这次的个人评分。</p><label>这次的评分<select id="cook-rating"><option value="">暂不评分</option>${[5,4,3,2,1].map(n=>`<option value="${n}">${'★'.repeat(n)} ${n} 分</option>`).join('')}</select></label><button class="primary" id="cook-button" ${d.deleted_at?'disabled':''}>${icon('check')} 做过一次 +1</button></section><div id="history" class="history"><h3>最近下厨记录</h3><p>正在读取…</p></div><div class="detail-actions"><button class="secondary" id="detail-plan" ${d.deleted_at?'disabled':''}>${icon(selected.has(id)?'check':'plus')}${selected.has(id)?'移出今日菜单':'加入今日菜单'}</button><button class="text-button" id="archive-dish">${icon('archive')}${d.deleted_at?'恢复菜谱':'归档菜谱'}</button></div></div>`,'detail-dialog');
  $('#edit-dish').onclick=()=>{el.close();showEditor(d);};
  $('#detail-plan').onclick=()=>togglePlan(id);
  $('#detail-favorite').onclick=async()=>{if(await action(()=>store.save({...d,favorite:!d.favorite})))showDetail(id);};
  $('#cook-button').onclick=async()=>{const value=$('#cook-rating').value;if(await action(()=>store.cook(id,value?Number(value):null),'已记录一次下厨'))showDetail(id);};
  $('#archive-dish').onclick=async()=>{if(await action(()=>store.save({...d,deleted_at:d.deleted_at?null:new Date().toISOString()}),d.deleted_at?'已恢复菜谱':'已归档，可在归档菜谱中恢复')){el.close();selected.delete(id);savePlan();renderPlan();}};
  try {const records=await store.history(id);if(activeDish!==id||!el.open)return;$('#history').innerHTML=`<h3>最近下厨记录</h3>${records.length?records.map(r=>`<p>${new Date(r.created_at).toLocaleString('zh-CN')} <span>${r.rating?stars(r.rating):'未评分'}</span></p>`).join(''):'<p>还没有记录，第一次下厨就从今天开始。</p>'}`;}catch(e){if($('#history'))$('#history').innerHTML=`<p>${esc(e.message)}</p>`;}
}
function showEditor(existing) {
  const d=existing||{name:'',category:'荤菜',ingredients:[],seasonings:[],steps:[],minutes:20,cook_count:0,rating:null,notes:''};
  const el=dialog('editor-dialog',`${closeButton}<div class="dialog-body"><span class="eyebrow">SAVE A LITTLE TASTE OF HOME</span><h2>${existing?'编辑菜谱':'记下一道好菜'}</h2><p class="dialog-description">把食材、做法和小窍门，都写进自己的点菜本。</p><form id="dish-form"><div class="form-row"><label>菜品名称 <span>*</span><input name="name" value="${esc(d.name)}" placeholder="例如：番茄炒蛋" required maxlength="60"/></label><label>所属分类 <span>*</span><input name="category" list="category-list" value="${esc(d.category)}" required maxlength="20"/><datalist id="category-list">${categories().map(c=>`<option value="${esc(c)}">`).join('')}</datalist><small>选择已有分类，或填写新分类</small></label></div><div class="form-row"><label>食材 <span>*</span><textarea name="ingredients" placeholder="鸡蛋 3 个&#10;番茄 2 个" required rows="5">${esc(d.ingredients.join('\n'))}</textarea><small>一行一种，建议写上用量</small></label><label>调料<textarea name="seasonings" placeholder="盐 3 克&#10;食用油 适量" rows="5">${esc(d.seasonings.join('\n'))}</textarea></label></div><label>制作方法 <span>*</span><textarea name="steps" placeholder="番茄切块，鸡蛋打散。&#10;热锅倒油，炒熟鸡蛋后盛出。&#10;炒软番茄，倒回鸡蛋，调味出锅。" required rows="6">${esc(d.steps.join('\n'))}</textarea><small>一个步骤一行，保存后会自动编号</small></label><div class="form-row three-columns"><label>制作耗时（分钟）<input name="minutes" type="number" min="1" max="1440" step="1" value="${d.minutes}" required/></label><label>已制作次数<input name="cook_count" type="number" min="0" max="1000000" step="1" value="${d.cook_count}" required/></label><label>我的评分<input name="rating" type="number" min="1" max="5" step="any" value="${d.rating ?? ''}" placeholder="1–5，留空未评分"/></label></div><label>菜谱小记<textarea name="notes" maxlength="4000" rows="2" placeholder="家人的口味、火候的小窍门，或这道菜的故事…">${esc(d.notes)}</textarea></label><p id="form-error" class="inline-error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" data-close>取消</button><button type="submit" class="primary">${icon('check')}保存菜谱</button></div></form></div>`,'editor-dialog');
  $('#dish-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.target),now=new Date().toISOString();const dish={...d,id:d.id||crypto.randomUUID(),name:f.get('name').trim(),category:f.get('category').trim(),ingredients:lines(f.get('ingredients')),seasonings:lines(f.get('seasonings')),steps:lines(f.get('steps')),minutes:Number(f.get('minutes')),cook_count:Number(f.get('cook_count')),rating:f.get('rating')?Number(f.get('rating')):null,notes:f.get('notes').trim(),favorite:d.favorite||false,version:d.version||1,created_at:d.created_at||now,deleted_at:d.deleted_at||null};
    busy=true;const submit=e.target.querySelector('[type=submit]');submit.disabled=true;$('#form-error').textContent='';
    try{await store.save(dish);el.close();toast('菜谱已保存');}catch(error){$('#form-error').textContent=error.message;}finally{busy=false;submit.disabled=false;}
  };
}
function showShopping() {
  const dishes=active().filter(d=>selected.has(d.id)); const items=shoppingItems(dishes);
  dialog('shopping-dialog',`${closeButton}<div class="dialog-body"><span class="eyebrow">A LITTLE PREP, A LOVELY MEAL</span><h2>今天的采购清单</h2><p class="dialog-description">${dishes.length} 道菜 · ${items.length} 项食材，相同文字合并展示。</p><div class="shopping-list">${items.map((item,i)=>`<label><input type="checkbox"/><span><strong>${esc(item.name)}</strong><small>${esc(item.dishes.join('、'))}</small></span></label>`).join('')}</div><p class="hint">不同用量会分别列出，请按实际人数调整总量。调料请对照菜谱检查。</p><button class="primary" id="copy-shopping">${icon('book')} 复制清单</button></div>`);
  $('#copy-shopping').onclick=async()=>{try{await navigator.clipboard.writeText(`今天的菜单：${dishes.map(d=>d.name).join('、')}\n\n采购食材：\n${items.map(i=>`□ ${i.name}（${i.dishes.join('、')}）`).join('\n')}`);toast('采购清单已复制');}catch{toast('浏览器未允许复制，可以直接查看清单');}};
}
function exportData() {
  const payload={format:'diancai-ben',version:1,exported_at:new Date().toISOString(),dishes:store.dishes.filter(d=>!d.deleted_at)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`点菜本-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出当前菜谱，不含登录凭据');
}
function showSettings() {
  const config=store.config||{url:'',key:''};
  const el=dialog('settings-dialog',`${closeButton}<div class="dialog-body"><span class="eyebrow">YOUR KITCHEN, ON EVERY SCREEN</span><h2>数据与设置</h2><p class="dialog-description">本地先用起来，接入云端后在不同设备同步。</p><div class="settings-status">${icon('cloud')}<div><strong>${store.mode==='cloud'?'正在使用云端菜谱':'正在使用本地菜谱'}</strong><small>${esc(store.user?.email||'数据保存在此浏览器，清理浏览器前请导出备份')}</small></div></div><section class="settings-section"><h3>菜谱备份</h3><div class="button-row"><button class="secondary" id="export-button">${icon('download')}导出 JSON</button><button class="secondary" id="import-button">${icon('plus')}导入 JSON</button><input id="import-file" type="file" accept=".json,application/json" hidden/></div><p class="hint">导入采用追加方式，重名菜品会跳过。导出包含当前菜谱，不包含已归档菜品及历史下厨记录。</p></section><section class="settings-section"><h3>连接 Supabase 实时数据库</h3><p class="hint">先创建项目并运行建表脚本，再填入下面两个公开配置。访问权限由登录和数据库 RLS 控制。</p><form id="config-form"><label>项目 URL<input name="url" type="url" required value="${esc(config.url)}" placeholder="https://xxxxxxxx.supabase.co"/></label><label>Publishable key / anon key<input name="key" required value="${esc(config.key)}" placeholder="sb_publishable_…" autocomplete="off"/></label><p class="hint">不能填写 service_role、secret key 或数据库密码。</p><button class="primary" type="submit">${icon('cloud')}保存连接配置</button></form></section><section class="settings-section"><h3>${store.user?'云端账号':'登录我的云端厨房'}</h3>${store.user?`<p>${esc(store.user.email)}</p><div class="button-row"><button class="secondary" id="upload-local">将本地菜谱导入云端</button><button class="secondary" id="sign-out">退出登录</button></div><p class="hint">首次登录时云端可以为空。点击导入会追加本地菜谱，重名跳过。</p>`:`<form id="login-form"><label>邮箱<input type="email" name="email" required placeholder="填写已在 Supabase 添加的用户邮箱" autocomplete="email"/></label><button class="secondary" type="submit">发送登录邮件</button></form><p class="hint">先在 Supabase → Authentication → Users 添加 / 邀请自己；打开邮件里的登录链接回到此网页。当前不开放公众注册。</p>`}<button class="text-button refresh-data" id="refresh-data">刷新数据库与同步状态</button>${config.url?'<button class="text-button" id="disconnect">移除本机连接配置</button>':''}</section><a class="setup-link" href="./setup.html" target="_blank" rel="noopener">查看数据库与发布接入说明 ${icon('chevron')}</a><p class="settings-feedback" id="settings-feedback" role="status"></p></div>`,'settings-dialog');
  $('#export-button').onclick=exportData;$('#import-button').onclick=()=>$('#import-file').click();
  $('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024){toast('文件不能超过 5 MB');return;}await action(async()=>{const data=JSON.parse(await file.text());const r=await store.importBackup(data);toast(`导入 ${r.added} 道菜，跳过 ${r.skipped} 道重名菜`);});e.target.value='';};
  $('#config-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);if(await action(()=>store.connect({url:f.get('url').trim(),key:f.get('key').trim()}),'连接配置已保存'))showSettings();};
  if($('#login-form'))$('#login-form').onsubmit=async e=>{e.preventDefault();const email=new FormData(e.target).get('email');if(await action(()=>store.signIn(email))){$('#settings-feedback').textContent='登录邮件已发送，请检查收件箱和垃圾邮件。';}};
  if($('#sign-out'))$('#sign-out').onclick=async()=>{if(await action(()=>store.signOut(),'已退出云端账号，回到本地菜谱'))showSettings();};
  if($('#upload-local'))$('#upload-local').onclick=()=>action(async()=>{const r=await store.importBackup(store.localBackup());toast(`已导入 ${r.added} 道菜，跳过 ${r.skipped} 道重名菜`);});
  $('#refresh-data').onclick=()=>action(async()=>{if(store.client)await store.setUser(store.user);else await store.refresh();},'数据已刷新');
  if($('#disconnect'))$('#disconnect').onclick=async()=>{if(await action(()=>store.disconnect(),'已移除本机配置'))showSettings();};
}
store.init().catch(e=>toast(e.message));
