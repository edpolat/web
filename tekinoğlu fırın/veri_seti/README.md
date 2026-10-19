# Vakfiye veri seti

Vakıf eserleri, konumları ve her bilginin nereden geldiği. `veri/` klasöründen `npm run veri-seti` (ya da `python3 araclar/veri_seti.py`) ile üretilir. Bu klasördeki dosyaları elle düzenlemeyin: veri değişince komutu yeniden çalıştırın.

## Dosyalar

| Dosya | Ne için |
|---|---|
| `eserler.json` | Tüm eserler, tüm alanlar. Başında kaynak kodlarının açıklaması ve kaynakça var. |
| `eserler.jsonl` | Aynı kayıtlar, satır başına bir eser. Yapay zekâ araçlarına satır satır vermek için. |
| `belgeler.jsonl` | Her eser için tek paragraf düz metin (`id`, `metin`). Her cümlenin sonunda köşeli parantezde kaynağı yazar. Yapay zekâya bağlam olarak verilecek dosya budur. |
| `eserler.geojson` | Konumlu eserler, GeoJSON `Point`. Leaflet, Mapbox, QGIS doğrudan açar. Koordinat sırası GeoJSON gereği `[boylam, enlem]`. |
| `konumlar.csv` | Yalnız eser-konum tablosu, Excel'de açılır. |

## Kaynak kodları

Her alanın yanında `kaynak` yazar:

| Kod | Anlamı | Güven |
|---|---|---|
| `kitap` | Vakıf Katılım envanter kitabından birebir alındı. `kaynak_id` ve `sayfa` ile gelir. | Kesin bilgi olarak gösterilebilir, kaynağıyla. |
| `osm` | Konum, OpenStreetMap'teki aynı adlı yapının noktası. | Büyük ihtimalle doğru, ekip onayı bekliyor. |
| `osm_elle_eslesme` | OpenStreetMap'te adı farklı yazılmış yapı, Claude tarafından eşleştirildi (Simkeş → "Simkaş Mescidi" gibi). | `osm` ile aynı, biraz daha az kesin. |
| `geocoding` | Adres koordinata çevrildi. `hassasiyet` alanı neyi gösterdiğini söyler; `mahalle` ise nokta yalnız mahalle merkezidir. | Yaklaşık. Harita üzerinde "yaklaşık konum" diye gösterin. |
| `claude` | Claude'un çıkarımı ya da genel bilgisi, kitapta birebir yok: eser türü sınıflandırması, fotoğraf alt metinleri, taslak kayıtların bilgileri. | Kesin bilgi gibi gösterilmemeli. |
| `ekip` | Takımdan biri elle girip doğruladı. | Kesin. |

Konum kaydında ayrıca `dogrulandi` (ekip haritada kontrol etti mi), `hassasiyet` (`eser`, `adres`, `mahalle`, `ilce`, `yaklasik`) ve okunur bir `aciklama` var.

`taslak: true` olan eserlerin bilgileri doğrulanmadı. Uygulamanın yayın sürümünde gösterilmez.

## Bir kayıt

```json
{
  "id": "molla-fenari-camii",
  "il": { "id": "bursa", "ad": "Bursa" },
  "taslak": false,
  "ad": { "tr": "Molla Fenârî Camii ve Haziresi", "en": "Molla Fenari Mosque and Graveyard", "kaynak": "kitap", "kaynak_id": "vk-bursa-envanter-c1-2", "sayfa": "394-397" },
  "tur": { "id": "cami", "ad": "Cami", "kaynak": "claude" },
  "konum": { "enlem": 40.176984, "boylam": 29.059007, "kaynak": "osm", "hassasiyet": "eser", "dogrulandi": false },
  "olgular": [ { "metin": { "tr": "...", "en": "..." }, "kategori": "tarihce", "kaynak": "kitap", "kaynak_id": "vk-bursa-envanter-c1-2", "sayfa": "394" } ]
}
```

Diğer alanlar: `ilce`, `adres`, `banisi`, `mimar`, `donem`, `tarihce`, `mimari`, `vakif`, `gorseller` (fotoğrafın kendisi `kitap`, alt metni `claude`), `belge` (düz metin özeti).

## Yapay zekâya verirken

- Bağlam olarak `belgeler.jsonl` içindeki ilgili eserlerin metnini verin. Soru bir eserle ilgiliyse o eserin metni, konumla ilgiliyse ("yakınımdaki camiler") önce `eserler.geojson` ile mesafeye göre seçin, sonra metinlerini verin.
- Modelden cevabındaki her bilgi için köşeli parantezdeki kaynağı geri yazmasını isteyin. `kitap` dışındaki kaynaktan gelen bilgi "yaklaşık" ya da "doğrulanmadı" diye söylenmeli; veride olmayan bilgiye "Kaynaklarımızda bu bilgi yok" demeli.
- Mesafe hesabını modele bırakmayın, koordinatlarla kodda yapın.

## Durum

Bursa'da 51 eser, Konya'da 2 taslak. Bursa'da 35 eser bina noktasında (34'ü OpenStreetMap'ten, 1'i adres aramasıyla). 15 eser yalnız mahalle düzeyinde, Yeşil Cami yaklaşık; bu 16 eseri ekip konum düzenleme sayfasında yerleştirecek. Hiçbir konum henüz ekip tarafından onaylanmadı. Onaylandıkça `npm run veri-seti` yeniden çalıştırılır ve kaynakları `ekip` olur.
