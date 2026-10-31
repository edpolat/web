import type { MetadataRoute } from "next";

// "Ana ekrana ekle": site telefona ikonla eklenip tam ekran açılır (mobil uygulamadaki manifest.json ile aynı ikonlar).
// Önbellek (service worker) kullanılmaz.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vakfiye · Vakıf Eserleri",
    short_name: "Vakfiye",
    description: "Bursa, Konya ve Hatay'daki vakıf eserlerinin hikâyesi, kaynağıyla.",
    start_url: "/tr",
    scope: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#17488f",
    lang: "tr",
    icons: [
      { src: "/ikon/ikon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/ikon/ikon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/ikon/ikon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
