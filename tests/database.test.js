import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('离线 PostgreSQL 验证 schema、RLS、去重与记录事务',async t=>{
  const db=new PGlite();
  const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
  const dishID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; grant usage on schema auth to anon, authenticated;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      insert into auth.users values('${A}'),('${B}');
      create publication supabase_realtime;`);
    const schema=await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');
    await db.exec(schema);
    await db.exec(schema); // 可重复执行，不删除表内记录。
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
    await db.query(`insert into public.dishes(id,owner_id,name,category,ingredients,steps)
      values($1,$2,'番茄炒蛋','荤菜','["鸡蛋 3 个","番茄 2 个"]','["切块并炒熟"]')`,[dishID,A]);
    await t.test('数据库独立拦截跨分类和全角空格重名',async()=>{
      await assert.rejects(db.query(`insert into public.dishes(owner_id,name,category,ingredients,steps)
        values($1,' 番茄　炒蛋 ','另一个分类','["鸡蛋"]','["炒熟"]')`,[A]),e=>e.code==='23505');
      assert.equal((await db.query('select count(*)::int as n from public.dishes')).rows[0].n,1);
    });
    await t.test('下厨 RPC 原子增加次数、保留历史、更新评分',async()=>{
      await db.query('select public.record_cook($1,5)',[dishID]);
      await db.query('select public.record_cook($1,null)',[dishID]);
      const d=(await db.query('select cook_count,rating,version from public.dishes where id=$1',[dishID])).rows[0];
      assert.equal(d.cook_count,2);assert.equal(Number(d.rating),5);assert.equal(d.version,3);
      assert.equal((await db.query('select count(*)::int as n from public.cooking_records')).rows[0].n,2);
      await assert.rejects(db.query('select public.record_cook($1,6)',[dishID]),/评分/);
      assert.equal((await db.query('select cook_count from public.dishes where id=$1',[dishID])).rows[0].cook_count,2);
    });
    await t.test('过期版本无法覆盖已更新菜谱',async()=>{
      const first=await db.query('update public.dishes set notes=$1 where id=$2 and version=3 returning version',['新做法',dishID]);
      assert.equal(first.rows[0].version,4);
      const stale=await db.query('update public.dishes set notes=$1 where id=$2 and version=3 returning id',['过期做法',dishID]);
      assert.equal(stale.rows.length,0);
    });
    await t.test('另一用户的读取、插入、更新和 RPC 都受权限限制',async()=>{
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
      assert.equal((await db.query('select * from public.dishes')).rows.length,0);
      assert.equal((await db.query('select * from public.cooking_records')).rows.length,0);
      assert.equal((await db.query('update public.dishes set notes=$1 where id=$2 returning id',['恶意修改',dishID])).rows.length,0);
      await assert.rejects(db.query('select public.record_cook($1,4)',[dishID]),/无权/);
      await assert.rejects(db.query(`insert into public.dishes(owner_id,name,category,ingredients,steps)
        values($1,'伪造所有者','荤菜','["食材"]','["做法"]')`,[A]),e=>e.code==='42501');
    });
    await t.test('匿名访问被拒绝，不能读私有数据或调用写入 RPC',async()=>{
      await db.exec('reset role; set role anon');
      await db.query("select set_config('request.jwt.claim.sub','',false)");
      await assert.rejects(db.query('select * from public.dishes'),e=>e.code==='42501');
      await assert.rejects(db.query('select public.record_cook($1,4)',[dishID]),e=>e.code==='42501');
    });
    await t.test('计数超限时整笔事务回滚，不留下孤立历史',async()=>{
      await db.exec('reset role; set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
      await db.query('update public.dishes set cook_count=1000000 where id=$1',[dishID]);
      await assert.rejects(db.query('select public.record_cook($1,4)',[dishID]),e=>e.code==='23514');
      assert.equal((await db.query('select count(*)::int as n from public.cooking_records')).rows[0].n,2);
      assert.equal((await db.query('select cook_count from public.dishes where id=$1',[dishID])).rows[0].cook_count,1000000);
    });
  } finally { await db.close(); }
});
