import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import KaynakKunye from "@/components/KaynakKunye";
import { Cip, IslemMetni, YuvarlakDugme } from "@/components/PanelTablo";
import PanelTablo from "@/components/PanelTabloGovde";
import { KaynakDogrula } from "@/components/KaynakPaneli";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { bilgiKaynaklari, kaynakOku } from "@/lib/sunucu/kaynak-depo";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { tumEserler } from "@/lib/veri";
import { izinli, paneldeMi } from "@/lib/yetki";

export const metadata: Metadata = { robots: { index: false } };

/** Kaynak ayrıntısı: PDF ve görsel panel içinde önizlenir, bağlantı yeni sekmede açılır; bağlı bilgiler ve doğrulama. */
export default async function KaynakSayfasi({ params }: { params: Promise<{ dil: string; id: string }> }) {
  const { dil, id } = await params;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  if (!paneldeMi(ben)) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const u = t.kutuphane;
  const k = await kaynakOku(id).catch(() => undefined);
  if (!k) notFound();
  const bagli = await bilgiKaynaklari({ kaynak_id: id }).catch(() => []);
  const adlar = new Map(tumEserler().map((e) => [e.id, metin(e.ad, dil)]));
  const dosya = `/api/kaynak/dosya/${k.id}`;
  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim/kaynaklar`}>← {u.baslik}</Link>
      </p>
      <h1>{k.baslik}</h1>
      <p className="katki-ust">
        <span className={`etiket etiket-kaynak-${k.durum}`}>{u.durumlar[k.durum]}</span>
        <span>{u.nitelikler[k.nitelik]}</span>
        <span>· {u.kaynakTurleri[k.kaynak_turu]}</span>
        <span>· {u.turler[k.tur]}</span>
        {k.durum === "dogrulandi" && <span>· {k.herkese_acik ? u.herkeseAcik : u.kapali}</span>}
      </p>
      <KaynakKunye dil={dil} kaynak={k} />
      {k.dosya_yolu && (
        <>
          <h2>{u.onizleme}</h2>
          {k.dosya_turu === "application/pdf" ? (
            <iframe className="kaynak-onizleme" src={dosya} title={k.baslik} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="kaynak-onizleme-gorsel" src={dosya} alt={k.baslik} />
          )}
          <p>
            <a href={dosya} target="_blank" rel="noopener noreferrer">
              {u.dosyaAc} ↗
            </a>
          </p>
        </>
      )}
      {izinli(ben, "kaynak.dogrula") && (
        <>
          <h2>{u.durum}</h2>
          <KaynakDogrula dil={dil} id={k.id} durum={k.durum} herkeseAcik={k.herkese_acik} />
        </>
      )}
      <h2>{u.bagliBilgiler}</h2>
      {bagli.length ? (
        <PanelTablo
          dil={dil}
          sutunlar={[
            { ad: u.eser, simge: "cami" },
            { ad: u.alan, simge: "belge" },
            { ad: u.konum, simge: "sayfa" },
          ]}
          satirlar={bagli.map((b) => {
            const ad = adlar.get(b.eser_id) ?? b.eser_id;
            const alan = t.alanlar[b.alan] ?? b.alan;
            return {
              id: b.id,
              hucreler: [
                <Cip key="e" simge="cami" href={`/${dil}/yonetim/eser/${b.eser_id}/gecmis`}>
                  {ad}
                </Cip>,
                <IslemMetni key="a" baslik={alan} aciklama={b.deger ? b.deger.slice(0, 200) : undefined} />,
                <span key="k" className="pt-sayi">
                  {b.konum}
                </span>,
              ],
              eylem: <YuvarlakDugme href={`/${dil}/yonetim/eser/${b.eser_id}/gecmis`} etiket={`${t.tablo.ac}: ${ad}`} />,
              sira: [ad, alan, b.konum ?? ""],
              ara: `${ad} ${alan} ${b.deger ?? ""} ${b.konum ?? ""}`,
            };
          })}
          ara=""
          birim={t.tablo.birim.bilgi}
          genis
        />
      ) : (
        <p>{t.surum.hicYok}</p>
      )}
    </section>
  );
}
