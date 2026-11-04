import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DILLER, ceviriEksik, gecerliDil, metin } from "@/lib/metin";
import { ayarlar, kaynakAdresi, tumEserler, vakiflar, yayindakiEser, yayindakiIller, yayindakiKaynaklar } from "@/lib/veri";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import HaritaYukle from "@/components/HaritaYukle";
import KapakGaleri from "@/components/KapakGaleri";
import Dinle, { type OkunacakParca } from "@/components/Dinle";
import SoruPaneli from "@/components/SoruPaneli";
import TalepFormu from "@/components/TalepFormu";
import TerimliMetin from "@/components/TerimliMetin";
import ZiyaretAdabi from "@/components/ZiyaretAdabi";
import ZiyaretBilgisi from "@/components/ZiyaretBilgisi";
import EserPlan, { EserMesafesi } from "@/components/EserPlan";
import Simge from "@/components/Simge";
import { z } from "@/lib/ziyaret";
import { konumEksik } from "@/lib/filtre";
import { g, kesikleriDuzelt } from "@/lib/gezi";
import { katkilar } from "@/lib/sunucu/kuyruk";
import { yayindakiSergiler } from "@/lib/sunucu/sergi-depo";
import { cevapla } from "@/lib/sunucu/sor";

type Params = Promise<{ dil: string; id: string }>;

/** Kitap metinleri paragrafları boş satırla ayırır. */
function Paragraflar({ metin, lang, dil }: { metin: string; lang?: string; dil: Dil }) {
  return (
    <div lang={lang}>
      {metin.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="cok-satir">
          <TerimliMetin metin={p} dil={(lang as Dil) ?? dil} />
        </p>
      ))}
    </div>
  );
}

export function generateStaticParams() {
  return DILLER.flatMap((dil) => tumEserler().map((e) => ({ dil, id: e.id })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { dil, id } = await params;
  const eser = gecerliDil(dil) ? await yayindakiEser(id) : undefined;
  return eser ? { title: metin(eser.ad, dil as Dil) } : {};
}

export default async function EserKarti({ params }: { params: Params }) {
  const { dil, id } = await params;
  if (!gecerliDil(dil)) notFound();
  const eser = await yayindakiEser(id);
  if (!eser) notFound();

  const t = s(dil);
  const ay = ayarlar();
  const tur = ay.eser_turleri.find((x) => x.id === eser.tur);
  const il = (await yayindakiIller()).find((x) => x.il.id === eser.il)?.il;
  const durumlar = new Map(ay.olgu_durumlari.map((d) => [d.id, d]));
  const kaynakMap = await yayindakiKaynaklar();
  const donemKaynagi = eser.donem?.kaynak_id ? kaynakMap.get(eser.donem.kaynak_id) : undefined;
  const sergiMap = await yayindakiSergiler();
  const vakif = eser.vakif_id ? vakiflar().get(eser.vakif_id) : undefined;

  // Yalnızca yayında gösterilecek durumdaki olgular ("doğrulanacak" gizli).
  // Kitaptan aktarılırken başı kopmuş cümlelerin kopuk başı atlanır (uygulamadaki gibi; veri değişmez).
  const olgular = kesikleriDuzelt(eser.olgular.filter((o) => durumlar.get(o.durum)?.yayinda));
  const yaklasik = konumEksik(eser.konum);
  const kullanilanKaynaklar = new Set(
    [...olgular.map((o) => o.kaynak_id), eser.envanter?.kaynak_id].filter(Boolean) as string[],
  );

  const durumAdlari = Object.fromEntries(ay.olgu_durumlari.map((d) => [d.id, metin(d.ad, dil)]));
  // Dinle önce kaynaklı bilgileri okur; bilgi yoksa tarihçe paragraflarını.
  const tarihceParagraflari = eser.tarihce ? metin(eser.tarihce, dil).split(/\n{2,}/) : [];
  const okunacak: OkunacakParca[] = olgular.length
    ? olgular.map((o, i) => ({ id: `olgu-${i}`, metin: metin(o.metin, dil), lang: ceviriEksik(o.metin, dil) ? "tr" : dil }))
    : tarihceParagraflari.map((p, i) => ({ id: `tarihce-${i}`, metin: p, lang: ceviriEksik(eser.tarihce, dil) ? "tr" : dil }));
  const sonOnay = katkilar()
    .filter((k) => k.eser_id === eser.id && k.durum === "onaylandi" && k.karar)
    .map((k) => k.karar!.tarih)
    .sort()
    .at(-1);

  return (
    <div className="eser-duzen">
    <article className="eser-sayfa">
      <p className="geri-baglanti">
        <Link href={`/${dil}`}>← {t.geri}</Link>
      </p>
      {eser.taslak && <p className="uyari" role="note">{t.taslak}</p>}
      <header className="eser-baslik">
        <p className="ust-bilgi">
          {[metin(il?.ad, dil), eser.ilce, metin(tur?.ad, dil)].filter(Boolean).join(" · ")}
          {eser.konum && <EserMesafesi dil={dil} konum={{ enlem: eser.konum.enlem, boylam: eser.konum.boylam }} yaklasik={yaklasik} />}
        </p>
        <h1>{metin(eser.ad, dil)}</h1>
      </header>
      {eser.il === "hatay" && (
        <p className="uyari" role="note">
          {t.hatayDeprem}
        </p>
      )}

      <KapakGaleri dil={dil} gorseller={eser.gorseller ?? []} galeriAdi={t.galeri} />

      <dl className="kunye-kutulari">
        {(eser.donem?.yapim_yili || eser.donem?.metin) && (
          <div>
            <dt>{t.donem}</dt>
            <dd>
              {eser.donem.metin ? (
                metin(eser.donem.metin, dil)
              ) : (
                <>
                  {eser.donem.yaklasik ? `${t.yaklasik} ` : ""}
                  {eser.donem.yapim_yili}
                  {eser.donem.yapim_yili_hicri ? ` (H. ${eser.donem.yapim_yili_hicri})` : ""}
                </>
              )}
              {donemKaynagi && (
                <>
                  {" "}
                  <a
                    className="etiket etiket-kaynakli"
                    href={eser.donem.sayfa ? kaynakAdresi(donemKaynagi, eser.donem.sayfa) : `#kaynak-${donemKaynagi.id}`}
                    {...(eser.donem.sayfa ? { target: "_blank", rel: "noopener" } : {})}
                    title={`${donemKaynagi.baslik}${eser.donem.sayfa ? `, ${t.sayfa} ${eser.donem.sayfa}` : ""}`}
                  >
                    {t.durumIsareti.kaynakli}
                    {eser.donem.sayfa ? ` ${t.sayfaKisa(eser.donem.sayfa)}` : ""}
                  </a>
                </>
              )}
            </dd>
          </div>
        )}
        {eser.banisi && (
          <div>
            <dt>{t.banisi}</dt>
            <dd>{eser.banisi}</dd>
          </div>
        )}
        {eser.mimar && (
          <div>
            <dt>{t.mimar}</dt>
            <dd>{eser.mimar}</dd>
          </div>
        )}
        {vakif && (
          <div>
            <dt>{t.vakif}</dt>
            <dd>{metin(vakif.ad, dil)}</dd>
          </div>
        )}
        {eser.adres && (
          <div className="genis">
            <dt>{t.adres}</dt>
            <dd>{metin(eser.adres, dil)}</dd>
          </div>
        )}
      </dl>

      {/* Tek dolu düğme (Dinle); yanında çerçevesiz, sakin eylemler. Öneri formları kaynaklı bilgilerin altındaki kartta. */}
      <div className="eser-eylemler">
        <Dinle dil={dil} parcalar={okunacak} />
        <EserPlan dil={dil} eserId={eser.id} eserAdi={metin(eser.ad, dil)} sehir={metin(il?.ad, dil)} />
        <Link className="dugme sade-eylem" href={`/${dil}/tara`}>
          <Simge ad="tara" /> {z(dil).tara.buradaysan}
        </Link>
        <a className="dugme sade-eylem sor-baglanti" href="#sor-baslik">
          <Simge ad="sor" /> {t.sor.baslik}
        </a>
      </div>
      {!olgular.length && !eser.tarihce && <p className="not bilgisiz">{g(dil).bilgisiz}</p>}
      <div className="ziyaret-ikili">
        <ZiyaretBilgisi dil={dil} tur={eser.tur} olgular={olgular} yaklasik={yaklasik} />
        <ZiyaretAdabi dil={dil} tur={eser.tur} konum={eser.konum ? { enlem: eser.konum.enlem, boylam: eser.konum.boylam } : undefined} />
      </div>
      {sonOnay && (
        <p className="not">
          {t.sonGuncelleme}: {new Date(sonOnay).toLocaleDateString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "long" })}
        </p>
      )}

      {olgular.length > 0 && (
        <section aria-labelledby="bilgiler">
          <h2 id="bilgiler">{t.bilgilerKaynaklar}</h2>
          <ul className="olgular">
            {olgular.map((o, i) => {
              const kaynak = o.kaynak_id ? kaynakMap.get(o.kaynak_id) : undefined;
              // Kitabın PDF'i varsa etiket onu bilginin geçtiği sayfada açar; yoksa kaynakçaya iner.
              const adres = kaynak && o.sayfa ? kaynakAdresi(kaynak, o.sayfa) : undefined;
              return (
                <li key={i} id={`olgu-${i}`}>
                  <span lang={ceviriEksik(o.metin, dil) ? "tr" : undefined}>
                    <TerimliMetin metin={metin(o.metin, dil)} dil={ceviriEksik(o.metin, dil) ? "tr" : dil} />
                  </span>{" "}
                  <a
                    className={`etiket etiket-${o.durum}`}
                    href={adres ?? (kaynak ? `#kaynak-${kaynak.id}` : undefined)}
                    {...(adres ? { target: "_blank", rel: "noopener" } : {})}
                    title={kaynak ? `${kaynak.baslik}${o.sayfa ? `, ${t.sayfa} ${o.sayfa}` : ""}` : undefined}
                  >
                    {t.durumIsareti[o.durum]} {durumAdlari[o.durum]}
                    {o.sayfa ? ` · ${t.sayfaKisa(o.sayfa)}` : ""}
                  </a>
                  {dil === "en" && o.en_ceviri === "yz" && (
                    <>
                      {" "}
                      <span className="etiket etiket-ceviri" title={t.ceviriAciklama}>
                        {t.ceviriEtiketi}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Katkı: bilgilerin hemen altında, sakin bir kartta. */}
      <section className="katki-karti" aria-labelledby="katki-baslik">
        <div>
          <h2 id="katki-baslik">{t.katkiBaslik}</h2>
          <p>{t.katkiAciklama}</p>
        </div>
        <div className="katki-dugmeler">
          <Link className="dugme ikincil" href={`/${dil}/eser/${eser.id}/oner`}>
            {t.bilgiEkle}
          </Link>
          <TalepFormu dil={dil} eserId={eser.id} eserAdi={metin(eser.ad, dil)} />
        </div>
      </section>

      {/* Ziyaret kartları asıl içerikten (kaynaklı bilgiler) sonra gelir. */}

      {eser.tarihce && (
        <section aria-labelledby="tarihce">
          <h2 id="tarihce">{t.tarihce}</h2>
          {ceviriEksik(eser.tarihce, dil) && <p className="not">{t.turkceGosteriliyor}</p>}
          <div lang={ceviriEksik(eser.tarihce, dil) ? "tr" : undefined}>
            {tarihceParagraflari.map((p, i) => (
              <p key={i} id={`tarihce-${i}`} className="cok-satir">
                <TerimliMetin metin={p} dil={ceviriEksik(eser.tarihce, dil) ? "tr" : dil} />
              </p>
            ))}
          </div>
        </section>
      )}

      {eser.mimari && (
        <section aria-labelledby="mimari">
          <h2 id="mimari">{t.mimari}</h2>
          {eser.mimari.metin && (
            <Paragraflar
              metin={metin(eser.mimari.metin, dil)}
              lang={ceviriEksik(eser.mimari.metin, dil) ? "tr" : undefined}
              dil={dil}
            />
          )}
          {(eser.mimari.plan || eser.mimari.malzeme?.length || eser.mimari.ust_ortu) && (
            <dl className="kunye-kutulari mimari-kunye">
              {eser.mimari.plan && (
                <div>
                  <dt>{t.plan}</dt>
                  <dd>{eser.mimari.plan}</dd>
                </div>
              )}
              {eser.mimari.malzeme?.length ? (
                <div>
                  <dt>{t.malzeme}</dt>
                  <dd>{eser.mimari.malzeme.join(", ")}</dd>
                </div>
              ) : null}
              {eser.mimari.ust_ortu && (
                <div>
                  <dt>{t.ustOrtu}</dt>
                  <dd>{eser.mimari.ust_ortu}</dd>
                </div>
              )}
            </dl>
          )}
          {eser.mimari.onarimlar?.length ? (
            <>
              <h3>{t.onarimlar}</h3>
              <ol className="onarim-cizelgesi">
                {eser.mimari.onarimlar.map((o, i) => (
                  <li key={`${o.yil}-${i}`}>
                    <b>{o.yil}</b>
                    {o.aciklama ? <span>{metin(o.aciklama, dil)}</span> : null}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </section>
      )}


      {eser.sergi_idleri?.length ? (
        <section aria-labelledby="sergiler">
          <h2 id="sergiler">{t.sergiler}</h2>
          <ul>
            {eser.sergi_idleri.map((sid) => {
              const sergi = sergiMap.get(sid);
              return sergi ? <li key={sid}>{metin(sergi.ad, dil)}</li> : null;
            })}
          </ul>
        </section>
      ) : null}

      {kullanilanKaynaklar.size > 0 && (
        <section aria-labelledby="kaynaklar">
          <h2 id="kaynaklar">{t.kaynaklar}</h2>
          <ol className="kaynakca">
            {[...kullanilanKaynaklar].map((kid) => {
              const k = kaynakMap.get(kid);
              if (!k) return null;
              return (
                <li key={kid} id={`kaynak-${kid}`}>
                  {k.yazar ? `${k.yazar}, ` : ""}
                  {k.url ? <a href={k.url}>{k.baslik}</a> : <cite>{k.baslik}</cite>}
                  {k.yayinci ? `, ${k.yayinci}` : ""}
                  {k.yil ? `, ${k.yil}` : ""}
                  {k.url && kid === eser.envanter?.kaynak_id && eser.envanter.sayfa && (
                    <>
                      {", "}
                      <a href={kaynakAdresi(k, eser.envanter.sayfa)} target="_blank" rel="noopener">
                        {t.sayfaKisa(eser.envanter.sayfa)}
                      </a>
                    </>
                  )}
                  .
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </article>
    <aside className="eser-yan">
      <SoruPaneli
        dil={dil}
        eserId={eser.id}
        durumAdlari={durumAdlari}
        ornekler={t.sor.ornekler.filter((o) => cevapla(eser, o, dil).bulundu)}
      />
      {eser.konum && (
        <section aria-labelledby="harita" className="yan-harita">
          <h2 id="harita">{t.harita}</h2>
          {!eser.konum.dogrulandi && (
            <p className="not">
              {eser.konum.hassasiyet === "ilce"
                ? t.konumIlce
                : eser.konum.hassasiyet === "mahalle"
                  ? t.konumMahalle
                  : t.konumDogrulanmadi}
            </p>
          )}
          <HaritaYukle dil={dil} eserler={[eser]} merkez={eser.konum} yakinlastirma={eser.konum.hassasiyet === "ilce" ? 13 : 16} yukseklik={220} />
          {eser.konum.hassasiyet !== "ilce" && (
            <details className="yol-tarifi">
              {/* Mobil uygulamadaki gibi yürüyerek yol tarifi; tıklayınca harita uygulaması seçilir */}
              <summary className="dugme">{t.yolTarifi}</summary>
              <ul>
                <li>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${eser.konum.enlem},${eser.konum.boylam}&travelmode=walking`}
                    target="_blank"
                    rel="noopener"
                  >
                    {t.googleHaritalar}
                  </a>
                </li>
                <li>
                  <a
                    href={`https://maps.apple.com/?daddr=${eser.konum.enlem},${eser.konum.boylam}&dirflg=w`}
                    target="_blank"
                    rel="noopener"
                  >
                    {t.appleHaritalar}
                  </a>
                </li>
              </ul>
            </details>
          )}
        </section>
      )}
    </aside>
    </div>
  );
}
