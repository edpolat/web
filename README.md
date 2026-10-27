# Vakfiye

Kök&Kod Hackathon (42 Türkiye x Vakıf Katılım) için vakıf eserleri keşif platformu. Takım: Tekinoğlu Fırın.

## Çalıştırma

```
npm install
npm run dev        # http://localhost:3000/tr
npm test           # birim testleri (vitest)
npm run dogrula    # veri doğrulama (python3 + jsonschema)
npm run build      # yayın derlemesi; taslak eserler gizlenir (VAKFIYE_TASLAK=1 ile görünür)
```

Next.js 16 (App Router), React 19, Leaflet + OpenStreetMap. Sayfalar derleme sırasında `veri/` klasöründen statik üretilir.

```
app/[dil]/page.tsx            ana sayfa: arama, şehir/tür filtresi, harita, liste
app/[dil]/eser/[id]/page.tsx  eser kartı: künye, tarihçe, mimari, kaynaklı olgular, galeri, harita, kaynakça
components/                   Kesif (filtre+liste), Harita, Galeri, DilDegistir
lib/                          veri okuma, tipler, filtre, TR/EN arayüz sözlüğü
tests/                        vitest
```

## İçerik ekleme, düzenleme ve onay kuyruğu

Sitede hiçbir değişiklik doğrudan yayına girmez; önce onay kuyruğuna düşer.

- **Bilgi ekle** (`/tr/eser/<id>/oner`, eser sayfasındaki düğme): herkes esere tek cümlelik bilgi önerebilir. Kaynak seçilmeden gönderilemez.
- **Yönetim paneli** (`/tr/yonetim`, şifreyle): yeni eser ekleme, var olan eserin adını, türünü, adresini, yapım bilgisini, banisini, mimarını, tarihçe ve mimari metnini düzenleme. Her değişiklik bir kaynağa dayanmak zorunda.
- **Onay kuyruğu** (`/tr/yonetim/onay`): bekleyen katkılar nereden geldiği (web / uygulama), kim gönderdiği, ne zaman ve hangi kaynağa dayandığıyla; eski ve yeni değer yan yana. Onaylanan katkı şemayla yeniden doğrulanıp `veri/iller/<il>.json` dosyasına yazılır, reddedilen notuyla saklanır.

Şifre `.env.local` dosyasında:

```
VAKFIYE_YONETIM_SIFRESI=buraya-sifre
```

Geliştirmede (`npm run dev`) şifre tanımlı değilse `vakfiye` kabul edilir.

API (web ve uygulama aynı uçları kullanır, gövde biçimi `sema/katki.schema.json`):

```
POST /api/katki              { tur: "olgu", eser_id, nereden: "uygulama", ekleyen, kaynak_id, sayfa, olgu: { metin: {tr, en}, kategori } }
GET  /api/katki/<id>         katkının durumu ve red notu
POST /api/katki              (yönetim) { tur: "eser_ekle", il, ... degisiklik } ya da { tur: "eser_duzenle", eser_id, ... degisiklik }
GET  /api/onay               (yönetim) bütün katkılar
POST /api/onay               (yönetim) { id, karar: "onayla" | "reddet", not }
POST /api/yonetim/giris      { sifre }  ·  DELETE çıkış
```

Erişilebilirlik: içeriğe atla bağlantısı, anlamlı başlık yapısı, etiketli form alanları, sonuç sayısı ekran okuyucuya duyurulur, klavyeyle gezilebilen galeri, açık/koyu tema, mobilde tek sütun.

# Veri katmanı

Sitenin bütün içeriği `veri/` altındaki JSON dosyalarından gelir. Şehirler, eser türleri ve diller kodda değil veride tanımlıdır.

```
sema/                 JSON Schema (draft 2020-12)
  ortak.schema.json   kimlik, cokDilli {tr, en}, konum, olgu, gorsel
  il.schema.json      bir şehir dosyası: il bilgisi + eserler
  eser.schema.json    eser kartı
  kaynak.schema.json  kaynaklar listesi
  vakif.schema.json   vakıflar, hayır ağı akışları, vakfiye şartları
  sergi.schema.json   sergiler
veri/
  ayarlar.json        diller, eser türleri, olgu durumları ve kategorileri
  iller/bursa.json    her şehir tek dosya
  kaynaklar.json  vakiflar.json  sergiler.json
araclar/dogrula.py    şema + çapraz kontrol
```

## Demo özellikleri (web)

- **Keşfet** (`/tr`): kapak, arama, şehir ve tür çipleri, fotoğraflı eser kartları ve yanında harita. Karta gelince eser haritada sarı işaretlenir. Renkler mobil uygulamayla aynı paletten (`app/globals.css` > `:root`).
- **Bu esere sor** (eser sayfasının sağ paneli, `POST /api/sor`): soruyu yalnız o eserin yayındaki olgularıyla eşleştirir ve olgunun kendi metnini kaynak ve sayfasıyla döndürür. Eşleşme yoksa "Kaynaklarımızda bu bilgi yok" der. Kurallar `lib/sunucu/sor.ts`, demo soruları `tests/sor.test.ts`. Yapay zekâ katmanı aynı ucu ve cevap biçimini kullanacak.
- **Dinle ve altyazı** (eser sayfası): kaynaklı bilgileri tarayıcının ses motoruyla okur, okunan bilgiyi vurgular ve altta altyazı şeridinde yazar. Ses yoksa altyazı cümle uzunluğuna göre ilerler.
- **Erişilebilirlik paneli** (üst menü): büyük yazı, yüksek kontrast, altyazı. Seçimler tarayıcıda hatırlanır (`lib/erisim.ts`).
- **Son güncelleme**: onaylanmış katkısı olan eserin sayfasında son onay tarihi görünür.
- **Demoyu sıfırla** (`/tr/yonetim` > Sunum hazırlığı): provadan önce "Şu anki hâli demo başlangıcı yap", her akıştan önce "Demoyu sıfırla". Kayıt `veri/demo-kaydi/` altında durur ve depoya girmez.
- **Oyun** (`/tr/oyun`): motor `lib/oyun.ts`, dersleri 300 tohumla ölçen test `tests/oyun.test.ts`. Arayüzü ekipten bir arkadaş yeniden tasarlayacak.

## Doğrulama

```
pip install jsonschema
python3 araclar/dogrula.py
```

Hata varsa çıkış kodu 1 olur (CI'a konabilir). İngilizcesi eksik metinler ve doğrulanmamış koordinatlar uyarı olarak listelenir.

## Kurallar

- **Yeni şehir:** `veri/iller/<il>.json` dosyası ekle. Kod değişmez (demodaki Kütahya anı).
- **Yeni eser türü:** `ayarlar.json > eser_turleri` listesine ekle.
- **Olgu:** kartta etiketle görünen tek cümle. `durum` şunlardan biri:
  `kaynakli` (kaynak_id zorunlu), `ai_yorumu`, `belirsiz`, `dogrulanacak` (yayında gösterilmez; PDF'den çıkarılıp kontrol bekleyenler).
- **Metinler** `{ "tr": "...", "en": "..." }` biçimindedir. `tr` zorunlu, `en` eksikse arayüz Türkçeyi gösterir.
- **Görsel** lisans, atıf ve alt metin olmadan eklenemez.
- **Konum** otomatik bulunduysa `dogrulandi: false` kalır, elle kontrol edilince `true` yapılır.
- **Hayır ağı** yalnızca `vakiflar.json` içinde `akislar` dolu olan vakıflarda açılır. Her akışın kaynağı zorunlu.
- `taslak: true` olan eser yayına alınmaz.

## Durum

- `veri/iller/bursa.json`: Bursa envanter kitabının web sürümünden 41 eser (Osmangazi Camiler ve Hazireler 3, Gemlik, Gürsu). TR/EN tarihçe ve mimari metin kitaptan kelimesi kelimesine; olgular sayfa numarasıyla `kaynakli`. Bunlara ek olarak metni olmayan 7 külliye yalnız fotoğraflarıyla (Orhan Bey, Hüdavendigâr, Hamzabey, Timurtaş Paşa, Yıldırım, Emir Sultan, Umurbey) ve 3 taslak kayıt var.
- Fotoğraflar `public/gorseller/bursa/<eser>/` altında, 1600 px WebP + 480 px önizleme (`_kucuk.webp`). Her galeride ve büyük görselde "© Vakıf Katılım" atfı gösterilir; fotoğraflar sponsorun envanter çalışmasındandır (tüm hakları saklıdır).
- Kitap eserlerinin koordinatları adresten otomatik bulundu, çoğu yalnız mahalle düzeyinde. Yeniden aramak için internete bağlı bir bilgisayarda:

```
python3 araclar/koordinat_bul.py        # bulduklarını listeler
python3 araclar/koordinat_bul.py --yaz  # veri dosyalarına yazar (dogrulandi: false)
python3 araclar/koordinat_bul.py --iyilestir  # mahalle düzeyindekileri eser düzeyinde yeniden dener
python3 araclar/osm_camiler.py --yaz  # tam yeri OpenStreetMap'teki cami kayıtlarından alır (önerilen)
```

  Sonra `npm run dev` ile http://localhost:3000/tr/duzenle/konum sayfasını açın: eseri seçin, haritada tam yerine tıklayın, kaydedin. Konum `veri/iller/<il>.json` dosyasına `dogrulandi: true, yontem: "elle"` olarak yazılır. Sayfa ve kaydetme ucu (`app/api/konum`) yalnız geliştirme ortamında çalışır, yayında 404 verir.

## Veri seti

`npm run veri-seti` komutu `veri_seti/` klasörüne her bilginin kaynağı işaretli eser ve konum dosyaları üretir (JSON, JSONL, GeoJSON, CSV, yapay zekâ için düz metin). Açıklaması `veri_seti/README.md` içinde. Veri değişince yeniden çalıştırın.
