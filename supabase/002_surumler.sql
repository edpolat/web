-- Aşama 2: eser sürümleri, inceleme akışı, geri alma ve arşivleme. 001_roller.sql'den sonra çalıştırılır; tekrar çalıştırmak zarar vermez.
-- Yayındaki eser = veri/iller/*.json'daki hâli (sürüm 0) + varsa en son "yayinda" sürümü. Hiçbir sürüm silinmez, güncellenmez:
-- geri alma ve arşivleme de yeni bir sürümdür. Her adım denetim_kaydi'na yazılır.

create table if not exists public.eser_surumleri (
  id bigint generated always as identity primary key,
  eser_id text not null,
  il text not null,
  veri jsonb not null,
  durum text not null default 'incelemede' check (durum in ('taslak', 'incelemede', 'yayinda', 'reddedildi')),
  islem text not null default 'duzenle' check (islem in ('ekle', 'duzenle', 'geri_al', 'arsivle', 'arsivden_cikar')),
  arsivlendi boolean not null default false,
  temel_surum bigint references public.eser_surumleri (id),
  kaynak_id text,
  sayfa text,
  aciklama text,
  ekleyen uuid references auth.users (id),
  ekleyen_ad text,
  olusturuldu timestamptz not null default now(),
  inceleyen uuid references auth.users (id),
  inceleyen_ad text,
  karar_tarihi timestamptz,
  ret_gerekcesi text
);
create index if not exists eser_surumleri_eser on public.eser_surumleri (eser_id, durum, karar_tarihi desc);
create index if not exists eser_surumleri_durum on public.eser_surumleri (durum, olusturuldu desc);

alter table public.denetim_kaydi add column if not exists surum_id bigint;
alter table public.denetim_kaydi add column if not exists kim_ad text;

alter table public.eser_surumleri enable row level security;

-- Site herkese yayındaki sürümleri okur; panel kullanıcıları hepsini, herkes kendi gönderdiklerini görür.
drop policy if exists "yayindakiler herkese acik" on public.eser_surumleri;
create policy "yayindakiler herkese acik" on public.eser_surumleri for select using (durum = 'yayinda');
drop policy if exists "panel ve sahibi okur" on public.eser_surumleri;
create policy "panel ve sahibi okur" on public.eser_surumleri for select to authenticated
  using (ekleyen = auth.uid() or exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));
-- Yazma yalnız aşağıdaki fonksiyonlarla.

create or replace function public.benim_adim() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select ad from profiller where id = auth.uid()), (select split_part(email, '@', 1) from auth.users where id = auth.uid()));
$$;

-- Denetim kaydına alan alan yazar. degisiklikler: [{ "alan": ..., "eski": ..., "yeni": ... }]
create or replace function public.denetime_yaz(p_islem text, p_eser text, p_surum bigint, p_degisiklikler jsonb, p_gerekce text)
returns void language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if p_degisiklikler is null or jsonb_array_length(p_degisiklikler) = 0 then
    insert into denetim_kaydi (kim, kim_ad, islem, hedef, surum_id, gerekce) values (auth.uid(), benim_adim(), p_islem, p_eser, p_surum, p_gerekce);
    return;
  end if;
  for d in select * from jsonb_array_elements(p_degisiklikler) loop
    insert into denetim_kaydi (kim, kim_ad, islem, hedef, surum_id, alan, eski, yeni, gerekce)
    values (auth.uid(), benim_adim(), p_islem, p_eser, p_surum, d->>'alan', d->'eski', d->'yeni', p_gerekce);
  end loop;
end $$;
revoke execute on function public.denetime_yaz(text, text, bigint, jsonb, text) from public, anon, authenticated;

-- Katkıcı/editör düzenlemesi: yayındaki hâli değiştirmez, taslak ya da incelemede bekler.
create or replace function public.surum_gonder(
  p_eser text, p_il text, p_veri jsonb, p_islem text, p_temel bigint, p_kaynak text, p_sayfa text, p_not text, p_taslak boolean
) returns bigint language plpgsql security definer set search_path = public as $$
declare yeni_id bigint;
begin
  if p_islem = 'ekle' and not izin_var('eser.ekle') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_islem = 'duzenle' and not izin_var('eser.duzenle') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_islem not in ('ekle', 'duzenle') then raise exception 'gecersiz islem'; end if;
  insert into eser_surumleri (eser_id, il, veri, durum, islem, temel_surum, kaynak_id, sayfa, aciklama, ekleyen, ekleyen_ad)
  values (p_eser, p_il, p_veri, case when p_taslak then 'taslak' else 'incelemede' end, p_islem, p_temel, p_kaynak, p_sayfa, p_not, auth.uid(), benim_adim())
  returning id into yeni_id;
  perform denetime_yaz(case when p_taslak then 'taslak_kaydet' else 'incelemeye_gonder' end, p_eser, yeni_id, null, p_not);
  return yeni_id;
end $$;

-- Kendi taslağını incelemeye gönderir.
create or replace function public.surum_incelemeye(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare s eser_surumleri;
begin
  select * into s from eser_surumleri where id = p_id;
  if s.id is null or s.ekleyen is distinct from auth.uid() or s.durum <> 'taslak' then
    raise exception 'yalniz kendi taslagin incelemeye gonderilebilir' using errcode = '42501';
  end if;
  update eser_surumleri set durum = 'incelemede', olusturuldu = now() where id = p_id;
  perform denetime_yaz('incelemeye_gonder', s.eser_id, p_id, null, null);
end $$;

-- Editör kararı. Reddetmede gerekçe zorunlu; onayda alan alan değişiklikler denetim kaydına yazılır.
create or replace function public.surum_karar(p_id bigint, p_onay boolean, p_gerekce text, p_degisiklikler jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s eser_surumleri;
begin
  if not izin_var('eser.onayla') then raise exception 'yetki yok' using errcode = '42501'; end if;
  select * into s from eser_surumleri where id = p_id for update;
  if s.id is null or s.durum <> 'incelemede' then raise exception 'bu surum incelemede degil'; end if;
  if not p_onay and coalesce(btrim(p_gerekce), '') = '' then raise exception 'reddetmek icin gerekce zorunlu'; end if;
  update eser_surumleri
  set durum = case when p_onay then 'yayinda' else 'reddedildi' end,
      inceleyen = auth.uid(), inceleyen_ad = benim_adim(), karar_tarihi = now(),
      ret_gerekcesi = case when p_onay then null else btrim(p_gerekce) end
  where id = p_id;
  perform denetime_yaz(case when p_onay then 'onayla' else 'reddet' end, s.eser_id, p_id,
                       case when p_onay then p_degisiklikler else null end, nullif(btrim(coalesce(p_gerekce, '')), ''));
end $$;

-- Doğrudan yayına alınan sürüm: eski bir sürüme dönme (eser.onayla) ya da arşivleme/arşivden çıkarma (eser.arsivle). Gerekçe zorunlu.
create or replace function public.surum_yayinla(
  p_eser text, p_il text, p_veri jsonb, p_islem text, p_temel bigint, p_gerekce text, p_degisiklikler jsonb
) returns bigint language plpgsql security definer set search_path = public as $$
declare yeni_id bigint;
begin
  if p_islem = 'geri_al' and not izin_var('eser.onayla') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_islem in ('arsivle', 'arsivden_cikar') and not izin_var('eser.arsivle') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_islem not in ('geri_al', 'arsivle', 'arsivden_cikar') then raise exception 'gecersiz islem'; end if;
  if coalesce(btrim(p_gerekce), '') = '' then raise exception 'gerekce zorunlu'; end if;
  insert into eser_surumleri (eser_id, il, veri, durum, islem, arsivlendi, temel_surum, aciklama, ekleyen, ekleyen_ad, inceleyen, inceleyen_ad, karar_tarihi)
  values (p_eser, p_il, p_veri, 'yayinda', p_islem, p_islem = 'arsivle', p_temel, btrim(p_gerekce), auth.uid(), benim_adim(), auth.uid(), benim_adim(), now())
  returning id into yeni_id;
  perform denetime_yaz(p_islem, p_eser, yeni_id, p_degisiklikler, btrim(p_gerekce));
  return yeni_id;
end $$;

-- Rol değişikliklerinde de yapanın adı kaydedilsin (001'deki rol_ata'nın aynısı + kim_ad).
create or replace function public.rol_ata(hedef uuid, yeni_rol text) returns void
language plpgsql security definer set search_path = public as $$
declare eski text;
begin
  if not public.izin_var('kullanici.yonet') then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  if hedef = auth.uid() then
    raise exception 'kendi rolunu degistiremezsin' using errcode = '42501';
  end if;
  select rol into eski from kullanici_rolleri where kullanici = hedef;
  if yeni_rol is null then
    delete from kullanici_rolleri where kullanici = hedef;
  else
    insert into kullanici_rolleri (kullanici, rol, atayan) values (hedef, yeni_rol, auth.uid())
    on conflict (kullanici) do update set rol = excluded.rol, atayan = excluded.atayan, tarih = now();
  end if;
  insert into denetim_kaydi (kim, kim_ad, islem, hedef, alan, eski, yeni)
  values (auth.uid(), benim_adim(), 'rol_ata', hedef::text, 'rol', to_jsonb(eski), to_jsonb(yeni_rol));
end $$;

revoke execute on function public.surum_gonder(text, text, jsonb, text, bigint, text, text, text, boolean) from public, anon;
revoke execute on function public.surum_incelemeye(bigint) from public, anon;
revoke execute on function public.surum_karar(bigint, boolean, text, jsonb) from public, anon;
revoke execute on function public.surum_yayinla(text, text, jsonb, text, bigint, text, jsonb) from public, anon;
revoke execute on function public.benim_adim() from public, anon;
grant execute on function public.surum_gonder(text, text, jsonb, text, bigint, text, text, text, boolean) to authenticated;
grant execute on function public.surum_incelemeye(bigint) to authenticated;
grant execute on function public.surum_karar(bigint, boolean, text, jsonb) to authenticated;
grant execute on function public.surum_yayinla(text, text, jsonb, text, bigint, text, jsonb) to authenticated;
grant execute on function public.benim_adim() to authenticated;
-- Supabase yeni tabloları API'ye kendiliğinden açmayabilir: yalnız okuma izni (yazma yalnız fonksiyonlarla).
grant select on public.eser_surumleri to anon, authenticated;
grant select on public.denetim_kaydi to authenticated;
