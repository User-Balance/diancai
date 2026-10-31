export const CATEGORIES = [
  { name: '荤菜', icon: '🥘', color: '#f4e2cb' },
  { name: '素菜', icon: '🥬', color: '#e0e9d9' },
  { name: '海鲜', icon: '🍤', color: '#f4dfd6' },
  { name: '汤羹', icon: '🍲', color: '#eee7cb' },
  { name: '主食', icon: '🍚', color: '#e8e4d8' },
  { name: '早餐', icon: '🍳', color: '#f5e9c7' },
  { name: '甜品饮品', icon: '🍮', color: '#eedfe6' }
];
export const normalizeName = (name) => String(name).normalize('NFKC').replace(/\s/gu, '').toLowerCase();
export const lines = (value) => String(value ?? '').split('\n').map(s => s.trim()).filter(Boolean);
export const stars = (rating) => rating ? `★ ${Number(rating).toFixed(1)}` : '还未评分';
export function validateDish(dish, dishes = []) {
  if (!dish.name?.trim() || dish.name.trim().length > 60) throw new Error('菜名需为 1–60 个字符');
  if (!dish.category?.trim() || dish.category.trim().length > 20) throw new Error('分类需为 1–20 个字符');
  if (!Array.isArray(dish.ingredients) || !dish.ingredients.length) throw new Error('请至少填写一种食材');
  if (!Array.isArray(dish.steps) || !dish.steps.length) throw new Error('请至少填写一个制作步骤');
  if (![dish.ingredients, dish.seasonings, dish.steps].every(a => Array.isArray(a) && a.length <= 100 && a.every(s => typeof s === 'string' && s.length <= 2000))) throw new Error('每项最多 100 行，每行不超过 2000 字');
  if (!Number.isInteger(dish.cook_count) || dish.cook_count < 0 || dish.cook_count > 1000000) throw new Error('制作次数需为 0–1000000 的整数');
  if (dish.rating != null && (!Number.isFinite(dish.rating) || dish.rating < 1 || dish.rating > 5)) throw new Error('评分范围为 1–5 分');
  if (!Number.isInteger(dish.minutes) || dish.minutes < 1 || dish.minutes > 1440) throw new Error('耗时需为 1–1440 分钟');
  if (typeof dish.notes !== 'string' || dish.notes.length > 4000) throw new Error('菜谱小记不能超过 4000 字');
  if (dishes.some(d => !d.deleted_at && d.id !== dish.id && normalizeName(d.name) === normalizeName(dish.name))) throw new Error('这道菜已经在菜谱里了，请编辑原有菜品');
  return dish;
}
export function shoppingItems(dishes) {
  const result = new Map();
  for (const dish of dishes) for (const ingredient of dish.ingredients) {
    const key = normalizeName(ingredient);
    if (!result.has(key)) result.set(key, { name: ingredient, dishes: [] });
    result.get(key).dishes.push(dish.name);
  }
  return [...result.values()];
}
export function migrateBackup(input, existing) {
  if (input?.format !== 'diancai-ben' || input.version !== 1 || !Array.isArray(input.dishes)) throw new Error('请选择点菜本导出的 JSON 文件');
  if (input.dishes.length > 1000) throw new Error('一次最多导入 1000 道菜');
  const out = [...existing]; let added = 0, skipped = 0;
  for (const raw of input.dishes) {
    const dish = {
      id: crypto.randomUUID(), name: String(raw.name ?? '').trim(), category: String(raw.category ?? '').trim(),
      ingredients: raw.ingredients, seasonings: raw.seasonings, steps: raw.steps,
      minutes: raw.minutes, cook_count: raw.cook_count, rating: raw.rating ?? null,
      favorite: !!raw.favorite, notes: String(raw.notes ?? '').slice(0, 4000), version: 1,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null
    };
    if (out.some(d => !d.deleted_at && normalizeName(d.name) === normalizeName(dish.name))) { skipped++; continue; }
    validateDish(dish, out); out.push(dish); added++;
  }
  return { dishes: out, added, skipped };
}
