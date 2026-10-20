-- Aşama 6A: yönetim paneline yapay zekâ desteği (kaynak–bilgi eşleştirme). 005'ten sonra çalıştırılır; tekrar çalıştırmak zarar vermez.
-- YZ hiçbir kaydı onaylamaz, reddetmez ya da değiştirmez: yalnız editöre gösterilen analiz sonuçları burada saklanır.
-- Yazma yalnız aşağıdaki fonksiyonlarla: panelde rolü olan kişi ya da sunucunun service_role anahtarı.

-- Her YZ analizi (hangi model, ne zaman, sonuç). Aynı içerik (ozet) için tekrar çağrı yapılmaz; "Yeniden analiz et" yeni satır ekler.
create table if not exists public.yz_analizleri (
  id bigint generated always as identity primary key,
  tur text not null check (tur in ('kaynak', 'eleme')),
  hedef_tur text not null check (hedef_tur in ('oneri', 'surum')),
  hedef_id bigint not null,
  eser_id text,
  ozet text not null,
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'tamam', 'hata')),
  sonuc jsonb,
  hata text,
  model text,
  isteyen uuid references auth.users (id),
  isteyen_ad text,
  olusturuldu timestamptz not null default now(),
  bitti timestamptz
);
create index if not exists yz_analizleri_hedef on public.yz_analizleri (tur, hedef_tur, hedef_id, olusturuldu desc);

-- Kaynaktan çıkarılan metin, sayfa numarasıyla (aynı kaynak her analizde yeniden okunmasın).
-- anahtar: 'kutuphane:<id>', 'oneri:<id>' (önerinin kendi dosyası/bağlantısı) ya da 'url:<sha256>'.
create table if not exists public.kaynak_metinleri (
  anahtar text primary key,
  durum text not null check (durum in ('tamam', 'okunamadi')),
  sayfali boolean not null default true,
  sayfa_sayisi integer not null default 0,
  cikarildi timestamptz not null default now()
);
create table if not exists public.kaynak_sayfalari (
  anahtar text not null references public.kaynak_metinleri (anahtar) on delete cascade,
  sayfa integer not null,
  metin text not null,
  primary key (anahtar, sayfa)
);

-- Günlük toplam YZ çağrısı sayacı (sınır sunucudan gelir: YZ_GUNLUK_LIMIT).
create table if not exists public.yz_gunluk_cagri (
  gun date primary key,
  sayi integer not null default 0
);

alter table public.yz_analizleri enable row level security;
alter table public.kaynak_metinleri enable row level security;
alter table public.kaynak_sayfalari enable row level security;
alter table public.yz_gunluk_cagri enable row level security;

drop policy if exists "panel yz analizlerini okur" on public.yz_analizleri;
create policy "panel yz analizlerini okur" on public.yz_analizleri for select to authenticated
  using (exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));
drop policy if exists "panel kaynak metinlerini okur" on public.kaynak_metinleri;
create policy "panel kaynak metinlerini okur" on public.kaynak_metinleri for select to authenticated
  using (exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));
drop policy if exists "panel kaynak sayfalarini okur" on public.kaynak_sayfalari;
create policy "panel kaynak sayfalarini okur" on public.kaynak_sayfalari for select to authenticated
  using (exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));
drop policy if exists "panel yz sayacini okur" on public.yz_gunluk_cagri;
create policy "panel yz sayacini okur" on public.yz_gunluk_cagri for select to authenticated
  using (exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));

-- Bu YZ işlemlerini kim yapabilir: sunucunun service_role anahtarı ya da panelde rolü olan kişi.
create or replace function public.yz_yazabilir() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.role(), '') = 'service_role' or exists (select 1 from kullanici_rolleri where kullanici = auth.uid());
$$;

-- Analizi başlatır ("bekliyor" satırı). Aynı hedef için son 3 dakikada başlamış bir analiz sürüyorsa null döner (çift çağrı olmasın).
create or replace function public.yz_analiz_baslat(p_tur text, p_hedef_tur text, p_hedef_id bigint, p_eser text, p_ozet text)
returns bigint language plpgsql security definer set search_path = public as $$
declare yeni_id bigint;
begin
  if not yz_yazabilir() then raise exception 'yetki yok' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('yz:' || p_tur || ':' || p_hedef_tur || ':' || p_hedef_id));
  if exists (select 1 from yz_analizleri where tur = p_tur and hedef_tur = p_hedef_tur and hedef_id = p_hedef_id
             and durum = 'bekliyor' and olusturuldu > now() - interval '3 minutes') then
    return null;
  end if;
  insert into yz_analizleri (tur, hedef_tur, hedef_id, eser_id, ozet, isteyen, isteyen_ad)
  values (p_tur, p_hedef_tur, p_hedef_id, p_eser, p_ozet, auth.uid(), case when auth.uid() is not null then benim_adim() end)
  returning id into yeni_id;
  return yeni_id;
end $$;

create or replace function public.yz_analiz_bitir(p_id bigint, p_durum text, p_sonuc jsonb, p_model text, p_hata text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not yz_yazabilir() then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_durum not in ('tamam', 'hata') then raise exception 'gecersiz durum'; end if;
  update yz_analizleri set durum = p_durum, sonuc = p_sonuc, model = p_model, hata = left(p_hata, 500), bitti = now()
  where id = p_id and durum = 'bekliyor';
end $$;

-- Günlük sınırdan bir çağrı hakkı düşer; sınır dolduysa false.
create or replace function public.yz_cagri_hakki(p_sinir integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not yz_yazabilir() then raise exception 'yetki yok' using errcode = '42501'; end if;
  insert into yz_gunluk_cagri (gun, sayi) values (current_date, 1)
  on conflict (gun) do update set sayi = yz_gunluk_cagri.sayi + 1 where yz_gunluk_cagri.sayi < p_sinir
  returning sayi into n;
  return n is not null;
end $$;

-- Çıkarılan metni saklar. p_sayfalar: [{ "sayfa": 1, "metin": "..." }]
create or replace function public.kaynak_metni_kaydet(p_anahtar text, p_durum text, p_sayfali boolean, p_sayfalar jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not yz_yazabilir() then raise exception 'yetki yok' using errcode = '42501'; end if;
  delete from kaynak_metinleri where anahtar = p_anahtar;
  insert into kaynak_metinleri (anahtar, durum, sayfali, sayfa_sayisi)
  values (p_anahtar, p_durum, coalesce(p_sayfali, true), coalesce(jsonb_array_length(p_sayfalar), 0));
  insert into kaynak_sayfalari (anahtar, sayfa, metin)
  select p_anahtar, (x->>'sayfa')::integer, x->>'metin' from jsonb_array_elements(coalesce(p_sayfalar, '[]'::jsonb)) x;
end $$;

-- Editör YZ analizini gördükten sonra karar verdiğinde denetim kaydına yazılır:
-- "YZ önerisi görüldü (destekliyor), Eda onayladı".
create or replace function public.yz_karar_kaydet(p_analiz bigint, p_karar text)
returns void language plpgsql security definer set search_path = public as $$
declare a yz_analizleri; ozet text;
begin
  if not izin_var('eser.onayla') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_karar not in ('onayladi', 'reddetti') then raise exception 'gecersiz karar'; end if;
  select * into a from yz_analizleri where id = p_analiz;
  if a.id is null then return; end if;
  ozet := coalesce(a.sonuc->>'sonuc', array_to_string(array(select jsonb_array_elements_text(a.sonuc->'etiketler')), ', '), a.durum);
  insert into denetim_kaydi (kim, kim_ad, islem, hedef, alan, yeni, gerekce)
  values (auth.uid(), benim_adim(), 'yz_onerisi', a.eser_id, a.hedef_tur || ' #' || a.hedef_id, a.sonuc,
          'YZ önerisi görüldü (' || ozet || '), ' || coalesce(benim_adim(), '?') || ' ' || case p_karar when 'onayladi' then 'onayladı' else 'reddetti' end);
end $$;

revoke execute on function public.yz_yazabilir() from public, anon;
revoke execute on function public.yz_analiz_baslat(text, text, bigint, text, text) from public, anon;
revoke execute on function public.yz_analiz_bitir(bigint, text, jsonb, text, text) from public, anon;
revoke execute on function public.yz_cagri_hakki(integer) from public, anon;
revoke execute on function public.kaynak_metni_kaydet(text, text, boolean, jsonb) from public, anon;
revoke execute on function public.yz_karar_kaydet(bigint, text) from public, anon;
grant execute on function public.yz_yazabilir() to authenticated, service_role;
grant execute on function public.yz_analiz_baslat(text, text, bigint, text, text) to authenticated, service_role;
grant execute on function public.yz_analiz_bitir(bigint, text, jsonb, text, text) to authenticated, service_role;
grant execute on function public.yz_cagri_hakki(integer) to authenticated, service_role;
grant execute on function public.kaynak_metni_kaydet(text, text, boolean, jsonb) to authenticated, service_role;
grant execute on function public.yz_karar_kaydet(bigint, text) to authenticated;
-- Supabase yeni tabloları API'ye kendiliğinden açmıyor: yalnız okuma izni (yazma yalnız fonksiyonlarla).
-- Sunucu (service_role) öneri ve sürümleri, kaynakları ve dosyaları okuyabilsin diye ona da okuma izni.
grant select on public.yz_analizleri, public.kaynak_metinleri, public.kaynak_sayfalari, public.yz_gunluk_cagri to authenticated, service_role;
grant select on public.bilgi_onerileri, public.eser_surumleri, public.kaynak_kutuphanesi to service_role;
