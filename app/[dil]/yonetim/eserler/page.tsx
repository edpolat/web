import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { adSirala, gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { surumler, yayindakiSurumler } from "@/lib/sunucu/surum-depo";
import type { Eser } from "@/lib/tipler";
import { ayarlar, yayindakiIller } from "@/lib/veri";
import { izinli, paneldeMi } from "@/lib/yetki";

export const metadata: Metadata = { robots: { index: false } };

const DURUMLAR = ["yayinda", "taslak", "incelemede", "arsivlendi"] as const;
const GOSTERILEN = 200;

type Arama = { q?: string; durum?: string; tur?: string; il?: string; donem?: string; gonderildi?: string };
type Satir = { eser: Eser; il: string; arsivde: boolean; incelemede: boolean };

const yuzyil = (e: Eser) => (e.donem?.yapim_yili ? Math.floor((e.donem.yapim_yili - 1) / 100) + 1 : undefined);

/** Paneldeki eser listesi: durum, kategori, bölge ve döneme göre süzülür; adla, banisiyle ya da kimlikle aranır. */
export default async function Eserler({ params, searchParams }: { params: Promise<{ dil: string }>; searchParams: Promise<Arama> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  if (!paneldeMi(ben)) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const p = t.pano;
  const a = await searchParams;

  const [iller, yayindakiler, bekleyen] = await Promise.all([
    yayindakiIller(),
    yayindakiSurumler(),
    surumler({ durum: "incelemede" }).catch(() => []),
  ]);
  const incelemede = new Set(bekleyen.map((x) => x.eser_id));
  const ilAdi = new Map(iller.map(({ il }) => [il.id, metin(il.ad, dil)]));
  const satirlar: Satir[] = [
    ...iller.flatMap(({ il, eserler }) => eserler.map((eser) => ({ eser, il: il.id, arsivde: false, incelemede: incelemede.has(eser.id) }))),
    ...[...yayindakiler.values()]
      .filter((x) => x.arsivlendi)
      .map((x) => ({ eser: { ...x.veri, id: x.eser_id }, il: x.il, arsivde: true, incelemede: incelemede.has(x.eser_id) })),
  ];
  const yuzyillar = [...new Set(satirlar.map((x) => yuzyil(x.eser)).filter((y): y is number => !!y))].sort((x, y) => x - y);
  const turler = ayarlar().eser_turleri;

  const q = (a.q ?? "").trim().toLocaleLowerCase("tr");
  const uyan = satirlar
    .filter((x) => {
      const e = x.eser;
      if (a.durum === "arsivlendi" && !x.arsivde) return false;
      if (a.durum === "yayinda" && (x.arsivde || e.taslak)) return false;
      if (a.durum === "taslak" && (x.arsivde || !e.taslak)) return false;
      if (a.durum === "incelemede" && !x.incelemede) return false;
      if (a.tur && e.tur !== a.tur) return false;
      if (a.il && x.il !== a.il) return false;
      if (a.donem === "yok" ? yuzyil(e) !== undefined : a.donem && String(yuzyil(e)) !== a.donem) return false;
      if (q && !`${e.ad.tr} ${e.ad.en ?? ""} ${e.banisi ?? ""} ${e.id} ${e.ilce ?? ""}`.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    })
    .sort((x, y) => adSirala(x.eser.ad.tr, y.eser.ad.tr));

  const duzenleyebilir = izinli(ben, "eser.duzenle");
  return (
    <section>
      <h1>{p.eserler}</h1>
      {a.gonderildi && (
        <p className="uyari" role="status">
          {t.surum.incelemeyeGitti}
        </p>
      )}
      <p className="not">{p.eserlerAciklama}</p>
      {izinli(ben, "eser.ekle") && (
        <p className="dugmeler">
          <Link className="dugme" href={`/${dil}/yonetim/eser/yeni`}>
            + {t.yeniEser}
          </Link>
        </p>
      )}
      <form className="panel-filtre" method="get">
        <label>
          {p.ara}
          <input type="search" name="q" defaultValue={a.q ?? ""} />
        </label>
        <label>
          {p.durum}
          <select name="durum" defaultValue={a.durum ?? ""}>
            <option value="">{p.tumu}</option>
            {DURUMLAR.map((d) => (
              <option key={d} value={d}>
                {p.durumlar[d]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {p.kategori}
          <select name="tur" defaultValue={a.tur ?? ""}>
            <option value="">{p.tumu}</option>
            {turler.map((x) => (
              <option key={x.id} value={x.id}>
                {metin(x.ad, dil)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {p.bolge}
          <select name="il" defaultValue={a.il ?? ""}>
            <option value="">{p.tumu}</option>
            {[...ilAdi].map(([id, ad]) => (
              <option key={id} value={id}>
                {ad}
              </option>
            ))}
          </select>
        </label>
        <label>
          {p.donem}
          <select name="donem" defaultValue={a.donem ?? ""}>
            <option value="">{p.tumu}</option>
            {yuzyillar.map((y) => (
              <option key={y} value={y}>
                {p.yuzyil(y)}
              </option>
            ))}
            <option value="yok">{p.donemsiz}</option>
          </select>
        </label>
        <div className="dugmeler">
          <button type="submit" className="ikincil">
            {p.filtrele}
          </button>
        </div>
      </form>
      <p className="not">
        {p.sayi(uyan.length, satirlar.length)}
        {uyan.length > GOSTERILEN && ` · ${p.ilkleri(GOSTERILEN)}`}
      </p>
      <table className="tablo">
        <thead>
          <tr>
            <th>{p.ad}</th>
            <th>{p.yer}</th>
            <th>{p.kategori}</th>
            <th>{p.yil}</th>
            <th>{p.durum}</th>
            <th>{p.islemler}</th>
          </tr>
        </thead>
        <tbody>
          {uyan.slice(0, GOSTERILEN).map(({ eser: e, il, arsivde, incelemede: bekliyor }) => (
            <tr key={e.id}>
              <td>
                {duzenleyebilir && !arsivde ? <Link href={`/${dil}/yonetim/eser/${e.id}`}>{metin(e.ad, dil)}</Link> : metin(e.ad, dil)}
                <br />
                <small className="not">{e.id}</small>
              </td>
              <td>{[ilAdi.get(il), e.ilce].filter(Boolean).join(", ")}</td>
              <td>{metin(turler.find((x) => x.id === e.tur)?.ad, dil) || e.tur}</td>
              <td>{e.donem?.yapim_yili ?? "—"}</td>
              <td>
                <span className={`etiket etiket-surum-${arsivde ? "arsivlendi" : e.taslak ? "taslak" : "yayinda"}`}>
                  {p.durumlar[arsivde ? "arsivlendi" : e.taslak ? "taslak" : "yayinda"]}
                </span>
                {bekliyor && (
                  <>
                    {" "}
                    <Link className="etiket etiket-surum-incelemede" href={`/${dil}/yonetim/inceleme?tur=eser`}>
                      {p.durumlar.incelemede}
                    </Link>
                  </>
                )}
              </td>
              <td className="eylemler">
                {duzenleyebilir && !arsivde && <Link href={`/${dil}/yonetim/eser/${e.id}`}>{p.duzenle}</Link>}
                <Link href={`/${dil}/yonetim/eser/${e.id}/gecmis`}>{p.gecmis}</Link>
                {!arsivde && !e.taslak && (
                  <Link href={`/${dil}/eser/${e.id}`} target="_blank">
                    {p.sitede} ↗
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
