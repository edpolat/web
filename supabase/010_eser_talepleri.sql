-- 010: Mobil uygulamadan gelen eser talepleri (bilgi / fotoğraf önerisi) yönetim panelinde.
-- Tabloyu ve "talep-foto" deposunu Feyza'nın SQL'i kurar (uygulama misafir ve üye olarak yazar). Bu dosya
-- tablo yoksa aynı biçimde kurar, karar sütunlarını ekler ve panele okuma + karar verme yetkisi verir.
-- Birden fazla kez çalıştırılabilir. Panel kendi oturumuyla çalışır; service_role anahtarı gerekmez.

create table if not exists public.eser_talepleri (
  id text primary key,
  eser_id text not null,
  eser_adi text,
  bilgi text,
  kullanici uuid references auth.users (id),
  gonderen_ad text,
  foto_yollari text[] not null default '{}',
  kaynak text,
  durum text not null default 'bekliyor',
  olusturuldu timestamptz not null default now()
);

alter table public.eser_talepleri add column if not exists olusturuldu timestamptz not null default now();
alter table public.eser_talepleri add column if not exists inceleyen uuid references auth.users (id);
alter table public.eser_talepleri add column if not exists inceleyen_ad text;
alter table public.eser_talepleri add column if not exists karar_tarihi timestamptz;
alter table public.eser_talepleri add column if not exists ret_gerekcesi text;
alter table public.eser_talepleri add column if not exists karar_notu text;

-- Durum değerleri bilgi önerileriyle aynı: bekliyor / kabul / reddedildi (eski "red" varsa çevrilir).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.eser_talepleri'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%durum%'
  loop
    execute format('alter table public.eser_talepleri drop constraint %I', c.conname);
  end loop;
end $$;
update public.eser_talepleri set durum = 'reddedildi' where durum in ('red', 'reddet', 'ret');
update public.eser_talepleri set durum = 'kabul' where durum in ('kabul_edildi', 'onaylandi');
alter table public.eser_talepleri add constraint eser_talepleri_durum_check check (durum in ('bekliyor', 'kabul', 'reddedildi'));

create index if not exists eser_talepleri_durum on public.eser_talepleri (durum, olusturuldu);

alter table public.eser_talepleri enable row level security;

-- Yeni talep her zaman "bekliyor" ve kararsız girer; üye ancak kendi kimliğiyle gönderebilir.
-- (Kısıtlayıcı kural: Feyza'nın ekleme kuralına ek olarak uygulanır, onu gevşetmez.)
drop policy if exists "talep karari disaridan yazilamaz" on public.eser_talepleri;
create policy "talep karari disaridan yazilamaz" on public.eser_talepleri as restrictive for insert to anon, authenticated
  with check (
    durum = 'bekliyor' and inceleyen is null and karar_tarihi is null and ret_gerekcesi is null
    and (kullanici is null or kullanici = auth.uid())
  );

-- Panel (eser.onayla) bütün talepleri okur. Yazma yalnız talep_karar ile.
drop policy if exists "panel talepleri okur" on public.eser_talepleri;
create policy "panel talepleri okur" on public.eser_talepleri for select to authenticated
  using (izin_var('eser.onayla'));
grant select on public.eser_talepleri to authenticated;

-- Panel talep fotoğraflarını okur (süreli imzalı bağlantı için gerekli).
drop policy if exists "panel talep fotografi okur" on storage.objects;
create policy "panel talep fotografi okur" on storage.objects for select to authenticated
  using (bucket_id = 'talep-foto' and izin_var('eser.onayla'));

-- Karar (eser.onayla): kabul "bilgi değerlendirildi / esere işlendi" demektir; eser değişikliği ayrıca
-- düzenleme olarak yapılır. Ret için gerekçe zorunlu. Denetim kaydına yazılır.
create or replace function public.talep_karar(p_id text, p_onay boolean, p_gerekce text)
returns void language plpgsql security definer set search_path = public as $$
declare t eser_talepleri;
begin
  if not izin_var('eser.onayla') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if not p_onay and coalesce(btrim(p_gerekce), '') = '' then raise exception 'reddetmek icin gerekce zorunlu'; end if;
  select * into t from eser_talepleri where id::text = p_id for update;
  if t.id is null then raise exception 'talep bulunamadi'; end if;
  if t.durum <> 'bekliyor' then raise exception 'talep zaten karara baglandi'; end if;
  update eser_talepleri
  set durum = case when p_onay then 'kabul' else 'reddedildi' end,
      inceleyen = auth.uid(), inceleyen_ad = benim_adim(), karar_tarihi = now(),
      ret_gerekcesi = case when p_onay then null else btrim(p_gerekce) end,
      karar_notu = case when p_onay then nullif(btrim(coalesce(p_gerekce, '')), '') else null end
  where id::text = p_id;
  perform denetime_yaz(case when p_onay then 'talep_kabul' else 'talep_reddet' end, t.eser_id, null, null,
    coalesce(nullif(btrim(coalesce(p_gerekce, '')), ''), 'Uygulama talebi ' || p_id));
end $$;
revoke execute on function public.talep_karar(text, boolean, text) from public, anon;
grant execute on function public.talep_karar(text, boolean, text) to authenticated;
