-- 点菜本 v1。Supabase Dashboard → SQL Editor → New query，整体执行。
-- 不包含私钥，不开放匿名写入。菜谱按已登录用户隔离。
begin;
create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  normalized_name text generated always as (lower(regexp_replace(normalize(name, NFKC), '[[:space:]]', '', 'g'))) stored,
  category text not null check (char_length(btrim(category)) between 1 and 20),
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) between 1 and 100),
  seasonings jsonb not null default '[]'::jsonb check (jsonb_typeof(seasonings) = 'array' and jsonb_array_length(seasonings) <= 100),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 100),
  minutes integer not null default 20 check (minutes between 1 and 1440),
  cook_count integer not null default 0 check (cook_count between 0 and 1000000),
  rating numeric check (rating is null or rating between 1 and 5),
  favorite boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 4000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists dishes_owner_name_unique on public.dishes(owner_id, normalized_name) where deleted_at is null;
create index if not exists dishes_owner_idx on public.dishes(owner_id);
create table if not exists public.cooking_records (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  rating numeric check (rating is null or rating between 1 and 5),
  created_at timestamptz not null default now()
);
create index if not exists cooking_records_dish_idx on public.cooking_records(dish_id, created_at desc);
alter table public.dishes enable row level security;
alter table public.cooking_records enable row level security;
drop policy if exists dishes_read_own on public.dishes;
create policy dishes_read_own on public.dishes for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists dishes_insert_own on public.dishes;
create policy dishes_insert_own on public.dishes for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists dishes_update_own on public.dishes;
create policy dishes_update_own on public.dishes for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists cooking_records_read_own on public.cooking_records;
create policy cooking_records_read_own on public.cooking_records for select to authenticated using ((select auth.uid()) = owner_id);
revoke all on public.dishes from anon;
revoke all on public.cooking_records from anon;
revoke all on public.dishes from authenticated;
grant select, insert, update on public.dishes to authenticated;
revoke all on public.cooking_records from authenticated;
grant select on public.cooking_records to authenticated;

create or replace function public.touch_dish() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists dishes_touch on public.dishes;
create trigger dishes_touch before update on public.dishes for each row execute function public.touch_dish();

-- 同一事务里记录历史和 +1；行锁避免不同设备同时记录时丢次数。
create or replace function public.record_cook(dish_id uuid, new_rating numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_owner uuid; record_id uuid;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  if new_rating is not null and (new_rating < 1 or new_rating > 5) then raise exception '评分需为 1–5 分'; end if;
  select d.owner_id into current_owner from public.dishes d
    where d.id = dish_id and d.owner_id = auth.uid() and d.deleted_at is null for update;
  if current_owner is null then raise exception '菜品不存在、已归档或无权访问'; end if;
  update public.dishes d set cook_count = d.cook_count + 1,
    rating = coalesce(new_rating, d.rating) where d.id = dish_id;
  insert into public.cooking_records(dish_id, owner_id, rating)
    values(dish_id, current_owner, new_rating) returning id into record_id;
  return record_id;
end;
$$;
revoke all on function public.record_cook(uuid, numeric) from public, anon;
grant execute on function public.record_cook(uuid, numeric) to authenticated;

-- Supabase 已提供 supabase_realtime publication。只添加本应用需要的表。
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dishes') then
    alter publication supabase_realtime add table public.dishes;
  end if;
end $$;
commit;
