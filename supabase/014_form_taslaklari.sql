-- Panel formlarının taslakları: yeni il, kaynak ekleme ve bilgi-kaynak bağlama. Eser taslakları eser_surumleri'nde kalır.
-- Taslak yalnız sahibine görünür; hiçbir onaya ya da yayına gitmez. Tekrar çalıştırmak zarar vermez.

create table if not exists public.form_taslaklari (
  id bigint generated always as identity primary key,
  sahip uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tur text not null check (tur in ('il', 'kaynak', 'bilgi')),
  hedef text,                                   -- bilgi taslağında eserin kimliği
  baslik text not null check (char_length(baslik) between 1 and 300),
  veri jsonb not null check (jsonb_typeof(veri) = 'object' and octet_length(veri::text) <= 20000),
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now()
);
create index if not exists form_taslaklari_sahip on public.form_taslaklari (sahip, guncellendi desc);

alter table public.form_taslaklari enable row level security;

-- Yalnız kendi taslakları; yazmak için eser ekleme ya da düzenleme izni gerekir.
drop policy if exists "kendi taslaklarim okunur" on public.form_taslaklari;
create policy "kendi taslaklarim okunur" on public.form_taslaklari for select to authenticated using (sahip = auth.uid());
drop policy if exists "kendi taslagimi eklerim" on public.form_taslaklari;
create policy "kendi taslagimi eklerim" on public.form_taslaklari for insert to authenticated
  with check (sahip = auth.uid() and (izin_var('eser.ekle') or izin_var('eser.duzenle')));
drop policy if exists "kendi taslagimi guncellerim" on public.form_taslaklari;
create policy "kendi taslagimi guncellerim" on public.form_taslaklari for update to authenticated
  using (sahip = auth.uid()) with check (sahip = auth.uid() and (izin_var('eser.ekle') or izin_var('eser.duzenle')));
drop policy if exists "kendi taslagimi silerim" on public.form_taslaklari;
create policy "kendi taslagimi silerim" on public.form_taslaklari for delete to authenticated using (sahip = auth.uid());

revoke all on public.form_taslaklari from anon;
grant select, insert, update, delete on public.form_taslaklari to authenticated;
