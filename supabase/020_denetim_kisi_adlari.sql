-- 020: Denetim kaydının "Hedef" sütununda kullanıcı kimliği (uuid) yerine kişinin adı görünsün.
-- profiller tablosu başkalarının satırını göstermediği için, panel kullanıcılarına (rolü olan herkes, denetim
-- kaydını görenlerle aynı kişiler) yalnız ad döndüren küçük bir fonksiyon. E-posta açılmaz: ad yoksa e-postanın
-- @ öncesi kısmı döner (benim_adim() ile aynı kural). Tekrar çalıştırmak zarar vermez.

create or replace function public.denetim_kisi_adlari(kimlikler uuid[])
returns table (id uuid, ad text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()) then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  return query
    select u.id, coalesce(nullif(trim(p.ad), ''), split_part(u.email, '@', 1))::text
    from auth.users u
    left join public.profiller p on p.id = u.id
    where u.id = any(kimlikler);
end $$;

revoke execute on function public.denetim_kisi_adlari(uuid[]) from public, anon;
grant execute on function public.denetim_kisi_adlari(uuid[]) to authenticated;

notify pgrst, 'reload schema';
