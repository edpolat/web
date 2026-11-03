-- 018: Rotalarım (ziyaretçinin kendi gezi planları). Mobil uygulama bu tabloyu 2 Kas 2026'dan beri kullanıyor
-- (uygulamada "003_rotalar.sql" diye anılıyor); web de aynı tabloyu okur ve yazar. Tablo zaten varsa
-- bu dosya hiçbir şeyi bozmaz (if not exists / or replace). Supabase > SQL Editor'de bir kez çalıştırılır.

create table if not exists public.rotalar (
  kullanici uuid not null references auth.users (id) on delete cascade,
  id text not null,
  ad text not null default '',
  eserler text[] not null default '{}',
  silindi boolean not null default false,
  guncelleme timestamptz not null default now(),
  primary key (kullanici, id)
);

alter table public.rotalar enable row level security;

-- Herkes yalnız kendi rotalarını görür ve değiştirir.
drop policy if exists "rotalar_kendi_okur" on public.rotalar;
create policy "rotalar_kendi_okur" on public.rotalar for select using (auth.uid() = kullanici);
drop policy if exists "rotalar_kendi_ekler" on public.rotalar;
create policy "rotalar_kendi_ekler" on public.rotalar for insert with check (auth.uid() = kullanici);
drop policy if exists "rotalar_kendi_gunceller" on public.rotalar;
create policy "rotalar_kendi_gunceller" on public.rotalar for update using (auth.uid() = kullanici) with check (auth.uid() = kullanici);
drop policy if exists "rotalar_kendi_siler" on public.rotalar;
create policy "rotalar_kendi_siler" on public.rotalar for delete using (auth.uid() = kullanici);
