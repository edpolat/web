-- Panelden yeni il ekleme. 002_surumler.sql'den sonra çalıştırılır; tekrar çalıştırmak zarar vermez.
-- Yayındaki iller = veri/iller/*.json + burada onaylanmış il kayıtları. Eser sürümlerindeki gibi hiçbir satır silinmez,
-- düzeltme de yeni bir satırdır; her adım denetim_kaydi'na yazılır. Yeni ilin eserleri eser_surumleri ile eklenir.

create table if not exists public.il_surumleri (
  id bigint generated always as identity primary key,
  il_id text not null check (il_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  veri jsonb not null,
  durum text not null default 'incelemede' check (durum in ('incelemede', 'yayinda', 'reddedildi')),
  islem text not null default 'ekle' check (islem in ('ekle', 'duzenle')),
  aciklama text,
  ekleyen uuid references auth.users (id),
  ekleyen_ad text,
  olusturuldu timestamptz not null default now(),
  inceleyen uuid references auth.users (id),
  inceleyen_ad text,
  karar_tarihi timestamptz,
  ret_gerekcesi text
);
create index if not exists il_surumleri_il on public.il_surumleri (il_id, durum, karar_tarihi desc);

alter table public.il_surumleri enable row level security;

drop policy if exists "yayindaki iller herkese acik" on public.il_surumleri;
create policy "yayindaki iller herkese acik" on public.il_surumleri for select using (durum = 'yayinda');
drop policy if exists "panel ve sahibi il okur" on public.il_surumleri;
create policy "panel ve sahibi il okur" on public.il_surumleri for select to authenticated
  using (ekleyen = auth.uid() or exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));
-- Yazma yalnız aşağıdaki fonksiyonlarla.

-- Yeni il ya da il bilgisi düzeltmesi: incelemeye girer. Aynı il için bekleyen ikinci kayıt açılmaz.
create or replace function public.il_gonder(p_il text, p_veri jsonb, p_islem text, p_not text)
returns bigint language plpgsql security definer set search_path = public as $$
declare yeni_id bigint;
begin
  if not izin_var('eser.ekle') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_islem not in ('ekle', 'duzenle') then raise exception 'gecersiz islem'; end if;
  if p_veri->>'id' is distinct from p_il then raise exception 'il kimligi veriyle uyusmuyor'; end if;
  if exists (select 1 from il_surumleri where il_id = p_il and durum = 'incelemede') then
    raise exception 'bu il icin incelemede bekleyen bir kayit var';
  end if;
  if p_islem = 'ekle' and exists (select 1 from il_surumleri where il_id = p_il and durum = 'yayinda') then
    raise exception 'bu il zaten yayinda';
  end if;
  insert into il_surumleri (il_id, veri, islem, aciklama, ekleyen, ekleyen_ad)
  values (p_il, p_veri, p_islem, nullif(btrim(coalesce(p_not, '')), ''), auth.uid(), benim_adim())
  returning id into yeni_id;
  perform denetime_yaz('il_gonder', 'il:' || p_il, null, null, nullif(btrim(coalesce(p_not, '')), ''));
  return yeni_id;
end $$;

-- Editör kararı. Reddetmede gerekçe zorunlu.
create or replace function public.il_karar(p_id bigint, p_onay boolean, p_gerekce text)
returns void language plpgsql security definer set search_path = public as $$
declare s il_surumleri;
begin
  if not izin_var('eser.onayla') then raise exception 'yetki yok' using errcode = '42501'; end if;
  select * into s from il_surumleri where id = p_id for update;
  if s.id is null or s.durum <> 'incelemede' then raise exception 'bu kayit incelemede degil'; end if;
  if not p_onay and coalesce(btrim(p_gerekce), '') = '' then raise exception 'reddetmek icin gerekce zorunlu'; end if;
  update il_surumleri
  set durum = case when p_onay then 'yayinda' else 'reddedildi' end,
      inceleyen = auth.uid(), inceleyen_ad = benim_adim(), karar_tarihi = now(),
      ret_gerekcesi = case when p_onay then null else btrim(p_gerekce) end
  where id = p_id;
  perform denetime_yaz(case when p_onay then 'il_onayla' else 'il_reddet' end, 'il:' || s.il_id, null,
                       case when p_onay then jsonb_build_array(jsonb_build_object('alan', 'il', 'eski', null, 'yeni', s.veri)) else null end,
                       nullif(btrim(coalesce(p_gerekce, '')), ''));
end $$;

revoke execute on function public.il_gonder(text, jsonb, text, text) from public, anon;
revoke execute on function public.il_karar(bigint, boolean, text) from public, anon;
grant execute on function public.il_gonder(text, jsonb, text, text) to authenticated;
grant execute on function public.il_karar(bigint, boolean, text) to authenticated;
-- Supabase yeni tabloları API'ye kendiliğinden açmayabilir: yalnız okuma izni (yazma yalnız fonksiyonlarla).
grant select on public.il_surumleri to anon, authenticated;
