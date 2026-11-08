import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Panel tablolarının ortak parçaları (yeni tablo tasarımı, 7 Kas 2026): simgeler, sayfa başlığı ve hücre biçimleri.
 * Etkileşimli tablonun kendisi PanelTabloGovde.tsx'te (hap süzgeçleri, arama, sıralama, sayfalama).
 */

/** Panel tablolarındaki işlem simgeleri (16px çizgi simge). Bağlantının kendisi title ve aria-label taşır. */
const YOLLAR = {
  duzenle: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  gecmis: "M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  sitede: "M14 3h7v7M10 14 21 3M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5",
  sil: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14",
  gor: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
} as const;

export function IslemIkonu({ ad }: { ad: keyof typeof YOLLAR }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={YOLLAR[ad]} />
    </svg>
  );
}

/** Tablo, başlık ve hap simgeleri (24'lük çizgi simge, currentColor). */
const SIMGELER = {
  ...YOLLAR,
  liste: "M4 5h16v5H4zM4 14h16v5H4zM7 7.5h2M7 16.5h2",
  kisi: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  kisiler: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7",
  cami: "M3 21h18M4 10h16M12 3l8 5H4zM6 10v8M10 10v8M14 10v8M18 10v8M3 18h18",
  katman: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  takvim: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h1M12 14h1M16 14h1M8 17h1M12 17h1",
  belge: "M5 3h14v18H5zM8 8h8M8 12h8M8 16h5",
  saat: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  sirala: "M8 9l4-4 4 4M8 15l4 4 4-4",
  ok: "M5 12h14M13 6l6 6-6 6",
  ara: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  bilgi: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01",
  sol: "M15 6l-6 6 6 6",
  sag: "M9 6l6 6-6 6",
  durum: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  kitap: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
  harita: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  etiket: "M3 12V3h9l9 9-9 9zM7.5 7.5h.01",
  sayfa: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h4",
  rol: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z",
  yildiz: "M12 2l2.4 4.2L19 5l-1.2 4.6L22 12l-4.2 2.4L19 19l-4.6-1.2L12 22l-2.4-4.2L5 19l1.2-4.6L2 12l4.2-2.4L5 5l4.6 1.2zM12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z",
  suzgec: "M4 5h16l-6 8v6l-4-2v-4z",
  ekle: "M12 5v14M5 12h14",
  yz: "M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
} as const;

export type SimgeAdi = keyof typeof SIMGELER;

export function PanelSimge({ ad, boyut = 18 }: { ad: SimgeAdi; boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={SIMGELER[ad]} />
    </svg>
  );
}

/** Sayfa başlığı: yuvarlak simge, başlık ve alt yazı; sağda isteğe bağlı düğmeler. */
export function PanelBaslik({ simge, baslik, alt, children }: { simge: SimgeAdi; baslik: ReactNode; alt?: ReactNode; children?: ReactNode }) {
  return (
    <header className="pt-baslik">
      <div className="pt-baslik-sol">
        <span className="pt-baslik-simge">
          <PanelSimge ad={simge} boyut={28} />
        </span>
        <div>
          <h1>{baslik}</h1>
          {alt && <p>{alt}</p>}
        </div>
      </div>
      {children && <div className="pt-baslik-sag">{children}</div>}
    </header>
  );
}

/** Tarih üstte kalın, saat altta; solda saat simgesi. */
export function Zaman({ iso, dil }: { iso: string; dil: string }) {
  const d = new Date(iso);
  const yer = dil === "tr" ? "tr-TR" : "en-GB";
  return (
    <div className="pt-zaman">
      <PanelSimge ad="saat" boyut={20} />
      <div>
        <b>{d.toLocaleDateString(yer, { day: "numeric", month: "short", year: "numeric" })}</b>
        <span>{d.toLocaleTimeString(yer, { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}

/** Kişi: yuvarlak avatar, ad ve isteğe bağlı alt satır (ör. e-posta). */
export function Kisi({ ad, alt }: { ad: ReactNode; alt?: ReactNode }) {
  return (
    <div className="pt-kisi">
      <span className="pt-avatar">
        <PanelSimge ad="kisi" boyut={20} />
      </span>
      <span>
        {ad}
        {alt && <small>{alt}</small>}
      </span>
    </div>
  );
}

/** Nötr etiket (hedef, yer, nitelik…): her zaman aynı renk; href verilirse bağlantı olur. */
export function Cip({ simge, href, children, title }: { simge: SimgeAdi; href?: string; children: ReactNode; title?: string }) {
  const ic = (
    <>
      <PanelSimge ad={simge} />
      <span>{children}</span>
    </>
  );
  return href ? (
    <Link className="pt-cip" href={href} title={title}>
      {ic}
    </Link>
  ) : (
    <span className="pt-cip" title={title}>
      {ic}
    </span>
  );
}

/** Kalın başlık, soluk açıklama ve isteğe bağlı küçük durum satırı (kırmızı ya da yeşil). */
export function IslemMetni({
  baslik,
  aciklama,
  durum,
  durumRengi = "kirmizi",
}: {
  baslik: ReactNode;
  aciklama?: ReactNode;
  durum?: ReactNode;
  durumRengi?: "kirmizi" | "yesil";
}) {
  return (
    <div className="pt-islem">
      <b>{baslik}</b>
      {aciklama && <p>{aciklama}</p>}
      {durum && <span className={`pt-durumsatir ${durumRengi}`}>{durum}</span>}
    </div>
  );
}

/** Noktalı durum yazısı (zeminsiz, sade). */
export function DurumNoktasi({ renk, children, alt }: { renk: "yesil" | "sari" | "kirmizi" | "gri"; children: ReactNode; alt?: ReactNode }) {
  return (
    <span className="pt-durum-kap">
      <span className={`pt-durum ${renk}`}>{children}</span>
      {alt && <small>{alt}</small>}
    </span>
  );
}

/** Satır sonundaki yuvarlak düğme bağlantısı. */
export function YuvarlakDugme({
  href,
  simge = "ok",
  etiket,
  tehlike,
  yeniSekme,
}: {
  href: string;
  simge?: SimgeAdi;
  etiket: string;
  tehlike?: boolean;
  yeniSekme?: boolean;
}) {
  return (
    <Link
      className={`pt-ok${tehlike ? " tehlike" : ""}`}
      href={href}
      title={etiket}
      aria-label={etiket}
      {...(yeniSekme ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <PanelSimge ad={simge} />
    </Link>
  );
}
