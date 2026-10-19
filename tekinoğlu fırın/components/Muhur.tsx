// Vakfiye mührü: mobil uygulamanın açılış ekranındaki sekiz köşeli yıldızlı daire.
export default function Muhur({ boyut = 120, className }: { boyut?: number; className?: string }) {
  const cizgiler = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const ic = i % 4 === 0 ? 40 : 42;
    return { x1: 50 + Math.cos(a) * ic, y1: 50 + Math.sin(a) * ic, x2: 50 + Math.cos(a) * 44, y2: 50 + Math.sin(a) * 44 };
  });
  return (
    <svg viewBox="0 0 100 100" width={boyut} height={boyut} className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="50" cy="50" r="48" />
        {cizgiler.map((c, i) => (
          <line key={i} {...c} strokeWidth="0.8" />
        ))}
        <rect x="27" y="27" width="46" height="46" />
        <rect x="27" y="27" width="46" height="46" transform="rotate(45 50 50)" />
        <polygon points="50,30 68,50 50,70 32,50" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="10" />
        <circle cx="50" cy="50" r="7" strokeWidth="0.8" />
      </g>
      <polygon
        fill="currentColor"
        points="50,44.5 51.6,48.4 55.6,48.6 52.5,51.1 53.6,55 50,52.8 46.4,55 47.5,51.1 44.4,48.6 48.4,48.4"
      />
    </svg>
  );
}
