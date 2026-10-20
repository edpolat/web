"use client";
import dynamic from "next/dynamic";

// Leaflet tarayıcıda çalışır; sunucuda yüklenmemesi için dinamik içe aktarılır.
const HaritaYukle = dynamic(() => import("./Harita"), {
  ssr: false,
  loading: () => <div className="harita-yer" aria-hidden="true" />,
});

export default HaritaYukle;
