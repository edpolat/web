"use client";
import { useEffect } from "react";
import { CircleMarker, LayersControl, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { konumEksik } from "@/lib/filtre";
import type { DuzenlenecekEser, Nokta } from "./KonumDuzenle";

type Props = {
  eserler: DuzenlenecekEser[];
  seciliId?: string;
  yeni?: Nokta;
  merkez: Nokta;
  yakinlastirma: number;
  odak?: Nokta;
  onTikla: (n: Nokta) => void;
  onSec: (id: string) => void;
};

function Olaylar({ onTikla, odak }: { onTikla: (n: Nokta) => void; odak?: Nokta }) {
  const harita = useMap();
  useMapEvents({ click: (e) => onTikla({ enlem: e.latlng.lat, boylam: e.latlng.lng }) });
  useEffect(() => {
    if (odak) harita.flyTo([odak.enlem, odak.boylam], Math.max(harita.getZoom(), 17), { duration: 0.6 });
  }, [odak, harita]);
  return null;
}

export default function KonumHarita({ eserler, seciliId, yeni, merkez, yakinlastirma, odak, onTikla, onSec }: Props) {
  return (
    <MapContainer center={[merkez.enlem, merkez.boylam]} zoom={yakinlastirma} style={{ height: 520 }} className="harita konum-harita">
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Harita">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Uydu">
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      <Olaylar onTikla={onTikla} odak={odak} />
      {eserler.filter((e) => e.konum).map((e) => {
        const secili = e.id === seciliId;
        const eksik = konumEksik(e.konum);
        return (
          <CircleMarker
            key={e.id}
            center={[e.konum!.enlem, e.konum!.boylam]}
            radius={secili ? 10 : 6}
            pathOptions={{
              color: secili ? "#1f1a14" : "#7a3e12",
              fillColor: eksik ? "#c8742c" : "#1d6b3a",
              fillOpacity: secili ? 0.9 : 0.6,
              weight: secili ? 3 : 1.5,
            }}
            eventHandlers={{ click: (ev) => { ev.originalEvent.stopPropagation(); onSec(e.id); } }}
            bubblingMouseEvents={false}
          >
            <Tooltip>{e.ad}</Tooltip>
          </CircleMarker>
        );
      })}
      {yeni && (
        <CircleMarker center={[yeni.enlem, yeni.boylam]} radius={11} pathOptions={{ color: "#5a3d99", fillColor: "#5a3d99", fillOpacity: 0.85, weight: 3 }} />
      )}
    </MapContainer>
  );
}
