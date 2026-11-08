-- KÖK&KOD demo verisini siler (demo_doldur.sql'in eklediği her şey ve demo sırasında onlardan doğanlar).
-- Supabase SQL Editor'da çalıştır. Tekrar çalıştırmak zararsızdır.
-- Demo sırasında panelden bir demo sürümü onaylandıysa o sürüm de silinir; eser sitede eski hâline döner.

do $temizle$
declare
  surumler bigint[];
  oneriler bigint[];
begin
  if to_regclass('public.demo_kayitlari') is null then
    raise notice 'Demo verisi yok.';
    return;
  end if;
  select array_agg(kayit::bigint) into oneriler from demo_kayitlari where tablo = 'bilgi_onerileri';
  -- Demo sürümleri + demo önerilerinin kabulüyle doğan sürümler + demo eserlerine (Kayseri) sonradan gönderilenler.
  select array_agg(distinct id) into surumler from eser_surumleri
  where id in (select kayit::bigint from demo_kayitlari where tablo = 'eser_surumleri')
     or id in (select surum_id from bilgi_onerileri where id = any(coalesce(oneriler, '{}')) and surum_id is not null)
     or il = 'kayseri';
  surumler := coalesce(surumler, '{}');
  oneriler := coalesce(oneriler, '{}');

  delete from yz_etiket_duzeltmeleri where oneri_id = any(oneriler);
  delete from yz_analizleri
  where id in (select kayit::bigint from demo_kayitlari where tablo = 'yz_analizleri')
     or (hedef_tur = 'surum' and hedef_id = any(surumler))
     or (hedef_tur = 'oneri' and hedef_id = any(oneriler));
  delete from bilgi_kaynaklari
  where surum_id = any(surumler) or kaynak_id in (select kayit from demo_kayitlari where tablo = 'kaynak_kutuphanesi');
  delete from denetim_kaydi
  where id in (select kayit::bigint from demo_kayitlari where tablo = 'denetim_kaydi')
     or surum_id = any(surumler)
     or hedef in (select kayit from demo_kayitlari where tablo = 'kaynak_kutuphanesi')
     or hedef = 'il:kayseri'
     -- Demo sırasında demo öneri/taleplerine verilen kararlar (hedefleri eser kimliği olduğu için zamana ve esere göre).
     or (ne_zaman >= (select min(kayit)::timestamptz from demo_kayitlari where tablo = 'yukleme_zamani')
         and islem in ('talep_kabul', 'talep_reddet', 'oneri_kabul', 'oneri_reddet')
         and hedef in (select eser_id from bilgi_onerileri where id = any(oneriler)
                       union select eser_id from eser_talepleri where id::text in (select kayit from demo_kayitlari where tablo = 'eser_talepleri')));
  update bilgi_onerileri set surum_id = null, eklenen_kaynak_id = null where id = any(oneriler);
  delete from bilgi_onerileri where id = any(oneriler)
     or kaynak_id in (select kayit from demo_kayitlari where tablo = 'kaynak_kutuphanesi');
  -- Sürümler birbirine (temel_surum) bağlı olabilir: önce bağları kopar.
  update eser_surumleri set temel_surum = null where temel_surum = any(surumler);
  delete from eser_surumleri where id = any(surumler);
  delete from il_surumleri where il_id = 'kayseri';
  delete from eser_talepleri where id::text in (select kayit from demo_kayitlari where tablo = 'eser_talepleri');
  delete from kaynak_kutuphanesi where id in (select kayit from demo_kayitlari where tablo = 'kaynak_kutuphanesi');
  delete from demo_kayitlari;
  raise notice 'Demo verisi silindi.';
end
$temizle$;

drop table if exists public.demo_kayitlari;
