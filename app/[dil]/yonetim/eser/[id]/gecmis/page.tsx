import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DenetimTablosu from "@/components/DenetimTablosu";
import { BilgiKaynagiFormu } from "@/components/KaynakPaneli";
import SurumListesi, { ArsivDugmesi, type GosterilenSurum } from "@/components/SurumListesi";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { DUZENLENEBILIR } from "@/lib/sunucu/katki";
import { bilgiKaynaklari, type BilgiKaynagi } from "@/lib/sunucu/kaynak-depo";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { formTaslagiOku } from "@/lib/sunucu/taslak-depo";
import { yayindakiHal } from "@/lib/sunucu/panel";
import { denetimKaydi, surumler, type DenetimSatiri } from "@/lib/sunucu/surum-depo";
import { ilkHal, surumuGoster } from "@/lib/sunucu/surum-goster";
import type { Eser } from "@/lib/tipler";
import { izinli, paneldeMi } from "@/lib/yetki";
import { yayindakiKaynaklar } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

/** Bir eserin sürüm geçmişi, denetim kaydı, eski sürüme dönme ve arşivleme. */
export default async function Gecmis({
  params,
  searchParams,
}: {
  params: Promise<{ dil: string; id: string }>;
  searchParams: Promise<{ taslak?: string }>;
}) {
  const { dil, id } = await params;
  const taslakNo = (await searchParams).taslak;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  if (!paneldeMi(ben)) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const u = t.surum;
  const kaynakMap = await yayindakiKaynaklar();
  const bilgiTaslagi = taslakNo && izinli(ben, "eser.duzenle") ? await formTaslagiOku(Number(taslakNo), "bilgi") : undefined;
  const ilk = ilkHal(id);
  const simdi = await yayindakiHal(id);
  if (!ilk && !simdi.eser) notFound();
  const ad = metin((simdi.eser ?? ilk!.eser).ad, dil);
  const geriAlabilir = izinli(ben, "eser.onayla");

  let liste: GosterilenSurum[] | undefined;
  let hataMetni = "";
  let kayitlar: DenetimSatiri[] = [];
  const bilgiler: BilgiKaynagi[] = await bilgiKaynaklari({ eser_id: id }).catch(() => []);
  let arsivde = false;
  try {
    const hepsi = await surumler({ eser_id: id });
    kayitlar = await denetimKaydi(id);
    // Yayındakiler eskiden yeniye: her biri bir öncekiyle karşılaştırılır.
    const yayindakiler = hepsi.filter((x) => x.durum === "yayinda").reverse();
    let onceki: Eser | undefined = ilk?.eser;
    const yayinKartlari = yayindakiler.map((x) => {
      const kart = surumuGoster(x, onceki, dil, t, kaynakMap, {
        guncel: x.id === simdi.surum,
        donulebilir: geriAlabilir && x.id !== simdi.surum && !x.arsivlendi,
        hedef: x.id,
      });
      onceki = x.veri;
      return kart;
    });
    arsivde = yayindakiler.at(-1)?.arsivlendi ?? false;
    const digerleri = hepsi
      .filter((x) => x.durum !== "yayinda")
      .map((x) => surumuGoster(x, x.islem === "ekle" ? undefined : simdi.eser, dil, t, kaynakMap));
    liste = [...digerleri, ...yayinKartlari.reverse()];
  } catch (h) {
    liste = undefined;
    hataMetni = h instanceof Error ? h.message : String(h);
  }

  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
        {izinli(ben, "eser.duzenle") && !arsivde && (
          <>
            {" · "}
            <Link href={`/${dil}/yonetim/eser/${id}`}>{t.eseriDuzenle}</Link>
          </>
        )}
      </p>
      <h1>
        {u.gecmis}: {ad}
      </h1>
      <p className="not">{u.gecmisAciklama}</p>
      {arsivde && <p className="uyari">{u.arsivde}</p>}
      {izinli(ben, "eser.arsivle") && liste && <ArsivDugmesi dil={dil} eserId={id} arsivde={arsivde} />}
      {liste ? (
        <>
          <SurumListesi dil={dil} surumler={liste} eylemler={["geriAl"]} eserAdresi={false} />
          {ilk && (
            <article className="katki">
              <p className="katki-ust">
                <span className="etiket etiket-surum-yayinda">{u.ilkHal}</span>
                {simdi.surum === null && <span className="etiket etiket-onaylandi">{u.guncel}</span>}
              </p>
              {geriAlabilir && simdi.surum !== null && (
                <SurumListesi
                  dil={dil}
                  eylemler={["geriAl"]}
                  eserAdresi={false}
                  surumler={[
                    {
                      id: 0,
                      eserId: id,
                      eser: ad,
                      il: "",
                      durum: "yayinda",
                      islem: "duzenle",
                      ekleyen: "",
                      olusturuldu: new Date(0).toISOString(),
                      farklar: [],
                      donulebilir: true,
                      hedef: null,
                    },
                  ]}
                />
              )}
            </article>
          )}
          <h2>{t.kutuphane.bilgiKaynaklari}</h2>
          <p className="not">{t.kutuphane.bilgiAciklama}</p>
          {bilgiler.length > 0 && (
            <table className="tablo">
              <thead>
                <tr>
                  <th>{t.kutuphane.alan}</th>
                  <th>{t.kaynak}</th>
                  <th>{t.kutuphane.konum}</th>
                </tr>
              </thead>
              <tbody>
                {bilgiler.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {t.alanlar[b.alan] ?? b.alan}
                      {b.deger && (
                        <>
                          <br />
                          <small>{b.deger.slice(0, 200)}</small>
                        </>
                      )}
                    </td>
                    <td>
                      <Link href={`/${dil}/yonetim/kaynaklar/${b.kaynak_id}`}>{kaynakMap.get(b.kaynak_id)?.baslik ?? b.kaynak_id}</Link>
                    </td>
                    <td>{b.konum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {izinli(ben, "eser.duzenle") && (
            <BilgiKaynagiFormu
              key={bilgiTaslagi?.id}
              dil={dil}
              eserId={id}
              taslak={bilgiTaslagi?.hedef === id ? bilgiTaslagi : undefined}
              alanlar={DUZENLENEBILIR.filter((a) => a !== "taslak" && a !== "olgular").map((a) => ({ id: a, ad: t.alanlar[a] ?? a }))}
              kaynaklar={[...kaynakMap.values()].map((k) => ({ id: k.id, ad: k.baslik }))}
            />
          )}
          <h2>{u.denetim}</h2>
          <DenetimTablosu dil={dil} kayitlar={kayitlar} kaynakMap={kaynakMap} />
        </>
      ) : (
        <p className="hata">
          {u.tabloYok} <small>({hataMetni})</small>
        </p>
      )}
    </section>
  );
}
