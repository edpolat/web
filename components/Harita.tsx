"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { CircleMarker, LayerGroup, LayersControl, MapContainer, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { metin } from "@/lib/metin";
import type { Dil, IlliEser, Konum } from "@/lib/tipler";
import { z } from "@/lib/ziyaret";

// Mobil uygulamadaki işaret renkleri: türün rengi; yaklaşık konumda içi boş ve kesik çizgili; pulu alınmış eser altın.
const TUR_RENGI: Record<string, string> = { cami: "#17488f", mescit: "#0077b6", kulliye: "#123d3a" };
const DIGER_RENK = "#1b263b";
const ALTIN = "#c9a45c";

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
  /** Uydu katmanı ve "Konumum" düğmesi (Keşfet haritası). */
  araclar?: boolean;
};

/** "Konumum": tarayıcıdan konumu alır, haritayı oraya götürür ve mavi nokta koyar (uygulamadaki ◎ düğmesi). */
function Konumum({ dil }: { dil: Dil }) {
  const harita = useMap();
  const t = z(dil).harita;
  const [yer, setYer] = useState<[number, number]>();
  const [hata, setHata] = useState(false);
  function bul() {
    setHata(false);
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const k: [number, number] = [p.coords.latitude, p.coords.longitude];
        setYer(k);
        harita.setView(k, 15);
      },
      () => setHata(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <>
      <div className="leaflet-top leaflet-left harita-konumum">
        <div className="leaflet-control leaflet-bar">
          <button type="button" onClick={bul} title={t.konumum} aria-label={t.konumum}>
            ◎
          </button>
        </div>
        {hata && (
          <p className="leaflet-control harita-hata" role="alert">
            {t.konumYok}
          </p>
        )}
      </div>
      {yer && (
        <CircleMarker center={yer} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#0077b6", fillOpacity: 1, weight: 3 }}>
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
  /** Yakınlaştırılmış haritada ad sürekli görünür. */
  adSurekli: boolean;
  ziyaretYazi: string;
  onUzerinde: (id: string) => void;
  onAyrildi: () => void;
  onTikla: (id: string) => void;
};

/**
 * Tek eser işareti. Fare üzerine gelince eser adı hemen görünür; noktaya ya da ada tek tıklamak eser sayfasını açar.
 * Ad kutusu ayrı tutulur (Leaflet'in kendi hover kapatması fare ada geçerken kutuyu kapattığı için).
 */
const EserIsareti = memo(function EserIsareti(p: IsaretProps) {
  const stil = p.vurgulu
    ? { color: "#17488f", fillColor: "#fcbd00", fillOpacity: 1, weight: 3 }
    : p.ziyaretli
      ? { color: "#ffffff", fillColor: ALTIN, fillOpacity: 1, weight: 2 }
      : p.yaklasik
        ? { color: TUR_RENGI[p.tur] ?? DIGER_RENK, fillColor: "#ffffff", fillOpacity: 0.8, weight: 2, dashArray: "3 3" }
        : { color: "#ffffff", fillColor: TUR_RENGI[p.tur] ?? DIGER_RENK, fillOpacity: 0.95, weight: 2 };
  return (
    <CircleMarker
      center={[p.enlem, p.boylam]}
      radius={p.vurgulu ? 13 : 8}
      pathOptions={stil}
      bubblingMouseEvents={false}
      eventHandlers={{
        mouseover: () => p.onUzerinde(p.id),
        mouseout: p.onAyrildi,
        click: () => p.onTikla(p.id),
      }}
    >
      {(p.acik || p.adSurekli) && (
        <Tooltip
          permanent
          interactive
          direction="top"
          offset={[0, p.vurgulu ? -11 : -6]}
          className={p.adSurekli && !p.acik ? "harita-ad harita-ad-surekli" : "harita-ad"}
        >
          <Link
            href={`/${p.dil}/eser/${p.id}`}
            onMouseEnter={() => p.onUzerinde(p.id)}
            onMouseLeave={p.onAyrildi}
          >
            {p.ad}
            {p.ziyaretli && <small> · {p.ziyaretYazi}</small>}
            <span aria-hidden="true"> ›</span>
          </Link>
        </Tooltip>
      )}
    </CircleMarker>
  );
});

/** Fare ile üzerine gelinemeyen (dokunmatik) cihaz mı? */
function dokunmatikMi() {
  return typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
}

/** Bu yakınlaştırmadan itibaren (mahalle ölçeği) eser adları noktaların üstünde sürekli yazar. */
const AD_SINIRI = 14;

/** Haritanın yakınlaştırma düzeyini izler. */
function YakinlikIzle({ onDegisti }: { onDegisti: (z: number) => void }) {
  useMapEvents({ zoomend: (e) => onDegisti(e.target.getZoom()) });
  return null;
}

/** Haritada boş bir yere dokunulunca açık ad kutusunu kapatır (dokunmatik ekranlar için). */
function BosTiklama({ onTikla }: { onTikla: () => void }) {
  useMapEvents({ click: onTikla });
  return null;
}

export default function Harita({ dil, eserler, merkez, yakinlastirma, yukseklik = 420, vurgulu, ziyaretli = [], araclar }: Props) {
  const konumlu = eserler.filter((e) => e.konum);
  const t = z(dil).harita;
  const ziyaret = new Set(ziyaretli);
  const router = useRouter();
  const [acik, setAcik] = useState<string>();
  const acikRef = useRef<string | undefined>(undefined);
  acikRef.current = acik;
  const [zoom, setZoom] = useState(yakinlastirma);
  const adSurekli = zoom >= AD_SINIRI;
  const adSurekliRef = useRef(adSurekli);
  adSurekliRef.current = adSurekli;
  const kapatSaati = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(kapatSaati.current), []);

  const onUzerinde = useCallback((id: string) => {
    // Dokunmatik ekranda taklit fare olayları yok sayılır; ad ilk dokunuşta açılır (onTikla).
    if (dokunmatikMi()) return;
    clearTimeout(kapatSaati.current);
    setAcik(id);
  }, []);
  // Fare noktadan ada geçerken kutu kapanmasın diye kısa bir bekleme.
  const onAyrildi = useCallback(() => {
    if (dokunmatikMi()) return;
    clearTimeout(kapatSaati.current);
    kapatSaati.current = setTimeout(() => setAcik(undefined), 250);
  }, []);
  const onTikla = useCallback(
    (id: string) => {
      // Dokunmatik ekranda fare yok: ad zaten yazmıyorsa ilk dokunuş adı gösterir, ada ya da aynı noktaya ikinci dokunuş sayfayı açar.
      if (dokunmatikMi() && !adSurekliRef.current && acikRef.current !== id) {
        clearTimeout(kapatSaati.current);
        setAcik(id);
        return;
      }
      router.push(`/${dil}/eser/${id}`);
    },
    [router, dil],
  );
  const bosTikla = useCallback(() => setAcik(undefined), []);

  const sokak = (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );
  return (
    <MapContainer
      center={[merkez.enlem, merkez.boylam]}
      zoom={yakinlastirma}
      style={{ height: yukseklik }}
      className="harita"
      scrollWheelZoom={false}
    >
      {araclar ? (
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name={t.sokak}>
            {sokak}
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name={t.uydu}>
            <LayerGroup>
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
            </LayerGroup>
          </LayersControl.BaseLayer>
        </LayersControl>
      ) : (
        sokak
      )}
      {araclar && <Konumum dil={dil} />}
      <BosTiklama onTikla={bosTikla} />
      <YakinlikIzle onDegisti={setZoom} />
      {konumlu.map((e) => (
        <EserIsareti
          key={e.id}
          dil={dil}
          id={e.id}
          ad={metin(e.ad, dil)}
          enlem={e.konum!.enlem}
          boylam={e.konum!.boylam}
          tur={e.tur}
          yaklasik={e.konum!.hassasiyet === "mahalle" || e.konum!.hassasiyet === "ilce"}
          vurgulu={e.id === vurgulu}
          ziyaretli={ziyaret.has(e.id)}
          acik={e.id === acik}
          adSurekli={adSurekli && !(e.konum!.hassasiyet === "mahalle" || e.konum!.hassasiyet === "ilce")}
          ziyaretYazi={t.ziyaret}
          onUzerinde={onUzerinde}
          onAyrildi={onAyrildi}
          onTikla={onTikla}
        />
      ))}
    </MapContainer>
  );
}
