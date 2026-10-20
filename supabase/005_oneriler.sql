-- Aşama 4: halktan bilgi önerisi. 003'ten sonra çalıştırılır; tekrar çalıştırmak zarar vermez.
-- Öneriler ayrı kuyrukta bekler ve sitede hiçbir şeyi değiştirmez. Göndermek için hesapla giriş gerekir;
-- kişi başına günde en fazla 20 öneri (panelde rolü olanlara sınır yok; veritabanında zorlanır).
-- Kabul edilen öneri eserin yeni yayındaki sürümü olur; önerinin kendi bağlantısı/dosyası istenirse kütüphaneye
-- doğrulanmış kaynak olarak girer.

create table if not exists public.bilgi_onerileri (
  id bigint generated always as identity primary key,
  eser_id text not null,
  alan text not null check (alan in ('olgu', 'banisi', 'mimar', 'yapim_yili', 'adres', 'ad', 'diger')),
  onerilen text not null check (length(btrim(onerilen)) between 1 and 2000),
  kaynak_id text references public.kaynak_kutuphanesi (id),
  konum text,
  url text check (url is null or url ~ '^https?://'),
  kaynak_turu text,
  dosya_yolu text,
  dosya_turu text,
  dosya_boyutu integer,
  kaynaksiz boolean generated always as (kaynak_id is null and url is null and dosya_yolu is null) stored,
  hak_onayi boolean not null default false,
  kullanici uuid not null references auth.users (id),
  kullanici_ad text,
  olusturuldu timestamptz not null default now(),
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'kabul', 'reddedildi')),
  inceleyen uuid references auth.users (id),
  inceleyen_ad text,
  karar_tarihi timestamptz,
  ret_gerekcesi text,
  surum_id bigint references public.eser_surumleri (id),
  eklenen_kaynak_id text references public.kaynak_kutuphanesi (id),
  -- Dosya ekleyen, paylaşma hakkı ve kişisel veri onayını işaretlemek zorunda.
  check (dosya_yolu is null or hak_onayi)
);
-- Önerenin söylediği kaynak türü (vakfiye, arşiv belgesi, akademik yayın...). Nitelik buna göre önerilir.
alter table public.bilgi_onerileri add column if not exists kaynak_turu text;
alter table public.bilgi_onerileri drop constraint if exists bilgi_onerileri_kaynak_turu_check;
alter table public.bilgi_onerileri add constraint bilgi_onerileri_kaynak_turu_check
  check (kaynak_turu is null or kaynak_turu in ('vakfiye', 'arsiv', 'envanter_kitabi', 'akademik', 'kitap', 'kurum_sitesi', 'web', 'haber', 'diger'));
create index if not exists bilgi_onerileri_durum on public.bilgi_onerileri (durum, olusturuldu);
create index if not exists bilgi_onerileri_kullanici on public.bilgi_onerileri (kullanici, olusturuldu);

alter table public.bilgi_onerileri enable row level security;

-- Öneren kendi önerilerini (ve ret gerekçesini), panel kullanıcıları hepsini görür. Yazma yalnız fonksiyonlarla.
drop policy if exists "oneren ve panel onerileri okur" on public.bilgi_onerileri;
create policy "oneren ve panel onerileri okur" on public.bilgi_onerileri for select to authenticated
  using (kullanici = auth.uid() or exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));

-- Öneri gönder: giriş yapmış herkes. Günlük sınır, doğrulanmış kaynak ve dosyanın sahibi burada denetlenir.
drop function if exists public.oneri_gonder(text, text, text, text, text, text, text, text, integer, boolean);
create or replace function public.oneri_gonder(
  p_eser text, p_alan text, p_onerilen text, p_kaynak text, p_konum text,
  p_url text, p_dosya_yolu text, p_dosya_turu text, p_dosya_boyutu integer, p_hak_onayi boolean, p_kaynak_turu text
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
  insert into bilgi_onerileri (eser_id, alan, onerilen, kaynak_id, konum, url, kaynak_turu, dosya_yolu, dosya_turu, dosya_boyutu, hak_onayi, kullanici, kullanici_ad)
  values (p_eser, p_alan, btrim(p_onerilen), p_kaynak, nullif(btrim(coalesce(p_konum, '')), ''), p_url,
          case when p_url is not null or p_dosya_yolu is not null then p_kaynak_turu end, p_dosya_yolu, p_dosya_turu, p_dosya_boyutu,
          coalesce(p_hak_onayi, false), auth.uid(), benim_adim())
  returning id into yeni_id;
  perform denetime_yaz('oneri_gonder', p_eser, null, jsonb_build_array(jsonb_build_object('alan', p_alan, 'eski', null, 'yeni', left(btrim(p_onerilen), 500))), null);
  return yeni_id;
end $$;

-- Reddet (eser.onayla): gerekçe zorunlu, öneren görür.
create or replace function public.oneri_reddet(p_id bigint, p_gerekce text)
returns void language plpgsql security definer set search_path = public as $$
declare o bilgi_onerileri;
begin
  if not izin_var('eser.onayla') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if coalesce(btrim(p_gerekce), '') = '' then raise exception 'reddetmek icin gerekce zorunlu'; end if;
  select * into o from bilgi_onerileri where id = p_id for update;
  if o.id is null then raise exception 'oneri bulunamadi'; end if;
  if o.durum <> 'bekliyor' then raise exception 'oneri zaten karara baglandi'; end if;
  update bilgi_onerileri
  set durum = 'reddedildi', inceleyen = auth.uid(), inceleyen_ad = benim_adim(), karar_tarihi = now(), ret_gerekcesi = btrim(p_gerekce)
  where id = p_id;
  perform denetime_yaz('oneri_reddet', o.eser_id, null, null, btrim(p_gerekce));
end $$;

-- Kabul (eser.onayla): tek işlemde
--   1) istenirse önerinin bağlantısı/dosyası kütüphaneye doğrulanmış kaynak olarak girer (kaynak.dogrula),
--   2) sunucunun hazırlayıp şemaya göre denetlediği yeni hâl yayındaki sürüm olur (ekleyen: öneren kişi),
--   3) bilgi kaynağa bağlanır, öneri "kabul" olur.
-- p_kutuphane: null ya da { id, baslik, kaynak_turu, nitelik, herkese_acik }.
create or replace function public.oneri_kabul(
  p_id bigint, p_il text, p_veri jsonb, p_temel bigint, p_degisiklikler jsonb,
  p_alan text, p_deger text, p_kaynak text, p_konum text, p_kutuphane jsonb
) returns bigint language plpgsql security definer set search_path = public as $$
declare o bilgi_onerileri; kaynak text := p_kaynak; yeni_id bigint;
begin
  if not izin_var('eser.onayla') then raise exception 'yetki yok' using errcode = '42501'; end if;
  select * into o from bilgi_onerileri where id = p_id for update;
  if o.id is null then raise exception 'oneri bulunamadi'; end if;
  if o.durum <> 'bekliyor' then raise exception 'oneri zaten karara baglandi'; end if;
  -- Kaynak ve konum verilmezse önerideki kullanılır.
  kaynak := coalesce(kaynak, o.kaynak_id);
  p_konum := coalesce(nullif(btrim(coalesce(p_konum, '')), ''), o.konum);

  if p_kutuphane is not null then
    if not izin_var('kaynak.dogrula') then raise exception 'yetki yok' using errcode = '42501'; end if;
    if o.url is null and o.dosya_yolu is null then raise exception 'onerinin kendi kaynagi yok'; end if;
    insert into kaynak_kutuphanesi (id, baslik, tur, nitelik, kaynak_turu, url, dosya_yolu, dosya_turu, dosya_boyutu,
                                    durum, herkese_acik, ekleyen, ekleyen_ad, dogrulayan, dogrulayan_ad, dogrulama_tarihi, aciklama)
    values (p_kutuphane->>'id', btrim(p_kutuphane->>'baslik'), case when o.dosya_yolu is not null then 'dosya' else 'baglanti' end,
            coalesce(p_kutuphane->>'nitelik', 'ikincil'), coalesce(p_kutuphane->>'kaynak_turu', 'diger'),
            o.url, o.dosya_yolu, o.dosya_turu, o.dosya_boyutu,
            'dogrulandi', coalesce((p_kutuphane->>'herkese_acik')::boolean, false), o.kullanici, o.kullanici_ad,
            auth.uid(), benim_adim(), now(), 'Bilgi önerisi #' || o.id);
    kaynak := p_kutuphane->>'id';
    perform denetime_yaz('kaynak_ekle', kaynak, null, null, 'Bilgi önerisi #' || o.id);
  elsif kaynak is not null and not exists (select 1 from kaynak_kutuphanesi where id = kaynak and durum = 'dogrulandi') then
    raise exception 'kaynak dogrulanmis degil';
  end if;

  insert into eser_surumleri (eser_id, il, veri, durum, islem, temel_surum, kaynak_id, sayfa, aciklama,
                              ekleyen, ekleyen_ad, inceleyen, inceleyen_ad, karar_tarihi)
  values (o.eser_id, p_il, p_veri, 'yayinda', 'duzenle', p_temel, kaynak, nullif(btrim(coalesce(p_konum, '')), ''),
          'Bilgi önerisi #' || o.id, o.kullanici, o.kullanici_ad, auth.uid(), benim_adim(), now())
  returning id into yeni_id;
  perform denetime_yaz('oneri_kabul', o.eser_id, yeni_id, p_degisiklikler, null);

  if kaynak is not null then
    insert into bilgi_kaynaklari (eser_id, alan, deger, kaynak_id, konum, surum_id, ekleyen, ekleyen_ad)
    values (o.eser_id, p_alan, left(p_deger, 500), kaynak, nullif(btrim(coalesce(p_konum, '')), ''), yeni_id, o.kullanici, o.kullanici_ad);
  end if;

  update bilgi_onerileri
  set durum = 'kabul', inceleyen = auth.uid(), inceleyen_ad = benim_adim(), karar_tarihi = now(),
      surum_id = yeni_id, eklenen_kaynak_id = case when p_kutuphane is not null then kaynak else null end
  where id = p_id;
  return yeni_id;
end $$;

revoke execute on function public.oneri_gonder(text, text, text, text, text, text, text, text, integer, boolean, text) from public, anon;
revoke execute on function public.oneri_reddet(bigint, text) from public, anon;
revoke execute on function public.oneri_kabul(bigint, text, jsonb, bigint, jsonb, text, text, text, text, jsonb) from public, anon;
grant execute on function public.oneri_gonder(text, text, text, text, text, text, text, text, integer, boolean, text) to authenticated;
grant execute on function public.oneri_reddet(bigint, text) to authenticated;
grant execute on function public.oneri_kabul(bigint, text, jsonb, bigint, jsonb, text, text, text, text, jsonb) to authenticated;
-- Supabase yeni tabloları API'ye kendiliğinden açmıyor: yalnız okuma izni (yazma yalnız fonksiyonlarla).
grant select on public.bilgi_onerileri to authenticated;
