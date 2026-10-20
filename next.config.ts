import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Geliştirme sunucusu ev ağındaki IP'den (telefon, başka bilgisayar) açılınca Next.js tarayıcı
  // kodunu engelliyor; o zaman filtreler ve harita çalışmıyor. Yerel ağ adreslerine izin ver.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  async redirects() {
    return [{ source: "/", destination: "/tr", permanent: false }];
  },
  images: { formats: ["image/webp"] },
  // YZ kaynak analizinin okuduğu kitap metinleri sunucu fonksiyonlarıyla birlikte yüklensin (Vercel).
  outputFileTracingIncludes: { "/**": ["./veri/kaynak-metinleri/**"] },
};

export default nextConfig;
