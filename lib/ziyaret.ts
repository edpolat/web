import type { Dil } from "./tipler";

// Mobil uygulamadan webe taşınan ziyaretçi özelliklerinin metinleri (Tara, ziyaret adabı, namaz vakti,
// mimari sözlük, hikâye kartı, Keşfet vitrini, harita, şifre sıfırlama, bilgi/fotoğraf önerisi, ana ekrana ekle).
// Uygulamadaki (Desktop/tekinoğlu fırın/vakfiye) metinlerle aynı tutuldu.

/** Kâğıt pasaportun kimlik sayfasındaki QR'ın numarası (uygulamadaki PASAPORT_NO). */
export const PASAPORT_NO = "VK-2026-0001";

const metinler = {
  tr: {
    tara: {
      sekme: "Tara",
      pulTara: "Pul tara",
      buradaysan: "Buradaysan tara",
      baslik: "QR kodu okut",
      alt: "Eserdeki ya da pasaportundaki QR kodu kameraya göster.",
      kameraAc: "Kamerayı aç",
      kameraKapat: "Kamerayı kapat",
      kameraYok: "Kamera açılamadı. Tarayıcıda kamera iznini ver ya da kodu listeden seç.",
      kutuphaneYok: "Kamera kütüphanesi yüklenemedi. İnterneti kontrol et.",
      listeden: "Kamera yoksa okutulacak kodu listeden seç:",
      kagit: `Kâğıt pasaport · ${PASAPORT_NO}`,
      kagitAlt: (bagli: boolean) => (bagli ? "Bağlı" : "Kimlik sayfasındaki kod"),
      rotaSec: "Rota",
      pulAlindi: " · pul alındı ✓",
      yabanci: "Bu kod Vakfiye'ye ait değil.",
      pulBildirim: (ad: string) => `Pul alındı: ${ad}`,
      rozetYari: "🏅 Rozet kazandın: Yarı yol!",
      rozetTamam: (rota: string) => `🏅 Rozet kazandın: ${rota} tamam!`,
      kagitBildirim: `Kâğıt pasaportun bağlandı: ${PASAPORT_NO}`,
      rotaDisi: "Bu eser rotada değil; pul yok ama sayfasını açıyoruz.",
      misafir: "Üye değilsin: pulların yalnız bu tarayıcıda saklanır. Giriş yapınca hesabına aktarılır.",
      pasaportaGit: "Pasaportuma git",
      kagitBaslik: "KÂĞIT PASAPORT",
      bagli: "Bağlı",
      kagitNot: (n: number) => `Kâğıtta ${n} damga · webde ${n} pul`,
    },
    adab: {
      baslik: "ZİYARET ADABI",
      ibadet: [
        "Omuzları ve dizleri örten kıyafet giy; kadınlar başını örtmeli, yanında bir şal bulundur.",
        "Ayakkabılarını girişte çıkar.",
        "Namaz kılanların önünden geçme, sessiz ol.",
        "Fotoğraf çekerken flaş kullanma, ibadet edenleri görüntüleme.",
      ],
      turbe: [
        "Sessiz ve saygılı ol; sandukalara dokunma, yaslanma.",
        "İçeride halı varsa ayakkabılarını çıkar.",
        "Omuzları ve dizleri örten kıyafet giy.",
      ],
      kilise: ["Ayin sırasında sessiz ol ve fotoğraf çekme.", "Omuzları ve dizleri örten kıyafet giy."],
      yapi: [
        "Taşlara, kitâbelere ve çinilere dokunma, yaslanma.",
        "Yapı bugün dükkân, kafe ya da müze olarak kullanılıyorsa çalışanlara sorarak gez.",
        "Fotoğraf çekerken içeridekilerin iznini al.",
      ],
      cesme: ["Çeşmenin taşına ve kitâbesine dokunma, üzerine çıkma.", "Suyu içilebilir değilse işaretlere uy."],
      vakitler: { Fajr: "Sabah", Dhuhr: "Öğle", Asr: "İkindi", Maghrib: "Akşam", Isha: "Yatsı" },
      yukleniyor: "Namaz vakitleri yükleniyor…",
      alinamadi: "Namaz vakitleri alınamadı.",
      kaynak: "Vakitler: Diyanet hesabı, aladhan.com",
      siradaki: (ad: string, saat: string) => `Sıradaki vakit: ${ad} ${saat}`,
      bitti: "Bugün başka vakit yok.",
      cuma: (saat: string, dk: number) =>
        `Cuma namazı ${saat}'de (${dk} dk kaldı). Hutbe ve namaz boyunca (yaklaşık 45 dk) cami kalabalık olur.`,
      yaklasiyor: (ad: string, dk: number, saat: string) =>
        `${ad} namazına ${dk} dk var (${saat}). Namaz yaklaşık 20 dakika sürer; ziyaretini sonrasına bırakabilirsin.`,
      girdi: (ad: string, saat: string) =>
        `${ad} namazı vakti girdi (${saat}). Cemaat namazı sürüyor olabilir; içeri girmeden önce bekle.`,
    },
    terim: { etiket: "MİMARİ SÖZLÜK", kapat: "Kapat", ipucu: "Altı noktalı kelimelere dokununca anlamı açılır." },
    hikaye: {
      olustur: "Hikâye kartı oluştur",
      baslik: "Hikâye kartın",
      paylas: "Paylaş",
      indir: "İndir",
      kapat: "Kapat",
      alt: "Rota tamamlama kartı",
      pasaport: "KÜLTÜR PASAPORTU",
      tamamladim: "rotasını tamamladım",
      pul: "pul",
    },
    vitrin: {
      baslik1: "Geçmişin izlerini",
      baslik2: "keşfet.",
      alt: "Vakıf eserleriyle kültür yolculuğuna çık.",
      oneCikan: "Öne Çıkan Eser",
      bugun: "BUGÜNÜN ESERİ",
      sehirler: "Şehirleri Keşfet",
      kategoriler: "Kategoriler",
      eser: (n: number) => `${n} eser`,
      tumEserler: "Tüm Eserler",
      deprem: "Hatay envanteri 2023 depremlerinden önce hazırlandı. Eserlerin bugünkü durumu farklı olabilir.",
    },
    harita: {
      sokak: "Harita",
      uydu: "Uydu",
      konumum: "Konumum",
      konumYok: "Konumun alınamadı. Tarayıcıda konum iznini ver.",
      buradasin: "Buradasın",
      ziyaret: "Ziyaret ettiğin (pulu alınmış) eser",
    },
    sifre: {
      unuttum: "Şifremi unuttum",
      epostaYaz: "Önce e-posta adresini yaz, sonra Şifremi unuttum'a bas.",
      gonderildi: "Şifre sıfırlama bağlantısı e-postana gönderildi. Gelen kutunu (ve gereksiz klasörünü) kontrol et.",
      yeniBaslik: "Yeni şifre belirle",
      yeni: "Yeni şifre",
      tekrar: "Yeni şifre (tekrar)",
      kaydet: "Şifreyi kaydet",
      ayniDegil: "İki şifre aynı değil.",
      guncellendi: "Şifren güncellendi.",
      gecersiz: "Şifre bağlantısı geçersiz ya da süresi dolmuş. Yeniden iste.",
    },
    talep: {
      dugme: "Bilgi / fotoğraf öner",
      aciklama: "Bu eser hakkında bildiğin ek bir bilgi ya da fotoğrafın mı var? Bize gönder, ekibimiz inceleyip ekleyebilir.",
      onerin: "Önerin",
      yer: "Örn: Camiin avlusundaki çeşme 1950'lerde eklendi…",
      foto: (n: number) => `Fotoğraf (en fazla ${n})`,
      fazla: (n: number) => `En fazla ${n} fotoğraf gönderilir.`,
      gonder: "Gönder",
      not: "Önerin yönetim ekibine iletilir; incelenmeden yayınlanmaz. Üye olmadan da gönderebilirsin.",
      bos: "Bir bilgi yaz ya da fotoğraf ekle.",
      bekle: "Biraz bekleyip tekrar dene.",
      yukleniyor: "Fotoğraflar yükleniyor…",
      gonderiliyor: "Gönderiliyor…",
      hata: "Gönderilemedi, internetini kontrol edip tekrar dene.",
      tesekkur: "Teşekkürler!",
      tesekkurMetin: "Önerin yönetim ekibine ulaştı. İncelendikten sonra eserin sayfasına eklenebilir.",
      tamam: "Tamam",
      kapat: "Kapat",
      ayarYok: "Öneri sistemi bu kurulumda ayarlanmadı.",
      kaynakliOneri: "Kaynaklı bilgi ekle (giriş gerekir)",
    },
    yukle: {
      dugme: "Ana ekrana ekle",
      baslik: "Vakfiye'yi ana ekrana ekle",
      iphone: ["Safari'nin altındaki Paylaş düğmesine bas.", "Listeden Ana Ekrana Ekle'yi seç.", "Sağ üstteki Ekle'ye bas."],
      android: ["Chrome'un sağ üstündeki ⋮ menüsünü aç.", "Uygulamayı yükle ya da Ana Ekrana Ekle'yi seç.", "Açılan pencerede Yükle'ye bas."],
      yukle: "Yükle",
      kapat: "Kapat",
    },
  },
  en: {
    tara: {
      sekme: "Scan",
      pulTara: "Scan a stamp",
      buradaysan: "At the site? Scan the QR",
      baslik: "Scan a QR code",
      alt: "Hold the QR code on the monument or your passport up to the camera.",
      kameraAc: "Open camera",
      kameraKapat: "Close camera",
      kameraYok: "The camera could not be opened. Allow camera access in the browser or choose the code from the list.",
      kutuphaneYok: "The camera library could not be loaded. Check your internet connection.",
      listeden: "No camera? Choose the code to scan from the list:",
      kagit: `Paper passport · ${PASAPORT_NO}`,
      kagitAlt: (bagli: boolean) => (bagli ? "Linked" : "Code on the ID page"),
      rotaSec: "Route",
      pulAlindi: " · stamp collected ✓",
      yabanci: "This code does not belong to Vakfiye.",
      pulBildirim: (ad: string) => `Stamp collected: ${ad}`,
      rozetYari: "🏅 Badge earned: Halfway!",
      rozetTamam: (rota: string) => `🏅 Badge earned: ${rota} complete!`,
      kagitBildirim: `Your paper passport is linked: ${PASAPORT_NO}`,
      rotaDisi: "This monument is not on a route; no stamp, but we are opening its page.",
      misafir: "You are not signed in: stamps are kept only in this browser. They move to your account when you sign in.",
      pasaportaGit: "Go to my passport",
      kagitBaslik: "PAPER PASSPORT",
      bagli: "Linked",
      kagitNot: (n: number) => `${n} stamps on paper · ${n} on the web`,
    },
    adab: {
      baslik: "VISITING ETIQUETTE",
      ibadet: [
        "Wear clothes that cover shoulders and knees; women should cover their hair, so carry a scarf.",
        "Take off your shoes at the entrance.",
        "Do not walk in front of people praying; keep quiet.",
        "Do not use flash and do not photograph worshippers.",
      ],
      turbe: [
        "Be quiet and respectful; do not touch or lean on the cenotaphs.",
        "Take off your shoes if there is a carpet inside.",
        "Wear clothes that cover shoulders and knees.",
      ],
      kilise: ["Keep quiet and do not take photos during services.", "Wear clothes that cover shoulders and knees."],
      yapi: [
        "Do not touch or lean on the stones, inscriptions or tiles.",
        "If the building is now a shop, café or museum, ask the staff before looking around.",
        "Ask permission before photographing people inside.",
      ],
      cesme: ["Do not touch or climb on the fountain's stone and inscription.", "If the water is not drinkable, follow the signs."],
      vakitler: { Fajr: "Dawn", Dhuhr: "Noon", Asr: "Afternoon", Maghrib: "Sunset", Isha: "Night" },
      yukleniyor: "Loading prayer times…",
      alinamadi: "Prayer times could not be loaded.",
      kaynak: "Times: Diyanet method, via aladhan.com",
      siradaki: (ad: string, saat: string) => `Next prayer: ${ad} ${saat}`,
      bitti: "No more prayers today.",
      cuma: (saat: string, dk: number) =>
        `Friday prayer at ${saat} (in ${dk} min). The mosque will be crowded during the sermon and prayer (about 45 min).`,
      yaklasiyor: (ad: string, dk: number, saat: string) =>
        `${ad} prayer in ${dk} min (${saat}). Prayer takes about 20 minutes; consider visiting afterwards.`,
      girdi: (ad: string, saat: string) =>
        `${ad} prayer time began at ${saat}. The congregation may still be praying; wait before going in.`,
    },
    terim: { etiket: "ARCHITECTURE GLOSSARY", kapat: "Close", ipucu: "Tap a dotted word to see what it means." },
    hikaye: {
      olustur: "Create story card",
      baslik: "Your story card",
      paylas: "Share",
      indir: "Download",
      kapat: "Close",
      alt: "Route completion card",
      pasaport: "CULTURE PASSPORT",
      tamamladim: "route completed",
      pul: "stamps",
    },
    vitrin: {
      baslik1: "Discover the traces",
      baslik2: "of the past.",
      alt: "Set out on a cultural journey through endowed monuments.",
      oneCikan: "Featured Monument",
      bugun: "MONUMENT OF THE DAY",
      sehirler: "Explore Cities",
      kategoriler: "Categories",
      eser: (n: number) => `${n} monuments`,
      tumEserler: "All Monuments",
      deprem: "The Hatay inventory was prepared before the 2023 earthquakes. The monuments' current condition may differ.",
    },
    harita: {
      sokak: "Map",
      uydu: "Satellite",
      konumum: "My location",
      konumYok: "Your location could not be found. Allow location access in the browser.",
      buradasin: "You are here",
      ziyaret: "Visited (stamp collected)",
    },
    sifre: {
      unuttum: "Forgot password",
      epostaYaz: "Type your e-mail address first, then press Forgot password.",
      gonderildi: "A password reset link was sent to your e-mail. Check your inbox (and spam folder).",
      yeniBaslik: "Set a new password",
      yeni: "New password",
      tekrar: "New password (again)",
      kaydet: "Save password",
      ayniDegil: "The two passwords do not match.",
      guncellendi: "Your password was updated.",
      gecersiz: "The password link is invalid or has expired. Request a new one.",
    },
    talep: {
      dugme: "Suggest info / photo",
      aciklama: "Do you have extra information or a photo about this monument? Send it to us and our team may add it after review.",
      onerin: "Your suggestion",
      yer: "E.g. The fountain in the courtyard was added in the 1950s…",
      foto: (n: number) => `Photos (up to ${n})`,
      fazla: (n: number) => `Up to ${n} photos are sent.`,
      gonder: "Send",
      not: "Your suggestion goes to the admin team and is not published before review. No account needed.",
      bos: "Write some information or add a photo.",
      bekle: "Please wait a moment and try again.",
      yukleniyor: "Uploading photos…",
      gonderiliyor: "Sending…",
      hata: "Could not send. Check your connection and try again.",
      tesekkur: "Thank you!",
      tesekkurMetin: "Your suggestion reached the admin team. It may be added to the monument's page after review.",
      tamam: "OK",
      kapat: "Close",
      ayarYok: "Suggestions are not set up in this installation.",
      kaynakliOneri: "Add a sourced fact (sign-in required)",
    },
    yukle: {
      dugme: "Add to home screen",
      baslik: "Add Vakfiye to your home screen",
      iphone: ["Tap the Share button at the bottom of Safari.", "Choose Add to Home Screen.", "Tap Add in the top right."],
      android: ["Open Chrome's ⋮ menu in the top right.", "Choose Install app or Add to Home Screen.", "Tap Install in the dialog that opens."],
      yukle: "Install",
      kapat: "Close",
    },
  },
};

export type ZiyaretMetinleri = (typeof metinler)["tr"];

export function z(dil: Dil): ZiyaretMetinleri {
  return metinler[dil] as ZiyaretMetinleri;
}

/** Ziyaret adabı türü (uygulamadaki ADAB_TURU). */
export const ADAB_TURU: Record<string, "ibadet" | "turbe" | "kilise" | "yapi" | "cesme"> = {
  cami: "ibadet",
  mescit: "ibadet",
  kulliye: "ibadet",
  turbe: "turbe",
  "zaviye-tekke": "turbe",
  kilise: "kilise",
  // 3 Kas: uygulamada ziyaret adabı medrese, han, hamam, çeşme ve diğer yapılarda da çıkıyor.
  medrese: "yapi",
  han: "yapi",
  hamam: "yapi",
  imaret: "yapi",
  "bedesten-carsi": "yapi",
  kutuphane: "yapi",
  darussifa: "yapi",
  diger: "yapi",
  cesme: "cesme",
  sebil: "cesme",
};

export const VAKIT_ANAHTARLARI = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type Vakitler = Partial<Record<(typeof VAKIT_ANAHTARLARI)[number], string>>;

/** Namaz vaktine göre uyarı (uygulamadaki namazUyarisi): vakte 20 dk kala / girdikten 25 dk sonrasına kadar; Cuma öğlesinde 45 dk. */
export function namazUyarisi(vakit: Vakitler, dil: Dil, simdi = new Date()): { uyari: string | null; siradaki: string | null } {
  const t = z(dil).adab;
  const dakika = simdi.getHours() * 60 + simdi.getMinutes();
  const cuma = simdi.getDay() === 5;
  let uyari: string | null = null;
  let siradaki: string | null = null;
  for (const k of VAKIT_ANAHTARLARI) {
    const saat = vakit[k];
    if (!saat) continue;
    const [s, d] = saat.split(":").map(Number);
    const fark = s * 60 + d - dakika;
    const ad = t.vakitler[k];
    const cumaVakti = cuma && k === "Dhuhr";
    const once = cumaVakti ? 45 : 20;
    const sonra = cumaVakti ? 45 : 25;
    if (!uyari && fark > 0 && fark <= once) uyari = cumaVakti ? t.cuma(saat, fark) : t.yaklasiyor(ad, fark, saat);
    else if (!uyari && fark <= 0 && -fark <= sonra) uyari = t.girdi(ad, saat);
    if (siradaki === null && fark > 0) siradaki = t.siradaki(ad, saat);
  }
  return { uyari, siradaki };
}

/** Güne göre değişen sıra numarası (uygulamadaki "Bugünün eseri"). */
export function gununSirasi(uzunluk: number, simdi = Date.now()): number {
  return uzunluk ? Math.floor(simdi / 86400000) % uzunluk : 0;
}
