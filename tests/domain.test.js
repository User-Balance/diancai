import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, validateDish, migrateBackup, shoppingItems } from '../src/domain.js';
import { seedDishes } from '../src/seed.js';

test('菜名跨分类去重并统一全角和空白',()=>{
  assert.equal(normalizeName(' Ａ　B\nＣ '),'abc');
  const dishes=seedDishes();
  assert.throws(()=>validateDish({...dishes[0],id:'other',name:' 番茄 炒蛋 ',category:'自定义分类'},dishes),/已经/);
  assert.doesNotThrow(()=>validateDish({...dishes[0],notes:'新做法'},dishes));
  assert.doesNotThrow(()=>validateDish({...dishes[0],id:'other'},[{...dishes[0],deleted_at:new Date().toISOString()}]));
});
test('示例菜谱有效、不重复、制作次数和评分不伪造',()=>{
  const dishes=seedDishes(); assert.equal(new Set(dishes.map(d=>normalizeName(d.name))).size,12);
  for(const dish of dishes){assert.doesNotThrow(()=>validateDish(dish,dishes));assert.equal(dish.cook_count,0);assert.equal(dish.rating,null);}
});
test('拒绝非法食材、步骤、计数、评分和耗时',()=>{
  const dish=seedDishes()[0];
  for(const fields of [{ingredients:[]},{steps:[]},{seasonings:[123]},{cook_count:-1},{cook_count:1.2},{rating:6},{rating:NaN},{minutes:0},{minutes:2.5}]) assert.throws(()=>validateDish({...dish,...fields}));
});
test('备份追加导入跳过重名并丢弃外部的 owner_id 和 id',()=>{
  const dishes=seedDishes();const raw={...dishes[1],owner_id:'untrusted'};
  const result=migrateBackup({format:'diancai-ben',version:1,dishes:[dishes[0],raw]},[dishes[0]]);
  assert.equal(result.added,1);assert.equal(result.skipped,1);assert.equal(result.dishes.length,2);
  assert.notEqual(result.dishes[1].id,raw.id);assert.equal(result.dishes[1].owner_id,undefined);
  assert.throws(()=>migrateBackup({dishes:[]},[]),/JSON/);
  assert.throws(()=>migrateBackup({format:'diancai-ben',version:1,dishes:[{...raw,ingredients:[]}]},[]));
});
test('采购清单合并相同文字，不擅自累加不同单位用量',()=>{
  const a={name:'A',ingredients:['鸡蛋 2 个','盐 3 克']},b={name:'B',ingredients:['鸡蛋 2 个','鸡蛋 3 个']};
  const list=shoppingItems([a,b]);assert.equal(list.length,3);assert.deepEqual(list[0].dishes,['A','B']);
});
