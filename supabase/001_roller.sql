-- Aşama 1: yönetim paneli rolleri, izinleri ve denetim kaydı.
-- Supabase > SQL Editor'da bir kez çalıştırılır; tekrar çalıştırmak zarar vermez.
-- Mevcut tablolara (profiller, pullar) dokunmaz, yalnız profiller'den ad okur.
-- Yetki kontrolleri izin adına göre yapılır (ör. izin_var('eser.onayla')), rol adına göre değil.

create table if not exists public.rol_izinleri (
  rol text not null,
  izin text not null,
  primary key (rol, izin)
);

-- Rol -> izin eşlemesi. lib/yetki.ts'deki ROL_IZINLERI ile aynı olmalı (tests/yetki.test.ts denetler).
insert into public.rol_izinleri (rol, izin) values
  ('super_admin', 'eser.ekle'),
  ('super_admin', 'eser.duzenle'),
  ('super_admin', 'eser.onayla'),
  ('super_admin', 'eser.arsivle'),
  ('super_admin', 'kaynak.dogrula'),
  ('super_admin', 'kullanici.yonet'),
  ('editor', 'eser.ekle'),
  ('editor', 'eser.duzenle'),
  ('editor', 'eser.onayla'),
  ('editor', 'kaynak.dogrula'),
  ('katkici', 'eser.ekle'),
  ('katkici', 'eser.duzenle')
on conflict do nothing;
-- goruntuleyici: izni yok, panelde yalnız okur.

create table if not exists public.kullanici_rolleri (
  kullanici uuid primary key references auth.users (id) on delete cascade,
  rol text not null check (rol in ('super_admin', 'editor', 'katkici', 'goruntuleyici')),
  atayan uuid references auth.users (id),
  tarih timestamptz not null default now()
);

-- Denetim kaydı: kim, ne zaman, neyi, hangi alanı, neden, neden neye değiştirdi. Yalnız fonksiyonlar yazar; güncelleme ve silme yok.
create table if not exists public.denetim_kaydi (
  id bigint generated always as identity primary key,
  kim uuid references auth.users (id),
  ne_zaman timestamptz not null default now(),
  islem text not null,
  hedef text,
  alan text,
  eski jsonb,
  yeni jsonb,
  gerekce text
);

alter table public.rol_izinleri enable row level security;
alter table public.kullanici_rolleri enable row level security;
alter table public.denetim_kaydi enable row level security;

create or replace function public.izin_var(istenen text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from kullanici_rolleri kr join rol_izinleri ri on ri.rol = kr.rol
    where kr.kullanici = auth.uid() and ri.izin = istenen
  );
$$;

create or replace function public.benim_izinlerim() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'rol', (select rol from kullanici_rolleri where kullanici = auth.uid()),
    'izinler', coalesce((
      select json_agg(ri.izin order by ri.izin)
      from kullanici_rolleri kr join rol_izinleri ri on ri.rol = kr.rol
      where kr.kullanici = auth.uid()
    ), '[]'::json)
  );
$$;

drop policy if exists "rol_izinleri okunur" on public.rol_izinleri;
create policy "rol_izinleri okunur" on public.rol_izinleri for select using (true);

drop policy if exists "kendi rolu ya da yonetici" on public.kullanici_rolleri;
create policy "kendi rolu ya da yonetici" on public.kullanici_rolleri for select to authenticated
  using (kullanici = auth.uid() or public.izin_var('kullanici.yonet'));
-- Rol ekleme/değiştirme yalnız rol_ata() ile.

drop policy if exists "panel kullanicilari okur" on public.denetim_kaydi;
create policy "panel kullanicilari okur" on public.denetim_kaydi for select to authenticated
  using (exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));

-- Kullanıcı yönetimi sayfası: tüm hesaplar, adları ve rolleri (yalnız kullanici.yonet).
create or replace function public.kullanicilari_listele()
returns table (id uuid, eposta text, ad text, rol text, kayit_tarihi timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.izin_var('kullanici.yonet') then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, p.ad::text, kr.rol, u.created_at
    from auth.users u
    left join public.profiller p on p.id = u.id
    left join public.kullanici_rolleri kr on kr.kullanici = u.id
    order by kr.rol nulls last, u.created_at desc;
end $$;

-- Rol ver, değiştir ya da (yeni_rol null) geri al. Kendi rolünü değiştirmek yasak: son yönetici kendini kilitleyemez.
create or replace function public.rol_ata(hedef uuid, yeni_rol text) returns void
language plpgsql security definer set search_path = public as $$
declare eski text;
begin
  if not public.izin_var('kullanici.yonet') then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  if hedef = auth.uid() then
    raise exception 'kendi rolunu degistiremezsin' using errcode = '42501';
  end if;
  select rol into eski from kullanici_rolleri where kullanici = hedef;
  if yeni_rol is null then
    delete from kullanici_rolleri where kullanici = hedef;
  else
    insert into kullanici_rolleri (kullanici, rol, atayan) values (hedef, yeni_rol, auth.uid())
    on conflict (kullanici) do update set rol = excluded.rol, atayan = excluded.atayan, tarih = now();
  end if;
  insert into denetim_kaydi (kim, islem, hedef, alan, eski, yeni)
  values (auth.uid(), 'rol_ata', hedef::text, 'rol', to_jsonb(eski), to_jsonb(yeni_rol));
end $$;

revoke execute on function public.kullanicilari_listele() from public, anon;
revoke execute on function public.rol_ata(uuid, text) from public, anon;
revoke execute on function public.benim_izinlerim() from public, anon;
grant execute on function public.kullanicilari_listele() to authenticated;
grant execute on function public.rol_ata(uuid, text) to authenticated;
grant execute on function public.benim_izinlerim() to authenticated;
grant execute on function public.izin_var(text) to anon, authenticated;
-- Supabase yeni tabloları API'ye kendiliğinden açmayabilir: yalnız okuma izni (yazma yalnız fonksiyonlarla).
grant select on public.denetim_kaydi, public.kullanici_rolleri, public.rol_izinleri to authenticated;
grant select on public.rol_izinleri to anon;

-- İlk süper yönetici. Önce sitede (/tr/hesap) bu e-postayla üye ol, sonra e-postayı yazıp bu satırı çalıştır.
insert into public.kullanici_rolleri (kullanici, rol)
select id, 'super_admin' from auth.users where email = lower('BURAYA_EPOSTANI_YAZ')
on conflict (kullanici) do update set rol = 'super_admin';
