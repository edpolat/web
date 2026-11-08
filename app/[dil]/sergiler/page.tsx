import { notFound } from "next/navigation";
import Muhur from "@/components/Muhur";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { sergiDurumu, type SergiDurumu as Durum } from "@/lib/sergi";
import { sergiFotograflari } from "@/lib/sergi-gorsel";
import { yayindakiSergiler } from "@/lib/sunucu/sergi-depo";
import { yayindakiIller } from "@/lib/veri";
import type { Dil } from "@/lib/tipler";

// Sergilerin durumu (açık, yakında, bitti) bugüne göre değişir; sayfa saatte bir yenilenir.
// Sergiler panelden yönetilir (Supabase "sergiler"); panelde değişince sayfa hemen tazelenir.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  return gecerliDil(dil) ? { title: s(dil).sergilerSayfa.baslik } : {};
}

function tarih(gun: string, dil: Dil) {
  return new Date(gun).toLocaleDateString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "long" });
}

export default async function SergilerSayfasi({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil).sergilerSayfa;
  const bugun = new Date().toISOString().slice(0, 10);
  const sira: Record<Durum, number> = { acik: 0, yakinda: 1, bitti: 2 };
  // Yeri ve tarihi bilinmeyen sergi kaydı listede gösterilmez.
  const liste = [...(await yayindakiSergiler()).values()]
    .filter((x) => x.yer && x.baslangic)
    .map((x) => ({ ...x, durum: sergiDurumu(x, bugun) }))
    .sort((a, b) => sira[a.durum] - sira[b.durum] || b.baslangic!.localeCompare(a.baslangic!));

  // Kartın üst şeridi: sergi şehrinden bir eserin fotoğrafı (yoksa lacivert-altın zemin).
  const fotograflar = sergiFotograflari(liste, await yayindakiIller());

  const sayilar = [
    { deger: liste.length, ad: t.sayac.toplam },
    { deger: liste.filter((x) => x.durum === "acik").length, ad: t.sayac.acik },
    { deger: liste.filter((x) => x.durum === "yakinda").length, ad: t.sayac.yakinda },
  ];

  return (
    <>
      {/* Keşfet ve Oyun sayfalarındaki koyu kapak bandının aynısı */}
      <section className="kapak">
        <div className="kapak-metin">
          <p className="ust-baslik">{t.kapakUst}</p>
          <h1>{t.baslik}</h1>
          <p className="kapak-slogan">{t.alt}</p>
          <dl className="sayaclar">
            {sayilar.map((x) => (
              <div key={x.ad}>
                <dt>{x.ad}</dt>
                <dd>{x.deger}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Muhur boyut={180} className="kapak-muhur" />
      </section>
      <div className="sergiler-sayfa">
        <ul className="sergi-kartlari">
          {liste.map((x) => (
            <li key={x.id} className={`sergi-kart sergi-${x.durum}`}>
              {fotograflar.get(x.id) ? (
                <img
                  className="sergi-foto"
                  src={fotograflar.get(x.id)!.dosya}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={fotograflar.get(x.id)!.odak ? { objectPosition: fotograflar.get(x.id)!.odak } : undefined}
                />
              ) : (
                <span className="sergi-foto sergi-foto-bos" aria-hidden="true" />
              )}
              <p className="sergi-ust">
                <span className={`sergi-durum sergi-durum-${x.durum}`}>{t.durum[x.durum]}</span>
                {x.sehir && <span>{x.ilce ? `${x.ilce}, ${x.sehir}` : x.sehir}</span>}
              </p>
              <h2>{metin(x.ad, dil)}</h2>
              <p>
                <strong>{t.yer}:</strong> {x.yer}
              </p>
              <p>
                <strong>{t.tarih}:</strong> {tarih(x.baslangic!, dil)}
                {x.bitis ? ` – ${tarih(x.bitis, dil)}` : ` (${t.bitisYok})`}
              </p>
              {x.aciklama && <p lang={x.aciklama[dil] ? undefined : "tr"}>{metin(x.aciklama, dil)}</p>}
              <p className="dugmeler">
                {x.durum !== "bitti" && x.harita && (
                  <a
                    className="dugme"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.harita)}`}
                    target="_blank"
                    rel="noopener"
                  >
                    {s(dil).yolTarifi}
                  </a>
                )}
                {x.url && (
                  <a className="dugme ikincil" href={x.url} target="_blank" rel="noopener">
                    {t.haber}
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
