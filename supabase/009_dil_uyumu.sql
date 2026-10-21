-- İki dil uyumu: 005'ten sonra çalıştırılır; tekrar çalıştırmak zarar vermez. Yeni tablo yok (sütunlar mevcut okuma izniyle gelir).
-- * eser_surumleri.dil_uyumu: düzenleyen "bu değişiklik diğer dildeki metne uyum için" dedi; onaylayana tek dil uyarısı çıkmaz.
-- * bilgi_onerileri.dil: önerilen metnin dili (tr/en); dil_uyumu: aynı işaret, öneri için.
-- Uyarının kendisi uygulamada (lib/dil-uyumu.ts); veritabanı yalnız işaretleri saklar.

alter table public.eser_surumleri add column if not exists dil_uyumu boolean not null default false;
alter table public.bilgi_onerileri add column if not exists dil text not null default 'tr';
alter table public.bilgi_onerileri add column if not exists dil_uyumu boolean not null default false;
alter table public.bilgi_onerileri drop constraint if exists bilgi_onerileri_dil_check;
alter table public.bilgi_onerileri add constraint bilgi_onerileri_dil_check check (dil in ('tr', 'en'));

-- surum_gonder: yeni parametre p_dil_uyumu (varsayılan false; eski çağrılar aynen çalışır).
drop function if exists public.surum_gonder(text, text, jsonb, text, bigint, text, text, text, boolean);
create or replace function public.surum_gonder(
  p_eser text, p_il text, p_veri jsonb, p_islem text, p_temel bigint, p_kaynak text, p_sayfa text, p_not text, p_taslak boolean,
  p_dil_uyumu boolean default false
) returns bigint language plpgsql security definer set search_path = public as $$
declare yeni_id bigint;
begin
  if p_islem = 'ekle' and not izin_var('eser.ekle') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_islem = 'duzenle' and not izin_var('eser.duzenle') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_islem not in ('ekle', 'duzenle') then raise exception 'gecersiz islem'; end if;
  insert into eser_surumleri (eser_id, il, veri, durum, islem, temel_surum, kaynak_id, sayfa, aciklama, ekleyen, ekleyen_ad, dil_uyumu)
  values (p_eser, p_il, p_veri, case when p_taslak then 'taslak' else 'incelemede' end, p_islem, p_temel, p_kaynak, p_sayfa, p_not, auth.uid(), benim_adim(),
          coalesce(p_dil_uyumu, false))
  returning id into yeni_id;
  perform denetime_yaz(case when p_taslak then 'taslak_kaydet' else 'incelemeye_gonder' end, p_eser, yeni_id, null, p_not);
  return yeni_id;
end $$;

-- oneri_gonder: yeni parametreler p_dil (varsayılan 'tr') ve p_dil_uyumu (varsayılan false).
drop function if exists public.oneri_gonder(text, text, text, text, text, text, text, text, integer, boolean, text);
create or replace function public.oneri_gonder(
  p_eser text, p_alan text, p_onerilen text, p_kaynak text, p_konum text,
  p_url text, p_dosya_yolu text, p_dosya_turu text, p_dosya_boyutu integer, p_hak_onayi boolean, p_kaynak_turu text,
  p_dil text default 'tr', p_dil_uyumu boolean default false
) returns bigint language plpgsql security definer set search_path = public as $$
declare yeni_id bigint;
begin
  if auth.uid() is null then raise exception 'giris gerekli' using errcode = '42501'; end if;
  if not exists (select 1 from kullanici_rolleri where kullanici = auth.uid())
     and (select count(*) from bilgi_onerileri where kullanici = auth.uid() and olusturuldu > now() - interval '1 day') >= 20 then
    raise exception 'gunluk oneri siniri doldu' using errcode = 'P0001', hint = 'gunluk_sinir';
  end if;
  if p_kaynak is not null and not exists (select 1 from kaynak_kutuphanesi where id = p_kaynak and durum = 'dogrulandi') then
    raise exception 'kaynak dogrulanmis degil';
  end if;
  if p_dosya_yolu is not null and split_part(p_dosya_yolu, '/', 1) <> auth.uid()::text then
    raise exception 'dosya bu kullaniciya ait degil' using errcode = '42501';
  end if;
  insert into bilgi_onerileri (eser_id, alan, onerilen, kaynak_id, konum, url, kaynak_turu, dosya_yolu, dosya_turu, dosya_boyutu, hak_onayi, kullanici, kullanici_ad,
                               dil, dil_uyumu)
  values (p_eser, p_alan, btrim(p_onerilen), p_kaynak, nullif(btrim(coalesce(p_konum, '')), ''), p_url,
          case when p_url is not null or p_dosya_yolu is not null then p_kaynak_turu end, p_dosya_yolu, p_dosya_turu, p_dosya_boyutu,
          coalesce(p_hak_onayi, false), auth.uid(), benim_adim(),
          coalesce(p_dil, 'tr'), coalesce(p_dil_uyumu, false))
  returning id into yeni_id;
  perform denetime_yaz('oneri_gonder', p_eser, null, jsonb_build_array(jsonb_build_object('alan', p_alan, 'eski', null, 'yeni', left(btrim(p_onerilen), 500))), null);
  return yeni_id;
end $$;

revoke execute on function public.surum_gonder(text, text, jsonb, text, bigint, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.surum_gonder(text, text, jsonb, text, bigint, text, text, text, boolean, boolean) to authenticated;
revoke execute on function public.oneri_gonder(text, text, text, text, text, text, text, text, integer, boolean, text, text, boolean) from public, anon;
grant execute on function public.oneri_gonder(text, text, text, text, text, text, text, text, integer, boolean, text, text, boolean) to authenticated;
-- PostgREST'in fonksiyon listesini yenilemesi için.
notify pgrst, 'reload schema';
