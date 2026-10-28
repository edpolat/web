import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KaynakFormu } from "@/components/KaynakPaneli";
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
  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <h1>{u.baslik}</h1>
      <p className="not">{u.aciklama}</p>
      {ekleyebilir && <KaynakFormu key={taslak?.id} dil={dil} taslak={taslak} />}
      <form className="panel-filtre" method="get">
        <label>
          {u.durum}
          <select name="durum" defaultValue={durum ?? ""}>
            <option value="">{u.tumu}</option>
            {KAYNAK_DURUMLARI.map((d) => (
              <option key={d} value={d}>
                {u.durumlar[d]}
              </option>
            ))}
          </select>
        </label>
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
        <label>
          {u.kaynakBaslik}
          <input type="search" name="q" defaultValue={arama.q ?? ""} />
        </label>
        <div className="dugmeler">
          <button type="submit" className="ikincil">
            {u.suz}
          </button>
        </div>
      </form>
      {liste ? (
        <>
          <p className="not">{u.sayi(liste.length)}</p>
          <table className="tablo">
            <thead>
              <tr>
                <th>{u.kaynakBaslik}</th>
                <th>{u.nitelik}</th>
                <th>{u.durum}</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((k) => (
                <tr key={k.id}>
                  <td>
                    <Link href={`/${dil}/yonetim/kaynaklar/${k.id}`}>{k.baslik}</Link>
                    <br />
                    <small>
                      {u.turler[k.tur]} · {u.kaynakTurleri[k.kaynak_turu]}
                      {k.ekleyen_ad && ` · ${k.ekleyen_ad}`}
                    </small>
                  </td>
                  <td>{u.nitelikler[k.nitelik]}</td>
                  <td>
                    <span className={`etiket etiket-kaynak-${k.durum}`}>{u.durumlar[k.durum]}</span>
                    {k.durum === "dogrulandi" && (
                      <>
                        <br />
                        <small>{k.herkese_acik ? u.herkeseAcik : u.kapali}</small>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="hata">
          {u.tabloYok} <small>({hataMetni})</small>
        </p>
      )}
    </section>
  );
}
