"use client";
import Link from "next/link";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { metin } from "@/lib/metin";
import type { Dil, IlliEser, Konum } from "@/lib/tipler";

// Mobil uygulamadaki işaret renkleri: türün rengi; yaklaşık konumda içi boş ve kesik çizgili.
const TUR_RENGI: Record<string, string> = { cami: "#17488f", mescit: "#0077b6", kulliye: "#123d3a" };
const DIGER_RENK = "#1b263b";

type Props = {
  dil: Dil;
  eserler: Pick<IlliEser, "id" | "ad" | "konum" | "tur">[];
  /** Listede üzerine gelinen eser haritada büyür. */
  vurgulu?: string;
  merkez: Pick<Konum, "enlem" | "boylam">;
  yakinlastirma: number;
  yukseklik?: number;
};

export default function Harita({ dil, eserler, merkez, yakinlastirma, yukseklik = 420, vurgulu }: Props) {
  const konumlu = eserler.filter((e) => e.konum);
  return (
    <MapContainer
      center={[merkez.enlem, merkez.boylam]}
      zoom={yakinlastirma}
      style={{ height: yukseklik }}
      className="harita"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {konumlu.map((e) => (
        <CircleMarker
          key={e.id}
          center={[e.konum!.enlem, e.konum!.boylam]}
          radius={e.id === vurgulu ? 13 : 8}
          pathOptions={
            e.id === vurgulu
              ? { color: "#17488f", fillColor: "#fcbd00", fillOpacity: 1, weight: 3 }
              : e.konum!.hassasiyet === "mahalle" || e.konum!.hassasiyet === "ilce"
                ? { color: TUR_RENGI[e.tur] ?? DIGER_RENK, fillColor: "#ffffff", fillOpacity: 0.8, weight: 2, dashArray: "3 3" }
                : { color: "#ffffff", fillColor: TUR_RENGI[e.tur] ?? DIGER_RENK, fillOpacity: 0.95, weight: 2 }
          }
        >
          <Popup>
            <Link href={`/${dil}/eser/${e.id}`}>{metin(e.ad, dil)}</Link>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
