import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SurumListesi, { type GosterilenSurum } from "@/components/SurumListesi";
import TaslakSil from "@/components/TaslakSil";
import { Cip, IslemMetni, YuvarlakDugme, Zaman } from "@/components/PanelTablo";
import PanelTablo from "@/components/PanelTabloGovde";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { kimlik } from "@/lib/sunucu/kimlik";
import { benimSurumlerim } from "@/lib/sunucu/panel";
import { surumOku } from "@/lib/sunucu/surum-depo";
import { taslakAdresi } from "@/lib/sunucu/taslak";
import { formTaslaklarim } from "@/lib/sunucu/taslak-depo";
import { ilkHal, surumuGoster } from "@/lib/sunucu/surum-goster";
import { yayindakiKaynaklar } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

/** Katkılarım: kişinin gönderdiği sürümler, durumları ve ret gerekçeleri. Taslaklar buradan incelemeye gider; ?durum=taslak yalnız taslakları gösterir. */
export default async function Katkilarim({
  params,
  searchParams,
}: {
  params: Promise<{ dil: string }>;
  searchParams: Promise<{ durum?: string }>;
}) {
  const { dil } = await params;
  const yalnizTaslak = (await searchParams).durum === "taslak";
  if (!gecerliDil(dil)) notFound();
  const t = s(dil);
  if (!(await kimlik())?.rol) redirect(`/${dil}/yonetim`);
  const kaynakMap = await yayindakiKaynaklar();
  const formTaslaklari = yalnizTaslak ? await formTaslaklarim() : [];
  const ft = t.formTaslagi;
  let liste: GosterilenSurum[] | undefined;
  let hataMetni = "";
  try {
    const benim = (await benimSurumlerim()).filter((x) => !yalnizTaslak || x.durum === "taslak");
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
      <h1>{yalnizTaslak ? t.surum.taslaklarim : t.surum.katkilarim}</h1>
      <p className="not">{yalnizTaslak ? t.surum.taslaklarimAciklama : t.surum.katkilarimAciklama}</p>
      {yalnizTaslak && (
        <p>
          <Link href={`/${dil}/yonetim/katkilarim`}>{t.surum.tumKatkilar}</Link>
        </p>
      )}
      {formTaslaklari.length > 0 && (
        <>
          <h2>{ft.baslik}</h2>
          <p className="not">{ft.aciklama}</p>
          <PanelTablo
            dil={dil}
            sutunlar={[
              { ad: ft.tur, simge: "etiket" },
              { ad: ft.ad, simge: "sayfa" },
              { ad: ft.guncellendi, simge: "takvim" },
            ]}
            satirlar={formTaslaklari.map((x) => ({
              id: x.id,
              hucreler: [
                <Cip key="t" simge={x.tur === "il" ? "harita" : x.tur === "kaynak" ? "kitap" : "belge"}>
                  {ft.turler[x.tur as keyof typeof ft.turler] ?? x.tur}
                </Cip>,
                <IslemMetni key="b" baslik={x.baslik} />,
                <Zaman key="z" iso={x.guncellendi} dil={dil} />,
              ],
              eylem: (
                <>
                  <TaslakSil dil={dil} id={x.id} />
                  <YuvarlakDugme href={taslakAdresi(dil, x)} etiket={ft.devamEt} />
                </>
              ),
              sira: [x.tur, x.baslik, x.guncellendi],
            }))}
            birim={t.tablo.birim.taslak}
            ilkSira={{ sutun: 2, yon: -1 }}
          />
          {liste && liste.length > 0 && <h2>{t.surum.taslaklarim}</h2>}
        </>
      )}
      {liste && yalnizTaslak && !liste.length ? (
        formTaslaklari.length ? null : <p>{t.surum.taslakYok}</p>
      ) : liste ? (
        <SurumListesi dil={dil} surumler={liste} eylemler={["incelemeye"]} />
      ) : (
        <p className="hata">
          {t.surum.tabloYok} <small>({hataMetni})</small>
        </p>
      )}
    </section>
  );
}
