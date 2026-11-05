-- 023: Sergilere ilçe alanı (5 Kas). 017'den sonra çalıştırılır.
-- Panelde şehir 81 ilden, ilçe o ilin ilçelerinden açılır listeyle seçilir (doğrulama lib/sergi.ts).
-- sergi_kaydet'e p_ilce eklenir (varsayılan null): ilçesiz çağrılar eskisi gibi çalışır.

alter table public.sergiler add column if not exists ilce text check (char_length(ilce) <= 60);

drop function if exists public.sergi_kaydet(text, boolean, text, text, text, text, text, date, date, text, text, text);

create or replace function public.sergi_kaydet(
  p_id text, p_yeni boolean, p_ad_tr text, p_ad_en text, p_sehir text, p_yer text, p_harita text,
  p_baslangic date, p_bitis date, p_aciklama_tr text, p_aciklama_en text, p_url text, p_ilce text default null
) returns text language plpgsql security definer set search_path = public as $$
declare eski sergiler; yeni sergiler; e jsonb; y jsonb; alan text; fark jsonb := '[]'::jsonb;
begin
  if not izin_var('sergi.yonet') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_bitis is not null and p_baslangic is not null and p_bitis < p_baslangic then
    raise exception 'bitis tarihi baslangictan once olamaz' using errcode = '22023';
  end if;
  if nullif(btrim(p_ilce), '') is not null and nullif(btrim(p_sehir), '') is null then
    raise exception 'ilce secildiyse sehir de secilmeli' using errcode = '22023';
  end if;
  if p_yeni then
    if exists (select 1 from sergiler where id = p_id) then raise exception 'bu kimlikte sergi zaten var' using errcode = '23505'; end if;
    insert into sergiler (id, ad_tr, ad_en, sehir, ilce, yer, harita, baslangic, bitis, aciklama_tr, aciklama_en, url, ekleyen, ekleyen_ad)
    values (p_id, btrim(p_ad_tr), nullif(btrim(p_ad_en), ''), nullif(btrim(p_sehir), ''), nullif(btrim(p_ilce), ''), nullif(btrim(p_yer), ''),
            nullif(btrim(p_harita), ''), p_baslangic, p_bitis, nullif(btrim(p_aciklama_tr), ''), nullif(btrim(p_aciklama_en), ''),
            nullif(btrim(p_url), ''), auth.uid(), benim_adim())
    returning * into yeni;
    perform denetime_yaz('sergi_ekle', 'sergi:' || p_id, null,
      jsonb_build_array(jsonb_build_object('alan', 'ad_tr', 'eski', null, 'yeni', yeni.ad_tr)), null);
    return p_id;
  end if;

  select * into eski from sergiler where id = p_id for update;
  if eski.id is null then raise exception 'sergi bulunamadi'; end if;
  update sergiler set
    ad_tr = btrim(p_ad_tr), ad_en = nullif(btrim(p_ad_en), ''), sehir = nullif(btrim(p_sehir), ''), ilce = nullif(btrim(p_ilce), ''),
    yer = nullif(btrim(p_yer), ''), harita = nullif(btrim(p_harita), ''), baslangic = p_baslangic, bitis = p_bitis,
    aciklama_tr = nullif(btrim(p_aciklama_tr), ''), aciklama_en = nullif(btrim(p_aciklama_en), ''), url = nullif(btrim(p_url), ''),
    guncelleyen_ad = benim_adim(), guncellendi = now()
  where id = p_id returning * into yeni;
  e := to_jsonb(eski); y := to_jsonb(yeni);
  foreach alan in array array['ad_tr', 'ad_en', 'sehir', 'ilce', 'yer', 'harita', 'baslangic', 'bitis', 'aciklama_tr', 'aciklama_en', 'url'] loop
    if e->alan is distinct from y->alan then
      fark := fark || jsonb_build_array(jsonb_build_object('alan', alan, 'eski', e->alan, 'yeni', y->alan));
    end if;
  end loop;
  if jsonb_array_length(fark) > 0 then perform denetime_yaz('sergi_duzenle', 'sergi:' || p_id, null, fark, null); end if;
  return p_id;
end $$;

revoke execute on function public.sergi_kaydet(text, boolean, text, text, text, text, text, date, date, text, text, text, text) from public, anon;
grant execute on function public.sergi_kaydet(text, boolean, text, text, text, text, text, date, date, text, text, text, text) to authenticated;

-- Supabase API'nin yeni sütunu ve imzayı hemen görmesi için.
notify pgrst, 'reload schema';
