-- İki aşamalı onay: her yeni bilgi önce tarihçiye, sonra editöre gider. 001-013'ten sonra çalıştırılır; tekrar çalıştırmak zarar vermez.
--
--   gönderilen düzenleme / kabul edilen halk önerisi
--     → incelemede  (tarihçi kuyruğu, izin eser.incele): düzeltip ilerletir ya da gerekçeyle reddeder
--     → editorde    (editör kuyruğu, izin eser.onayla): yayına alır ya da gerekçeyle tarihçiye geri gönderir
--     → yayinda
--   Aynı kişi bir sürümün iki aşamasını birden geçemez. Atlama yolu yok; "eski sürüme dön" ve "arşivle" yeni içerik yayınlamadığı için aynen kalır.
--   Kaynak doğrulama, halk önerileri ve uygulama talepleri tarihçiye geçer. Yeni il yalnız editör onayıyla girer (değişmedi).

-- Rol ve izinler (lib/yetki.ts ROL_IZINLERI ile aynı olmalı).
alter table public.kullanici_rolleri drop constraint if exists kullanici_rolleri_rol_check;
alter table public.kullanici_rolleri add constraint kullanici_rolleri_rol_check
  check (rol in ('super_admin', 'editor', 'tarihci', 'katkici', 'goruntuleyici'));
insert into public.rol_izinleri (rol, izin) values
  ('super_admin', 'eser.incele'),
  ('tarihci', 'eser.incele'),
  ('tarihci', 'kaynak.dogrula')
on conflict do nothing;
delete from public.rol_izinleri where rol = 'editor' and izin = 'kaynak.dogrula';

-- Sürümde tarihçi aşaması: kim, ne zaman, notu; tarihçi düzelttiyse gönderilen ilk hâl ilk_veri'de saklanır.
alter table public.eser_surumleri add column if not exists tarihci uuid references auth.users (id);
alter table public.eser_surumleri add column if not exists tarihci_ad text;
alter table public.eser_surumleri add column if not exists tarihci_tarihi timestamptz;
alter table public.eser_surumleri add column if not exists tarihci_notu text;
alter table public.eser_surumleri add column if not exists ilk_veri jsonb;
alter table public.eser_surumleri add column if not exists editor_notu text;
alter table public.eser_surumleri drop constraint if exists eser_surumleri_durum_check;
alter table public.eser_surumleri add constraint eser_surumleri_durum_check
  check (durum in ('taslak', 'incelemede', 'editorde', 'yayinda', 'reddedildi'));

-- Tarihçi kararı (eser.incele). İlerletirken p_veri verilirse sürüm onunla değişir (ilk hâl saklanır, değişiklikler denetim kaydına).
-- Reddetmede gerekçe zorunlu.
create or replace function public.surum_tarihci_karar(p_id bigint, p_ilerlet boolean, p_veri jsonb, p_not text, p_degisiklikler jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s eser_surumleri; nott text := nullif(btrim(coalesce(p_not, '')), '');
begin
  if not izin_var('eser.incele') then raise exception 'yetki yok' using errcode = '42501'; end if;
  select * into s from eser_surumleri where id = p_id for update;
  if s.id is null or s.durum <> 'incelemede' then raise exception 'bu surum tarihci incelemesinde degil'; end if;
  if not p_ilerlet then
    if nott is null then raise exception 'reddetmek icin gerekce zorunlu'; end if;
    update eser_surumleri
    set durum = 'reddedildi', tarihci = auth.uid(), tarihci_ad = benim_adim(), tarihci_tarihi = now(),
        inceleyen = auth.uid(), inceleyen_ad = benim_adim(), karar_tarihi = now(), ret_gerekcesi = nott
    where id = p_id;
    perform denetime_yaz('tarihci_reddet', s.eser_id, p_id, null, nott);
    return;
  end if;
  update eser_surumleri
  set durum = 'editorde', tarihci = auth.uid(), tarihci_ad = benim_adim(), tarihci_tarihi = now(), tarihci_notu = nott,
      ilk_veri = case when p_veri is not null and p_veri <> s.veri then coalesce(s.ilk_veri, s.veri) else s.ilk_veri end,
      veri = coalesce(p_veri, s.veri), editor_notu = null
  where id = p_id;
  perform denetime_yaz('tarihci_ilerlet', s.eser_id, p_id,
                       case when p_veri is not null and p_veri <> s.veri then p_degisiklikler else null end, nott);
end $$;

-- Editör kararı (eser.onayla): yalnız tarihçiden geçmiş sürüm, tarihçiyle aynı kişi olmamak koşuluyla.
-- Onay: yayına girer, değişen alanlar sürümün kaynağına bağlanır (003'teki gibi). Ret: gerekçeyle tarihçiye geri döner.
create or replace function public.surum_karar(p_id bigint, p_onay boolean, p_gerekce text, p_degisiklikler jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s eser_surumleri; d jsonb; gerekce text := nullif(btrim(coalesce(p_gerekce, '')), '');
begin
  if not izin_var('eser.onayla') then raise exception 'yetki yok' using errcode = '42501'; end if;
  select * into s from eser_surumleri where id = p_id for update;
  if s.id is null or s.durum <> 'editorde' then raise exception 'bu surum editor onayinda degil'; end if;
  if s.tarihci = auth.uid() then raise exception 'tarihci olarak inceledigin surumu editor olarak onaylayamazsin' using errcode = '42501'; end if;
  if not p_onay then
    if gerekce is null then raise exception 'geri gondermek icin gerekce zorunlu'; end if;
    update eser_surumleri set durum = 'incelemede', editor_notu = gerekce where id = p_id;
    perform denetime_yaz('editor_geri_gonder', s.eser_id, p_id, null, gerekce);
    return;
  end if;
  update eser_surumleri
  set durum = 'yayinda', inceleyen = auth.uid(), inceleyen_ad = benim_adim(), karar_tarihi = now(), ret_gerekcesi = null
  where id = p_id;
  perform denetime_yaz('onayla', s.eser_id, p_id, p_degisiklikler, gerekce);
  if s.kaynak_id is not null and exists (select 1 from kaynak_kutuphanesi where id = s.kaynak_id) and p_degisiklikler is not null then
    for d in select * from jsonb_array_elements(p_degisiklikler) loop
      insert into bilgi_kaynaklari (eser_id, alan, deger, kaynak_id, konum, surum_id, ekleyen, ekleyen_ad)
      values (s.eser_id, d->>'alan', left(coalesce(d->'yeni'->>'tr', d->>'yeni'), 500), s.kaynak_id, s.sayfa, p_id, s.ekleyen, s.ekleyen_ad);
    end loop;
  end if;
end $$;

-- Halk önerileri tarihçiye (005'teki işlevlerin izni eser.incele; kabul edilen öneri editör onayına gider).
create or replace function public.oneri_reddet(p_id bigint, p_gerekce text)
returns void language plpgsql security definer set search_path = public as $$
declare o bilgi_onerileri;
begin
  if not izin_var('eser.incele') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if coalesce(btrim(p_gerekce), '') = '' then raise exception 'reddetmek icin gerekce zorunlu'; end if;
  select * into o from bilgi_onerileri where id = p_id for update;
  if o.id is null then raise exception 'oneri bulunamadi'; end if;
  if o.durum <> 'bekliyor' then raise exception 'oneri zaten karara baglandi'; end if;
  update bilgi_onerileri
  set durum = 'reddedildi', inceleyen = auth.uid(), inceleyen_ad = benim_adim(), karar_tarihi = now(), ret_gerekcesi = btrim(p_gerekce)
  where id = p_id;
  perform denetime_yaz('oneri_reddet', o.eser_id, null, null, btrim(p_gerekce));
end $$;

create or replace function public.oneri_kabul(
  p_id bigint, p_il text, p_veri jsonb, p_temel bigint, p_degisiklikler jsonb,
  p_alan text, p_deger text, p_kaynak text, p_konum text, p_kutuphane jsonb
) returns bigint language plpgsql security definer set search_path = public as $$
declare o bilgi_onerileri; kaynak text := p_kaynak; yeni_id bigint;
begin
  if not izin_var('eser.incele') then raise exception 'yetki yok' using errcode = '42501'; end if;
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

  -- 015: öneri artık doğrudan yayına girmez; tarihçinin hazırladığı sürüm editör onayını bekler.
  -- Bilgi-kaynak bağı editör onaylayınca surum_karar'da kurulur.
  insert into eser_surumleri (eser_id, il, veri, durum, islem, temel_surum, kaynak_id, sayfa, aciklama,
                              ekleyen, ekleyen_ad, tarihci, tarihci_ad, tarihci_tarihi)
  values (o.eser_id, p_il, p_veri, 'editorde', 'duzenle', p_temel, kaynak, nullif(btrim(coalesce(p_konum, '')), ''),
          'Bilgi önerisi #' || o.id, o.kullanici, o.kullanici_ad, auth.uid(), benim_adim(), now())
  returning id into yeni_id;
  perform denetime_yaz('oneri_kabul', o.eser_id, yeni_id, p_degisiklikler, null);

  update bilgi_onerileri
  set durum = 'kabul', inceleyen = auth.uid(), inceleyen_ad = benim_adim(), karar_tarihi = now(),
      surum_id = yeni_id, eklenen_kaynak_id = case when p_kutuphane is not null then kaynak else null end
  where id = p_id;
  return yeni_id;
end $$;

-- Uygulama talepleri tarihçiye (010).
drop policy if exists "panel talepleri okur" on public.eser_talepleri;
create policy "panel talepleri okur" on public.eser_talepleri for select to authenticated
  using (izin_var('eser.incele') or izin_var('eser.onayla'));
drop policy if exists "panel talep fotografi okur" on storage.objects;
create policy "panel talep fotografi okur" on storage.objects for select to authenticated
  using (bucket_id = 'talep-foto' and (izin_var('eser.incele') or izin_var('eser.onayla')));
create or replace function public.talep_karar(p_id text, p_onay boolean, p_gerekce text)
returns void language plpgsql security definer set search_path = public as $$
declare t eser_talepleri;
begin
  if not izin_var('eser.incele') then raise exception 'yetki yok' using errcode = '42501'; end if;
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

-- YZ kayıtları hem tarihçi hem editör kararında yazılır (006, 007).
create or replace function public.yz_karar_kaydet(p_analiz bigint, p_karar text)
returns void language plpgsql security definer set search_path = public as $$
declare a yz_analizleri; ozet text;
begin
  if not (izin_var('eser.incele') or izin_var('eser.onayla')) then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_karar not in ('onayladi', 'reddetti') then raise exception 'gecersiz karar'; end if;
  select * into a from yz_analizleri where id = p_analiz;
  if a.id is null then return; end if;
  ozet := coalesce(a.sonuc->>'sonuc', array_to_string(array(select jsonb_array_elements_text(a.sonuc->'etiketler')), ', '), a.durum);
  insert into denetim_kaydi (kim, kim_ad, islem, hedef, alan, yeni, gerekce)
  values (auth.uid(), benim_adim(), 'yz_onerisi', a.eser_id, a.hedef_tur || ' #' || a.hedef_id, a.sonuc,
          'YZ önerisi görüldü (' || ozet || '), ' || coalesce(benim_adim(), '?') || ' ' || case p_karar when 'onayladi' then 'onayladı' else 'reddetti' end);
end $$;

create or replace function public.yz_etiket_duzelt(p_oneri bigint, p_analiz bigint, p_etiketler jsonb, p_oncelik text)
returns bigint language plpgsql security definer set search_path = public as $$
declare a yz_analizleri; o bilgi_onerileri; yeni_id bigint;
begin
  if not (izin_var('eser.incele') or izin_var('eser.onayla')) then raise exception 'yetki yok' using errcode = '42501'; end if;
  if jsonb_typeof(p_etiketler) <> 'array' or exists (
    select 1 from jsonb_array_elements_text(p_etiketler) e
    where e not in ('spam', 'anlamsiz', 'kaynaksiz', 'kaynak_alakasiz', 'mevcut_bilgiyle_ayni', 'mevcut_bilgiyle_celisiyor', 'degerli')
  ) then raise exception 'gecersiz etiket'; end if;
  select * into o from bilgi_onerileri where id = p_oneri;
  if o.id is null then raise exception 'oneri bulunamadi'; end if;
  if p_analiz is not null then
    select * into a from yz_analizleri where id = p_analiz and tur = 'eleme' and hedef_tur = 'oneri' and hedef_id = p_oneri;
  end if;
  insert into yz_etiket_duzeltmeleri (oneri_id, analiz_id, yz_etiketler, yz_oncelik, etiketler, oncelik, kim, kim_ad)
  values (p_oneri, a.id, a.sonuc->'etiketler', a.sonuc->>'oncelik', p_etiketler, p_oncelik, auth.uid(), benim_adim())
  returning id into yeni_id;
  insert into denetim_kaydi (kim, kim_ad, islem, hedef, alan, eski, yeni, gerekce)
  values (auth.uid(), benim_adim(), 'yz_etiket_duzelt', o.eser_id, 'oneri #' || p_oneri,
          jsonb_build_object('etiketler', a.sonuc->'etiketler', 'oncelik', a.sonuc->>'oncelik'),
          jsonb_build_object('etiketler', p_etiketler, 'oncelik', p_oncelik), 'YZ etiketi elle düzeltildi');
  return yeni_id;
end $$;

revoke execute on function public.surum_tarihci_karar(bigint, boolean, jsonb, text, jsonb) from public, anon;
grant execute on function public.surum_tarihci_karar(bigint, boolean, jsonb, text, jsonb) to authenticated;

-- Denetim kaydı: tamamını yalnız sistem yöneticisi (kullanici.yonet) görür; diğer herkes yalnız kendi yaptıklarını görür.
drop policy if exists "panel kullanicilari okur" on public.denetim_kaydi;
drop policy if exists "yonetici ve kendi kaydi" on public.denetim_kaydi;
create policy "yonetici ve kendi kaydi" on public.denetim_kaydi for select to authenticated
  using (
    public.izin_var('kullanici.yonet') or kim = auth.uid()
  );
