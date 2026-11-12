-- BLCKSI Store — base inicial segura para Supabase
-- Executar no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'MZN',
  stock integer not null default 0 check (stock >= 0),
  is_new boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Perfis: dados mínimos ligados ao utilizador autenticado.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

-- Segurança: ativar RLS em todas as tabelas.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.profiles enable row level security;

-- Conteúdo público: apenas leitura de itens ativos.
drop policy if exists "public can read active categories" on public.categories;
create policy "public can read active categories" on public.categories for select using (is_active = true);

drop policy if exists "public can read active products" on public.products;
create policy "public can read active products" on public.products for select using (is_active = true);

drop policy if exists "public can read product images" on public.product_images;
create policy "public can read product images" on public.product_images for select using (true);

-- Perfis: cada cliente só lê/atualiza o próprio perfil.
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Não criar policies públicas de INSERT/UPDATE/DELETE para produtos/categorias.
-- O painel administrativo deverá usar uma Edge Function/servidor seguro ou
-- policies adicionais baseadas em role, após o fluxo de administração ser definido.

-- Exemplos iniciais (opcional):
insert into public.categories (name, slug, description, position) values
('Camisetas','camisetas','Peças essenciais BLCKSI',1),
('Camisolas','camisolas','Drops e novas silhuetas',2),
('Calças','calcas','Streetwear em construção',3),
('Bonés','bones','Acessórios de identidade',4)
on conflict (slug) do nothing;


-- V5: encomendas e análise de dados. Executar após o esquema base.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  notes text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0),
  currency text not null default 'MZN',
  status text not null default 'pending_payment' check (status in ('pending_payment','payment_review','paid','processing','shipped','completed','cancelled','refunded')),
  payment_method text check (payment_method in ('M-Pesa','e-Mola','Transferência bancária')),
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_slug text not null,
  size text,
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  page text,
  occurred_at timestamptz not null default now()
);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists analytics_events_date_idx on public.analytics_events(occurred_at desc);

-- Corrige a possibilidade de um cliente alterar o próprio role.
drop policy if exists "users update own profile" on public.profiles;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.analytics_events enable row level security;

-- A criação de pedidos é feita pela Edge Function com service role no servidor.
-- Não conceder INSERT público em orders/order_items.
drop policy if exists "admins read all orders" on public.orders;
create policy "admins read all orders" on public.orders for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders for update to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "admins read order items" on public.order_items;
create policy "admins read order items" on public.order_items for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "admins manage product images" on public.product_images;
create policy "admins manage product images" on public.product_images for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
-- Eventos anónimos são opt-in no frontend; não guardam nome, telefone nem endereço.
drop policy if exists "public insert analytics events" on public.analytics_events;
create policy "public insert analytics events" on public.analytics_events for insert to anon, authenticated with check (
  event_name in ('page_view','product_view','add_to_cart','order_created')
  and length(coalesce(page,'')) <= 300
  and jsonb_typeof(properties) = 'object'
  and octet_length(properties::text) <= 2048
  and (properties - 'slug' - 'order_number' - 'total') = '{}'::jsonb
);
drop policy if exists "admins read analytics events" on public.analytics_events;
create policy "admins read analytics events" on public.analytics_events for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

-- Criar bucket público apenas para leitura dos ficheiros de catálogo.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,10485760,array['image/webp','image/jpeg','image/png'])
on conflict(id) do nothing;
drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects for select to anon,authenticated using (bucket_id='product-images');
drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images" on storage.objects for insert to authenticated with check (bucket_id='product-images' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "admins update product images" on storage.objects;
create policy "admins update product images" on storage.objects for update to authenticated using (bucket_id='product-images' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (bucket_id='product-images' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "admins delete product images" on storage.objects;
create policy "admins delete product images" on storage.objects for delete to authenticated using (bucket_id='product-images' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));


-- Criar perfil customer automaticamente quando uma conta Auth é criada.
create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute procedure public.handle_new_user_profile();


-- Atualização de stock quando a equipa confirma pagamento ou cancela/reembolsa.
create or replace function public.apply_order_stock_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare item record;
begin
  if new.status = 'paid' and old.status <> 'paid' then
    for item in select product_id, quantity from public.order_items where order_id = new.id and product_id is not null loop
      update public.products set stock = stock - item.quantity, updated_at = now()
      where id = item.product_id and stock >= item.quantity;
      if not found then raise exception 'Stock insuficiente para confirmar a encomenda'; end if;
    end loop;
  elsif old.status = 'paid' and new.status in ('cancelled','refunded') then
    for item in select product_id, quantity from public.order_items where order_id = new.id and product_id is not null loop
      update public.products set stock = stock + item.quantity, updated_at = now() where id = item.product_id;
    end loop;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists orders_stock_status_change on public.orders;
create trigger orders_stock_status_change before update of status on public.orders
for each row execute procedure public.apply_order_stock_change();
