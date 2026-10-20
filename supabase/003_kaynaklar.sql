-- Aşama 3: kaynak kütüphanesi, bilgiye bağlı kaynaklar ve kaynak dosyaları. 002'den sonra çalıştırılır; tekrar çalıştırmak zarar vermez.
-- Kaynaklar ayrı tabloda durur ve birçok eserde kullanılır. Kaynak esere değil eserin bir bilgisine bağlanır:
-- eser + alan + değer + kaynak + konum (ör. sayfa). Dosyalar herkese kapalı "kaynak-dosyalari" kovasında durur.

create table if not exists public.kaynak_kutuphanesi (
  id text primary key,
  baslik text not null,
  tur text not null default 'baglanti' check (tur in ('dosya', 'baglanti', 'kayit')),
  nitelik text not null default 'ikincil' check (nitelik in ('birincil', 'ikincil', 'ucuncul')),
  kaynak_turu text not null default 'diger'
    check (kaynak_turu in ('vakfiye', 'arsiv', 'envanter_kitabi', 'akademik', 'kitap', 'kurum_sitesi', 'web', 'haber', 'diger')),
  url text,
  dosya_yolu text unique,
  dosya_turu text,
  dosya_boyutu integer,
  yazar text,
  yayinci text,
  yil integer,
  durum text not null default 'dogrulanmamis' check (durum in ('dogrulanmamis', 'dogrulandi', 'reddedildi')),
  herkese_acik boolean not null default false,
  ekleyen uuid references auth.users (id),
  ekleyen_ad text,
  eklendi timestamptz not null default now(),
  dogrulayan uuid references auth.users (id),
  dogrulayan_ad text,
  dogrulama_tarihi timestamptz,
  aciklama text,
  ret_gerekcesi text,
  check (tur <> 'dosya' or dosya_yolu is not null),
  check (tur <> 'baglanti' or url ~ '^https?://')
);

-- veri/kaynaklar.json'daki kaynaklar doğrulanmış olarak (kimlikleri aynı).
insert into public.kaynak_kutuphanesi (id, baslik, tur, nitelik, kaynak_turu, url, yazar, yayinci, yil, aciklama, durum, herkese_acik, dogrulayan_ad, dogrulama_tarihi)
select x.*, 'dogrulandi', true, 'veri/kaynaklar.json', now() from (values
  ('vk-bursa-envanter-c1-2', 'Bursa Vakıf Eserleri, I. ve II. Cilt (Osmangazi, Yıldırım)', 'kayit', 'ikincil', 'envanter_kitabi', null, null, 'Vakıf Katılım', 2025, 'Kitabın web sürümü bölümlerinden alındı (Web Sürümü.zip). Sayfa numaraları kitaba aittir.'),
  ('vk-bursa-envanter-c3', 'Bursa Vakıf Eserleri, III. Cilt (Diğer İlçeler)', 'kayit', 'ikincil', 'envanter_kitabi', null, null, 'Vakıf Katılım', 2025, 'Kitabın web sürümü bölümlerinden alındı (Web Sürümü.zip). Sayfa numaraları kitaba aittir.'),
  ('unesco-1452', 'Bursa and Cumalıkızık: the Birth of the Ottoman Empire', 'baglanti', 'ucuncul', 'kurum_sitesi', 'https://whc.unesco.org/en/list/1452', null, 'UNESCO World Heritage Centre', 2014, null),
  ('vk-konya-envanter-c1', 'Konya Vakıf Eserleri Envanteri, I. Cilt', 'kayit', 'ikincil', 'envanter_kitabi', null, null, 'Vakıf Katılım', 2024, 'Kitabın web PDF''inden (konya-envanteri-1_cilt-web.pdf) yazı tipine göre otomatik ayrıştırıldı. Sayfa numaraları kitaba aittir. Konumlar ilçe merkezidir; konum_bul.py ile adresten düzeltilir.'),
  ('vk-konya-envanter-c2', 'Konya Vakıf Eserleri Envanteri, II. Cilt', 'kayit', 'ikincil', 'envanter_kitabi', null, null, 'Vakıf Katılım', 2024, 'Kitabın web PDF''inden (konya-envanteri-2_cilt-web.pdf) yazı tipine göre otomatik ayrıştırıldı. Sayfa numaraları kitaba aittir. Konumlar ilçe merkezidir; konum_bul.py ile adresten düzeltilir.'),
  ('vk-hatay-envanter', 'Hatay İli Vakıf Eserleri', 'kayit', 'ikincil', 'envanter_kitabi', null, null, 'Vakıf Katılım', 2022, 'Kitabın PDF''inden (hatay-vakif-eserleri.pdf) otomatik ayrıştırıldı. Kitap 2023 depremlerinden önce yayımlandı. Konumlar ilçe merkezidir.')
) as x (id, baslik, tur, nitelik, kaynak_turu, url, yazar, yayinci, yil, aciklama)
on conflict (id) do nothing;

create table if not exists public.bilgi_kaynaklari (
  id bigint generated always as identity primary key,
  eser_id text not null,
  alan text not null,
  deger text,
  kaynak_id text not null references public.kaynak_kutuphanesi (id),
  konum text,
  surum_id bigint references public.eser_surumleri (id),
  ekleyen uuid references auth.users (id),
  ekleyen_ad text,
  eklendi timestamptz not null default now()
);
create index if not exists bilgi_kaynaklari_eser on public.bilgi_kaynaklari (eser_id, alan);
create index if not exists bilgi_kaynaklari_kaynak on public.bilgi_kaynaklari (kaynak_id);

alter table public.kaynak_kutuphanesi enable row level security;
alter table public.bilgi_kaynaklari enable row level security;

-- Doğrulanmış kaynaklar herkese görünür; panel kullanıcıları hepsini, ekleyen kendi eklediğini görür.
drop policy if exists "dogrulanmis kaynaklar acik" on public.kaynak_kutuphanesi;
create policy "dogrulanmis kaynaklar acik" on public.kaynak_kutuphanesi for select using (durum = 'dogrulandi');
drop policy if exists "panel ve ekleyen kaynaklari okur" on public.kaynak_kutuphanesi;
create policy "panel ve ekleyen kaynaklari okur" on public.kaynak_kutuphanesi for select to authenticated
  using (ekleyen = auth.uid() or exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));

drop policy if exists "bilgi kaynaklari okunur" on public.bilgi_kaynaklari;
create policy "bilgi kaynaklari okunur" on public.bilgi_kaynaklari for select
  using (exists (select 1 from public.kaynak_kutuphanesi k where k.id = kaynak_id and k.durum = 'dogrulandi'));
drop policy if exists "panel bilgi kaynaklarini okur" on public.bilgi_kaynaklari;
create policy "panel bilgi kaynaklarini okur" on public.bilgi_kaynaklari for select to authenticated
  using (exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));

-- Kaynak ekleme: panelde eser ekleyip düzenleyebilenler. Yeni kaynak doğrulanmamış girer.
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

-- Doğrulama (kaynak.dogrula): durum ve herkese açıklık. Reddetmede gerekçe zorunlu.
create or replace function public.kaynak_dogrula(p_id text, p_durum text, p_herkese_acik boolean, p_gerekce text)
returns void language plpgsql security definer set search_path = public as $$
declare k kaynak_kutuphanesi;
begin
  if not izin_var('kaynak.dogrula') then raise exception 'yetki yok' using errcode = '42501'; end if;
  select * into k from kaynak_kutuphanesi where id = p_id for update;
  if k.id is null then raise exception 'kaynak bulunamadi'; end if;
  if p_durum = 'reddedildi' and coalesce(btrim(p_gerekce), '') = '' then raise exception 'reddetmek icin gerekce zorunlu'; end if;
  update kaynak_kutuphanesi
  set durum = p_durum,
      herkese_acik = p_durum = 'dogrulandi' and coalesce(p_herkese_acik, false),
      dogrulayan = auth.uid(), dogrulayan_ad = benim_adim(), dogrulama_tarihi = now(),
      ret_gerekcesi = case when p_durum = 'reddedildi' then btrim(p_gerekce) else null end
  where id = p_id;
  perform denetime_yaz('kaynak_dogrula', p_id, null,
    jsonb_build_array(jsonb_build_object('alan', 'durum', 'eski', k.durum, 'yeni', p_durum),
                      jsonb_build_object('alan', 'herkese_acik', 'eski', k.herkese_acik, 'yeni', p_durum = 'dogrulandi' and coalesce(p_herkese_acik, false))),
    nullif(btrim(coalesce(p_gerekce, '')), ''));
end $$;

-- Bir bilgiyi kaynağa bağlar (eser.duzenle).
create or replace function public.bilgi_kaynagi_ekle(p_eser text, p_alan text, p_deger text, p_kaynak text, p_konum text)
returns bigint language plpgsql security definer set search_path = public as $$
declare yeni_id bigint;
begin
  if not izin_var('eser.duzenle') then raise exception 'yetki yok' using errcode = '42501'; end if;
  insert into bilgi_kaynaklari (eser_id, alan, deger, kaynak_id, konum, ekleyen, ekleyen_ad)
  values (p_eser, p_alan, p_deger, p_kaynak, nullif(btrim(coalesce(p_konum, '')), ''), auth.uid(), benim_adim())
  returning id into yeni_id;
  perform denetime_yaz('bilgi_kaynagi_ekle', p_eser, null, jsonb_build_array(jsonb_build_object('alan', p_alan, 'eski', null, 'yeni', p_kaynak)), null);
  return yeni_id;
end $$;

-- Onaylanan sürümün değişen her alanı, sürümün kaynağına ve sayfasına otomatik bağlanır (002'deki surum_karar + bilgi kaynakları).
create or replace function public.surum_karar(p_id bigint, p_onay boolean, p_gerekce text, p_degisiklikler jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s eser_surumleri; d jsonb;
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
  if p_onay and s.kaynak_id is not null and exists (select 1 from kaynak_kutuphanesi where id = s.kaynak_id) and p_degisiklikler is not null then
    for d in select * from jsonb_array_elements(p_degisiklikler) loop
      insert into bilgi_kaynaklari (eser_id, alan, deger, kaynak_id, konum, surum_id, ekleyen, ekleyen_ad)
      values (s.eser_id, d->>'alan', left(coalesce(d->'yeni'->>'tr', d->>'yeni'), 500), s.kaynak_id, s.sayfa, p_id, s.ekleyen, s.ekleyen_ad);
    end loop;
  end if;
end $$;

-- Dosya kovası: herkese kapalı, en fazla 10 MB, yalnız PDF/JPG/PNG. Dosya türü ayrıca sunucuda içerikten denetlenir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kaynak-dosyalari', 'kaynak-dosyalari', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Herkes yalnız kendi klasörüne (<kullanıcı kimliği>/...) yükler ve oradaki geçersiz dosyayı silebilir.
drop policy if exists "kaynak dosyasi yukle" on storage.objects;
create policy "kaynak dosyasi yukle" on storage.objects for insert to authenticated
  with check (bucket_id = 'kaynak-dosyalari' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "kaynak dosyasi sil" on storage.objects;
create policy "kaynak dosyasi sil" on storage.objects for delete to authenticated
  using (bucket_id = 'kaynak-dosyalari' and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from public.kaynak_kutuphanesi k where k.dosya_yolu = name));
-- Okuma: sahibi ve panel kullanıcıları; ziyaretçi yalnız doğrulanmış ve herkese açık kaynağın dosyasını (süreli bağlantıyla).
drop policy if exists "kaynak dosyasi oku" on storage.objects;
create policy "kaynak dosyasi oku" on storage.objects for select
  using (bucket_id = 'kaynak-dosyalari' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid())
    or exists (select 1 from public.kaynak_kutuphanesi k where k.dosya_yolu = name and k.durum = 'dogrulandi' and k.herkese_acik)
  ));

revoke execute on function public.kaynak_ekle(text, text, text, text, text, text, text, text, integer, text, text, integer, text) from public, anon;
revoke execute on function public.kaynak_dogrula(text, text, boolean, text) from public, anon;
revoke execute on function public.bilgi_kaynagi_ekle(text, text, text, text, text) from public, anon;
grant execute on function public.kaynak_ekle(text, text, text, text, text, text, text, text, integer, text, text, integer, text) to authenticated;
grant execute on function public.kaynak_dogrula(text, text, boolean, text) to authenticated;
grant execute on function public.bilgi_kaynagi_ekle(text, text, text, text, text) to authenticated;
-- Supabase yeni tabloları API'ye kendiliğinden açmıyor: yalnız okuma izni (yazma yalnız fonksiyonlarla).
grant select on public.kaynak_kutuphanesi, public.bilgi_kaynaklari to anon, authenticated;
