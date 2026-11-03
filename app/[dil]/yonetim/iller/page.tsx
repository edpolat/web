import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IlFormu, IlKaldir, IlKarari } from "@/components/IlPaneli";
import { adAnahtari, tumIller } from "@/lib/il-ilce";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { ilSurumleri } from "@/lib/sunucu/il-depo";
import type { IlSurumSatiri } from "@/lib/sunucu/il-surum";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { formTaslagiOku } from "@/lib/sunucu/taslak-depo";
import { iller, yayindakiIller, yayindakiKaynaklar } from "@/lib/veri";
import { izinli, paneldeMi } from "@/lib/yetki";

export const metadata: Metadata = { robots: { index: false } };

/** İller: sitedeki şehirler, yeni il formu ve onay bekleyen il kayıtları. */
export default async function Iller({ params, searchParams }: { params: Promise<{ dil: string }>; searchParams: Promise<{ taslak?: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  if (!paneldeMi(ben)) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const u = t.ilPaneli;
  const [yayindaki, kaynakMap] = await Promise.all([yayindakiIller(), yayindakiKaynaklar()]);
  const jsonda = new Set(iller().map(({ il }) => il.id));
  let kayitlar: IlSurumSatiri[] | undefined;
  let hataMetni = "";
  try {
    kayitlar = await ilSurumleri();
  } catch (h) {
    hataMetni = h instanceof Error ? h.message : String(h);
  }
  const bekleyen = (kayitlar ?? []).filter((k) => k.durum === "incelemede");
  const gecmis = (kayitlar ?? []).filter((k) => k.durum !== "incelemede").slice(0, 20);
  const tarih = (x: string) => new Date(x).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const ekleyebilir = izinli(ben, "eser.ekle");
  // Yeni il yalnız 81 ilden, sitede (ya da onay kuyruğunda) olmayanlar arasından seçilir.
  const alinmis = new Set([...yayindaki.map(({ il }) => il.ad.tr), ...bekleyen.map((k) => k.veri.ad.tr)].map(adAnahtari));
  const secilebilirIller = tumIller().filter((x) => !alinmis.has(adAnahtari(x)));
  const taslak = ekleyebilir ? await formTaslagiOku(Number((await searchParams).taslak), "il") : undefined;

  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <h1>{u.baslik}</h1>
      <p className="not">{u.aciklama}</p>
      {ekleyebilir && <IlFormu dil={dil} kaynaklar={[...kaynakMap.values()].map((k) => ({ id: k.id, ad: k.baslik }))} secilebilirIller={secilebilirIller} taslak={taslak} />}

      <h2>{u.bekleyen}</h2>
      {!kayitlar ? (
        <p className="hata">
          {u.tabloYok} <small>({hataMetni})</small>
        </p>
      ) : bekleyen.length === 0 ? (
        <p className="not">{u.bekleyenYok}</p>
      ) : (
        <ul className="il-listesi">
          {bekleyen.map((k) => (
            <li key={k.id} className="il-kayit">
              <strong>{metin(k.veri.ad, dil)}</strong> <small>({k.il_id})</small>
              <p className="not">
                {u.enlem}: {k.veri.merkez.enlem} · {u.boylam}: {k.veri.merkez.boylam}
                {k.veri.envanter_kaynak_id && ` · ${kaynakMap.get(k.veri.envanter_kaynak_id)?.baslik ?? k.veri.envanter_kaynak_id}`}
                <br />
                {u.ekleyen}: {k.ekleyen_ad ?? "?"} · {tarih(k.olusturuldu)}
              </p>
              {k.aciklama && <p>{k.aciklama}</p>}
              {izinli(ben, "eser.onayla") && <IlKarari dil={dil} id={k.id} />}
            </li>
          ))}
        </ul>
      )}

      <h2>{u.mevcut}</h2>
      <table className="tablo">
        <thead>
          <tr>
            <th>{u.adTr}</th>
            <th>{u.eserSayisi}</th>
            <th>{u.kaynak}</th>
          </tr>
        </thead>
        <tbody>
          {yayindaki.map(({ il, eserler }) => (
            <tr key={il.id}>
              <td>
                {metin(il.ad, dil)}
                {ekleyebilir && (
                  <>
                    <br />
                    <small>
                      <Link href={`/${dil}/yonetim/eser/yeni?il=${il.id}`}>{u.eserEkle}</Link>
                    </small>
                  </>
                )}
              </td>
              <td>{eserler.length}</td>
              <td>
                {jsonda.has(il.id) ? u.json : u.panelden}
                {!jsonda.has(il.id) && izinli(ben, "eser.arsivle") && <IlKaldir dil={dil} ilId={il.id} ad={metin(il.ad, dil)} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {gecmis.length > 0 && (
        <>
          <h2>{u.gecmis}</h2>
          <ul className="il-listesi">
            {gecmis.map((k) => (
              <li key={k.id}>
                <span className={`etiket etiket-${k.durum === "yayinda" && !k.arsivlendi ? "onaylandi" : "reddedildi"}`}>
                  {k.arsivlendi ? u.durumlar.arsivlendi : u.durumlar[k.durum]}
                </span>{" "}
                {metin(k.veri.ad, dil)} · {k.ekleyen_ad ?? "?"}
                {k.inceleyen_ad && ` → ${k.inceleyen_ad}`}
                {k.karar_tarihi && ` · ${tarih(k.karar_tarihi)}`}
                {k.ret_gerekcesi && ` · ${k.ret_gerekcesi}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
