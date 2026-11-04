-- 021: Araştırmacı (katkici) ve Okur (goruntuleyici) rolleri kaldırılır (eda, 3 Kas). 001-020'den sonra çalıştırılır;
-- tekrar çalıştırmak zarar vermez. Kalan roller: super_admin, editor, tarihci (lib/yetki.ts ROLLER ile aynı).
--
-- Bu rollerdeki kişiler rolsüz kalır (hesapları durur, panele giremez). Her biri denetim kaydına "rol_ata" olarak yazılır.
-- Birine başka rol vermek istersen bunu ÖNCE yap (panel > Kullanıcılar). Kimlerin etkileneceğini görmek için önce yalnız şunu çalıştır:
--   select u.email, kr.rol from public.kullanici_rolleri kr join auth.users u on u.id = kr.kullanici
--   where kr.rol in ('katkici', 'goruntuleyici');

begin;

with silinen as (
  delete from public.kullanici_rolleri where rol in ('katkici', 'goruntuleyici')
  returning kullanici, rol
)
insert into public.denetim_kaydi (kim, kim_ad, islem, hedef, alan, eski, yeni, gerekce)
select null, 'Sistem', 'rol_ata', kullanici::text, 'rol', to_jsonb(rol), null,
       'Araştırmacı ve Okur rolleri kaldırıldı (021)'
from silinen;

delete from public.rol_izinleri where rol in ('katkici', 'goruntuleyici');

alter table public.kullanici_rolleri drop constraint if exists kullanici_rolleri_rol_check;
alter table public.kullanici_rolleri add constraint kullanici_rolleri_rol_check
  check (rol in ('super_admin', 'editor', 'tarihci'));

commit;

-- Sonuç: rol başına kişi sayısı (yalnız üç rol görünmeli).
select rol, count(*) as kisi from public.kullanici_rolleri group by rol order by rol;
