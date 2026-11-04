# Vakfiye Web Uygulaması – Tam Spesifikasyon

> Bu dosya, Vakfiye web sitesini sıfırdan aynı davranışla yeniden kurmak için yazıldı. Başka bir yapay zekâ kodlama aracına tek başına verildiğinde aynı siteyi üretebilmesi hedeflenir. Kaynak: eda'nın Mac'teki `Desktop/web` klasörünün 21 Ekim 2026 hâli (son commit `617644a deploy`).
> Kod, dosya, değişken ve alan adları **Türkçe ve ASCII** yazılır (`eser`, `iller`, `kaynak_id`). Arayüz metinleri TR + EN.

---

## 1. Ürün özeti

**Vakfiye**, Kök&Kod Hackathon (42 Türkiye x Vakıf Katılım) için "Tekinoğlu Fırın" takımının yaptığı **vakıf eserleri keşif ve envanter platformu**dur.

- Ziyaretçi: eserleri haritada ve listede keşfeder, şehir/tür ile süzer, eser sayfasında künye, tarihçe, mimari, **her bilgi kaynağı ve sayfasıyla**, galeri, harita, yol tarifi, "Bu esere sor" asistanı, sesli dinleme + altyazı görür. Hesap açıp bilgi önerebilir, pasaportunu görür, vakıf oyununu oynar, sergileri görür.
- Ekip (yönetim paneli): Supabase hesabıyla rol tabanlı giriş; eser ekleme/düzenleme sürüm olarak incelemeye gider; editör onaylar/reddeder; kaynak kütüphanesi; halktan gelen öneriler; denetim kaydı; YZ destekli kaynak analizi ve ön eleme; iki dil uyum uyarısı.
- Mobil uygulama (Feyza'nın statik HTML/JS uygulaması, GitHub Pages) aynı Supabase projesini ve bu sitenin API'lerini (CORS) kullanır. Web ve mobil **tek entegre sistemdir**.

Temel ilkeler (şartname kaynaklı, asla bozulmaz):
1. Kaynağı gösterilmeyen tarihsel cümle arayüze çıkmaz. Doğrulanmamış bilgi kesin bilgi gibi gösterilmez (etiketler: `✓ Kaynaklı`, `~ AI yorumu`, `? Belirsiz`; `dogrulanacak` hiç gösterilmez).
2. Hiçbir değişiklik doğrudan yayına girmez; onay kuyruğu/inceleme vardır.
3. Yeni şehir = yeni JSON dosyası, kod değişmez. Eser türleri ve olgu durumları veride tanımlıdır.
4. YZ hiçbir kaydı onaylamaz, reddetmez, değiştirmez; yalnız bilgi verir.

---

## 2. Teknoloji

| Katman | Seçim |
|---|---|
| Çatı | **Next.js 16.4 App Router**, React 19.3, TypeScript strict (`any` yok) |
| Harita | Leaflet 1.9.4 + react-leaflet 5, OpenStreetMap karoları; yalnız tarayıcıda (`next/dynamic`, `ssr:false`) |
| Veri | Depoda JSON (`veri/`), JSON Schema draft 2020-12 (`sema/`), sunucuda `ajv` ile doğrulama |
| Hesap/DB | **Supabase** (`@supabase/supabase-js` 2.x): auth + Postgres tabloları + Storage; mobil uygulamayla aynı proje |
| YZ | Google Gemini REST (ücretsiz AI Studio anahtarı), isteğe bağlı Anthropic SDK (Claude) |
| PDF metni | `unpdf` (sunucuda, YZ kaynak analizi için) |
| Test | `vitest` |
| Python araçları | `araclar/*.py` (jsonschema ile doğrulama, koordinat bulma, veri seti üretme) |
| Yayın | Vercel Hobby, GitHub `edpolat/web` (özel), push'ta otomatik deploy |

`package.json` komutları: `dev`, `build`, `start`, `lint` (= `tsc --noEmit`), `test` (= `vitest run`), `dogrula` (= `python3 araclar/dogrula.py`), `veri-seti` (= `python3 araclar/veri_seti.py`).

`next.config.ts`:
- `allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"]` (ev ağından dev sunucusu)
- `redirects`: `/` → `/tr` (kalıcı değil)
- `images.formats: ["image/webp"]`
- `outputFileTracingIncludes: { "/**": ["./veri/kaynak-metinleri/**"] }` (kitap metinleri Vercel fonksiyonlarına gitsin)

Next.js 16 notları: `params` ve `searchParams` Promise'tir, `await` edilir. `useSearchParams` kullanan bileşen `<Suspense>` içinde. Arka plan işi için `after()` kullanılır. Önbellek etiketleri + `revalidateTag`/`revalidatePath`.

---

## 3. Klasör yapısı

```
app/
  [dil]/                       tr | en (generateStaticParams). Geçersiz dil → notFound
    layout.tsx                 <html lang>, üst bar, erişilebilirlik betiği, leaflet.css, globals.css
    page.tsx                   Keşfet (ana sayfa)
    eser/[id]/page.tsx         Eser sayfası
    eser/[id]/oner/page.tsx    Bilgi öner formu (hesap gerekli)
    sergiler/page.tsx          Sergiler (revalidate 3600)
    oyun/page.tsx              Vakıf oyunu
    hesap/page.tsx             Hesabım + Pasaport
    duzenle/konum/page.tsx     Konum düzenleme (yalnız dev; prod 404)
    yonetim/                   Panel (bkz. §7)
      layout.tsx  page.tsx  eserler/  eser/[id]/  eser/[id]/gecmis/  inceleme/  onay/
      kaynaklar/  kaynaklar/[id]/  katkilarim/  kullanicilar/  denetim/
  api/                         Bkz. §8
  globals.css                  Tüm stil (tek dosya, ~40 KB), palet :root'ta
components/                    React bileşenleri (aşağıda listelenir)
lib/
  tipler.ts  metin.ts  filtre.ts  erisim.ts  gorsel.ts  sozluk.ts  veri.ts  yetki.ts
  kaynak.ts  oneri.ts  dil-uyumu.ts  yz.ts  oyun.ts  bulut.ts
  sunucu/                      "server-only" modüller (bkz. §6)
sema/                          ortak, il, eser, katki, kaynak, vakif, sergi, rota .schema.json
veri/
  ayarlar.json  kaynaklar.json  sergiler.json  vakiflar.json  rotalar.json
  iller/<il>.json              bursa, konya, hatay
  kaynak-metinleri/<kaynak_id>.json   kitap metni sayfa sayfa (YZ için)
  kuyruk/  demo-kaydi/         (gitignore; eski dosya tabanlı kuyruk ve demo kaydı)
public/gorseller/<il>/<eser_id>/NN.webp + NN_kucuk.webp
supabase/001…009_*.sql         Supabase SQL göçleri (sırayla, tekrar çalıştırılabilir)
araclar/                       dogrula.py, koordinat_bul.py, osm_camiler.py, veri_seti.py, veri_seti_al.py, kaynak_metni_al.py
veri_seti/                     npm run veri-seti çıktısı (json, jsonl, geojson, csv, belgeler.jsonl)
tests/                         vitest testleri
docs/SPESIFIKASYON.md          bu dosya
CLAUDE.md  AGENTS.md  README.md  .env.example
```

Proje üç parçaya ayrılır (CLAUDE.md): **Veri** (`veri/`, `sema/`, `araclar/`), **Backend** (`lib/veri.ts`, `app/api/`, `lib/sunucu/`), **Frontend** (`app/[dil]/`, `components/`, `globals.css`, `lib/sozluk.ts`). Sözleşme: `sema/*.schema.json` + `lib/tipler.ts`.

---

## 4. Veri modeli

### 4.1 Ortak tipler (`lib/tipler.ts`)

```ts
type Dil = "tr" | "en";
type CokDilli = { tr: string; en?: string };           // tr zorunlu; en yoksa arayüz Türkçeyi gösterir + "Türkçe gösteriliyor" notu
type Konum = { enlem: number; boylam: number; dogrulandi: boolean;
  yontem?: "kitap" | "geocoding" | "elle" | "osm"; hassasiyet?: "eser" | "adres" | "mahalle" | "ilce" };
type Olgu = { metin: CokDilli; kategori: string; durum: string; kaynak_id?: string; sayfa?: string };
type Gorsel = { dosya: string; alt: CokDilli; aciklama?: CokDilli; lisans: string; atif: string; kaynak_id?: string };
type Eser = {
  id: string;                          // kebab-case ASCII, ör. "molla-fenari-camii" (kimlikUret: Türkçe harfler sadeleşir)
  ad: CokDilli; tur: string; ilce?: string; adres?: CokDilli; konum?: Konum;
  donem?: { yapim_yili?: number; yapim_yili_hicri?: number; yaklasik?: boolean; metin?: CokDilli };
  banisi?: string; mimar?: string;
  tarihce?: CokDilli;                  // paragraflar boş satırla (\n\n) ayrılır
  mimari?: { metin?: CokDilli; plan?: string; malzeme?: string[]; ust_ortu?: string;
             onarimlar?: { yil: number; aciklama?: CokDilli; kaynak_id?: string }[] };
  olgular: Olgu[];                     // kartta etiketle görünen tek cümlelik bilgiler
  gorseller?: Gorsel[]; sergi_idleri?: string[]; vakif_id?: string; kulliye_id?: string;
  envanter?: { kaynak_id?: string; sayfa?: string; envanter_no?: string };
  taslak?: boolean;                    // yayında gizli (dev'de ya da VAKFIYE_TASLAK=1 iken görünür)
};
type Il = { id: string; ad: CokDilli; merkez: Konum; yakinlastirma?: number;
  envanter_kaynak_id?: string; envanter_yili?: number; toplam_eser?: number };
type IlliEser = Eser & { il: string };
type KesifEseri = Pick<IlliEser,"id"|"il"|"ad"|"tur"|"ilce"|"banisi"|"konum"> & { yil?: number;
  gorsel?: Pick<Gorsel,"dosya"|"alt">; gorselSayisi: number; kaynakliSayisi: number };
type Kaynak = { id; tur; baslik; yazar?; yayinci?; yil?; url?; lisans?; not? };
type Sergi = { id; ad: CokDilli; sehir?; harita?; yer?; baslangic?: "YYYY-MM-DD"; bitis?; aciklama?: CokDilli; url?; kaynak_id? };
type Vakif = { id; ad: CokDilli; vakif?; vakfiye_tarihi?; kaynak_idleri: string[]; akislar?: unknown[];
  sartlar?: { metin: CokDilli; kaynak_id: string; sayfa?: string }[] };
type Rota = { il: string; duraklar: { eser_id: string; damga_ust?: string; damga_alt?: string }[] };  // il başına 6 durak
```

### 4.2 Dosyalar

- `veri/iller/<il>.json` = `{ "il": Il, "eserler": Eser[] }`. Şehirler klasörden keşfedilir (alfabetik).
- `veri/ayarlar.json`:
  - `diller`: tr (varsayılan), en
  - `eser_turleri` (`{id, ad:{tr,en}}`): cami, mescit, kulliye, medrese, imaret, hamam, han, bedesten-carsi, turbe, cesme, sebil, zaviye-tekke, kopru, kutuphane, darussifa, kilise, sinagog, diger
  - `olgu_durumlari` (`{id, ad, yayinda}`): `kaynakli` (yayinda, kaynak_id zorunlu), `ai_yorumu` (yayinda), `belirsiz` (yayinda), `dogrulanacak` (yayinda: false)
  - `olgu_kategorileri`: tarihce, mimari, vakif, gelir_gider, onarim, gunumuz
- `veri/kaynaklar.json`: `Kaynak[]` (envanter kitapları: `vk-bursa-envanter-c1-2`, `vk-bursa-envanter-c3`, `vk-konya-envanter-c1`, `vk-hatay-envanter` …)
- `veri/sergiler.json`, `veri/vakiflar.json`, `veri/rotalar.json` (pasaport rotaları, mobil uygulamadan)
- `veri/kaynak-metinleri/<kaynak_id>.json` = `{ sayfalar: [{ sayfa: number, metin: string, pdf_sayfa?: number }] }` (Bursa c1-2 s.394-489, c3 s.325-337; `araclar/kaynak_metni_al.py` üretir)

### 4.3 Örnek eser (kısaltılmış)

```json
{
  "id": "molla-fenari-camii",
  "ad": { "tr": "Molla Fenârî Camii ve Haziresi", "en": "Molla Fenari Mosque and Graveyard" },
  "tur": "cami", "ilce": "Osmangazi",
  "adres": { "tr": "Mollafenari Mahallesi, 12. Dilek Sokak, No: 1, Osmangazi, Bursa", "en": "…" },
  "banisi": "Molla Mehmed Şemseddin bin Hamza el-Fenârî",
  "tarihce": { "tr": "…\n\n…", "en": "…" },
  "mimari": { "metin": {"tr":"…","en":"…"}, "plan": "Dikdörtgen plan", "ust_ortu": "Kiremit örtülü kırma çatı",
              "malzeme": ["moloz taş","tuğla"],
              "onarimlar": [{ "yil": 1969, "aciklama": {"tr":"…","en":"…"}, "kaynak_id": "vk-bursa-envanter-c1-2" }] },
  "olgular": [{ "metin": {"tr":"Caminin banisi … el-Fenârî’dir.","en":"…"}, "kategori": "tarihce",
                "durum": "kaynakli", "kaynak_id": "vk-bursa-envanter-c1-2", "sayfa": "394" }],
  "envanter": { "kaynak_id": "vk-bursa-envanter-c1-2", "sayfa": "394-397" },
  "konum": { "enlem": 40.176984, "boylam": 29.059007, "dogrulandi": false, "yontem": "osm", "hassasiyet": "eser" },
  "gorseller": [{ "dosya": "/gorseller/bursa/molla-fenari-camii/01.webp",
                  "alt": {"tr":"Ağaçlar arasında tuğla cami…","en":"…"},
                  "lisans": "Tüm hakları saklıdır (…)", "atif": "Vakıf Katılım, Bursa Vakıf Eserleri",
                  "kaynak_id": "vk-bursa-envanter-c1-2" }]
}
```

### 4.4 Veri kuralları (doğrulayıcı zorlar: `araclar/dogrula.py` + `lib/sunucu/dogrula.ts`)

- Şema + çapraz kontrol: tür, olgu durumu, kategori, kaynak/vakıf/sergi/külliye kimlikleri tanımlı olmalı; dosya içinde eser kimliği tekil.
- `kaynakli` olgu `kaynak_id` olmadan olmaz. Kitaptan doğrulanmamış bilgi `dogrulanacak` kalır, eser `taslak: true`.
- Görsel lisans, atıf ve alt metin olmadan eklenemez. Görseller 1600 px WebP + 480 px `_kucuk.webp` (`lib/gorsel.ts > kucukGorsel`).
- Otomatik bulunan koordinat `dogrulandi: false`; elle doğrulanınca `true, yontem: "elle"`. Türkiye kutusu: enlem 35.5-42.5, boylam 25.5-45.
- Hayır ağı yalnız `vakiflar.json` içinde `akislar` dolu vakıfta açılır (henüz yok; bir takım arkadaşı yapıyor).

### 4.5 Mevcut veri (21 Ekim 2026)

| İl | Eser | Taslak | Olgu | Görsel | Not |
|---|---|---|---|---|---|
| Bursa | 51 | 3 | 274 | 223 | Kitap web sürümünden 41 kaynaklı eser + 7 fotoğraflı külliye; TR/EN kitaptan |
| Konya | 263 | 1 | 3213 | 730 | Feyza'nın uygulamasından içe aktarıldı (`araclar/veri_seti_al.py`) |
| Hatay | 77 | 0 | 698 | 203 | Aynı; adres yalnız ilçe |

Konya/Hatay koordinatlarının çoğu ilçe merkezi (`hassasiyet: "ilce"`); ~79 EN metin çevrilmemiş; `konum.dogrulandi: true` olan eser yok.

### 4.6 Yayındaki hâl (katmanlama)

Ziyaretçi sayfaları JSON'u doğrudan değil **yayındaki hâli** okur (`lib/veri.ts`):
`yayindakiIller() = katmanla(iller(), yayindakiSurumler())`

- `yayindakiSurumler()`: Supabase `eser_surumleri` tablosundan `durum='yayinda'` satırlarının her eser için en son olanı (karar_tarihi, eşitse id büyük olan). Anonim anahtarla okunur, `unstable_cache` benzeri 5 dk önbellek, etiket `eser-surumleri`. Supabase yoksa/ulaşılamazsa boş Map → site JSON ile aynen çalışır.
- `katmanla`: JSON'daki eserin yayındaki sürümü varsa sürümün `veri`si konur (arşivlenmişse çıkarılır); JSON'da olmayan yeni eser sürümleri ilgili ilin sonuna eklenir.
- `yayindakiKaynaklar()`: `kaynaklar.json` + kütüphanedeki `dogrulandi` kaynaklar (aynı kimlikte JSON kazanır).
- `kesifEserleri()`: fotoğraflılar önce, sonra `adSirala` (Türkçe collator, baştaki "(Başarakavak) " gibi parantez yok sayılır).

---

## 5. Görsel tasarım ve palet

Yalnız **açık tema** (koyu tema kaldırıldı). Mobil uygulamayla aynı görünüm: açık başlık çubuğu, serif lacivert logo, simgeli sekmeler, çipler, yeşil yapı karosu. Renkler `app/globals.css > :root`:

| Değişken | Renk | Kullanım |
|---|---|---|
| `--lacivert` | `#17488F` | marka, menü, başlıklar, bağlantılar |
| `--mavi` | `#0077B6` | düğmeler, ikonlar, etkileşim |
| `--turkuaz` | `#00B4D8` | **yalnız** aktif sekme ve vurgu çizgisi; asla metin rengi değil |
| `--yesil` | `#123D3A` | vakıf kimliği, "kaynaklı" etiketi |
| `--sari` | `#FCBD00` | rozet ve mühür, idareli |
| `--damga` | `#B4462F` | pasaport damgası |
| `--zemin` | `#F5F1E8` | sıcak taş arka plan |
| `--yuzey` | `#FFFFFF` | kartlar |
| `--metin` | `#1B263B` | metin |
| `--soluk` | `#4A5670` | ikincil metin |
| `--cizgi` | `#E2DCCD` | çizgiler |
| `--kaynakli-zemin` `#E3EFEC`, `--ai` `#6B4E00` / `--ai-zemin` `#FFF1C2`, `--belirsiz` `#4A5670`, `--uyari` `#FFF1C2` |
| `--baslik-yazi` | "Iowan Old Style", Palatino, Georgia, serif | başlıklar ve logo |

Harita işaretleri (`components/Harita.tsx`): tür rengi (cami `#17488F`, mescit `#0077B6`, kulliye `#123D3A`, diğer `#1B263B`); konum `hassasiyet` mahalle/ilçe ise **içi boş, kesik çizgili** daire. Karta gelince işaret sarı vurgulanır.

`components/Muhur.tsx`: sekiz köşeli yıldızlı daire mühür (kapakta 180 px). `components/Simge.tsx`: mobil alt menüdeki çizgi simgeleri (`kesfet`, `sergi`, `oyun`, eser = kubbe+minare), `aria-hidden`.

Erişilebilirlik (baştan zorunlu): "İçeriğe geç" bağlantısı, anlamlı başlık sırası, etiketli form alanları, alt metin, klavyeyle gezilen galeri, görünür odak, renge ek olarak simge/metinle ayırt edilen etiketler (`✓`, `~`, `?`), sonuç sayısı `aria-live` ile duyurulur, mobilde tek sütun, aktif sekme `aria-current="page"`.

Arayüz metinleri bileşene yazılmaz: `lib/sozluk.ts > s(dil)` TR/EN sözlük (ör. `t.site`, `t.kesfet`, `t.pano.*`, `t.oneri.*`, `t.dilUyumu.*`, `t.durumIsareti[durum]`).

---

## 6. Sunucu modülleri (`lib/` ve `lib/sunucu/`)

| Dosya | Görev |
|---|---|
| `lib/veri.ts` | JSON okuma (`ayarlar`, `iller`, `tumEserler`, `kesifEserleri`, `eserBul`, `kaynaklar`, `sergiler`, `vakiflar`, `rotalar`, `kaynakMetni`) + yayındaki hâl (`yayindakiIller/Eserler/Eser/KesifEserleri/Kaynaklar`) |
| `lib/metin.ts` | `DILLER`, `gecerliDil`, `metin(m, dil)` (yoksa tr), `ceviriEksik`, `adSirala` |
| `lib/filtre.ts` | `sadelestir` (Türkçe harf + aksan sadeleştirme), `filtrele({il,tur,ara})` (ad tr+dil, ilçe, banisi içinde arar), `konumEksik` |
| `lib/erisim.ts` | Erişilebilirlik tercihleri (`buyukYazi`, `kontrast`, `altyazi`), localStorage anahtarı `vakfiye-erisim`, `<html data-yazi data-kontrast data-altyazi>`; `ERISIM_BETIGI` satır içi betik ilk çizimden önce uygular |
| `lib/yetki.ts` | İzinler/roller ve `izinli`, `paneldeMi`, `yetkiCoz` (bkz. §9) |
| `lib/kaynak.ts` | Kütüphane sabitleri ve form denetimi (bkz. §10.2) |
| `lib/oneri.ts` | Öneri alanları, `oneriIstegi`, `oneriyiUygula`, `mevcutDeger` (bkz. §10.3) |
| `lib/dil-uyumu.ts` | İki dil farkı kuralı (bkz. §10.4) |
| `lib/yz.ts` | YZ saf kuralları: maskeleme, sayfa seçme, alıntı kontrolü, şemalar, etiketler (bkz. §11) |
| `lib/oyun.ts` | Vakıf oyunu motoru (bkz. §7.5) |
| `lib/bulut.ts` | Tarayıcı Supabase istemcisi: `uyeOl`, `girisYap`, `kayitliOturum`, `pullariGetir`, `cikisYap`, `oturumIzle`, `erisimJetonu`, `dosyaYukle`; form kuralları (ad ≥2, geçerli e-posta, şifre ≥6) ve hata kodları mobil uygulamayla aynı |
| `sunucu/kimlik.ts` | Panel kimliği: jeton `Authorization: Bearer` başlığından ya da httpOnly çerez `vakfiye_hesap`'tan; `auth.getUser` + `rpc('benim_izinlerim')` + `profiller.ad`; `kimlik()` istek başına cache; `hesapIstemcisi()` (kullanıcı adına RLS'li istemci); `jetonOmru` (JWT exp) |
| `sunucu/oturum.ts` | `panelKimligi()` (dev'de şifreli çerez `vakfiye_yonetim` → "Yerel yönetici", super_admin izinleri eksi `kullanici.yonet`), `yetkili(izin)`, `yoneticiMi()` |
| `sunucu/yonetim.ts` | Dev'e özel tek şifre: `VAKFIYE_YONETIM_SIFRESI`, dev'de yoksa `vakfiye`, **prod'da kapalı**; çerez değeri şifreden türetilir |
| `sunucu/katki.ts` | Eski kuyruk + sürümlerin ortak kuralları: `DUZENLENEBILIR` alanlar, `kimlikUret`, `katkiOlustur`, `uygula`, `denetleVeUygula`, `farklar`, `esit`, `KatkiHatasi` |
| `sunucu/kuyruk.ts` | Eski dosya tabanlı kuyruk (`veri/kuyruk/<id>.json`): `depoOku`, `katkiEkle`, `katkiOku`, `katkilar`, `kararVer` |
| `sunucu/surum.ts` | Sürüm kuralları (saf): `sonYayindakiler`, `katmanla`, `alanFarklari`, `surumHazirla`, `yayinaUygunMu` |
| `sunucu/surum-depo.ts` | Supabase `eser_surumleri`: `yayindakiSurumler`, `yayiniYenile`, `surumler`, `surumOku`, `denetimKaydi`, `surumGonder`, `surumIncelemeye`, `surumKarar`, `surumYayinla` |
| `sunucu/panel.ts` | `/api/surum` iş mantığı `panelIslemi`, `yayindakiDepo`, `yayindakiHal`, `benimSurumlerim` |
| `sunucu/kaynak-depo.ts` | Kütüphane: `dogrulanmisKaynaklar` (önbellek etiketi `kaynak-kutuphanesi`), `kaynakListesi`, `kaynakOku`, `bilgiKaynaklari`, `yuklemeAdresi`, `dosyaDenetle`, `kaynakEkle`, `kaynakDogrula`, `bilgiKaynagiEkle`, `dosyaBaglantisi` |
| `sunucu/oneri-depo.ts` | `oneriGonder`, `oneriler`, `oneriReddet`, `oneriKabul`, `oneriDosyaBaglantisi` |
| `sunucu/sor.ts` | Eşleştirmeli soru-cevap + YZ bağlamı (`kayitlar`, `yzCevabi`) |
| `sunucu/sor-yz.ts` | Asistan model zinciri (bkz. §11.1) |
| `sunucu/yz-servis.ts` | Panel LLM çağrılarının tek noktası (bkz. §11.2) |
| `sunucu/yz-analiz.ts`, `yz-kaynak.ts`, `yz-eleme.ts`, `yz-dil.ts`, `yz-depo.ts`, `kaynak-metni.ts` | Panel YZ akışı (bkz. §11) |
| `sunucu/goster.ts`, `surum-goster.ts` | Panelde alan değerini okunur metne çevirme, `ilkHal` |
| `sunucu/konum.ts` | `konumDenetle`, `konumuYaz` (dev konum aracı) |
| `sunucu/dogrula.ts` | ajv ile `semaHatalari`, `eserHatalari`, `ilDosyasiHatalari` |
| `sunucu/demo.ts` | Demoyu kaydet/sıfırla (`veri/demo-kaydi/`) |

---

## 7. Sayfalar (ziyaretçi)

### 7.1 Üst bar (`app/[dil]/layout.tsx`)
Sol: serif logo "Vakfiye" (`/[dil]`), sekmeler (`components/UstMenu.tsx`, simgeli): **Keşfet** (`""`, `/eser/*` de aktif sayar), **Sergiler** (`/sergiler`), **Oyun** (`/oyun`). Yeni sekme buraya eklenir.
Sağ: Erişilebilirlik paneli (`ErisimPaneli`: büyük yazı, yüksek kontrast, altyazı; localStorage), **Hesabım** (`/hesap`), **Yönetim** bağlantısı (`YonetimBaglantisi`: yalnız `/api/yonetim/ben` panel rolü döndürürse görünür), dil değiştirici (`DilDegistir`, aynı yolu diğer dilde açar, sorgu korunur).
Metadata: başlık şablonu `%s · Vakfiye`, açıklama slogan.

### 7.2 Keşfet `/[dil]`
- Kapak: üst başlık, "Vakfiye" h1, slogan, sayaçlar (eser, şehir, fotoğraf, kaynaklı bilgi sayısı; `tr-TR`/`en-GB` biçim), Mühür.
- `components/Kesif.tsx` (istemci): arama kutusu, şehir çipleri, tür çipleri (yalnız kullanılan türler; sayılar şehir+arama filtresine göre değişir), "Temizle". Filtre durumu bileşende; adres çubuğu `history.replaceState` ile `?il=&tur=&ara=` güncellenir (paylaşılabilir, yenileyince aynı filtre). Sonuç sayısı duyurulur.
- Sol: fotoğraflı eser kartları (küçük görsel, ad, il/ilçe, tür, yıl, kaynaklı bilgi sayısı); sağ: harita (`HaritaYukle` → `Harita`), karta gelince işaret sarı.

### 7.3 Eser sayfası `/[dil]/eser/[id]`
`generateStaticParams` tüm eserler × diller; veri `yayindakiEser(id)`; yoksa 404.
Sıra:
1. "← Geri", taslaksa uyarı.
2. Üst bilgi (il · ilçe · tür), h1 ad.
3. Kapak görseli (+ "Galeri (n)" bağlantısı).
4. Künye kutuları: Dönem (yaklaşık + yıl + "(H. hicri)" ya da dönem metni), Banisi, Mimar, Vakıf, Adres.
5. Eylemler: **Dinle** (`components/Dinle.tsx`), **+ Bilgi ekle** (→ `/eser/[id]/oner`, etiket bu kalır), **Bu esere sor** (sağ panele kaydırır).
6. "Son güncelleme: <tarih>" (eski kuyruktaki onaylı katkı varsa).
7. **Bilgiler ve kaynakları**: yayında olan olgular; her biri metin + etiket bağlantısı `✓ Kaynaklı · s. 394` (kaynakçaya `#kaynak-<id>` çapası, title'da kitap ve sayfa). `dogrulanacak` gizli.
8. Tarihçe (paragraflar `\n\n`; çeviri eksikse "Türkçe gösteriliyor" notu ve `lang="tr"`).
9. Mimari: metin, künye (plan, malzeme, üst örtü), onarımlar listesi.
10. Galeri (`Galeri.tsx`, klavyeyle gezilir, boşsa "fotoğraf yok").
11. Harita (280 px; ilçe düzeyinde zoom 13, aksi 16) + konum notu (ilçe/mahalle/doğrulanmadı). Hassasiyet ilçe değilse **yol tarifi** düğmeleri: Google Maps yürüyerek (`/maps/dir/?api=1&destination=lat,lng&travelmode=walking`) ve Apple Haritalar (`?daddr=lat,lng&dirflg=w`).
12. Sergiler (eser `sergi_idleri`).
13. Kaynakça (`ol.kaynakca`, kullanılan kaynaklar + envanter kaynağı, `KaynakKunye`).
- Sağ panel: **SoruPaneli** (sohbet balonları; `POST /api/sor` gövdesi `{eser_id, soru, dil, gecmis:[{soru,cevap}] son 4}`; her cümle durum etiketiyle: `✓ Kaynaklı` + kaynak + sayfa ya da `~ AI yorumu`; hata/503'te "Cevap alınamadı, tekrar dene"; yeni mesajda en alta kayar). Başlangıçta önerilen sorular gösterilebilir.
- **Dinle**: Web Speech API; önce yayındaki olguları, olgu yoksa tarihçe paragraflarını okur; okunan öğeyi vurgular; altta altyazı şeridi (altyazı tercihi açıksa). Ses yoksa/olay gelmezse altyazı cümle uzunluğuna göre ilerler; Chrome sesleri geç yüklediği için kısa bekleme.

### 7.4 Bilgi öner `/[dil]/eser/[id]/oner` (`components/OneriFormu.tsx`)
Giriş yoksa "Öneri göndermek için giriş yap → /hesap". Alanlar:
- **Alan** seçimi: `olgu` (yeni bilgi), `banisi`, `mimar`, `yapim_yili`, `adres`, `ad`, `diger`.
- İki dilli alanlarda (olgu, ad, adres, diger) **öneri dili** tr/en seçilir; seçilen dildeki mevcut değer gösterilir.
- Önerilen metin (1-2000 karakter).
- **Kaynak**: `kutuphane` (doğrulanmış kaynak + konum/sayfa), `baglanti` (http(s) URL + kaynak türü), `dosya` (PDF/JPG/PNG ≤10 MB; önce `yukleme_adresi` alınır, tarayıcı doğrudan Supabase Storage'a yükler), `yok` (kaynaksız; editöre "kaynaksız" görünür).
- Dosya/bağlantıda hak onayı kutusu (`hak_onayi`).
- "Bu değişiklik diğer dildeki metne uyum için" kutusu (yalnız ad, adres, diger).
- Gönderim `POST /api/oneri {islem:"gonder", …}` Bearer jetonla. Altta kişinin bu eserdeki önceki önerileri durum ve ret gerekçesiyle (`GET /api/oneri?eser=`). Günlük 20 sınırı.

### 7.5 Oyun `/[dil]/oyun` (`components/Oyun.tsx` + `lib/oyun.ts`)
Vakıf kurma oyunu; motor ekrandan bağımsız, mobil ile aynı dosya. Kurallar:
- Sermaye 100 birim: hamam/han/arazi/nakit (varsayılan 30/30/20/20). Amaç: aşevi (gider 26/tur), medrese (22), çeşme (12). Yedek fon payı %0-50 (5'er, varsayılan 20). Mütevelli: dürüst (×1) ya da becerikli (×1.05, %15 zimmet ihtimali, %60 zimmet, eşik 10).
- Her tur 10 yıl, hedef 600 yıl. Gelir/bakım birim başına: hamam 0.8/0.2, han 0.72/0.07, arazi 0.36/0; nakit sandığa 0.02 katar.
- Olay ihtimali tur başına: deprem 9%, yangın 9%, kuraklık 6%, savaş 6%, enflasyon 6%. Yıkım: deprem hamam %80 han %40; yangın han %60. Enflasyon: nakit -%40, fon -%20, gider +%12. Onarım çarpanı 1.1; yıkımda karar: **fon**dan onar / **nakit**le onar / **kış** (hizmeti kıs: 2 tur kısma, mülk 4 turda geri gelir; kış ödenmemiş tur sayılır). Üst üste 3 boş sandık = çöküş. Tek kaynak eşiği %45 (ders).
- Sonuç dersleri: ayakta, fon, zimmet, tek_kaynak, gider. RNG mulberry32, tohum adrese yazılır (`?tohum=`), sunum tohumu **186** (varsayılanla 600 yıl ayakta; hamam 70 olunca 130. yılda depremde çöker). Durum düz JSON.
- Arayüzü bir takım arkadaşı yeniden tasarlayacak; **mevcut oyun UI'sine dokunulmaz**. Test: `tests/oyun.test.ts` dersleri 300 tohumla ölçer.

### 7.6 Sergiler `/[dil]/sergiler`
`veri/sergiler.json`; yeri ve tarihi olmayan gösterilmez. Durum bugüne göre (açık / yakında / bitti), sıralama durum sonra başlangıç (yeni önce). `revalidate = 3600`. Kartta yer, tarih aralığı, açıklama, harita adresi, dış bağlantı.

### 7.7 Hesabım `/[dil]/hesap` (`Hesap.tsx` + `Pasaport.tsx`)
- Supabase ile üye ol / giriş / çıkış (mobil uygulamayla aynı hesaplar). E-posta onayı açıksa "onaydan sonra giriş yap". Supabase env yoksa uyarı.
- Pasaport: `pullar(kullanici, eser_id, tarih)` tablosundan pullar; rota seçici (`veri/rotalar.json`, açılışta en çok pul alınan rota), 6 duraklı damga ızgarası (SVG damga, `--damga` rengi, `damga_ust`/`damga_alt` yazıları), rota dışı pullar, rozetler: 🧭 ilk pul, 🌙 rotanın yarısı, 🏛️ tamamı. Pul verme mobil uygulamada (QR ile sahada); web yalnız gösterir.

### 7.8 Konum düzenleme `/[dil]/duzenle/konum` (yalnız dev)
Eser seç, haritada tıkla, kaydet → `POST /api/konum` doğrudan `veri/iller/<il>.json`'a `dogrulandi:true, yontem:"elle"` yazar. Konumu eksik (`konumEksik`) eserler öne çıkar. Prod'da sayfa ve uç 404.

---

## 8. API uçları

Tüm hatalar `{ hata: string, ayrinti?: string[] }`. CORS yalnız belirtilen uçlarda.

| Uç | Yöntem | Yetki | İstek → Yanıt |
|---|---|---|---|
| `/api/eserler` | GET, OPTIONS | herkes, **CORS \*** | `?il=bursa` (ops.) → `{ eserler: IlliEser[] }` yayındaki, taslak olmayan; görsel yolları köke göre (`/gorseller/...`). `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` |
| `/api/eserler/[id]` | GET, OPTIONS | herkes, CORS \* | `{ eser }` ya da 404 |
| `/api/sor` | POST, GET, OPTIONS | herkes, CORS \* (POST, content-type) | POST `{ eser_id, soru (1-300), dil?: "tr"\|"en", gecmis?: [{soru≤300, cevap≤800}] (son 4) }` → `Cevap = { bulundu, cumleler: [{ metin, durum: "kaynakli"\|"ai_yorumu"\|"belirsiz"\|"not", kaynak_id?, sayfa? }], yontem: "eslesme"\|"yapay_zeka" }`. YZ anahtarı varsa ve başarısızsa **503** `{hata}` (eşleştirmeye düşmez); hiç anahtar yoksa eşleştirme. GET `?eser=&soru=` teşhis: `{ saglayici, model, son_hata, soru, deneme_cevabi, model_ciktisi, eslestirme }` (anahtar göstermez) |
| `/api/oneri` | GET, POST, OPTIONS | Bearer jeton ya da çerez, **CORS \*** (GET, POST; headers content-type, authorization) | GET `?eser=` → `{ oneriler }` (yalnız kendi; girişsizse boş). POST `{islem}`: `yukleme_adresi {tur, boyut}` → `{yol, jeton}`; `gonder {eser_id, alan, onerilen, kaynak_id?, konum?, url?, kaynak_turu?, dosya_yolu?, hak_onayi, dil, dil_uyumu}` → `{id}` (sonra arka planda YZ); `kabul {id, alan, deger, deger_en?, kategori?, konum?, dil_onayi?, kutuphane?: {baslik, kaynak_turu, nitelik, herkese_acik}, yz_analizleri?}` → `{surum}` (eser.onayla; kütüphane için kaynak.dogrula); `reddet {id, gerekce}` (eser.onayla, gerekçe zorunlu) |
| `/api/oneri/dosya/[id]` | GET | panel ya da öneren | 302 → 5 dk'lık imzalı Storage bağlantısı, aksi 404 |
| `/api/talep` | POST | eser.onayla (çerez) | Mobil uygulama talebine karar: `{islem: "kabul"\|"reddet", id, gerekce?}` (ret gerekçe zorunlu, kabulde not) → `talep_karar` |
| `/api/surum` | POST | panel rolü | `{islem}`: `gonder {tur:"eser_ekle"\|"eser_duzenle", eser_id?, il?, degisiklik, kaynak_id, sayfa?, not?, taslak?, dil_uyumu?}` → `{id, eser_id}`; `incelemeye {id}`; `onayla {id, gerekce?, dil_onayi?, yz_analizleri?}`; `reddet {id, gerekce}`; `geri_al {eser_id, hedef: surumId\|null, gerekce}`; `arsivle`/`arsivden_cikar {eser_id, gerekce}` |
| `/api/kaynak` | POST | hesap + izin | `yukleme_adresi {tur, boyut}` (≤50 MB; eser.ekle\|duzenle); `ekle {baslik, tur:"dosya"\|"baglanti"\|"kayit", nitelik?, kaynak_turu, url?, dosya_yolu?, yazar?, yayinci?, yil?, not?}` → `{id}`; `dogrula {id, durum, herkese_acik, gerekce}` (kaynak.dogrula; ret gerekçe zorunlu); `bilgi_bagla {eser_id, alan, deger, kaynak_id, konum}` (eser.duzenle) |
| `/api/kaynak/dosya/[id]` | GET | panel: hepsi; ziyaretçi: doğrulanmış + herkese açık | 302 imzalı bağlantı ya da 404 |
| `/api/yz` | POST | eser.onayla | `dil_uyumu {ciftler:[{tr,en}] ≤12, her biri ≤6000}` → `{tamam, sonuclar:[{uyumlu, aciklama}]}` ya da `{tamam:false, neden}`; `etiket_duzelt {id, analiz?, etiketler[], oncelik}` (YZ kapalıyken de); `kaynak {hedef_tur:"oneri"\|"surum", id}` / `eleme {hedef_tur:"oneri", id}` → `{analiz}` (Yeniden analiz et). `maxDuration = 60` |
| `/api/yonetim/ben` | GET | — | panel kimliği `{id, eposta, ad, rol, izinler}` ya da 401. **CORS yok** |
| `/api/yonetim/oturum` | POST, DELETE | Bearer | Tarayıcıdaki Supabase jetonunu httpOnly `vakfiye_hesap` çerezine yazar (ömür = JWT exp) → `{degisti}`; DELETE siler |
| `/api/yonetim/kullanicilar` | GET, POST | kullanici.yonet | GET `rpc kullanicilari_listele`; POST `{kullanici: uuid, rol: Rol\|null}` → `rpc rol_ata` |
| `/api/yonetim/giris` | POST, DELETE | — | Dev tek şifre `{sifre}` → çerez `vakfiye_yonetim` (12 saat). Şifre yoksa 503 |
| `/api/yonetim/demo` | POST | eser.onayla | `{islem:"kaydet"}` → `{zaman}`; `{islem:"sifirla"}` (dosyaları kayda döndürür) |
| `/api/katki`, `/api/katki/[id]`, `/api/onay` | | | **Eski** dosya tabanlı kuyruk (MVP ilk sürüm). `POST /api/katki` olgu (herkes) ya da eser_ekle/duzenle (eser.duzenle) → `veri/kuyruk/<id>.json`; `/api/onay` GET/POST karar (eser.onayla) → il JSON'una yazar. Vercel'de kalıcı değil; mobil artık `/api/oneri` kullanır |
| `/api/konum` | POST | yalnız dev | `{id, enlem, boylam}` |

Mobil uygulama entegrasyonu: `/api/eserler`, `/api/eserler/<id>`, `/api/sor`, `/api/oneri` (Bearer = Supabase erişim jetonu). Anahtarlar asla uygulamaya verilmez.

---

## 9. Kimlik, roller ve izinler

- Ziyaretçi ve ekip aynı Supabase hesaplarını kullanır. Panel girişi `components/PanelGiris.tsx`: tarayıcıda Supabase ile giriş → `OturumKoprusu` (her panel sayfasında) jetonu `POST /api/yonetim/oturum` ile çereze kopyalar, oturum değişince sayfayı yeniler.
- Sunucu jetonu her istekte Supabase'e doğrulatır; izinler `benim_izinlerim()` RPC'sinden.
- **İzin adına göre denetim** (rol adına göre değil). Hem API'de hem Supabase fonksiyonlarında.

| Rol | İzinler |
|---|---|
| `super_admin` | eser.ekle, eser.duzenle, eser.onayla, eser.arsivle, kaynak.dogrula, kullanici.yonet |
| `editor` | eser.ekle, eser.duzenle, eser.onayla, kaynak.dogrula |
| `tarihci` | eser.incele, kaynak.dogrula (015) |

Araştırmacı (`katkici`) ve Okur (`goruntuleyici`) 3 Kas'ta kaldırıldı (`supabase/021_rolleri_sadelestir.sql`).

Rolü olmayan hesap panelde "rolün yok" görür. eda super_admin.

---

## 10. İş akışları

### 10.1 Eser sürümleri (Aşama 2)
- Yayındaki eser = JSON'daki hâl (sürüm 0) + varsa en son `yayinda` sürüm. **Hiçbir sürüm silinmez/güncellenmez**; geri alma ve arşivleme de yeni sürüm. Her adım `denetim_kaydi`'na.
- Eser formu (`components/EserFormu.tsx`, sekmeli: künye, metinler, konum, kaynak): düzenlenebilir alanlar `ad, tur, ilce, adres, konum, donem, banisi, mimar, tarihce, mimari, taslak` (olgular/görseller formla değişmez). Kaynak (kütüphaneden ya da JSON) **zorunlu**, sayfa ve not isteğe bağlı. "Taslak olarak kaydet" ya da "İncelemeye gönder". "Diğer dildeki metne uyum için" kutusu. Gönderince `/yonetim/eserler?gonderildi=1`.
- `surumHazirla`: eski kuyruğun kurallarıyla (`katkiOlustur` yönetici modu) tam eser hâli üretir, ajv + çapraz kontrolle doğrular. `eser_ekle`'de kimlik addan üretilir.
- Onay: `yayinaUygunMu` (şehir dosyası geçerli kalmalı, yeni eser zaten yayında olmamalı) + dil uyarısı kontrolü → `surum_karar` + `yayiniYenile()` (revalidateTag + revalidatePath `/[dil]` layout). Ret gerekçe zorunlu.
- Geri al: eski bir `yayinda` sürüm ya da `hedef:null` = JSON ilk hâli. Arşivle/arşivden çıkar: `eser.arsivle` izni.
- Kaynakla gelen ve incelemeye giren sürüm için YZ kaynak analizi yanıttan sonra başlar.

### 10.2 Kaynak kütüphanesi (Aşama 3)
- Tablo `kaynak_kutuphanesi`: `tur` dosya/baglanti/kayit; `nitelik` birincil/ikincil/ucuncul; `kaynak_turu` vakfiye, arsiv, envanter_kitabi, akademik, kitap, kurum_sitesi, web, haber, diger (varsayılan nitelik türden gelir: vakfiye/arşiv birincil, akademik/kitap/envanter ikincil, web/haber üçüncül); `durum` dogrulanmamis/dogrulandi/reddedildi; `herkese_acik`.
- Dosyalar özel kova **`kaynak-dosyalari`**; yol `<kullanıcı id>/<32 hex>.<pdf|jpg|png>` sunucuda rastgele verilir; tarayıcı tek kullanımlık imzalı adresle **doğrudan Supabase'e** yükler (Vercel istek sınırı ~4.5 MB). Sunucu sonra içeriği ilk baytlardan denetler (gerçek tür + boyut), uymazsa siler. Sınır: panel 50 MB, halk 10 MB. Envanter PDF'leri `kitaplar/<kaynak_id>.pdf`.
- Kaynak esere değil **bilgiye** bağlanır: `bilgi_kaynaklari(eser_id, alan, deger, kaynak_id, konum, surum_id)`.
- Sitede yalnız doğrulanmış kaynaklar görünür. Panel sayfaları: `/yonetim/kaynaklar` (liste, durum/nitelik süzgeci, ekleme formu `KaynakPaneli`), `/yonetim/kaynaklar/[id]` (künye, dosya önizleme, doğrula/reddet, bağlı bilgiler).
- Kaynak yılı 1 ile bu yıl arası (004).

### 10.3 Halktan bilgi önerisi (Aşama 4)
- `bilgi_onerileri`; gönderen hesapla giriş yapmış olmalı; **kişi başına günde 20** (rolü olana sınırsız; DB'de zorlanır). `kaynaksiz` üretilmiş sütun. Öneri sitede hiçbir şeyi değiştirmez.
- Nitelik kişiye göre değil **kaynağa** göre: öneren `kaynak_turu` belirtir.
- Kabul (`oneri_kabul`, tek atomik işlem): öneri eserin yeni `yayinda` sürümü olur; `olgu` alanında yeni olgu eklenir (kaynak varsa `kaynakli`, yoksa `belirsiz`), diğer alanlar değer değiştirir; `diger` için kabul eden uygulanacak alanı seçer. İki dilli alanlarda kabul formunda TR ve EN kutuları (önerinin dilindeki kutuda öneri, diğerinde sitedeki hâl; boş EN = eski kalsın). İstenirse önerinin bağlantısı/dosyası kütüphaneye **doğrulanmış kaynak** olarak eklenir (kaynak.dogrula gerekli) ve `bilgi_kaynaklari`'na yazılır.
- Ret gerekçe zorunlu; öneren "Katkılarım"/öneri formunda gerekçeyi görür.

### 10.4 Onay bekleyenler `/yonetim/inceleme` (birleşik liste)
Tek listede dört tür kart, **talep tarihine göre eskiden yeniye**: eser sürümü (`SurumListesi`/SurumKarti: alan alan eski/yeni), doğrulanmamış kaynak, bilgi önerisi (`OneriKarti`), mobil uygulamadan gelen talep (`TalepKarti`: Feyza'nın uygulamasının `eser_talepleri` tablosu; serbest metin + en çok 3 fotoğraf `talep-foto` deposundan 10 dk'lık imzalı bağlantıyla; misafir ya da üye; "Eseri düzenle" bağlantısı, kabul = değerlendirildi + isteğe bağlı not, ret gerekçeli; eserde değişiklik ayrıca sürüm olarak yapılır). Süzgeç çipleri: `?tur=eser|kaynak|oneri|talep`; `?sira=yeni` (yeniden eskiye), `?sira=oncelik` (YZ önceliği: spam hep sonda, yüksek > normal/etiketsiz > düşük); `?etiket=<YZ etiketi>|benzer` (yalnız öneriler). YZ kutuları (`YzKaynakKutusu`, `YzElemeKutusu`) kartlarda; analizi olmayanlar (en çok 3-4 iş) sayfa yanıtından sonra arka planda başlatılır; kutu en çok 8 kez (~1 dk) sayfayı tazeler.

### 10.5 İki dil uyum uyarısı (`lib/dil-uyumu.ts`, `components/DilUyarisi.tsx`)
- `dilFarklari(eski, yeni)` eserin bütün `{tr,en}` metinlerini gezer (yol ör. `olgular.3.metin`); yalnız yeni hâldeki metinlere bakılır.
- Yalnız bir dili değişen metin (`trDegisti !== enDegisti`) varsa ve gönderen "uyum için" demediyse **uyarı**: kartta statik not (`DilNotu`), onaylarken "Yine de onayla" / "Vazgeç". Sunucu zorlar: `/api/surum onayla` ve `/api/oneri kabul` uyarı gerektiğinde `dil_onayi: true` ister; denetim notuna "Dil uyarısına rağmen onaylandı." eklenir.
- YZ açıksa onaya basınca değişen metnin TR+EN çiftleri `POST /api/yz {islem:"dil_uyumu"}` ile karşılaştırılır; hepsi `uyumlu` ise uyarı çıkmaz; YZ başarısızsa basit uyarı. Biri boş çift YZ'ye sorulmaz. Bellek içi önbellek.

### 10.6 Diğer panel sayfaları
- `/yonetim` (pano): giriş yoksa `PanelGirisFormu` (+ dev'de şifreli giriş `<details>`); rol yoksa mesaj. Özet kutuları (izne göre): bekleyen düzenleme, bilgi önerisi, doğrulanmamış kaynak, taslaklarım → ilgili süzgeçli sayfalar. Düğmeler: + Yeni eser, Eserler, Kaynak kütüphanesi, eski kuyruk (bekleyen varsa), konum düzenle (dev). Son değişiklikler (denetim, 8 satır), hızlı düzenle (`EserSecici`), Sunum hazırlığı (`DemoDugmeleri`: "Şu anki hâli demo başlangıcı yap", "Demoyu sıfırla"), çıkış.
- Panel menüsü (`PanelMenu`, izne göre): Ana sayfa, Eserler (`/eser/*` dahil), Onay bekleyenler (eser.onayla veya kaynak.dogrula), Kaynaklar, Katkılarım (eser.ekle/duzenle), Kullanıcılar (kullanici.yonet), Denetim.
- `/yonetim/eserler`: tablo; süzgeç `q` (ad/banisi/kimlik), `durum` (yayinda/taslak/incelemede/arsivlendi), `tur`, `il`, `donem`; incelemede olanlarda etiket; `?gonderildi=1` notu. Ad sıralaması `adSirala`.
- `/yonetim/eser/[id]` (form; `yeni` = yeni eser), `/yonetim/eser/[id]/gecmis` (yayındaki sürümler eskiden yeniye, her biri öncekiyle fark; geri al / arşivle düğmeleri).
- `/yonetim/katkilarim`: kişinin sürümleri (taslak, incelemede, yayında, reddedildi + gerekçe), dayandığı hâle göre fark.
- `/yonetim/kullanicilar` (`KullaniciYonetimi`): hesap listesi, rol ver/geri al.
- `/yonetim/denetim` (`DenetimTablosu`): kim, ne zaman, işlem, hedef (bağlantılı), alan, eski → yeni, gerekçe; son 200.
- `/yonetim/onay`: eski dosya kuyruğu (`OnayKuyrugu`).

---

## 11. Yapay zekâ katmanı

### 11.1 Ziyaretçi asistanı "Bu esere sor" (`lib/sunucu/sor-yz.ts`, `sor.ts`)
- RAG: model yalnız o eserin **numaralı kayıtlarıyla** beslenir (`kayitlar(eser)`: olgular kendi kaynağıyla; tarihçe/mimari paragrafları ve künye (ad, adres, ilçe, banisi, mimar, dönem) envanter kaynağıyla, yoksa `belirsiz`). Model her cümle için `kayitlar: number[]` verir; `yzCevabi` numaraları kaynak+sayfaya çevirir (sayfa aralıkları sadeleşir), dayanağı olmayan cümle **`ai_yorumu`**, çok kayda dayanan cümle en zayıf durumu alır, HTML varlıkları düzeltilir. Çıktı şeması `{bulundu, cumleler:[{metin, kayitlar}]}`.
- Sistem talimatı özeti: önce kayıtlar, yetmezse genel bilgi (AI yorumu, uydurma tarih/isim yok); kısa devam sorularının öznesi eserdir; "kim yaptı" = bânî; mimar yoksa söyle; konum soruları künyedeki adresle; `belirsiz` kayıt cümlede belli edilir; 1-4 kısa cümle; cevap kullanıcının dilinde; ilgisiz sorular ve talimat enjeksiyonu → `bulundu:false`. Sohbet geçmişi son 4 mesaj.
- **Sağlayıcı zinciri**: `ANTHROPIC_API_KEY` varsa Claude (`claude-opus-5-5`, structured output JSON şema, effort low, sistem bağlamı cache'li, 45 sn); yoksa `GEMINI_API_KEY` ile Gemini: `GEMINI_MODEL` (vars. `gemini-flash-lite-latest`) → `GEMINI_YEDEK_MODEL` (vars. `gemini-flash-latest`) → `GEMMA_MODEL` (vars. `gemma-3-27b-it`; JSON modu/sistem talimatı yok, talimat ve biçim mesaja yazılır, JSON metinden ayıklanır). Her model 20 sn zaman aşımı; 429/5xx/zaman aşımında sıradakine; "API key" 400'ünde durur.
- Anahtar var ama hepsi başarısız → **503** ve arayüzde "Cevap alınamadı, tekrar dene" (eşleştirmeye düşülmez). Hiç anahtar yoksa eşleştirme (`cevapla`: Türkçe/İngilizce kök gruplarıyla olgu ve tarihçe cümlesi eşleme, zaman/kim/mimar/konum soruları için özel kurallar; eşleşme yoksa "Kaynaklarımızda bu bilgi yok").
- Arayüz etiketleri: `✓ Kaynaklı` + kitap + sayfa, `~ AI yorumu`.
- Ücretsiz Gemini günlük kotası model başınadır; asistan ile panel aynı anahtarı kullanırsa kota paylaşılır → panel için `GEMINI_PANEL_API_KEY` (ayrı AI Studio projesi).

### 11.2 Panel YZ (Aşama 6) – yalnız bilgi verir
- Açma: `AI_ENABLED=true` **ve** anahtar (`GEMINI_PANEL_API_KEY` ya da `GEMINI_API_KEY`). Kapalıysa panel aynen çalışır, kutuda "YZ analizi yapılamadı".
- Tek çağrı noktası `yz-servis.ts > yzJson(istek, hak)`: Gemini `generateContent`, `temperature 0`, `responseMimeType: application/json`, `responseSchema` (bizim `Sema` → Gemini biçimi), 25 sn; Flash-Lite → Flash; şemaya uymazsa bir kez yeniden. Her denemeden önce günlük hak düşer: `yz_cagri_hakki(YZ_GUNLUK_LIMIT)` (vars. 200, sayaç Supabase'de).
- Kişisel veri **maskeleme** (`lib/yz.ts > maskele`): e-posta, IBAN, TC kimlik no, telefon, adres, kendini tanıtma kalıplarındaki ad-soyad LLM'e gitmeden yer tutucuyla değişir (tarihî kişi adları korunur). Belge metni `<belge>` içine kaçışlı konur (`belgeGuvenli`).
- **6A Kaynak–bilgi eşleştirme** (`yz-kaynak.ts`): iddia (eser, alan, değer) + kaynağın ilgili sayfaları (`sayfaSec`: kök eşleşmesine göre en ilgili sayfalar, karakter sınırı). Kaynak metni: varsayılan kitap için `veri/kaynak-metinleri`, kütüphane dosyası için PDF (`unpdf`, sayfa başına <40 harf = taranmış → "okunamadı"; OCR yok), bağlantı için HTML (~4000 harflik bölümler; iç ağ adresleri engelli, 3 yönlendirme, 15 sn, 10 MB). Çıkan metin `kaynak_metinleri/kaynak_sayfalari`'nda önbellek. Sonuç: `destekliyor | celisiyor | bulunamadi`, güven `yuksek|orta|dusuk`, alıntı + sayfa; **alıntı kodla belgede aranır** (`pasajBul`), bulunamazsa uydurma sayılır. "Kaynakta bu sayfayı aç" = dosya adresi + `#page=<pdf_sayfa>`.
- **6B Öneri ön eleme** (`yz-eleme.ts`): etiketler `spam, anlamsiz, kaynaksiz, kaynak_alakasiz, mevcut_bilgiyle_ayni, mevcut_bilgiyle_celisiyor, degerli`; öncelik `yuksek|normal|dusuk`; gerekçe. `kaynaksiz` etiketini kod ekler. Tekrar tespiti LLM'siz (`benzerOneriler`: aynı eser+alan bekleyenler). Editör etiketi düzeltebilir (`yz_etiket_duzeltmeleri`, ekranda YZ'ninkinin yerine geçer). Hiçbir öneri silinmez/gizlenmez.
- Akış (`yz-analiz.ts`): öneri gönderilince / sürüm incelemeye girince `after()` ile yanıttan sonra (kaynak analizi önce, ön eleme onun sonucunu da kullanır). Aynı içerik özeti (`ozet`, sürüm etiketi `6a-1`/`6b-1` dahil) için tekrar çağrı yok; "Yeniden analiz et" yeni satır. Vercel'de kalıcı kuyruk yok: yarım kalanı Onay bekleyenler sayfası tetikler. `SUPABASE_SERVICE_ROLE_KEY` tanımlıysa analiz öneri anında sunucu istemcisiyle başlar.
- Editör kararı verdiğinde denetime "YZ önerisi görüldü, X onayladı/reddetti" (`yz_karar_kaydet`).
- **Dil uyumu** karşılaştırması (`yz-dil.ts`) bkz. §10.5.
- Testler LLM'i taklit eder (`tests/yz.test.ts`).

---

## 12. Supabase

Proje Feyza'nındır (mobil uygulamayla ortak). Önceden var olan tablolar: `profiller(id, ad)`, `pullar(kullanici, eser_id, tarih)`. Göçler `supabase/` altında, **sırayla** SQL Editor'da çalıştırılır; hepsi tekrar çalıştırılabilir (`if not exists`, `create or replace`, `drop policy if exists`). Yazma **yalnız `security definer` fonksiyonlarla**; tablolarda RLS açık, yalnız `select` politikaları.

> GOTCHA: Bu Supabase projesi yeni tabloları `anon`/`authenticated`'a otomatik vermiyor. Her yeni tabloya açıkça `grant select … to …` ve her fonksiyona `grant execute` yazılmalı.

| Dosya | İçerik |
|---|---|
| `001_roller.sql` | `rol_izinleri(rol, izin)` (seed §9), `kullanici_rolleri(kullanici pk→auth.users, rol check, atayan, tarih)`, `denetim_kaydi(id, kim, ne_zaman, islem, hedef, alan, eski jsonb, yeni jsonb, gerekce)`; fonksiyonlar `izin_var(text)`, `benim_izinlerim() → json {rol, izinler}`, `kullanicilari_listele()`, `rol_ata(hedef, yeni_rol)` (kullanici.yonet; denetime yazar). Repo kopyasında ilk super_admin e-postası yer tutucudur |
| `002_surumler.sql` | `eser_surumleri(id, eser_id, il, veri jsonb, durum taslak/incelemede/yayinda/reddedildi, islem ekle/duzenle/geri_al/arsivle/arsivden_cikar, arsivlendi, temel_surum, kaynak_id, sayfa, aciklama, ekleyen, ekleyen_ad, olusturuldu, inceleyen, inceleyen_ad, karar_tarihi, ret_gerekcesi)`; politika: `yayinda` herkese açık, panel ve sahibi diğerlerini okur; `denetim_kaydi` + `surum_id`, `kim_ad`; fonksiyonlar `benim_adim`, `denetime_yaz`, `surum_gonder`, `surum_incelemeye`, `surum_karar(p_id, p_onay, p_gerekce, p_degisiklikler)`, `surum_yayinla` (geri al/arşiv: doğrudan yayinda) |
| `003_kaynaklar.sql` | `kaynak_kutuphanesi` (§10.2), `bilgi_kaynaklari`; `kaynak_ekle`, `kaynak_dogrula`, `bilgi_kaynagi_ekle`; `surum_karar` güncellenir (onaylanan sürümün kaynağını `bilgi_kaynaklari`'na yazar); Storage politikaları (kova `kaynak-dosyalari`: authenticated kendi klasörüne yükler/siler; okuma panel, sahibi ya da doğrulanmış+herkese açık) |
| `004_yil_siniri.sql` | `kaynak_ekle`: yıl 1..bu yıl |
| `005_oneriler.sql` | `bilgi_onerileri` (§10.3, alan check, onerilen 1-2000, url `^https?://`, `kaynaksiz` generated, `hak_onayi`, durum bekliyor/kabul/reddedildi, `surum_id`, `eklenen_kaynak_id`); `oneri_gonder` (günde 20, rolü olana sınırsız), `oneri_reddet`, `oneri_kabul(p_id, p_il, p_veri, p_temel, p_degisiklikler, p_alan, p_deger, p_kaynak, p_konum, p_kutuphane jsonb)` atomik |
| `006_yz.sql` | `yz_analizleri(id, tur kaynak/eleme, hedef_tur oneri/surum, hedef_id, eser_id, ozet, durum bekliyor/tamam/hata, sonuc jsonb, hata, model, isteyen, isteyen_ad, olusturuldu, bitti)`, `kaynak_metinleri(anahtar, durum, sayfali, sayfa_sayisi)`, `kaynak_sayfalari(anahtar, sayfa, metin)`, `yz_gunluk_cagri(gun, sayi)`; `yz_yazabilir`, `yz_analiz_baslat`, `yz_analiz_bitir`, `yz_cagri_hakki(p_sinir)`, `kaynak_metni_kaydet`, `yz_karar_kaydet`; service_role izinleri |
| `007_yz_eleme.sql` | `yz_etiket_duzeltmeleri(oneri_id, analiz_id, yz_etiketler, yz_oncelik, etiketler, oncelik, kim, kim_ad, ne_zaman)`; `yz_etiket_duzelt` |
| `008_kitap_dosyalari.sql` | Kova sınırı 50 MB; envanter kitabı kütüphane satırları `tur=dosya, dosya_yolu=kitaplar/<id>.pdf, herkese_acik=false` (PDF'ler Storage'a elle yüklenir) |
| `010_eser_talepleri.sql` | Mobil uygulama talepleri: `eser_talepleri` yoksa kurar (Feyza'nın biçimi), `inceleyen, inceleyen_ad, karar_tarihi, ret_gerekcesi, karar_notu, olusturuldu` ekler; durum `bekliyor/kabul/reddedildi`; kısıtlayıcı ekleme kuralı (yeni talep bekliyor ve kararsız, üye yalnız kendi kimliğiyle); panel (eser.onayla) okur ve `talep-foto` fotoğraflarını okur; `talep_karar(p_id text, p_onay, p_gerekce)` denetime `talep_kabul`/`talep_reddet` yazar. service_role gerekmez |
| `009_dil_uyumu.sql` | `eser_surumleri.dil_uyumu`, `bilgi_onerileri.dil` (tr/en) ve `dil_uyumu`; `surum_gonder(..., p_dil_uyumu default false)` ve `oneri_gonder(..., p_dil default 'tr', p_dil_uyumu default false)` yeniden tanımlanır. Kod 009 olmadan da çalışır (parametre yalnız işaretliyse gider; EN öneri / uyum kutusu dostça hata verir) |

Supabase Auth ayarı: Redirect URLs'e `https://vakfiye.vercel.app/**` (ve dev adresleri) eklenmeli.

---

## 13. Ortam değişkenleri (yalnız adlar; değerler `.env.local` ve Vercel'de, **asla koda/belgeye yazılmaz**)

| Ad | Gerekli | Açıklama |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | evet | Supabase proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | evet | herkese açık (publishable) anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | hayır | yalnız sunucu; öneri anında arka plan YZ analizi |
| `VAKFIYE_YONETIM_SIFRESI` | hayır | dev'e özel tek şifreli panel girişi (dev'de yoksa `vakfiye`; prod'da kapalı) |
| `AI_ENABLED` | hayır | `true` ise panel YZ açık |
| `YZ_GUNLUK_LIMIT` | hayır | günlük panel YZ çağrısı (vars. 200) |
| `GEMINI_API_KEY` | asistan için | Google AI Studio ücretsiz anahtarı |
| `GEMINI_PANEL_API_KEY` | hayır | panel için ayrı kota |
| `GEMINI_MODEL`, `GEMINI_YEDEK_MODEL`, `GEMMA_MODEL` | hayır | model adları |
| `ANTHROPIC_API_KEY` | hayır | varsa asistan Claude kullanır (ücretli; şu an yok) |
| `VAKFIYE_TASLAK` | hayır | `1` ise prod'da taslaklar görünür |

`.env.example` depoda, `.env.local` gitignore'da.

---

## 14. Yayın (deploy)

- Vercel Hobby, proje GitHub `edpolat/web` (özel, kişisel hesap; Hobby özel **organizasyon** deposunu deploy edemediği için Tekinoglu-Firin/web'den taşındı). Push → otomatik deploy; yalnız eda'nın push'ları deploy olur. Canlı: **https://vakfiye.vercel.app/tr**.
- Env değişkenleri Vercel > Settings > Environment Variables'a da girilmeli.
- **Dosya yazan her şey Vercel'de kalıcı değil** (serverless salt okunur/geçici): eski kuyruk `veri/kuyruk`, demo kaydı, `/api/konum`. Kalıcı işler Supabase'de (sürümler, öneriler, kaynaklar, YZ).
- Eser sayfaları derlemede statik üretilir; onaydan sonra `revalidatePath("/[dil]", "layout")` + önbellek etiketleri ile yenilenir; yayındaki sürümler 5 dk önbellekli.
- Bulut geliştirme ortamı ve Mac VM'si `vercel.app`/`googleapis`/Supabase'e ulaşamaz; canlı denemeler tarayıcıdan yapılır. `GET /api/sor` asistan teşhisi verir.

---

## 15. Testler (`tests/`, vitest)

| Dosya | Kapsam |
|---|---|
| `filtre.test.ts` (8) | sadeleştirme, filtre, konumEksik |
| `katki.test.ts` (10) | eski kuyruk kuralları, kimlik üretimi, şema |
| `surum.test.ts` (8) | katmanlama, son yayındaki, alan farkları, yayına uygunluk |
| `kaynak.test.ts` (7) | kaynak formu, dosya türü (ilk baytlar) |
| `oneri.test.ts` (7) | öneri formu, oneriyiUygula |
| `dil-uyumu.test.ts` (9) | dil farkları, uyarı kuralı |
| `yetki.test.ts` (4) | rol/izin çözümü |
| `sor.test.ts` (18) | demo soruları, eşleştirme, yzCevabi |
| `yz.test.ts` (35) | maskeleme, sayfa seçme, alıntı, şemalar, eleme, LLM taklidi |
| `oyun.test.ts` (9) | oyun motoru, 300 tohum dersleri |
| `konum.test.ts` (4), `veri.test.ts` | konum yazma, veri okuma |

Bitmiş saymadan önce: `npm test`, `npm run lint`, veriye dokunulduysa `npm run dogrula`.

---

## 16. Bilinen eksikler ve açık işler

- Konum: hiçbir eserde `dogrulandi: true` yok; Konya/Hatay çoğu ilçe merkezi.
- ~79 EN metin çevrilmemiş (Konya/Hatay); Hatay'da adres yok (yalnız ilçe).
- Konya/Hatay kitap metinleri (`veri/kaynak-metinleri`) yok → YZ kaynak analizi bu kitaplar için çalışmaz (PDF gerekli).
- Fotoğraf öneri/katkısı yok; QR kartları yok (isteğe bağlı).
- Hayır ağı: bir takım arkadaşı yapıyor; bitince entegre edilecek (kendimiz yapmıyoruz).
- Oyun arayüzü takım arkadaşınca yeniden tasarlanacak.
- Eski dosya tabanlı kuyruk (`/api/katki`, `/api/onay`, `/yonetim/onay`) yerinde duruyor; Vercel'de kalıcı değil.
- Supabase Redirect URLs canlı girişte doğrulanmalı.
- Görsel lisans şartı organizatöre sorulacak.
- Takvim: geliştirme 7 Kasım 2026'da biter, kod dondurma 4 Kasım, final 7-8 Kasım.
