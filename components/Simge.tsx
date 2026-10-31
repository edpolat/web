// Mobil uygulamanın alt menüsündeki çizgi simgeleri. Süs içindir, ekran okuyucuya gösterilmez.
export type SimgeAdi = "kesfet" | "harita" | "pasaport" | "oyun" | "erisim" | "yapi" | "kaynak" | "foto" | "dinle" | "sor" | "sergi" | "tara";

const YOLLAR: Record<SimgeAdi, React.ReactNode> = {
  // Çerçeveli resim: sergi.
  sergi: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="15.5" cy="8.5" r="1.5" />
    </>
  ),
  // QR çerçevesi: tara (uygulamanın alt menüsündeki simge).
  tara: <path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4M4 12h16" />,
  kesfet: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" />
    </>
  ),
  harita: (
    <>
      <polygon points="3,6 9,4 15,6 21,4 21,18 15,20 9,18 3,20" />
      <line x1="9" y1="4" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="20" />
    </>
  ),
  pasaport: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </>
  ),
  oyun: (
    <>
      <path d="M4 20V11l8-6 8 6v9z" />
      <path d="M10 20v-5h4v5" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </>
  ),
  erisim: (
    <>
      <path d="M4 18 8 6l4 12" />
      <line x1="5.3" y1="14" x2="10.7" y2="14" />
      <path d="M14 18l3-8 3 8" />
      <line x1="15" y1="15.5" x2="19" y2="15.5" />
    </>
  ),
  // Mobildeki eser simgesi: kubbe ve minare.
  yapi: (
    <>
      <path d="M3 20v-5a5 5 0 0 1 10 0v5" />
      <path d="M13 20v-4a3 3 0 0 1 6 0" />
      <line x1="20" y1="20" x2="20" y2="7" />
      <path d="M19 9l1-3 1 3" />
      <line x1="2" y1="20" x2="22" y2="20" />
      <line x1="8" y1="10" x2="8" y2="8.5" />
    </>
  ),
  kaynak: (
    <>
      <path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z" />
      <path d="M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z" />
    </>
  ),
  foto: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M8 6l1.5-2h5L16 6" />
    </>
  ),
  dinle: (
    <>
      <polygon points="4,9 8,9 13,5 13,19 8,15 4,15" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  sor: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M10 9a2 2 0 1 1 2.5 1.9c-.3.1-.5.4-.5.7V12" />
      <line x1="12" y1="13.6" x2="12" y2="13.7" />
    </>
  ),
};

export default function Simge({ ad, boyut = 20, className }: { ad: SimgeAdi; boyut?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={boyut}
      height={boyut}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {YOLLAR[ad]}
    </svg>
  );
}
