// Rota tamamlama hikâye kartı (1080×1920 PNG): mobil uygulamadaki hikayeKartiCiz ile aynı çizim.
import type { Rota } from "./tipler";

export async function hikayeKartiCiz(o: {
  sehir: string;
  duraklar: Rota["duraklar"];
  ad?: string;
  en: boolean;
  metin: { pasaport: string; tamamladim: string; pul: string };
  adres: string;
}): Promise<Blob | null> {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  if (!x) return null;
  const BASLIK = 'Georgia, "Times New Roman", serif', GOVDE = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const LACIVERT = "#0B2540", ALTIN = "#C9A45C", ACIK = "#E6D2A6";

  const aralikli = (yazi: string, cx: number, y: number, aralik: number) => {
    x.textAlign = "left";
    const genislik = Array.from(yazi).reduce((t, h) => t + x.measureText(h).width + aralik, -aralik);
    let px = cx - genislik / 2;
    Array.from(yazi).forEach((h) => {
      x.fillText(h, px, y);
      px += x.measureText(h).width + aralik;
    });
  };

  x.fillStyle = LACIVERT;
  x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, 520, 50, W / 2, 520, 900);
  g.addColorStop(0, "rgba(201,164,92,.16)");
  g.addColorStop(1, "rgba(201,164,92,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(201,164,92,.55)";
  x.lineWidth = 2;
  x.strokeRect(54, 54, W - 108, H - 108);
  x.strokeStyle = "rgba(201,164,92,.25)";
  x.strokeRect(68, 68, W - 136, H - 136);

  // Amblem: sekiz köşeli yıldız
  x.save();
  x.translate(W / 2, 250);
  x.strokeStyle = ALTIN;
  x.lineWidth = 4;
  x.strokeRect(-46, -46, 92, 92);
  x.rotate(Math.PI / 4);
  x.strokeRect(-46, -46, 92, 92);
  x.restore();
  x.beginPath();
  x.arc(W / 2, 250, 10, 0, Math.PI * 2);
  x.fillStyle = ALTIN;
  x.fill();

  x.textBaseline = "alphabetic";
  x.fillStyle = ALTIN;
  x.font = `600 76px ${BASLIK}`;
  aralikli("VAKFİYE", W / 2, 420, 16);
  x.fillStyle = ACIK;
  x.font = `500 26px ${GOVDE}`;
  aralikli(o.metin.pasaport, W / 2, 470, 10);

  x.textAlign = "center";
  x.fillStyle = "#fff";
  x.font = `600 104px ${BASLIK}`;
  x.fillText(o.sehir, W / 2, 630);
  x.fillStyle = ALTIN;
  x.font = `italic 500 58px ${BASLIK}`;
  x.fillText(o.metin.tamamladim, W / 2, 710);

  // Damgalar: 2 sütun × 3 satır
  const R = 135, sutun = [W / 2 - 190, W / 2 + 190];
  o.duraklar.slice(0, 6).forEach((durak, i) => {
    const cx = sutun[i % 2], cy = 920 + Math.floor(i / 2) * 300;
    x.save();
    x.translate(cx, cy);
    x.rotate(((i % 2 ? 6 : -8) * Math.PI) / 180);
    x.strokeStyle = ALTIN;
    x.fillStyle = ALTIN;
    x.lineWidth = 6;
    x.beginPath();
    x.arc(0, 0, R, 0, Math.PI * 2);
    x.stroke();
    x.lineWidth = 2;
    x.beginPath();
    x.arc(0, 0, R - 16, 0, Math.PI * 2);
    x.stroke();
    x.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 9 : 22, a = -Math.PI / 2 + (k * Math.PI) / 5;
      x.lineTo(Math.cos(a) * r, -48 + Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
    x.textAlign = "center";
    let boyut = 30;
    x.font = `700 ${boyut}px ${GOVDE}`;
    while (x.measureText((durak.damga_ust ?? "")).width > R * 1.6 && boyut > 18) {
      boyut -= 2;
      x.font = `700 ${boyut}px ${GOVDE}`;
    }
    x.fillText((durak.damga_ust ?? ""), 0, 12);
    x.font = `600 20px ${GOVDE}`;
    x.fillStyle = ACIK;
    x.fillText((durak.damga_alt ?? ""), 0, 52);
    x.restore();
  });

  const tarih = new Date().toLocaleDateString(o.en ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric" });
  x.textAlign = "center";
  x.fillStyle = "#fff";
  x.font = `600 40px ${BASLIK}`;
  if (o.ad) x.fillText(o.ad, W / 2, 1720);
  x.fillStyle = ACIK;
  x.font = `500 28px ${GOVDE}`;
  x.fillText(`${o.duraklar.length} ${o.metin.pul} · ${tarih}`, W / 2, o.ad ? 1770 : 1730);
  x.fillStyle = ALTIN;
  x.font = `600 26px ${GOVDE}`;
  x.fillText(o.adres, W / 2, 1830);

  return new Promise((coz) => c.toBlob(coz, "image/png"));
}
