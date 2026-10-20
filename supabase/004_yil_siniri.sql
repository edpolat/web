-- Aşama 3 düzeltmesi: kaynak yılı gelecekte olamaz (1 ile bu yıl arası).
-- 003_kaynaklar.sql'i zaten çalıştırdıysan bunu çalıştır. Tekrar çalıştırmak güvenli.

create or replace function public.kaynak_ekle(
  p_id text, p_baslik text, p_tur text, p_nitelik text, p_kaynak_turu text, p_url text,
  p_dosya_yolu text, p_dosya_turu text, p_dosya_boyutu integer, p_yazar text, p_yayinci text, p_yil integer, p_not text
) returns text language plpgsql security definer set search_path = public as $$
begin
  if not (izin_var('eser.ekle') or izin_var('eser.duzenle')) then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_dosya_yolu is not null and split_part(p_dosya_yolu, '/', 1) <> auth.uid()::text then
    raise exception 'dosya bu kullaniciya ait degil' using errcode = '42501';
  end if;
  if p_yil is not null and (p_yil < 1 or p_yil > extract(year from now())::int) then
    raise exception 'yil gecersiz' using errcode = '22023';
  end if;
  insert into kaynak_kutuphanesi (id, baslik, tur, nitelik, kaynak_turu, url, dosya_yolu, dosya_turu, dosya_boyutu, yazar, yayinci, yil, aciklama, ekleyen, ekleyen_ad)
  values (p_id, btrim(p_baslik), p_tur, p_nitelik, p_kaynak_turu, p_url, p_dosya_yolu, p_dosya_turu, p_dosya_boyutu, p_yazar, p_yayinci, p_yil, p_not, auth.uid(), benim_adim());
  perform denetime_yaz('kaynak_ekle', p_id, null, null, null);
  return p_id;
end $$;

-- Daha önce girilmiş gelecek yılları boşalt (yalnız test kayıtları).
update public.kaynak_kutuphanesi set yil = null where yil > extract(year from now())::int or yil < 1;
