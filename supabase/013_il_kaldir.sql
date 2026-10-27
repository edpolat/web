-- Panelden eklenen ili kaldırma (arşivleme). 012_il_surumleri.sql'den sonra çalıştırılır; tekrar çalıştırmak zarar vermez.
-- Hiçbir satır silinmez: kaldırma, arşivlendi işaretli yeni bir "yayinda" satırıdır; ilin yayındaki eserleri de aynı anda
-- eser_surumleri'ne arşiv sürümü olarak yazılır. Kaldırılan il sonra yeniden eklenebilir (eserleri arşivde kalır).
-- Yalnız panelden eklenen iller kaldırılabilir; veri/iller/*.json'daki iller kod deposunda durur.

alter table public.il_surumleri add column if not exists arsivlendi boolean not null default false;
alter table public.il_surumleri drop constraint if exists il_surumleri_islem_check;
alter table public.il_surumleri add constraint il_surumleri_islem_check check (islem in ('ekle', 'duzenle', 'arsivle'));

-- İlin en son yayındaki kaydı arşivlenmemiş mi (yani il sitede mi).
create or replace function public.il_yayinda(p_il text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select not arsivlendi from il_surumleri where il_id = p_il and durum = 'yayinda'
                   order by karar_tarihi desc, id desc limit 1), false);
$$;
revoke execute on function public.il_yayinda(text) from public, anon, authenticated;

-- 012'deki il_gonder: kaldırılmış il yeniden eklenebilsin diye "zaten yayında" denetimi en son kayda bakar.
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
  if p_islem = 'ekle' and il_yayinda(p_il) then raise exception 'bu il zaten yayinda'; end if;
  insert into il_surumleri (il_id, veri, islem, aciklama, ekleyen, ekleyen_ad)
  values (p_il, p_veri, p_islem, nullif(btrim(coalesce(p_not, '')), ''), auth.uid(), benim_adim())
  returning id into yeni_id;
  perform denetime_yaz('il_gonder', 'il:' || p_il, null, null, nullif(btrim(coalesce(p_not, '')), ''));
  return yeni_id;
end $$;

-- İli ve yayındaki eserlerini kaldırır (eser.arsivle). Gerekçe zorunlu. Dönen değer: arşivlenen eser sayısı.
create or replace function public.il_kaldir(p_il text, p_gerekce text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  son il_surumleri;
  e record;
  sayi integer := 0;
  gerekce text := btrim(coalesce(p_gerekce, ''));
begin
  if not izin_var('eser.arsivle') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if gerekce = '' then raise exception 'gerekce zorunlu'; end if;
  select * into son from il_surumleri where il_id = p_il and durum = 'yayinda' order by karar_tarihi desc, id desc limit 1;
  if son.id is null then raise exception 'yalniz panelden eklenen iller kaldirilabilir'; end if;
  if son.arsivlendi then raise exception 'bu il zaten kaldirilmis'; end if;

  insert into il_surumleri (il_id, veri, durum, islem, arsivlendi, aciklama, ekleyen, ekleyen_ad, inceleyen, inceleyen_ad, karar_tarihi)
  values (p_il, son.veri, 'yayinda', 'arsivle', true, gerekce, auth.uid(), benim_adim(), auth.uid(), benim_adim(), now());

  for e in
    select * from (
      select distinct on (eser_id) * from eser_surumleri where il = p_il and durum = 'yayinda'
      order by eser_id, karar_tarihi desc, id desc
    ) x where not x.arsivlendi
  loop
    insert into eser_surumleri (eser_id, il, veri, durum, islem, arsivlendi, temel_surum, aciklama, ekleyen, ekleyen_ad, inceleyen, inceleyen_ad, karar_tarihi)
    values (e.eser_id, p_il, e.veri, 'yayinda', 'arsivle', true, e.id, gerekce, auth.uid(), benim_adim(), auth.uid(), benim_adim(), now());
    sayi := sayi + 1;
  end loop;

  perform denetime_yaz('il_kaldir', 'il:' || p_il, null, null, gerekce);
  return sayi;
end $$;

revoke execute on function public.il_kaldir(text, text) from public, anon;
grant execute on function public.il_kaldir(text, text) to authenticated;
