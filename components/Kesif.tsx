"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { bulutHazir, kayitliOturum, pullariGetir } from "@/lib/bulut";
import { PUL_OLAYI, yerelPullar } from "@/lib/yerel-pul";
import { gununSirasi, z } from "@/lib/ziyaret";
import { aramaDerecesi, filtrele, konumEksik } from "@/lib/filtre";
import { DIGER_RENK, HARITA_RENKLERI, g, mesafeKm } from "@/lib/gezi";
import { konumIste, type Nokta } from "@/lib/konum";
import { adSirala } from "@/lib/metin";
import { kucukGorsel } from "@/lib/gorsel";
import { metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import type { Dil, Il, KesifEseri, Tanim } from "@/lib/tipler";
import HaritaYukle from "./HaritaYukle";
import Simge from "./Simge";

type Props = { dil: Dil; eserler: KesifEseri[]; iller: Il[]; turler: Tanim[] };

export default function Kesif({ dil, eserler, iller, turler }: Props) {
  const t = s(dil);
  const sorgu = useSearchParams();
  // Filtreler bileşenin kendi durumunda tutulur, seçim anında uygulanır. Adres çubuğu sayfayı
  // yeniden yüklemeden güncellenir: bağlantı paylaşılabilir, yenileyince aynı filtre gelir.
  const [f, setF] = useState(() => ({
    il: sorgu.get("il") ?? "",
    tur: sorgu.get("tur") ?? "",
    ara: sorgu.get("ara") ?? "",
  }));
  const [vurgulu, setVurgulu] = useState<string>();
  const v = z(dil).vitrin;
  // Pulu alınmış (ziyaret edilmiş) eserler haritada altın işaretlenir: bu tarayıcıdaki pullar + girişliyse hesaptakiler.
  const [ziyaretli, setZiyaretli] = useState<string[]>([]);
  useEffect(() => {
    const yerel = () => setZiyaretli((o) => [...new Set([...o, ...yerelPullar()])]);
    yerel();
    if (bulutHazir)
      kayitliOturum()
        .then(async (o) => {
          if (!o) return;
          const p = await pullariGetir();
          setZiyaretli((x) => [...new Set([...x, ...p])]);
        })
        .catch(() => {});
    window.addEventListener(PUL_OLAYI, yerel);
    return () => window.removeEventListener(PUL_OLAYI, yerel);
  }, []);

  function guncelle(alan: keyof typeof f, deger: string) {
    const yeniF = { ...f, [alan]: deger };
    setF(yeniF);
    const yeni = new URLSearchParams();
    for (const [k, v] of Object.entries(yeniF)) if (v) yeni.set(k, v);
    window.history.replaceState(null, "", `${window.location.pathname}${yeni.size ? `?${yeni}` : ""}`);
  }

  // Sıralama (mobil uygulamadan, 3 Kas): "Önerilen" fotoğraflı ve bilgisi bol eserleri öne alır, "A–Z" alfabetik
  // (rakamla başlayan "3. Mıntıka…" gibi kayıtlar sonda), "Yakınımda" konum izniyle en yakından uzağa.
  // Arama yazılıyken adı aranan sözle başlayan eserler en üstte.
  const gz = g(dil).yakin;
  const [sira, setSira] = useState<"onerilen" | "az" | "yakin">("onerilen");
  const [konum, setKonum] = useState<Nokta | null>(null);
  const [konumNotu, setKonumNotu] = useState<string>();
  async function yakinimda() {
    setKonumNotu(gz.aliniyor);
    const n = await konumIste();
    if (!n) return setKonumNotu(typeof navigator !== "undefined" && !navigator.geolocation ? gz.desteklenmiyor : gz.yok);
    setKonumNotu(undefined);
    setKonum(n);
    setSira("yakin");
  }
  const sonuc = useMemo(() => {
    const l = filtrele(eserler, f, dil);
    const ad = (e: KesifEseri) => metin(e.ad, dil);
    const rakamla = (e: KesifEseri) => Number(/^\d/.test(ad(e).replace(/^\s*\([^)]*\)\s*/, "")));
    const az = (a: KesifEseri, b: KesifEseri) => rakamla(a) - rakamla(b) || adSirala(ad(a), ad(b));
    const zengin = (e: KesifEseri) => (e.gorsel ? 2 : 0) + Math.min(e.kaynakliSayisi, 12) / 12 - (e.kaynakliSayisi === 0 ? 2 : 0);
    const uzaklik = (e: KesifEseri) => (konum && e.konum ? mesafeKm(konum.enlem, konum.boylam, e.konum.enlem, e.konum.boylam) : 1e9);
    if (f.ara.trim()) return l.sort((a, b) => aramaDerecesi(a, f.ara, dil) - aramaDerecesi(b, f.ara, dil) || az(a, b));
    if (sira === "yakin" && konum) return l.sort((a, b) => uzaklik(a) - uzaklik(b));
    if (sira === "az") return l.sort(az);
    return l.sort((a, b) => zengin(b) - zengin(a) || az(a, b));
  }, [eserler, f.il, f.tur, f.ara, dil, sira, konum]);
  // Tür çiplerindeki sayılar şehir ve arama filtresine göre değişir.
  const turSayilari = useMemo(() => {
    const sayac = new Map<string, number>();
    for (const e of filtrele(eserler, { ...f, tur: "" }, dil)) sayac.set(e.tur, (sayac.get(e.tur) ?? 0) + 1);
    return sayac;
  }, [eserler, f.il, f.ara, dil]);
  const ilSayilari = useMemo(() => {
    const sayac = new Map<string, number>();
    for (const e of filtrele(eserler, { ...f, il: "" }, dil)) sayac.set(e.il, (sayac.get(e.il) ?? 0) + 1);
    return sayac;
  }, [eserler, f.tur, f.ara, dil]);
  const seciliIl = iller.find((i) => i.id === f.il);
  const merkez = seciliIl?.merkez ?? { enlem: 39.0, boylam: 33.0 };
  const turAdi = (id: string) => metin(turler.find((tr) => tr.id === id)?.ad, dil);
  const yaklasikVar = sonuc.some((e) => e.konum && konumEksik(e.konum));
  const filtreli = Boolean(f.il || f.tur || f.ara);

  // Vitrin (mobil uygulamadaki gibi): güne göre değişen öne çıkan eser, kategori düğmeleri, fotoğraflı şehir kartları.
  const fotolu = useMemo(() => eserler.filter((e) => e.gorsel), [eserler]);
  const oneCikan = fotolu[gununSirasi(fotolu.length)];
  const kategoriler = ["cami", "mescit", "kulliye", "medrese"].filter((id) => turler.some((tr) => tr.id === id));
  const sehirKartlari = iller.map((i) => {
    const ilinkiler = fotolu.filter((e) => e.il === i.id);
    return { il: i, sayi: eserler.filter((e) => e.il === i.id).length, foto: ilinkiler[gununSirasi(ilinkiler.length)]?.gorsel };
  });

  return (
    <div className="kesif-alani">
      {!filtreli && (
        <section className="vitrin" aria-label={v.oneCikan}>
          {oneCikan && (
            <Link href={`/${dil}/eser/${oneCikan.id}`} className="vitrin-one-cikan" style={{ backgroundImage: `url("${kucukGorsel(oneCikan.gorsel!.dosya)}")`, backgroundPosition: oneCikan.gorsel!.odak }}>
              <small>{v.bugun}</small>
              <b>{metin(oneCikan.ad, dil)}</b>
              {oneCikan.ozet && <span className="vitrin-ozet">{metin(oneCikan.ozet, dil)}</span>}
              <span>{[turAdi(oneCikan.tur), metin(iller.find((i) => i.id === oneCikan.il)?.ad, dil), oneCikan.ilce].filter(Boolean).join(" · ")}</span>
            </Link>
          )}
          <div className="vitrin-yan">
            <h2 className="kart-baslik">{v.kategoriler}</h2>
            <div className="vitrin-kategoriler" role="group" aria-label={v.kategoriler}>
              {kategoriler.map((id) => (
                <button key={id} type="button" onClick={() => guncelle("tur", id)}>
                  {turAdi(id)} <small>{turSayilari.get(id) ?? 0}</small>
                </button>
              ))}
            </div>
            <h2 className="kart-baslik">{v.sehirler}</h2>
            <div className="vitrin-sehirler">
              {sehirKartlari.map(({ il, sayi, foto }) => (
                <button
                  key={il.id}
                  type="button"
                  className="vitrin-sehir"
                  style={foto ? { backgroundImage: `url("${kucukGorsel(foto.dosya)}")`, backgroundPosition: foto.odak } : undefined}
                  onClick={() => guncelle("il", il.id)}
                >
                  <b>{metin(il.ad, dil)}</b>
                  <small>{v.eser(sayi)}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      <form className="kesif-arac" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="arama">
          <span className="gizli">{t.ara}</span>
          <input
            type="search"
            value={f.ara}
            placeholder={t.araYer}
            onChange={(e) => guncelle("ara", e.target.value)}
          />
        </label>
        <label className="secim">
          <span>{t.il}</span>
          <select value={f.il} onChange={(e) => guncelle("il", e.target.value)}>
            <option value="">{t.tumSehirler}</option>
            {iller.map((i) => (
              <option key={i.id} value={i.id}>
                {metin(i.ad, dil)} ({ilSayilari.get(i.id) ?? 0})
              </option>
            ))}
          </select>
        </label>
        <label className="secim">
          <span>{t.tur}</span>
          <select value={f.tur} onChange={(e) => guncelle("tur", e.target.value)}>
            <option value="">{t.tumTurler}</option>
            {turler
              .filter((tr) => turSayilari.has(tr.id) || f.tur === tr.id)
              .map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {metin(tr.ad, dil)} ({turSayilari.get(tr.id) ?? 0})
                </option>
              ))}
          </select>
        </label>
        {(f.il || f.tur || f.ara) && (
          <button type="button" className="temizle" onClick={() => { setF({ il: "", tur: "", ara: "" }); window.history.replaceState(null, "", window.location.pathname); }}>
            {t.filtreleriTemizle}
          </button>
        )}
      </form>

      {f.il === "hatay" && (
        <p className="uyari" role="note">
          {v.deprem}
        </p>
      )}
      <div className="sonuc-satiri">
        <p className="sonuc-sayisi" role="status" aria-live="polite">
          {t.sonucOran(sonuc.length, eserler.length)}
        </p>
        {!f.ara.trim() && (
          <span className="sira-secici" role="group" aria-label={gz.sira}>
            <button type="button" aria-pressed={sira === "yakin" && !!konum} onClick={yakinimda}>
              {gz.yakinimda}
            </button>
            <button type="button" aria-pressed={sira === "onerilen"} onClick={() => setSira("onerilen")}>
              {gz.onerilen}
            </button>
            <button type="button" aria-pressed={sira === "az"} onClick={() => setSira("az")}>
              {gz.az}
            </button>
          </span>
        )}
      </div>
      {konumNotu && (
        <p className="not" role="status">
          {konumNotu}
        </p>
      )}

      <div className="kesif">
        <section aria-label={t.liste}>
          {sonuc.length === 0 ? (
            <p className="bos-sonuc">{t.sonucYok}</p>
          ) : (
            <ul className="eser-kartlari">
              {sonuc.map((e) => (
                <li key={e.id} onMouseEnter={() => setVurgulu(e.id)} onMouseLeave={() => setVurgulu(undefined)}>
                  <Link
                    href={`/${dil}/eser/${e.id}`}
                    className="eser-karti"
                    onFocus={() => setVurgulu(e.id)}
                    onBlur={() => setVurgulu(undefined)}
                  >
                    <span className="eser-karti-gorsel">
                      {e.gorsel ? (
                        <img src={kucukGorsel(e.gorsel.dosya)} alt="" loading="lazy" width={480} height={270} style={e.gorsel.odak ? { objectPosition: e.gorsel.odak } : undefined} />
                      ) : (
                        <span className="gorsel-yok">
                          <Simge ad="yapi" boyut={44} />
                        </span>
                      )}
                      <span className="tur-rozeti">{turAdi(e.tur)}</span>
                      {e.gorselSayisi > 1 && (
                        <span className="foto-sayisi">
                          <Simge ad="foto" boyut={14} /> {e.gorselSayisi}
                        </span>
                      )}
                    </span>
                    <span className="eser-karti-govde">
                      <strong>{metin(e.ad, dil)}</strong>
                      <small>
                        {[e.ilce, metin(iller.find((i) => i.id === e.il)?.ad, dil), e.yil].filter(Boolean).join(" · ")}
                      </small>
                      {e.kaynakliSayisi > 0 && (
                        <span className="kaynakli-not">
                          <Simge ad="kaynak" boyut={15} /> {t.kaynakliBilgi(e.kaynakliSayisi)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label={t.harita} className="kesif-harita">
          <HaritaYukle
            key={f.il || "tum"}
            dil={dil}
            eserler={sonuc}
            merkez={merkez}
            yakinlastirma={seciliIl?.yakinlastirma ?? 6}
            yukseklik={560}
            vurgulu={vurgulu}
            ziyaretli={ziyaretli}
            araclar
          />
          <p className="lejant" aria-label={t.harita}>
            {Object.entries(HARITA_RENKLERI).map(([id, renk]) => (
              <span key={id}>
                <i style={{ background: renk }} aria-hidden="true" />
                {turAdi(id)}
              </span>
            ))}
            <span>
              <i style={{ background: DIGER_RENK }} aria-hidden="true" />
              {metin(turler.find((tr) => tr.id === "diger")?.ad, dil) || "Diğer"}
            </span>
          </p>
          {yaklasikVar && <p className="not">○ {t.konumYaklasik}</p>}
          {ziyaretli.length > 0 && (
            <p className="not">
              <span className="ziyaret-nokta" aria-hidden="true" /> {z(dil).harita.ziyaret}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
