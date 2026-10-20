import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DemoDugmeleri from "@/components/DemoDugmeleri";
import EserSecici from "@/components/EserSecici";
import { demoKaydiZamani } from "@/lib/sunucu/demo";
import { CikisDugmesi, GirisFormu } from "@/components/YonetimGiris";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { katkilar } from "@/lib/sunucu/kuyruk";
import { yoneticiMi } from "@/lib/sunucu/oturum";
import { iller } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

export default async function Yonetim({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil);
  if (!(await yoneticiMi())) {
    return (
      <section className="kart">
        <h1>{t.yonetimGiris}</h1>
        <GirisFormu dil={dil} />
      </section>
    );
  }
  const bekleyen = katkilar().filter((k) => k.durum === "bekliyor").length;
  return (
    <section className="kart">
      <h1>{t.yonetim}</h1>
      <p className="not">{t.yonetimAciklama}</p>
      <p className="dugmeler">
        <Link className="dugme" href={`/${dil}/yonetim/onay`}>
          {t.onayKuyrugu}: {t.bekleyen(bekleyen)}
        </Link>
        <Link className="dugme ikincil" href={`/${dil}/yonetim/eser/yeni`}>
          {t.yeniEser}
        </Link>
        {process.env.NODE_ENV !== "production" && (
          <Link className="dugme ikincil" href={`/${dil}/duzenle/konum`}>
            {t.konumDuzenle}
          </Link>
        )}
      </p>
      <h2>{t.eseriDuzenle}</h2>
      <EserSecici
        dil={dil}
        eserler={iller().flatMap(({ il, eserler }) =>
          eserler.map((e) => ({
            id: e.id,
            ad: metin(e.ad, dil),
            alt: [metin(il.ad, dil), e.ilce, e.taslak ? t.alanlar.taslak : ""].filter(Boolean).join(", "),
          })),
        )}
      />
      <DemoDugmeleri dil={dil} kayitZamani={demoKaydiZamani()} />
      <CikisDugmesi dil={dil} />
    </section>
  );
}
