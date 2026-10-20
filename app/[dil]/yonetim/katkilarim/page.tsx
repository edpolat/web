import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SurumListesi, { type GosterilenSurum } from "@/components/SurumListesi";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { kimlik } from "@/lib/sunucu/kimlik";
import { benimSurumlerim } from "@/lib/sunucu/panel";
import { surumOku } from "@/lib/sunucu/surum-depo";
import { ilkHal, surumuGoster } from "@/lib/sunucu/surum-goster";
import { yayindakiKaynaklar } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

/** Katkılarım: kişinin gönderdiği sürümler, durumları ve ret gerekçeleri. Taslaklar buradan incelemeye gider. */
export default async function Katkilarim({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil);
  if (!(await kimlik())?.rol) redirect(`/${dil}/yonetim`);
  const kaynakMap = await yayindakiKaynaklar();
  let liste: GosterilenSurum[] | undefined;
  let hataMetni = "";
  try {
    const benim = await benimSurumlerim();
    // Karşılaştırma, düzenlemenin dayandığı hâle göre: önceki onaylı sürüm ya da veri dosyasındaki ilk hâl.
    liste = await Promise.all(
      benim.map(async (x) => {
        const temel = x.islem === "ekle" ? undefined : x.temel_surum ? (await surumOku(x.temel_surum))?.veri : ilkHal(x.eser_id)?.eser;
        return surumuGoster(x, temel, dil, t, kaynakMap);
      }),
    );
  } catch (h) {
    liste = undefined;
    hataMetni = h instanceof Error ? h.message : String(h);
  }
  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <h1>{t.surum.katkilarim}</h1>
      <p className="not">{t.surum.katkilarimAciklama}</p>
      {liste ? <SurumListesi dil={dil} surumler={liste} eylemler={["incelemeye"]} /> : <p className="hata">
          {t.surum.tabloYok} <small>({hataMetni})</small>
        </p>}
    </section>
  );
}
