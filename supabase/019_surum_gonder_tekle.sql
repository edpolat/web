-- 019: "Could not choose the best candidate function between public.surum_gonder(...)" hatasını giderir.
-- Neden: 009 eski 9 parametreli surum_gonder'i silip p_dil_uyumu'lu 10 parametreli sürümü kurar. 002 sonradan yeniden
-- çalıştırılınca eski 9 parametreli sürüm geri gelir; iki sürüm birlikte durunca Supabase hangisini çağıracağını seçemez.
-- Bu dosya eskisini siler, yenisine dokunmaz. Tekrar çalıştırmak zarar vermez.
-- En sondaki sorgu, 002'nin yeniden çalışmasıyla başka fonksiyonların da eskiye dönüp dönmediğini gösterir.

drop function if exists public.surum_gonder(text, text, jsonb, text, bigint, text, text, text, boolean);

-- PostgREST'in fonksiyon listesini hemen yenilemesi için.
notify pgrst, 'reload schema';

select f.ad as fonksiyon,
       case when f.tamam then 'tamam' else f.yapilacak end as durum
from (
  select 'surum_gonder' as ad,
         (select count(*) from pg_proc where proname = 'surum_gonder' and pronamespace = 'public'::regnamespace) = 1
           and exists (select 1 from pg_proc where proname = 'surum_gonder' and pronargs = 10 and pronamespace = 'public'::regnamespace) as tamam,
         '009_dil_uyumu.sql dosyasını yeniden çalıştır, sonra bu dosyayı tekrar' as yapilacak
  union all
  select 'surum_karar',
         coalesce((select prosrc like '%editorde%' from pg_proc where proname = 'surum_karar' and pronamespace = 'public'::regnamespace limit 1), false),
         '015_tarihci_onayi.sql dosyasını yeniden çalıştır'
  union all
  select 'rol_ata',
         coalesce((select prosrc like '%amr%' from pg_proc where proname = 'rol_ata' and pronamespace = 'public'::regnamespace limit 1), false),
         '016_rol_sifre_onayi.sql dosyasını yeniden çalıştır'
) f;
