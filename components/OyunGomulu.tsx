"use client";
// Vakıf oyunu (rabialtndl/vakfiye) tek dosya olarak public/oyun/vakfiye-oyun.js'de.
// Mobil uygulamadaki (feyzabb/vakfiye) Oyun sekmesiyle aynı paket ve aynı sözleşme:
//   VakfiyeOyun.baslat(kutu, araclar) / durdur()
// İki uygulama oyuna aynı araçları verir; böylece oyun webde ve telefonda aynı davranır:
//   pullar   → aynı Supabase "pullar" tablosu (telefonda alınan pul webde de görünür, level ve bölge açar)
//   kaydet/oku → "vakfiye:oyun:" önekiyle cihazda (mobildeki kayitYaz ile aynı anahtarlar)
//   eserAc   → sitedeki eser sayfası, yeni sekmede (mobilde Keşfet'teki eser kartı)
//   eserler  → bu sitenin /api/eserler ucu (aynı köken; yerelde ve önizlemede de o sitenin verisi)
//   dil      → sayfanın dili; /en/oyun İngilizce açılır (oyuncu oyun içinden değiştirebilir)
// Tam ekran: oyunun köşesindeki düğme. Tarayıcı destekliyorsa gerçek tam ekran (Fullscreen API),
// desteklemiyorsa (iPhone Safari) oyun kutusu sayfanın tamamını kaplar. Esc ile çıkılır.
// Klavye: YouTube'daki gibi F tam ekranı açar/kapatır. Oyun F'yi kullanmıyor; oyun iframe değil, aynı
// sayfada çizildiği için odak oyunun içindeyken de tuş yakalanır. Yazı alanına yazılırken (ör. oyuncu adı)
// ve Ctrl/Cmd/Alt kısayollarında devreye girmez.
// Paketi güncellemek için oyun reposunda `npm run build:gomulu`, çıkan dosyayı public/oyun/'a kopyala.
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { bulutHazir, oturumIzle, pullariGetir } from "@/lib/bulut";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

type Araclar = {
  bildir?: (metin: string) => void;
  pullar?: () => string[];
  kaydet?: (anahtar: string, deger: unknown) => void;
  oku?: <T>(anahtar: string, varsayilan: T) => T;
  eserAc?: (id: string) => void;
  eserler?: (turler: string[]) => Promise<GercekEser[]>;
  dil?: Dil;
};
type GercekEser = { id: string; ad: string; il: string; tur: string; ilce?: string; gorsel?: string; gorseller?: string[] };
type HamEser = { id: string; ad: { tr: string; en?: string } | string; il: string; tur: string; ilce?: string; gorseller?: { dosya: string }[] };
declare global {
  interface Window {
    VakfiyeOyun?: { baslat: (kutu: HTMLElement, araclar: Araclar) => void; durdur: () => void; surum: string };
  }
}

const ONEK = "vakfiye:oyun:";

let eserOnbellegi: Promise<HamEser[]> | null = null;

// Oyunun "Gerçek eseri gör" kartları için; görsel yolları sitenin köküne göredir (/gorseller/...).
async function eserler(turler: string[], dil: Dil): Promise<GercekEser[]> {
  eserOnbellegi ??= fetch("/api/eserler")
    .then((y) => (y.ok ? y.json() : { eserler: [] }))
    .then((j: { eserler?: HamEser[] }) => j.eserler ?? [])
    .catch(() => {
      eserOnbellegi = null; // bağlantı yoksa bir dahaki sefere tekrar dene
      return [];
    });
  return (await eserOnbellegi)
    .filter((e) => turler.includes(e.tur))
    .map((e) => ({
      id: e.id,
      ad: typeof e.ad === "string" ? e.ad : (dil === "en" && e.ad.en) || e.ad.tr,
      il: e.il,
      tur: e.tur,
      ilce: e.ilce,
      gorsel: e.gorseller?.[0]?.dosya,
      gorseller: e.gorseller?.map((g) => g.dosya),
    }));
}

function kaydet(anahtar: string, deger: unknown) {
  try {
    localStorage.setItem(ONEK + anahtar, JSON.stringify(deger));
  } catch {
    /* gizli sekme: yalnızca bu oturumda geçerli */
  }
}

function oku<T>(anahtar: string, varsayilan: T): T {
  try {
    const ham = localStorage.getItem(ONEK + anahtar);
    return ham ? (JSON.parse(ham) as T) : varsayilan;
  } catch {
    return varsayilan;
  }
}

// Safari eski sürümleri webkit önekli adları kullanır.
type OnekliBelge = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type OnekliOge = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

function tamEkrandakiOge(): Element | null {
  const b = document as OnekliBelge;
  return b.fullscreenElement ?? b.webkitFullscreenElement ?? null;
}

// Yazı yazılan yerlerde F harfi tam ekranı değil, metni değiştirmeli.
function yaziAlaniMi(hedef: EventTarget | null): boolean {
  if (!(hedef instanceof HTMLElement)) return false;
  if (hedef.isContentEditable) return true;
  if (hedef instanceof HTMLTextAreaElement || hedef instanceof HTMLSelectElement) return true;
  if (hedef instanceof HTMLInputElement) {
    // Kaydırıcı, onay kutusu, düğme gibi girişlerde F yazılmaz; oralarda kısayol çalışabilir.
    return !["range", "checkbox", "radio", "button", "submit", "reset", "color", "file", "image"].includes(hedef.type);
  }
  return false;
}

function TamEkranSimgesi({ acik }: { acik: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {acik ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </svg>
  );
}

export default function OyunGomulu({ dil }: { dil: Dil }) {
  const sahne = useRef<HTMLDivElement>(null);
  const kutu = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [hazir, setHazir] = useState(false);
  const pullar = useRef<string[]>([]);
  const [gercekTam, setGercekTam] = useState(false); // Fullscreen API ile
  const [sayfaTam, setSayfaTam] = useState(false); // API yoksa: sayfayı kaplayan kutu
  const tam = gercekTam || sayfaTam;
  const t = s(dil).oyun;

  // Giriş yapmış ziyaretçinin pulları; giriş/çıkışta yeniden okunur. Oyuna "vakfiye:pullar" olayıyla haber verilir.
  useEffect(() => {
    if (!bulutHazir) return; // Supabase ayarlı değilse pulsuz oynanır
    const yenile = () =>
      pullariGetir()
        .then((p) => (pullar.current = p))
        .catch(() => (pullar.current = []))
        .finally(() => window.dispatchEvent(new Event("vakfiye:pullar")));
    yenile();
    return oturumIzle(() => yenile());
  }, []);

  const tamEkrandanCik = useCallback(() => {
    setSayfaTam(false);
    if (tamEkrandakiOge()) {
      const b = document as OnekliBelge;
      try {
        void (b.exitFullscreen ? b.exitFullscreen() : b.webkitExitFullscreen?.())?.catch?.(() => {});
      } catch {
        /* zaten çıkılmış */
      }
    }
  }, []);

  useEffect(() => {
    if (!hazir || !kutu.current || !window.VakfiyeOyun) return;
    const oyun = window.VakfiyeOyun;
    oyun.baslat(kutu.current, {
      pullar: () => pullar.current.slice(),
      kaydet,
      oku,
      eserler: (turler) => eserler(turler, dil),
      // Eser kartı yeni sekmede açılır; oyun bu sekmede kaldığı yerde bekler.
      // Tarayıcı açılır pencereyi engellerse aynı sekmede eser sayfasına gidilir.
      eserAc: (id) => {
        const adres = `/${dil}/eser/${encodeURIComponent(id)}`;
        const sekme = window.open(adres, "_blank");
        if (sekme) {
          sekme.opener = null;
          return;
        }
        tamEkrandanCik();
        router.push(adres);
      },
      dil,
    });
    return () => oyun.durdur();
  }, [hazir, dil, router, tamEkrandanCik]);

  // Tarayıcının kendi tam ekranı (Esc, sistem hareketi) kapanınca düğmeyi eşitle.
  useEffect(() => {
    const degisti = () => setGercekTam(tamEkrandakiOge() === sahne.current);
    document.addEventListener("fullscreenchange", degisti);
    document.addEventListener("webkitfullscreenchange", degisti);
    return () => {
      document.removeEventListener("fullscreenchange", degisti);
      document.removeEventListener("webkitfullscreenchange", degisti);
    };
  }, []);

  // Yedek tam ekranda: sayfa kaymasın, Esc ile çıkılsın.
  useEffect(() => {
    if (!sayfaTam) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tus = (e: KeyboardEvent) => e.key === "Escape" && setSayfaTam(false);
    window.addEventListener("keydown", tus);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", tus);
    };
  }, [sayfaTam]);

  // F tuşu: düğmeyle aynı işi yapar. Klavye olayı kullanıcı etkileşimi sayıldığından tarayıcı izin verir.
  const fTusu = useRef<() => void>(() => {});
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key.toLocaleLowerCase("tr") !== "f" || e.repeat || e.defaultPrevented || e.isComposing) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl/Cmd+F: tarayıcının "sayfada bul"u
      if (yaziAlaniMi(e.target)) return;
      e.preventDefault();
      fTusu.current();
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, []);

  // Oyunda fareyle sürüklerken sayfadaki yazılar seçilmesin. Seçim oyunun içinde başlıyorsa
  // engellenir; oyundaki yazı alanlarında (vakıf adı vb.) seçim serbest kalır.
  useEffect(() => {
    const oge = sahne.current;
    if (!oge) return;
    const secimBasladi = (e: Event) => {
      const hedef = e.target instanceof Node && !(e.target instanceof Element) ? e.target.parentElement : e.target;
      if (yaziAlaniMi(hedef)) return;
      e.preventDefault();
    };
    oge.addEventListener("selectstart", secimBasladi);
    return () => oge.removeEventListener("selectstart", secimBasladi);
  }, []);

  async function tamEkranDegistir() {
    if (tam) return tamEkrandanCik();
    const oge = sahne.current as OnekliOge | null;
    if (!oge) return;
    try {
      if (oge.requestFullscreen) await oge.requestFullscreen({ navigationUI: "hide" });
      else if (oge.webkitRequestFullscreen) await oge.webkitRequestFullscreen();
      else throw new Error("desteklenmiyor");
    } catch {
      setSayfaTam(true); // iPhone Safari gibi tarayıcılarda öğe tam ekranı yok
    }
  }

  fTusu.current = () => void tamEkranDegistir();

  return (
    <>
      <Script src="/oyun/vakfiye-oyun.js" strategy="afterInteractive" onReady={() => setHazir(true)} />
      <div ref={sahne} className={`oyun-sahne${tam ? " oyun-sahne--tam" : ""}`}>
        <div ref={kutu} className="oyun-kutusu" />
        <button
          type="button"
          className="oyun-tam-ekran"
          onClick={tamEkranDegistir}
          aria-pressed={tam}
          aria-label={tam ? t.tamEkranCik : t.tamEkran}
          title={tam ? t.tamEkranCik : t.tamEkran}
        >
          <TamEkranSimgesi acik={tam} />
        </button>
      </div>
    </>
  );
}
