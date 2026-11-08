import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KaynakFormu } from "@/components/KaynakPaneli";
import { Cip, DurumNoktasi, IslemMetni, Kisi, PanelBaslik, PanelSimge, YuvarlakDugme } from "@/components/PanelTablo";
import PanelTablo from "@/components/PanelTabloGovde";
import { KAYNAK_DURUMLARI, NITELIKLER, type KutuphaneKaynagi } from "@/lib/kaynak";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { kaynakListesi } from "@/lib/sunucu/kaynak-depo";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { formTaslagiOku } from "@/lib/sunucu/taslak-depo";
import { izinli, paneldeMi } from "@/lib/yetki";

export const metadata: Metadata = { robots: { index: false } };

type Arama = { durum?: string; nitelik?: string; q?: string; taslak?: string };

/** Kaynak kütüphanesi: süzgeçli liste ve kaynak ekleme. Ayrıntı, önizleme ve doğrulama kaynağın kendi sayfasında. */
export default async function Kaynaklar({ params, searchParams }: { params: Promise<{ dil: string }>; searchParams: Promise<Arama> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  if (!paneldeMi(ben)) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const u = t.kutuphane;
  const arama = await searchParams;
  const durum = KAYNAK_DURUMLARI.find((d) => d === arama.durum);
  const nitelik = NITELIKLER.find((n) => n === arama.nitelik);
  const q = (arama.q ?? "").trim().toLocaleLowerCase("tr");
  const ekleyebilir = izinli(ben, "eser.ekle") || izinli(ben, "eser.duzenle");
  const taslak = ekleyebilir && arama.taslak ? await formTaslagiOku(Number(arama.taslak), "kaynak") : undefined;
  let liste: KutuphaneKaynagi[] | undefined;
  let hataMetni = "";
  try {
    liste = (await kaynakListesi({ durum, nitelik })).filter(
      (k) => !q || `${k.baslik} ${k.yazar ?? ""} ${k.yayinci ?? ""}`.toLocaleLowerCase("tr").includes(q),
    );
  } catch (h) {
    hataMetni = h instanceof Error ? h.message : String(h);
  }
  // Durum hapları öteki süzgeçleri korur.
  const adres = (d?: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ durum: d, nitelik, q: arama.q })) if (v) q.set(k, v);
    return q.toString() ? `?${q}` : "?";
  };
  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <PanelBaslik simge="kitap" baslik={u.baslik} alt={u.aciklama} />
      {ekleyebilir && <KaynakFormu key={taslak?.id} dil={dil} taslak={taslak} />}
      {liste ? (
        <PanelTablo
          dil={dil}
          sutunlar={[
            { ad: u.kaynakBaslik, simge: "kitap" },
            { ad: t.tablo.ekleyen, simge: "kisi" },
            { ad: u.nitelik, simge: "etiket" },
            { ad: u.durum, simge: "durum" },
          ]}
          satirlar={liste.map((k) => ({
            id: k.id,
            hucreler: [
              <IslemMetni
                key="b"
                baslik={<Link href={`/${dil}/yonetim/kaynaklar/${k.id}`}>{k.baslik}</Link>}
                aciklama={`${u.turler[k.tur]} · ${u.kaynakTurleri[k.kaynak_turu]}`}
              />,
              k.ekleyen_ad ? <Kisi key="e" ad={k.ekleyen_ad} /> : "—",
              <Cip key="n" simge="etiket">
                {u.nitelikler[k.nitelik]}
              </Cip>,
              <DurumNoktasi
                key="d"
                renk={k.durum === "dogrulandi" ? "yesil" : k.durum === "reddedildi" ? "kirmizi" : "sari"}
                alt={k.durum === "dogrulandi" ? (k.herkese_acik ? u.herkeseAcik : u.kapali) : undefined}
              >
                {u.durumlar[k.durum]}
              </DurumNoktasi>,
            ],
            eylem: <YuvarlakDugme href={`/${dil}/yonetim/kaynaklar/${k.id}`} etiket={`${t.tablo.ac}: ${k.baslik}`} />,
            sira: [k.baslik, k.ekleyen_ad ?? "", u.nitelikler[k.nitelik], u.durumlar[k.durum]],
          }))}
          haplar={[undefined, ...KAYNAK_DURUMLARI].map((d) => ({
            ad: d ? u.durumlar[d] : u.tumu,
            simge: d === "dogrulandi" ? "durum" : d === "reddedildi" ? "sil" : d ? "belge" : "liste",
            href: adres(d),
            secili: durum === d,
          }))}
          araForm={{ ad: "q", deger: arama.q ?? "", gizli: { durum, nitelik } }}
          ekAlan={
            <details className="pt-diger" open={!!nitelik}>
              <summary>
                <PanelSimge ad="suzgec" />
                {t.tablo.digerSuzgecler}
              </summary>
              <form className="panel-filtre" method="get">
                {durum && <input type="hidden" name="durum" value={durum} />}
                {arama.q && <input type="hidden" name="q" value={arama.q} />}
                <label>
                  {u.nitelik}
                  <select name="nitelik" defaultValue={nitelik ?? ""}>
                    <option value="">{u.tumu}</option>
                    {NITELIKLER.map((n) => (
                      <option key={n} value={n}>
                        {u.nitelikler[n]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="dugmeler">
                  <button type="submit" className="ikincil">
                    {u.suz}
                  </button>
                </div>
              </form>
            </details>
          }
          birim={t.tablo.birim.kaynak}
          genis
        />
      ) : (
        <p className="hata">
          {u.tabloYok} <small>({hataMetni})</small>
        </p>
      )}
    </section>
  );
}
