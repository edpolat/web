"use client";
import Link from "next/link";
import { useState } from "react";
import { CircleMarker, LayerGroup, LayersControl, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
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

export default function Harita({ dil, eserler, merkez, yakinlastirma, yukseklik = 420, vurgulu, ziyaretli = [], araclar }: Props) {
  const konumlu = eserler.filter((e) => e.konum);
  const t = z(dil).harita;
  const ziyaret = new Set(ziyaretli);
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
      {konumlu.map((e) => (
        <CircleMarker
          key={e.id}
          center={[e.konum!.enlem, e.konum!.boylam]}
          radius={e.id === vurgulu ? 13 : 8}
          pathOptions={
            e.id === vurgulu
              ? { color: "#17488f", fillColor: "#fcbd00", fillOpacity: 1, weight: 3 }
              : ziyaret.has(e.id)
                ? { color: "#ffffff", fillColor: ALTIN, fillOpacity: 1, weight: 2 }
                : e.konum!.hassasiyet === "mahalle" || e.konum!.hassasiyet === "ilce"
                  ? { color: TUR_RENGI[e.tur] ?? DIGER_RENK, fillColor: "#ffffff", fillOpacity: 0.8, weight: 2, dashArray: "3 3" }
                  : { color: "#ffffff", fillColor: TUR_RENGI[e.tur] ?? DIGER_RENK, fillOpacity: 0.95, weight: 2 }
          }
        >
          <Popup>
            <Link href={`/${dil}/eser/${e.id}`}>{metin(e.ad, dil)}</Link>
            {ziyaret.has(e.id) && <small> · {t.ziyaret}</small>}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
