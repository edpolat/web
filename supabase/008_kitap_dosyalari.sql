-- Envanter kitaplarının PDF'leri kütüphanede: panel kullanıcıları "Kaynakta bu sayfayı aç" ile kitabın o sayfasını açar.
-- 003'ten sonra çalıştırılır; tekrar çalıştırmak zarar vermez. Önce bu dosyayı çalıştırın, sonra PDF'leri
-- Storage > kaynak-dosyalari kovasında kitaplar/ klasörüne aynı adlarla yükleyin:
--   kitaplar/vk-bursa-envanter-c1-2.pdf, kitaplar/vk-bursa-envanter-c3.pdf
-- Dosyalar ziyaretçilere kapalıdır (herkese_acik = false); kitabın künyesi sitede görünmeye devam eder.

-- Panelden yüklenen kaynak dosyaları 50 MB'a kadar (halkın önerilerindeki dosyalar uygulamada 10 MB ile sınırlı).
update storage.buckets set file_size_limit = 52428800 where id = 'kaynak-dosyalari';

update public.kaynak_kutuphanesi as k
set tur = 'dosya', dosya_yolu = x.yol, dosya_turu = 'application/pdf', dosya_boyutu = x.boyut, herkese_acik = false
from (values
  ('vk-bursa-envanter-c1-2', 'kitaplar/vk-bursa-envanter-c1-2.pdf', 32337856),
  ('vk-bursa-envanter-c3', 'kitaplar/vk-bursa-envanter-c3.pdf', 5568845)
) as x (id, yol, boyut)
where k.id = x.id;
