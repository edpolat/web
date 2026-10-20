# Vakfiye – Claude için proje notları

@AGENTS.md

Kök&Kod Hackathon (42 Türkiye x Vakıf Katılım) projesi. Takım: Tekinoğlu Fırın. Vakıf eserlerini haritada ve listede keşfettiren, her bilgiyi kaynağıyla gösteren bir web uygulaması.

- Geliştirme dönemi 7 Kasım 2026'da biter, fiziki final 7-8 Kasım 2026.
- Şartnamenin MVP şartları: birden fazla eseri keşfetme; tarihçe, görsel ve kaynağa erişim; **içerik ekleme ve düzenleme**; yeni eser/şehir eklenebilir yapı; kullanıcı katkısı varsa onay kuyruğu; doğrulanmamış bilgi kesin bilgi gibi gösterilmez; testler ve README.
- Bilgi notunun beklentileri: mobil uyumlu ve hızlı, TR/EN, harita, şehir ve tür filtresi, galeri, sergi bilgileri, görme ve işitme engelli kullanıcılar.

## Komutlar

```
npm install
npm run dev        # http://localhost:3000/tr
npm test           # vitest
npm run lint       # tsc --noEmit
npm run dogrula    # veri doğrulama (python3 + jsonschema)
npm run veri-seti  # veri_seti/ klasörünü üretir: her alanı kaynağıyla işaretli eser + konum veri seti (veri_seti/README.md)
npm run build
```

Bir değişikliği bitmiş saymadan önce `npm test`, `npm run lint` ve veriye dokunduysan `npm run dogrula` geçmeli.

## Üç parça

Proje üç parçaya ayrılır. Her parçanın sahibi kendi klasörlerinde serbestçe çalışır. Parçalar arasındaki sözleşme **`sema/*.schema.json`** ve **`lib/tipler.ts`** dosyalarıdır. Bu ikisini değiştiren kişi diğer iki parçaya haber verir ve ikisini birlikte günceller.

| Parça | Klasörler | Sorumluluk |
|---|---|---|
| **Veri** | `veri/`, `sema/`, `araclar/` | Şema, envanter PDF'lerinden veri çıkarma, koordinatlar, kaynaklar, vakıf gelir-gider bilgisi, yapay zekâ test soru seti |
| **Backend** | `lib/veri.ts`, `app/api/`, `lib/sunucu/` | Veriyi okuma ve yazma, içerik ekleme/düzenleme API'si, onay kuyruğu, girdi doğrulama, yapay zekâ soru-cevap uç noktası |
| **Frontend** | `app/[dil]/`, `components/`, `app/globals.css`, `lib/sozluk.ts` | Liste, eser kartı, harita, filtre, galeri, TR/EN, erişilebilirlik, PWA |

`lib/metin.ts` ve `lib/filtre.ts` ortak yardımcılardır; değiştiren testlerini de günceller.

### Veri

- Her şehir tek dosya: `veri/iller/<il>.json`. Yeni şehir eklemek kod değişikliği gerektirmez.
- Eser türleri, diller, olgu durumları ve kategorileri `veri/ayarlar.json` içinde. Koda sabit liste yazma.
- Metinler `{ "tr": "...", "en": "..." }`. `tr` zorunlu.
- Olgu durumları: `kaynakli` (kaynak_id zorunlu), `ai_yorumu`, `belirsiz`, `dogrulanacak` (yayında görünmez).
- Kitaptan doğrulanmamış hiçbir bilgiyi `kaynakli` yapma. Emin olmadığın bilgi `dogrulanacak` kalır, eser `taslak: true` olur.
- Görsel eklerken lisans, atıf ve alt metin zorunlu.
- Otomatik bulunan koordinat `dogrulandi: false` kalır.

### Backend

- Veri JSON'dan okunur (`lib/veri.ts`, `server-only`); eser sayfaları derlemede üretilir, onaydan sonra `revalidatePath` ile yenilenir.
- İçerik ekleme/düzenleme ve onay kuyruğu: her değişiklik önce `veri/kuyruk/<id>.json` katkısı olur (`sema/katki.schema.json`), onaylanınca il dosyasına yazılır. Kurallar `lib/sunucu/katki.ts` (saf, testli), dosya işi `lib/sunucu/kuyruk.ts`, şema + çapraz kontrol `lib/sunucu/dogrula.ts` (ajv). Uçlar: `POST /api/katki` (herkes: kaynaklı bilgi; yönetim: eser ekle/düzenle), `GET /api/katki/[id]` (durum ve red notu), `GET/POST /api/onay` ve `POST/DELETE /api/yonetim/giris` (yönetim). Uygulama da aynı uçları kullanır, `nereden: "uygulama"` gönderir.
- Ziyaretçi üyeliği: mobil uygulamayla aynı Supabase projesi (auth + `profiller(id, ad)`, `pullar(kullanici, eser_id)`). İstemci `lib/bulut.ts`, sayfa `/tr/hesap` (`components/Hesap.tsx`). Adres ve herkese açık anahtar koda yazılmaz: `.env.local` içinde `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; yoksa sayfa uyarı gösterir.
- Yönetim girişi tek şifre: `.env.local` > `VAKFIYE_YONETIM_SIFRESI`. Geliştirmede tanımlı değilse şifre `vakfiye`; yayında şifre yoksa panel kapalı.
- Konum düzenleme (`/tr/duzenle/konum` + `app/api/konum`) yalnız geliştirmede çalışır ve kuyruğa girmez, doğrudan yazar.
- Gelen her kayıt `sema/` ile doğrulanmadan kaydedilmez. Onaylanmamış katkı yayına girmez.
- Yapay zekâ: model yalnızca ilgili eserin kayıtlarıyla beslenir ve cevabındaki her cümle için kaynak kimliği verir. Kimliksiz cümle "AI yorumu" olarak işaretlenir; veride olmayan soruya "Kaynaklarımızda bu bilgi yok" der. API anahtarı yalnızca sunucuda, `.env.local` içinde tutulur. Sağlayıcı sırası (`lib/sunucu/sor-yz.ts`): `ANTHROPIC_API_KEY` varsa Claude, yoksa `GEMINI_API_KEY` varsa Gemini (ücretsiz kota, model `GEMINI_MODEL`, varsayılan `gemini-flash-latest`), ikisi de yoksa eşleştirme (`lib/sunucu/sor.ts`).

- Yönetim panelinde YZ desteği (Aşama 6): yalnız editöre bilgi verir, hiçbir kaydı onaylamaz/reddetmez/değiştirmez. Tek anahtar `AI_ENABLED=true` (yoksa kapalı, panel aynen çalışır ve kutuda "YZ analizi yapılamadı" yazar), günlük sınır `YZ_GUNLUK_LIMIT`. Bütün LLM çağrıları `lib/sunucu/yz-servis.ts`'de (model değişirse yalnız orası); saf kurallar (maskeleme, sayfa seçme, alıntı kontrolü, şemalar) `lib/yz.ts`; akış `lib/sunucu/yz-analiz.ts` (Next.js `after()` ile yanıttan sonra; yarım kalan analizi Onay bekleyenler sayfası tetikler); tablolar `supabase/006_yz.sql`. Testler LLM'i taklit eder (`tests/yz.test.ts`).

### Frontend

- Next.js 16 App Router: `params` ve `searchParams` Promise'tir, `await` edilir. `useSearchParams` kullanan bileşen `<Suspense>` içinde olmalı.
- Leaflet yalnızca tarayıcıda çalışır; `components/HaritaYukle.tsx` üzerinden dinamik yüklenir.
- Arayüz metni bileşene yazılmaz, `lib/sozluk.ts` içine TR ve EN olarak eklenir.
- Erişilebilirlik baştan: anlamlı HTML ve başlık sırası, etiketli form alanları, alt metin, klavyeyle gezinme, görünür odak, renk dışında da ayırt edilen etiketler.

## Kurallar

- Kod, klasör ve değişken adları Türkçe (ASCII): `eser`, `iller`, `kaynak_id`. Mevcut adlandırmaya uy.
- TypeScript `strict`. `any` kullanma.
- Yeni davranış için `tests/` altına test ekle.
- Kaynak bilgisi gösterilmeyen tarihsel cümle arayüze çıkmaz.
- Mevcut veri: Bursa kitabının web sürümünden 41 kaynaklı eser + fotoğraflı 7 külliye (README > Durum). Konya ve birkaç Bursa kaydı taslak. Kitap eserlerinin koordinatları çoğunlukla mahalle düzeyinde; düzeltmek için konum düzenleme sayfası.

## Kaynaklar

- Envanter kitapları: Hatay (2022, 117 eser), Konya (2024, 289 eser, Vakıf Katılım sitesinde PDF), Bursa (385) ve Kütahya (141) baskıda.
- Sponsorun vereceği veri seti: 7 bölgeden yaklaşık 60-80 eser, yarı yapılandırılmış. Geldiğinde `veri/iller/` biçimine dönüştürülür.
