-- Sergiler: yönetim panelinden eklenir, düzenlenir ve silinir (/yonetim/sergiler). 016'dan sonra çalıştırılır; tekrar çalıştırmak zarar vermez.
-- veri/sergiler.json'daki sergiler tabloya taşınır (kimlikleri aynı, eserlerin sergi_idleri bozulmaz). Tablo varken site sergileri buradan okur;
-- tablo yoksa ya da Supabase'e ulaşılamazsa veri/sergiler.json'a döner.
-- Yetki: yeni izin sergi.yonet (Sistem yöneticisi ve Yayın editörü). Her işlem denetim kaydına "sergi:<kimlik>" hedefiyle yazılır.

-- Rol ve izinler (lib/yetki.ts ROL_IZINLERI ile aynı olmalı).
insert into public.rol_izinleri (rol, izin) values
  ('super_admin', 'sergi.yonet'),
  ('editor', 'sergi.yonet')
on conflict do nothing;

create table if not exists public.sergiler (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  ad_tr text not null check (char_length(btrim(ad_tr)) between 2 and 150),
  ad_en text check (char_length(ad_en) <= 150),
  sehir text check (char_length(sehir) <= 60),
  yer text check (char_length(yer) <= 300),
  harita text check (char_length(harita) <= 200),
  baslangic date,
  bitis date,
  aciklama_tr text check (char_length(aciklama_tr) <= 1500),
  aciklama_en text check (char_length(aciklama_en) <= 1500),
  url text check (url ~ '^https?://' and char_length(url) <= 500),
  kaynak_id text,
  ekleyen uuid references auth.users (id),
  ekleyen_ad text,
  olusturuldu timestamptz not null default now(),
  guncelleyen_ad text,
  guncellendi timestamptz,
  check (bitis is null or baslangic is null or bitis >= baslangic)
);

-- veri/sergiler.json'daki 6 sergi (2 Kas 2026). Var olan kimliğe dokunulmaz.
insert into public.sergiler (id, ad_tr, ad_en, sehir, yer, harita, baslangic, bitis, aciklama_tr, aciklama_en, url, kaynak_id, ekleyen_ad)
select x.*, 'veri/sergiler.json' from (values
  ('bursa-700-yil', 'Bursa Vakıf Eserleri Fotoğraf Sergisi', null, 'Bursa', 'Tophane Meydanı; yıl boyunca Orhangazi, Çarşıbaşı, Emir Sultan ve UNESCO meydanları ile Cumhuriyet Caddesi', 'Tophane Meydanı, Osmangazi, Bursa', date '2026-04-07', date '2026-12-31', 'Bursa''nın fethinin 700. yılı için Bursa Valiliği ile birlikte. Envanter kitabından seçilmiş 276 fotoğraf açık havada.', null, 'https://www.yenisafak.com/hayat/vakif-eserleri-sergilendi-4812779', null),
  ('bir-ruyanin-izinde', 'Bir Rüyanın İzinde', null, 'Bursa', 'Tayyare Kültür Merkezi', 'Tayyare Kültür Merkezi, Bursa', date '2026-09-17', null::date, 'Bursa Vakıf Eserleri kitabından seçilen 320 eserin fotoğraflarıyla fotoğraf ve deneyim sergisi.', null, 'https://www.ekonomigazetesi.com/sehirler/vakif-katilim-bursanin-vakif-mirasini-gelecege-tasiyor-87828', null),
  ('istanbulu-goren-ruya-bursa', 'İstanbul''u Gören Rüya: Bursa', null, 'İstanbul', 'Üsküdar Mimar Sinan Sanat Galerisi', 'Mimar Sinan Sanat Galerisi, Üsküdar, İstanbul', date '2026-09-04', date '2026-09-30', 'Bursa''daki 385 vakıf eserini belgeleyen yaklaşık 35 bin kareden seçilen 87 fotoğraf.', null, 'https://www.dha.com.tr/video/vakif-eserleri-bursanin-tarihi-mirasini-fotograflarla-istanbula-tasidi-video-2939085', null),
  ('ayna', 'AYNA – Anadolu Göğünün İpek Mahyası', null, 'Konya', 'Depo No:4', 'Depo No 4, Konya', date '2025-09-19', date '2026-06-30', 'Konya vakıf eserleri fotoğraf ve deneyim sergisi; Konya Büyükşehir Belediyesi tarafından Vakıf Eserleri Envanter Projesi kapsamında hazırlandı.', null, 'https://www.gazetebirlik.com/kultur-sanat/konyanin-bin-yillik-hafizasi-gun-yuzune-cikiyor-ayna-vakif-eserleri-sergisi-ziyarete-acildi/905178', null),
  ('konya-fotograf-sergisi-istanbul', 'Konya Vakıf Eserleri Fotoğraf Sergisi', null, 'İstanbul', 'Üsküdar Mimar Sinan Galerisi', 'Mimar Sinan Sanat Galerisi, Üsküdar, İstanbul', date '2025-01-24', date '2025-03-10', 'İki ciltlik Konya Vakıf Eserleri Envanteri''nden seçilen 546 fotoğraf.', null, 'https://www.turkgun.com/kultur-sanat/vakif-katilimin-konya-vakif-eserleri-fotograf-sergisi-mimar-sinan-galerisinde-sanatseverlerle-bulustu/263268', null),
  ('5-subat-hatay', '5 Şubat Hatay', null, null, null, null, null::date, null::date, null, null, null, null)
) as x (id, ad_tr, ad_en, sehir, yer, harita, baslangic, bitis, aciklama_tr, aciklama_en, url, kaynak_id)
on conflict (id) do nothing;

alter table public.sergiler enable row level security;
drop policy if exists "sergiler herkese acik" on public.sergiler;
create policy "sergiler herkese acik" on public.sergiler for select using (true);

-- Ekleme ve düzenleme (sergi.yonet). p_yeni: true yeni kayıt (kimlik varsa hata), false var olanı günceller.
-- Değişen her alan denetim kaydına eski → yeni olarak yazılır.
create or replace function public.sergi_kaydet(
  p_id text, p_yeni boolean, p_ad_tr text, p_ad_en text, p_sehir text, p_yer text, p_harita text,
  p_baslangic date, p_bitis date, p_aciklama_tr text, p_aciklama_en text, p_url text
) returns text language plpgsql security definer set search_path = public as $$
declare eski sergiler; yeni sergiler; e jsonb; y jsonb; alan text; fark jsonb := '[]'::jsonb;
begin
  if not izin_var('sergi.yonet') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_bitis is not null and p_baslangic is not null and p_bitis < p_baslangic then
    raise exception 'bitis tarihi baslangictan once olamaz' using errcode = '22023';
  end if;
  if p_yeni then
    if exists (select 1 from sergiler where id = p_id) then raise exception 'bu kimlikte sergi zaten var' using errcode = '23505'; end if;
    insert into sergiler (id, ad_tr, ad_en, sehir, yer, harita, baslangic, bitis, aciklama_tr, aciklama_en, url, ekleyen, ekleyen_ad)
    values (p_id, btrim(p_ad_tr), nullif(btrim(p_ad_en), ''), nullif(btrim(p_sehir), ''), nullif(btrim(p_yer), ''), nullif(btrim(p_harita), ''),
            p_baslangic, p_bitis, nullif(btrim(p_aciklama_tr), ''), nullif(btrim(p_aciklama_en), ''), nullif(btrim(p_url), ''), auth.uid(), benim_adim())
    returning * into yeni;
    perform denetime_yaz('sergi_ekle', 'sergi:' || p_id, null,
      jsonb_build_array(jsonb_build_object('alan', 'ad_tr', 'eski', null, 'yeni', yeni.ad_tr)), null);
    return p_id;
  end if;

  select * into eski from sergiler where id = p_id for update;
  if eski.id is null then raise exception 'sergi bulunamadi'; end if;
  update sergiler set
    ad_tr = btrim(p_ad_tr), ad_en = nullif(btrim(p_ad_en), ''), sehir = nullif(btrim(p_sehir), ''), yer = nullif(btrim(p_yer), ''),
    harita = nullif(btrim(p_harita), ''), baslangic = p_baslangic, bitis = p_bitis, aciklama_tr = nullif(btrim(p_aciklama_tr), ''),
    aciklama_en = nullif(btrim(p_aciklama_en), ''), url = nullif(btrim(p_url), ''), guncelleyen_ad = benim_adim(), guncellendi = now()
  where id = p_id returning * into yeni;
  e := to_jsonb(eski); y := to_jsonb(yeni);
  foreach alan in array array['ad_tr', 'ad_en', 'sehir', 'yer', 'harita', 'baslangic', 'bitis', 'aciklama_tr', 'aciklama_en', 'url'] loop
    if e->alan is distinct from y->alan then
      fark := fark || jsonb_build_array(jsonb_build_object('alan', alan, 'eski', e->alan, 'yeni', y->alan));
    end if;
  end loop;
  if jsonb_array_length(fark) > 0 then perform denetime_yaz('sergi_duzenle', 'sergi:' || p_id, null, fark, null); end if;
  return p_id;
end $$;

-- Silme (sergi.yonet), gerekçe zorunlu. Silinen kaydın bütün alanları denetim kaydında kalır.
create or replace function public.sergi_sil(p_id text, p_gerekce text)
returns void language plpgsql security definer set search_path = public as $$
declare eski sergiler;
begin
  if not izin_var('sergi.yonet') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if coalesce(btrim(p_gerekce), '') = '' then raise exception 'silmek icin gerekce zorunlu' using errcode = '22023'; end if;
  delete from sergiler where id = p_id returning * into eski;
  if eski.id is null then raise exception 'sergi bulunamadi'; end if;
  perform denetime_yaz('sergi_sil', 'sergi:' || p_id, null,
    jsonb_build_array(jsonb_build_object('alan', 'sergi', 'eski', to_jsonb(eski) - 'ekleyen', 'yeni', null)), btrim(p_gerekce));
end $$;

revoke execute on function public.sergi_kaydet(text, boolean, text, text, text, text, text, date, date, text, text, text) from public, anon;
revoke execute on function public.sergi_sil(text, text) from public, anon;
grant execute on function public.sergi_kaydet(text, boolean, text, text, text, text, text, date, date, text, text, text) to authenticated;
grant execute on function public.sergi_sil(text, text) to authenticated;
-- Supabase yeni tabloları API'ye kendiliğinden açmıyor: yalnız okuma izni (yazma yalnız fonksiyonlarla).
grant select on public.sergiler to anon, authenticated;
