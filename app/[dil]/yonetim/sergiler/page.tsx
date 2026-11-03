import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SergiFormu, SergiSil } from "@/components/SergiPaneli";
import { gecerliDil, metin } from "@/lib/metin";
import { satirdanSergi, sergiDurumu, sergidenForm, type SergiSatiri } from "@/lib/sergi";
import { s } from "@/lib/sozluk";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { sergiKayitlari } from "@/lib/sunucu/sergi-depo";
import type { Dil, Sergi } from "@/lib/tipler";
import { sergiler as jsondakiSergiler } from "@/lib/veri";
import { izinli, paneldeMi } from "@/lib/yetki";

export const metadata: Metadata = { robots: { index: false } };

const gun = (x: string, dil: Dil) => new Date(`${x}T00:00:00Z`).toLocaleDateString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeZone: "UTC" });

/** Sergiler: sitedeki sergilerin listesi; sergi.yonet izni olan ekler, düzenler, siler. */
export default async function Sergiler({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  if (!paneldeMi(ben)) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const u = t.sergiPaneli;
  const yonetebilir = izinli(ben, "sergi.yonet");

  let satirlar: SergiSatiri[] | undefined;
  let hataMetni = "";
  try {
    satirlar = await sergiKayitlari();
  } catch (h) {
    hataMetni = h instanceof Error ? h.message : String(h);
  }
  // Tablo yoksa (017 çalıştırılmadı) site JSON'u gösteriyor: listede de o görünür, değiştirme kapalı.
  const liste: { sergi: Sergi; satir?: SergiSatiri }[] = satirlar
    ? satirlar.map((r) => ({ sergi: satirdanSergi(r), satir: r }))
    : [...jsondakiSergiler().values()].map((sergi) => ({ sergi }));
  const bugun = new Date().toISOString().slice(0, 10);
  const zaman = (x: string) => new Date(x).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <h1>{u.baslik}</h1>
      <p className="not">
        {u.aciklama} <Link href={`/${dil}/sergiler`}>{t.pano.sitede} →</Link>
      </p>
      {!satirlar && (
        <p className="hata">
          {u.tabloYok} <small>({hataMetni})</small>
        </p>
      )}
      {!yonetebilir && <p className="not">{u.salt}</p>}

      {yonetebilir && satirlar && (
        <details className="katki" id="sergi-formu">
          <summary>{u.ekle}</summary>
          <SergiFormu dil={dil} />
        </details>
      )}

      <h2>{u.sayi(liste.length)}</h2>
      {liste.length === 0 ? (
        <p className="not">{u.bos}</p>
      ) : (
        <ul className="il-listesi sergi-panel-listesi">
          {liste.map(({ sergi, satir }) => {
            const gizli = !sergi.yer || !sergi.baslangic;
            const durum = sergiDurumu(sergi, bugun);
            return (
              <li key={sergi.id} id={`sergi-${sergi.id}`} className="il-kayit">
                <p>
                  {gizli ? (
                    <span className="etiket etiket-reddedildi">{u.sitedeGizli}</span>
                  ) : (
                    <span className={`sergi-durum sergi-durum-${durum}`}>{t.sergilerSayfa.durum[durum]}</span>
                  )}{" "}
                  <strong>{metin(sergi.ad, dil)}</strong> <small>({sergi.id})</small>
                </p>
                <p className="not">
                  {[sergi.sehir, sergi.yer].filter(Boolean).join(" · ")}
                  {sergi.baslangic && (
                    <>
                      <br />
                      {u.tarih}: {gun(sergi.baslangic, dil)}
                      {sergi.bitis ? ` – ${gun(sergi.bitis, dil)}` : ` (${t.sergilerSayfa.bitisYok})`}
                    </>
                  )}
                  {satir && (satir.guncelleyen_ad || satir.ekleyen_ad) && (
                    <>
                      <br />
                      {u.degistiren}: {satir.guncelleyen_ad ?? satir.ekleyen_ad}
                      {satir.guncellendi ? ` · ${zaman(satir.guncellendi)}` : ""}
                    </>
                  )}
                </p>
                {yonetebilir && satir && (
                  <>
                    <details>
                      <summary>{u.duzenle}</summary>
                      <SergiFormu dil={dil} ilk={sergidenForm(sergi)} />
                    </details>
                    <SergiSil dil={dil} id={sergi.id} ad={metin(sergi.ad, dil)} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
