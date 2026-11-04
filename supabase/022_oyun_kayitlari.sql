-- 022: Oyun kaydı hesapta. Giriş yapmış oyuncunun oyun ilerlemesi (yıldızlar, leveller, albüm...) burada durur;
-- web (/oyun) ve mobil uygulama (Oyun sekmesi) aynı satırı okur ve yazar, böylece oyun iki tarafta kaldığı yerden sürer.
-- Misafirlerin kaydı yalnız kendi cihazında kalır. Şimdilik yalnız "vakfiye.ilerleme" anahtarı eşitlenir.
-- Birleştirme kuralı web'de lib/oyun-ilerleme.ts. Tablo zaten varsa bu dosya hiçbir şeyi bozmaz.
-- Supabase > SQL Editor'de bir kez çalıştırılır.

create table if not exists public.oyun_kayitlari (
  kullanici uuid not null references auth.users (id) on delete cascade,
  anahtar text not null check (char_length(anahtar) between 1 and 80),
  deger jsonb not null default '{}'::jsonb,
  guncelleme timestamptz not null default now(),
  primary key (kullanici, anahtar)
);

alter table public.oyun_kayitlari enable row level security;

-- Herkes yalnız kendi oyun kaydını görür ve değiştirir.
drop policy if exists "oyun_kayit_kendi_okur" on public.oyun_kayitlari;
create policy "oyun_kayit_kendi_okur" on public.oyun_kayitlari for select using (auth.uid() = kullanici);
drop policy if exists "oyun_kayit_kendi_ekler" on public.oyun_kayitlari;
create policy "oyun_kayit_kendi_ekler" on public.oyun_kayitlari for insert with check (auth.uid() = kullanici);
drop policy if exists "oyun_kayit_kendi_gunceller" on public.oyun_kayitlari;
create policy "oyun_kayit_kendi_gunceller" on public.oyun_kayitlari for update using (auth.uid() = kullanici) with check (auth.uid() = kullanici);
drop policy if exists "oyun_kayit_kendi_siler" on public.oyun_kayitlari;
create policy "oyun_kayit_kendi_siler" on public.oyun_kayitlari for delete using (auth.uid() = kullanici);
