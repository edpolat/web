-- 016: Birini sistem yöneticisi (super_admin) yapmak için şifre onayı.
-- Panel (app/api/yonetim/kullanicilar) işlemi yapanın şifresini Supabase Auth'a yeniden doğrulatır ve rolü o yeni girişin
-- jetonuyla atar. Bu dosya aynı kuralı veritabanında da uygular: jetonun "amr" alanında son 5 dakika içinde şifreyle
-- giriş yoksa super_admin atanamaz (rol_ata'yı doğrudan çağırmak da işe yaramaz). Diğer roller eskisi gibi.
-- 002'deki rol_ata'nın aynısı + şifre kontrolü. Tekrar çalıştırılabilir.

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
  if yeni_rol = 'super_admin' and not exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' = 'password'
      and (a ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 300
  ) then
    raise exception 'sistem yoneticisi atamak icin sifre onayi gerekli' using errcode = '42501';
  end if;
  select rol into eski from kullanici_rolleri where kullanici = hedef;
  if yeni_rol is null then
    delete from kullanici_rolleri where kullanici = hedef;
  else
    insert into kullanici_rolleri (kullanici, rol, atayan) values (hedef, yeni_rol, auth.uid())
    on conflict (kullanici) do update set rol = excluded.rol, atayan = excluded.atayan, tarih = now();
  end if;
  insert into denetim_kaydi (kim, kim_ad, islem, hedef, alan, eski, yeni)
  values (auth.uid(), benim_adim(), 'rol_ata', hedef::text, 'rol', to_jsonb(eski), to_jsonb(yeni_rol));
end $$;

revoke execute on function public.rol_ata(uuid, text) from public, anon;
grant execute on function public.rol_ata(uuid, text) to authenticated;
