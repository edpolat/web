"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import L from "leaflet";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { metin } from "@/lib/metin";
import type { Dil, IlliEser, Konum } from "@/lib/tipler";
import { z } from "@/lib/ziyaret";
import { ALTIN, turRengi } from "@/lib/gezi";

// Mobil uygulamadaki harita (Desktop/vakfiye uygulama.js + stil.css) webe taşındı:
// Esri sokak haritası, sol üstte "Harita | Uydu" seçici, sağ üstte yuvarlak ◎ Konumum, sağ altta yakınlaştırma,
// damla biçimli işaretler (içinde türün baş harfi, yaklaşık konumda içi boş kesik çizgi, pulu alınmış eser altın ✓),
// birbirine yakın işaretler lacivert, altın halkalı sayı dairesinde toplanır (yakınlaşınca ayrılır).

type Props = {
  dil: Dil;
  eserler: Pick<IlliEser, "id" | "ad" | "konum" | "tur">[];
  /** Listede üzerine gelinen eser haritada büyür. */
  vurgulu?: string;
  merkez: Pick<Konum, "enlem" | "boylam">;
  yakinlastirma: number;
  yukseklik?: number;
  /** Ziyaret edilmiş (pulu alınmış) eserler altın işaretlenir. */
  ziyaretli?: string[];
  /** Uydu katmanı, "Konumum" düğmesi ve kümeleme (Keşfet haritası). */
  araclar?: boolean;
};

const BAS_HARF: Record<string, string> = { cesme: "Ç", sebil: "S", turbe: "T", kumbet: "K", hamam: "H", han: "H", kulliye: "K" };
const basHarf = (tur: string) => BAS_HARF[tur] ?? tur.charAt(0).toLocaleUpperCase("tr");

/** Uygulamadaki damla işaret (uygulama.js isaretYap). */
function damla(tur: string, yaklasik: boolean, ziyaretli: boolean, vurgulu: boolean) {
  const renk = ziyaretli ? ALTIN : turRengi(tur);
  const sinif = ["pin", yaklasik && !ziyaretli ? "yaklasik" : "", ziyaretli ? "ziyaret" : "", vurgulu ? "vurgulu" : ""].filter(Boolean).join(" ");
  const boy = vurgulu ? 38 : ziyaretli ? 34 : 30;
  return L.divIcon({
    className: "pin-kap",
    iconSize: [boy, boy + 8],
    iconAnchor: [boy / 2, boy + 6],
    tooltipAnchor: [0, -(boy + 4)],
    html: `<div class="${sinif}" style="--renk:${renk}"><span>${ziyaretli ? "✓" : basHarf(tur)}</span></div>`,
  });
}

/** Uygulamadaki küme dairesi (leaflet.markercluster iconCreateFunction). */
function kumeIkonu(sayi: number, ziyaretli: boolean) {
  const boy = sayi >= 100 ? 46 : 40;
  return L.divIcon({
    className: "pin-kap",
    iconSize: [boy, boy],
    html: `<div class="kume${ziyaretli ? " ziyaretli" : ""}">${sayi}</div>`,
  });
}

/** Haritanın üstündeki düğmeler tıklayınca haritayı kaydırmasın/yakınlaştırmasın. */
function useDurdur() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);
  return ref;
}

/** Sol üst: "Harita | Uydu" (uygulamadaki .katman-secici). */
function KatmanSecici({ dil, katman, sec }: { dil: Dil; katman: "sokak" | "uydu"; sec: (k: "sokak" | "uydu") => void }) {
  const t = z(dil).harita;
  const ref = useDurdur();
  return (
    <div ref={ref} className="harita-katman-secici" role="group" aria-label={`${t.sokak} / ${t.uydu}`}>
      <button type="button" aria-pressed={katman === "sokak"} onClick={() => sec("sokak")}>{t.sokak}</button>
      <button type="button" aria-pressed={katman === "uydu"} onClick={() => sec("uydu")}>{t.uydu}</button>
    </div>
  );
}

/** Sağ üst: yuvarlak ◎ "Konumum" (uygulamadaki .konumum). Konumu alınca mavi nokta koyar. */
function Konumum({ dil }: { dil: Dil }) {
  const harita = useMap();
  const t = z(dil).harita;
  const [yer, setYer] = useState<[number, number]>();
  const [hata, setHata] = useState(false);
  const ref = useDurdur();
  function bul() {
    setHata(false);
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const k: [number, number] = [p.coords.latitude, p.coords.longitude];
        setYer(k);
        harita.setView(k, 16);
      },
      () => setHata(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <>
      <div ref={ref} className="harita-konumum-kutu">
        <button type="button" className="harita-konumum-dugme" onClick={bul} title={t.konumum} aria-label={t.konumum}>
          ◎
        </button>
        {hata && (
          <p className="harita-hata" role="alert">
            {t.konumYok}
          </p>
        )}
      </div>
      {yer && (
        <CircleMarker center={yer} radius={9} pathOptions={{ color: "#ffffff", fillColor: "#1A73E8", fillOpacity: 1, weight: 3 }}>
          <Popup>{t.buradasin}</Popup>
        </CircleMarker>
      )}
    </>
  );
}

type IsaretProps = {
  dil: Dil;
  id: string;
  ad: string;
  enlem: number;
  boylam: number;
  tur: string;
  yaklasik: boolean;
  vurgulu: boolean;
  ziyaretli: boolean;
  acik: boolean;
  ziyaretYazi: string;
  onUzerinde: (id: string) => void;
  onAyrildi: () => void;
  onTikla: (id: string) => void;
};

/**
 * Tek eser işareti (damla). Ad yalnızca fare üzerine gelince (dokunmatikte ilk dokunuşta) görünür.
 * Noktaya ya da ada tıklamak eser sayfasını açar.
 */
const EserIsareti = memo(function EserIsareti(p: IsaretProps) {
  const ikon = useMemo(() => damla(p.tur, p.yaklasik, p.ziyaretli, p.vurgulu), [p.tur, p.yaklasik, p.ziyaretli, p.vurgulu]);
  return (
    <Marker
      position={[p.enlem, p.boylam]}
      icon={ikon}
      title={p.ad}
      zIndexOffset={p.vurgulu ? 1000 : p.ziyaretli ? 500 : 0}
      bubblingMouseEvents={false}
      eventHandlers={{
        mouseover: () => p.onUzerinde(p.id),
        mouseout: p.onAyrildi,
        click: () => p.onTikla(p.id),
      }}
    >
      {p.acik && (
        <Tooltip permanent interactive direction="top" className="harita-ad">
          <Link href={`/${p.dil}/eser/${p.id}`} onMouseEnter={() => p.onUzerinde(p.id)} onMouseLeave={p.onAyrildi}>
            {p.ad}
            {p.ziyaretli && <small> · {p.ziyaretYazi}</small>}
            <span aria-hidden="true"> ›</span>
          </Link>
        </Tooltip>
      )}
    </Marker>
  );
});

type Nokta = { id: string; ad: string; enlem: number; boylam: number; tur: string; yaklasik: boolean };
type Kume = { enlem: number; boylam: number; uyeler: Nokta[] };

/** Yakın işaretleri ekrandaki uzaklığa göre toplar (uygulamadaki maxClusterRadius: 40). Ek paket gerekmez. */
const KUMESIZ_ZOOM = 17;

function kumele(harita: L.Map, noktalar: Nokta[], yaricap = 40): Kume[] {
  const zoom = harita.getZoom();
  // Çok yakında artık toplanmaz; aynı noktadaki eserler (ör. ilçe merkezindeki yaklaşık konumlar) küçük bir çembere açılır.
  if (zoom >= KUMESIZ_ZOOM) {
    const gruplar = new Map<string, Nokta[]>();
    for (const n of noktalar) {
      const a = `${n.enlem.toFixed(6)},${n.boylam.toFixed(6)}`;
      gruplar.set(a, [...(gruplar.get(a) ?? []), n]);
    }
    return [...gruplar.values()].flatMap((g) =>
      g.map((n, i) => {
        if (g.length === 1) return { enlem: n.enlem, boylam: n.boylam, uyeler: [n] };
        const p = harita.project([n.enlem, n.boylam], zoom);
        const r = 22 + g.length * 2.5;
        const aci = (2 * Math.PI * i) / g.length;
        const m = harita.unproject([p.x + r * Math.cos(aci), p.y + r * Math.sin(aci)], zoom);
        return { enlem: m.lat, boylam: m.lng, uyeler: [{ ...n, enlem: m.lat, boylam: m.lng }] };
      }),
    );
  }
  const kumeler: (Kume & { x: number; y: number })[] = [];
  for (const n of noktalar) {
    const p = harita.project([n.enlem, n.boylam], zoom);
    const k = kumeler.find((c) => Math.abs(c.x - p.x) < yaricap && Math.abs(c.y - p.y) < yaricap);
    if (k) {
      k.uyeler.push(n);
      const s = k.uyeler.length;
      k.x += (p.x - k.x) / s;
      k.y += (p.y - k.y) / s;
    } else kumeler.push({ x: p.x, y: p.y, enlem: n.enlem, boylam: n.boylam, uyeler: [n] });
  }
  return kumeler.map((k) => {
    const m = harita.unproject([k.x, k.y], zoom);
    return { enlem: m.lat, boylam: m.lng, uyeler: k.uyeler };
  });
}

/** Kümeleri yakınlaştırma/kaydırma değiştikçe yeniden hesaplar. */
function Kumeler({ noktalar, children }: { noktalar: Nokta[]; children: (k: Kume[]) => React.ReactNode }) {
  const harita = useMap();
  const [surum, setSurum] = useState(0);
  useMapEvents({ zoomend: () => setSurum((s) => s + 1) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kumeler = useMemo(() => kumele(harita, noktalar), [harita, noktalar, surum]);
  return <>{children(kumeler)}</>;
}

/** Fare ile üzerine gelinemeyen (dokunmatik) cihaz mı? */
function dokunmatikMi() {
  return typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
}

/** Haritada boş bir yere dokunulunca açık ad kutusunu kapatır (dokunmatik ekranlar için). */
function BosTiklama({ onTikla }: { onTikla: () => void }) {
  useMapEvents({ click: onTikla });
  return null;
}

/** Küme dairesine tıklayınca o kümenin eserlerini gösterecek kadar yakınlaşır. */
function KumeIsareti({ kume, ziyaretli }: { kume: Kume; ziyaretli: boolean }) {
  const harita = useMap();
  const ikon = useMemo(() => kumeIkonu(kume.uyeler.length, ziyaretli), [kume.uyeler.length, ziyaretli]);
  return (
    <Marker
      position={[kume.enlem, kume.boylam]}
      icon={ikon}
      bubblingMouseEvents={false}
      eventHandlers={{
        click: () => {
          const sinir = L.latLngBounds(kume.uyeler.map((u) => [u.enlem, u.boylam] as [number, number]));
          if (sinir.getNorthEast().equals(sinir.getSouthWest())) harita.setView(sinir.getCenter(), Math.max(harita.getZoom() + 2, KUMESIZ_ZOOM));
          else harita.fitBounds(sinir, { padding: [48, 48], maxZoom: 18 });
        },
      }}
    />
  );
}

export default function Harita({ dil, eserler, merkez, yakinlastirma, yukseklik = 420, vurgulu, ziyaretli = [], araclar }: Props) {
  const t = z(dil).harita;
  const ziyaret = useMemo(() => new Set(ziyaretli), [ziyaretli]);
  const router = useRouter();
  const [katman, setKatman] = useState<"sokak" | "uydu">("sokak");
  const [acik, setAcik] = useState<string>();
  const acikRef = useRef<string | undefined>(undefined);
  acikRef.current = acik;
  const kapatSaati = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(kapatSaati.current), []);

  const noktalar = useMemo<Nokta[]>(
    () =>
      eserler
        .filter((e) => e.konum)
        .map((e) => ({
          id: e.id,
          ad: metin(e.ad, dil),
          enlem: e.konum!.enlem,
          boylam: e.konum!.boylam,
          tur: e.tur,
          yaklasik: e.konum!.hassasiyet === "mahalle" || e.konum!.hassasiyet === "ilce",
        })),
    [eserler, dil],
  );

  const onUzerinde = useCallback((id: string) => {
    if (dokunmatikMi()) return;
    clearTimeout(kapatSaati.current);
    setAcik(id);
  }, []);
  const onAyrildi = useCallback(() => {
    if (dokunmatikMi()) return;
    clearTimeout(kapatSaati.current);
    kapatSaati.current = setTimeout(() => setAcik(undefined), 250);
  }, []);
  const onTikla = useCallback(
    (id: string) => {
      if (dokunmatikMi() && acikRef.current !== id) {
        clearTimeout(kapatSaati.current);
        setAcik(id);
        return;
      }
      router.push(`/${dil}/eser/${id}`);
    },
    [router, dil],
  );
  const bosTikla = useCallback(() => setAcik(undefined), []);

  const isaret = (n: Nokta) => (
    <EserIsareti
      key={n.id}
      dil={dil}
      id={n.id}
      ad={n.ad}
      enlem={n.enlem}
      boylam={n.boylam}
      tur={n.tur}
      yaklasik={n.yaklasik}
      vurgulu={n.id === vurgulu}
      ziyaretli={ziyaret.has(n.id)}
      acik={n.id === acik}
      ziyaretYazi={t.ziyaret}
      onUzerinde={onUzerinde}
      onAyrildi={onAyrildi}
      onTikla={onTikla}
    />
  );

  return (
    <MapContainer
      center={[merkez.enlem, merkez.boylam]}
      zoom={yakinlastirma}
      style={{ height: yukseklik }}
      className="harita harita-uygulama"
      scrollWheelZoom={false}
      zoomControl={false}
    >
      {katman === "sokak" ? (
        <TileLayer
          key="sokak"
          maxZoom={19}
          attribution="Harita &copy; Esri, HERE, OpenStreetMap"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        />
      ) : (
        <>
          <TileLayer key="uydu" maxZoom={19} attribution="Uydu &copy; Esri, Maxar" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          <TileLayer key="uydu-ad" maxZoom={19} url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
        </>
      )}
      <ZoomControl position="bottomright" />
      {araclar && <KatmanSecici dil={dil} katman={katman} sec={setKatman} />}
      {araclar && <Konumum dil={dil} />}
      <BosTiklama onTikla={bosTikla} />
      {araclar ? (
        <Kumeler noktalar={noktalar}>
          {(kumeler) =>
            kumeler.map((k) =>
              k.uyeler.length === 1 || k.uyeler.some((u) => u.id === vurgulu) ? (
                k.uyeler.map(isaret)
              ) : (
                <KumeIsareti key={k.uyeler[0].id + ":" + k.uyeler.length} kume={k} ziyaretli={k.uyeler.some((u) => ziyaret.has(u.id))} />
              ),
            )
          }
        </Kumeler>
      ) : (
        noktalar.map(isaret)
      )}
    </MapContainer>
  );
}
