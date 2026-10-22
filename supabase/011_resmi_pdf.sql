-- Envanter kitapları Vakıf Katılım'ın resmi PDF'lerine bağlanır; Storage'a kitap yüklemek gerekmez.
-- 003'ten sonra çalıştırılır; tekrar çalıştırmak zarar vermez. Bursa I. ve II. cilt ayrı kayıt olur
-- (eserler artık vk-bursa-envanter-c1 ve -c2 kullanıyor; eski vk-bursa-envanter-c1-2 kaydı silinmez).

insert into public.kaynak_kutuphanesi (id, baslik, tur, nitelik, kaynak_turu, url, yayinci, yil, aciklama, durum, herkese_acik, dogrulayan_ad, dogrulama_tarihi)
values
  ('vk-bursa-envanter-c1', 'Bursa Vakıf Eserleri, I. Cilt', 'baglanti', 'ikincil', 'envanter_kitabi', 'https://www.vakifkatilim.com.tr/documents/KurumsalIletisim/yayinlarimiz/bursa-envanteri-cilt-1.pdf', 'Vakıf Katılım', 2025, 'Vakıf Katılım''ın yayınlar sayfasındaki tam PDF. Sayfa numaraları basılı kitabınkidir.', 'dogrulandi', true, 'veri/kaynaklar.json', now()),
  ('vk-bursa-envanter-c2', 'Bursa Vakıf Eserleri, II. Cilt', 'baglanti', 'ikincil', 'envanter_kitabi', 'https://www.vakifkatilim.com.tr/documents/KurumsalIletisim/yayinlarimiz/bursa-envanteri-cilt-2.pdf', 'Vakıf Katılım', 2025, 'Vakıf Katılım''ın yayınlar sayfasındaki tam PDF. Sayfa numaraları basılı kitabınkidir.', 'dogrulandi', true, 'veri/kaynaklar.json', now())
on conflict (id) do nothing;

update public.kaynak_kutuphanesi as k
set url = x.url, baslik = coalesce(x.baslik, k.baslik)
from (values
  ('vk-bursa-envanter-c3', 'https://www.vakifkatilim.com.tr/documents/KurumsalIletisim/yayinlarimiz/bursa-envanteri-cilt-3.pdf', 'Bursa Vakıf Eserleri, III. Cilt'),
  ('vk-konya-envanter-c1', 'https://www.vakifkatilim.com.tr/documents/KurumsalIletisim/yayinlarimiz/konya-envanteri-1_cilt-web.pdf', null),
  ('vk-konya-envanter-c2', 'https://www.vakifkatilim.com.tr/documents/KurumsalIletisim/yayinlarimiz/konya-envanteri-2_cilt-web.pdf', null),
  ('vk-hatay-envanter', 'https://www.vakifkatilim.com.tr/documents/KurumsalIletisim/hatay-vakif-eserleri.pdf', null)
) as x (id, url, baslik)
where k.id = x.id;
