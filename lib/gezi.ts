import type { Dil } from "./tipler";

// Mobil uygulamadan 3 Kas 2026'da webe taşınan özellikler (uygulamada duzenleme.js ve uygulama.js'in
// "Rotalarım" bölümü): Ziyaret bilgisi, Gitmek istiyorum + Paylaş, Yakınımda / mesafe, Rotalarım,
// kesik cümle düzeltmesi, öne çıkan eser cümlesi. Metinler uygulamadakilerle aynı tutuldu.

const metinler = {
  tr: {
    bilgi: {
      baslik: "ZİYARET BİLGİSİ",
      bugun: "Bugün",
      acikMi: "Açık mı?",
      ucret: "Ücret",
      konum: "Konum",
      sayfa: (s: string) => `envanter s. ${s}`,
      muzeAcik: "Müze olarak kullanılıyor; giriş saatleri için müzenin güncel bilgisine bak.",
      muzeUcret: "Müzeler genellikle ücretlidir; Müzekart geçerli olabilir.",
      yaklasik: "Bu eserin konumu yaklaşık. Yol tarifi seni yakınına götürür; son metrelerde çevreye sorman gerekebilir.",
      not: "Açık mı ve ücret bilgisi geneldir; eserin kendi saatleri farklı olabilir.",
      genel: {
        ibadet: {
          acik: "Camiler genellikle sabah namazından yatsıya kadar açıktır. Küçük mahalle ve köy camileri vakit aralarında kilitli olabilir.",
          ucret: "Giriş ücretsizdir.",
        },
        turbe: { acik: "Türbeler çoğunlukla gündüz açıktır; bekçisi yoksa kapalı olabilir.", ucret: "Giriş genellikle ücretsizdir." },
        yapi: {
          acik: "Bu tür yapılar bugün müze, dükkân ya da kafe gibi farklı amaçlarla kullanılıyor olabilir; açılış saatleri yapıya göre değişir.",
          ucret: "Müze ya da işletme olarak kullanılıyorsa giriş ücretli olabilir.",
        },
        cesme: { acik: "Açık alanda; her saatte görülebilir.", ucret: "Ücretsiz." },
      },
    },
    gitmek: {
      dugme: "Gitmek istiyorum",
      listende: "Listende",
      eklendi: "Gitmek istediklerine eklendi.",
      cikti: "Listenden çıkarıldı.",
      baslik: "GİTMEK İSTEDİKLERİM",
      bos: "Bir eser sayfasında ♡ Gitmek istiyorum'a bas; burada listelensin.",
      cikar: "Listeden çıkar",
      cihazda: "Bu liste bu tarayıcıda saklanır.",
    },
    paylas: { dugme: "Paylaş", kopyalandi: "Bağlantı kopyalandı.", kopyala: "Bağlantıyı kopyala:" },
    yakin: {
      sira: "Sıralama",
      onerilen: "Önerilen",
      az: "A–Z",
      yakinimda: "Yakınımda",
      aliniyor: "Konumun alınıyor…",
      yok: "Konum alınamadı. Tarayıcıda konum iznini kontrol et.",
      desteklenmiyor: "Bu tarayıcı konum vermiyor.",
      mesafe: "Sana uzaklığı",
    },
    rota: {
      baslik: "ROTALARIM",
      bos: "Gezmek istediğin eserleri seç, kendi gezi planını oluştur.",
      olustur: "Rota oluştur",
      durak: (n: number) => `${n} durak`,
      durakSiniri: (n: number, en: number) => `${n} / ${en} durak`,
      rotam: "ROTAM",
      yolTarifi: "Yol tarifi al",
      yaklasik: "Bazı eserlerin konumu yaklaşıktır.",
      duzenle: "Düzenle",
      sil: "Sil",
      silinsinMi: (ad: string) => `"${ad}" rotası silinsin mi?`,
      kapat: "Kapat",
      vazgec: "Vazgeç",
      kaydet: "Kaydet",
      yeni: "YENİ ROTA",
      duzenleBaslik: "ROTAYI DÜZENLE",
      adYer: "Rotanın adı (ör. Cumartesi gezisi)",
      ad: "Rotanın adı",
      eserEkle: "ESER EKLE",
      tumu: "Tümü",
      ara: "Eser ara",
      durakYok: "Henüz durak yok. Aşağıdan en az 2 eser ekle.",
      daralt: "Daha fazlası için aramayı daralt.",
      bulunamadi: "Eser bulunamadı.",
      adVer: "Rotana bir ad ver.",
      enAz: "Rotaya en az 2 eser ekle.",
      enCok: (n: number) => `Bir rotada en çok ${n} durak olabilir.`,
      kaydedildi: (ad: string) => `Rotan kaydedildi: ${ad}`,
      eklendi: (ad: string) => `Rotana eklendi: ${ad}`,
      rotamaEkle: "Rotama ekle",
      rotamaEkleBaslik: "ROTAMA EKLE",
      yeniRota: "＋ Yeni rota",
      buRotada: "Bu rotada",
      yukari: "Yukarı taşı",
      asagi: "Aşağı taşı",
      cikar: "Çıkar",
      pulAlindi: "Pul alındı",
      cihazda: "Rotaların bu tarayıcıda saklanır; giriş yaparsan hesabına da kaydedilir ve uygulamada da görünür.",
      hesapta: "Rotaların hesabına kaydedilir; uygulamada da aynı rotaları görürsün.",
    },
    bilgisiz:
      "Bu eserin envanter bilgileri henüz eklenmedi. Yandaki “Bu esere sor” ile sorabilir, bildiğin bir bilgi ya da fotoğrafı önerebilirsin.",
  },
  en: {
    bilgi: {
      baslik: "VISITOR INFO",
      bugun: "Today",
      acikMi: "Open?",
      ucret: "Fee",
      konum: "Location",
      sayfa: (s: string) => `inventory p. ${s}`,
      muzeAcik: "Used as a museum; check the museum's current opening hours.",
      muzeUcret: "Museums usually charge entry; the Museum Card may be valid.",
      yaklasik: "This monument's location is approximate. Directions take you nearby; you may need to ask around for the last stretch.",
      not: "Opening and fee info is general; this monument's own hours may differ.",
      genel: {
        ibadet: {
          acik: "Mosques are usually open from dawn until the night prayer. Small neighbourhood and village mosques may be locked between prayers.",
          ucret: "Entry is free.",
        },
        turbe: { acik: "Tombs are mostly open during the day; they may be closed if there is no caretaker.", ucret: "Entry is usually free." },
        yapi: {
          acik: "Buildings like this may now be used as a museum, shop or café; opening hours vary.",
          ucret: "If it is used as a museum or business, there may be an entry fee.",
        },
        cesme: { acik: "Outdoors; can be seen at any time.", ucret: "Free." },
      },
    },
    gitmek: {
      dugme: "Want to visit",
      listende: "On your list",
      eklendi: "Added to your list.",
      cikti: "Removed from your list.",
      baslik: "WANT TO VISIT",
      bos: "Tap ♡ Want to visit on a monument page to list it here.",
      cikar: "Remove from list",
      cihazda: "This list is kept in this browser.",
    },
    paylas: { dugme: "Share", kopyalandi: "Link copied.", kopyala: "Copy the link:" },
    yakin: {
      sira: "Sort",
      onerilen: "Suggested",
      az: "A–Z",
      yakinimda: "Near me",
      aliniyor: "Getting your location…",
      yok: "Location unavailable. Check location permission in your browser.",
      desteklenmiyor: "This browser can't share your location.",
      mesafe: "Distance from you",
    },
    rota: {
      baslik: "MY ROUTES",
      bos: "Pick the monuments you want to visit and build your own trip plan.",
      olustur: "Create route",
      durak: (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`,
      durakSiniri: (n: number, en: number) => `${n} / ${en} stops`,
      rotam: "MY ROUTE",
      yolTarifi: "Get directions",
      yaklasik: "Some locations are approximate.",
      duzenle: "Edit",
      sil: "Delete",
      silinsinMi: (ad: string) => `Delete the route "${ad}"?`,
      kapat: "Close",
      vazgec: "Cancel",
      kaydet: "Save",
      yeni: "NEW ROUTE",
      duzenleBaslik: "EDIT ROUTE",
      adYer: "Route name (e.g. Saturday trip)",
      ad: "Route name",
      eserEkle: "ADD MONUMENTS",
      tumu: "All",
      ara: "Search monuments",
      durakYok: "No stops yet. Add at least 2 monuments below.",
      daralt: "Narrow your search to see more.",
      bulunamadi: "No monuments found.",
      adVer: "Give your route a name.",
      enAz: "Add at least 2 monuments to the route.",
      enCok: (n: number) => `A route can have at most ${n} stops.`,
      kaydedildi: (ad: string) => `Route saved: ${ad}`,
      eklendi: (ad: string) => `Added to route: ${ad}`,
      rotamaEkle: "Add to my route",
      rotamaEkleBaslik: "ADD TO MY ROUTE",
      yeniRota: "＋ New route",
      buRotada: "In this route",
      yukari: "Move up",
      asagi: "Move down",
      cikar: "Remove",
      pulAlindi: "Stamp collected",
      cihazda: "Your routes are kept in this browser; if you log in they are saved to your account and also appear in the app.",
      hesapta: "Your routes are saved to your account; you will see the same routes in the app.",
    },
    bilgisiz:
      "This monument's inventory details have not been added yet. You can use “Ask about this monument”, or suggest a fact or photo you know.",
  },
};

export function g(dil: Dil) {
  return metinler[dil];
}

/* ---------- Ziyaret bilgisi ---------- */

export type GenelTur = "ibadet" | "turbe" | "yapi" | "cesme";
/** Açık mı / ücret için genel tür (uygulamadaki GENEL_TURU); listede olmayan türler "yapi". */
export const GENEL_TURU: Record<string, GenelTur> = {
  cami: "ibadet",
  mescit: "ibadet",
  kulliye: "ibadet",
  turbe: "turbe",
  "zaviye-tekke": "turbe",
  cesme: "cesme",
  sebil: "cesme",
};

/** Envanterin "Günümüz" bilgisinde yapının bugünkü kullanımını söyleyen cümle. */
export const DURUM_CUMLESI =
  /(ibadete açık|ibadete kapalı|müze olarak|müzesi olarak|olarak kullanılmaktadır|olarak hizmet vermektedir|atıl|yıkık|harap|kullanılmamaktadır|restorasyon(u)? (devam|sürmektedir))/i;

/** Uzun bilgiden yalnızca durumu söyleyen cümle; bulunamazsa metnin tamamı. */
export function durumCumlesi(metin: string): string {
  const cumleler = metin.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ“"])/);
  return cumleler.find((c) => DURUM_CUMLESI.test(c)) ?? metin;
}

/* ---------- Mesafe ---------- */

export function mesafeKm(enlem1: number, boylam1: number, enlem2: number, boylam2: number): number {
  const R = 6371,
    r = Math.PI / 180;
  const a =
    Math.sin(((enlem2 - enlem1) * r) / 2) ** 2 +
    Math.cos(enlem1 * r) * Math.cos(enlem2 * r) * Math.sin(((boylam2 - boylam1) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function mesafeYazisi(km: number, dil: Dil = "tr"): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 100) return `${dil === "tr" ? km.toFixed(1).replace(".", ",") : km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/* ---------- Kesik cümleler ----------
   Envanter kitabından aktarılırken sayfa geçişinde bazı bilgilerin başı kopmuş; küçük harfle, kelimenin
   ortasından başlıyorlar ("nemin birçok görkemli yapısının…"). Ekranda kopuk baş atlanır, ardından gelen
   tam cümleler kalır; geriye tam cümle kalmazsa bilgi gösterilmez. Yalnızca baş harfi küçük kalmış ama tam
   bir sözcükle başlayan cümleler büyük harfle başlatılır. Veri dosyası değişmez (uygulamadaki madde 15). */
const TAM_BASLANGIC =
  /^(bu|şu|o|ve|ancak|fakat|ayrıca|yine|daha|ise|bir|her|cami|caminin|mescit|mescidin|yapı|yapının|eser|eserin|the|this|it|and|but)\s/;

export function kopukBasiAt(metin: string): string {
  const m = String(metin ?? "").trim();
  if (!/^[a-zçğıöşüâîû]/.test(m)) return m;
  if (TAM_BASLANGIC.test(m)) return m.charAt(0).toLocaleUpperCase("tr") + m.slice(1);
  const i = m.search(/[.!?…][”"’)]?\s+(?=[A-ZÇĞİÖŞÜ“"0-9])/);
  return i < 0 ? "" : m.slice(i).replace(/^[.!?…][”"’)]?\s+/, "");
}

/** Olguların kopuk başlarını atar; geriye bir şey kalmayanları çıkarır. */
export function kesikleriDuzelt<T extends { metin: { tr: string; en?: string } }>(olgular: T[]): T[] {
  const sonuc: T[] = [];
  for (const o of olgular) {
    const tr = kopukBasiAt(o.metin.tr);
    if (tr === o.metin.tr.trim()) {
      sonuc.push(o);
      continue;
    }
    if (!tr) continue;
    const en = o.metin.en ? kopukBasiAt(o.metin.en) || o.metin.en : o.metin.en;
    sonuc.push({ ...o, metin: { ...o.metin, tr, ...(en !== undefined ? { en } : {}) } });
  }
  return sonuc;
}

/* ---------- Öne çıkan eser cümlesi ----------
   Kim yaptırdığını ya da ne zaman yapıldığını söyleyen kısa, güçlü bir envanter cümlesi (uygulamadaki madde 12). */
const ZAYIF_CUMLE = /(bulunmamakta|bilinmemekte|yer almamakta|bilgi yok|yoktur|söylenebilir|restor|tamir|onarı|çevril|plan|çatı|malzeme|ebatlarında|×)/i;
const GUCLU_CUMLE = /(inşa ettiril|yaptırıl|yaptırmış|yaptırdığı|tarafından[^.]*(inşa|yaptır|yapıl)|kitâbesine göre|kitabesine göre|vakfet)/i;

export function oneCikanCumle<T extends { kategori: string; metin: { tr: string } }>(olgular: T[]): T | undefined {
  // Tarihçenin ilk iki cümlesi ve vakıf cümleleri (sonraki cümleler çoğu kez başka yapılardan söz eder)
  const adaylar = olgular
    .filter((o) => o.kategori === "tarihce")
    .slice(0, 2)
    .concat(olgular.filter((o) => o.kategori === "vakif"));
  return adaylar.find((o) => {
    const m = o.metin.tr.trim();
    return (
      m.length >= 40 &&
      m.length <= 130 &&
      /^[A-ZÇĞİÖŞÜ0-9“"]/.test(m) &&
      !/^(Yine|Ayrıca|Bununla|Bu |Ancak|Fakat)/.test(m) &&
      GUCLU_CUMLE.test(m) &&
      !ZAYIF_CUMLE.test(m)
    );
  });
}

/* ---------- Yol tarifi ---------- */

/** Google Haritalar yürüyüş tarifi; son nokta hedef, öncekiler ara durak (Google en çok 10 nokta alır). */
export function yolTarifiAdresi(noktalar: { enlem: number; boylam: number }[]): string | null {
  const n = noktalar.map((k) => `${k.enlem},${k.boylam}`);
  const hedef = n.pop();
  if (!hedef) return null;
  let adres = `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${encodeURIComponent(hedef)}`;
  if (n.length) adres += `&waypoints=${encodeURIComponent(n.join("|"))}`;
  return adres;
}

/* ---------- Harita renkleri ----------
   Uygulamada (madde 13) cami ile külliye neredeyse aynı renkteydi ve 11 türden yalnızca 3'ü lejanttaydı.
   Artık dört ayrı renk var, geri kalan türler "Diğer" gri. Altın "ziyaret ettiğin" için ayrılmış. */
export const HARITA_RENKLERI: Record<string, string> = {
  cami: "#17488f",
  mescit: "#0077b6",
  kulliye: "#2f6b5b",
  medrese: "#8a4b3c",
};
export const DIGER_RENK = "#8c96a3";
export const ALTIN = "#c9a45c";
export const turRengi = (tur: string) => HARITA_RENKLERI[tur] ?? DIGER_RENK;
