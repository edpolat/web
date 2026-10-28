import Link from "next/link";
import { s } from "@/lib/sozluk";
import { goster } from "@/lib/sunucu/goster";
import type { DenetimSatiri } from "@/lib/sunucu/surum-depo";
import type { Sozluk } from "@/lib/sozluk";
import type { Dil, Kaynak } from "@/lib/tipler";

const tarih = (iso: string, dil: string) =>
  new Date(iso).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

type Nesne = Record<string, unknown>;
const nesne = (x: unknown): Nesne => (typeof x === "object" && x !== null ? (x as Nesne) : {});

/** "surum #3" / "kaynak #5" / "oneri #7" → "Eser düzenlemesi #3" gibi. */
function yzHedefi(alan: string | null, t: Sozluk): string {
  const [tur, no] = (alan ?? "").split(" #");
  const ad = t.surum.onayTuru[(tur === "surum" ? "eser" : tur) as keyof typeof t.surum.onayTuru];
  return ad ? `${ad}${no ? ` #${no}` : ""}` : alan ?? "";
}

/** YZ etiket/öncelik nesnesi → "Spam, Kaynaksız · Düşük öncelik". */
function etiketYazisi(x: unknown, t: Sozluk): string {
  const o = nesne(x);
  const etiketler = Array.isArray(o.etiketler) ? o.etiketler.map((e) => t.yz.etiketler[String(e)] ?? String(e)) : [];
  const oncelik = typeof o.oncelik === "string" ? t.yz.oncelikler[o.oncelik] ?? o.oncelik : "";
  return [etiketler.join(", ") || t.yz.etiketYok, oncelik].filter(Boolean).join(" · ");
}

/** Saklanan YZ sonucunu (kaynak analizi ya da ön eleme) düz cümleye çevirir. */
function yzSonucu(x: unknown, t: Sozluk): string {
  const o = nesne(x);
  const y = t.yz;
  const aciklama = typeof o.aciklama === "string" ? o.aciklama.trim() : "";
  if (o.metin === "kaynak_yok") return `${y.okunamadi}. ${y.kaynakYok}`;
  if (o.metin === "okunamadi") {
    const neden = aciklama.replace(/^Metin okunamadı, manuel inceleme gerekli\.?\s*/, "");
    return `${y.okunamadi}.${neden ? ` ${neden}` : ""}`;
  }
  if (typeof o.sonuc === "string") {
    const parca = [y.sonuclar[o.sonuc] ?? o.sonuc];
    if (typeof o.guven === "string" && y.guven[o.guven]) parca.push(y.guven[o.guven]);
    if (o.pasaj_dogrulandi === false) parca.push(y.dogrulanamadiKisa);
    return `${parca.join(", ")}.${aciklama ? ` ${aciklama}` : ""}`;
  }
  if (Array.isArray(o.etiketler)) {
    const gerekce = typeof o.gerekce === "string" ? o.gerekce.trim() : "";
    return `${etiketYazisi(o, t)}.${gerekce ? ` ${gerekce}` : ""}`;
  }
  return aciklama || y.yapilamadi;
}

/** Gerekçenin sonundaki "X onayladı/reddetti" kısmından editör kararı. */
const yzKarar = (gerekce: string | null, t: Sozluk) =>
  gerekce?.trim().endsWith("reddetti") ? t.yz.kararlar.reddetti : gerekce?.trim().endsWith("onayladı") ? t.yz.kararlar.onayladi : null;

/**
 * Denetim kaydı tablosu: zaman, kim, işlem ve alan alan eski → yeni. hedefler verilirse "Hedef" sütunu da çıkar
 * (eser adı ya da kaynak başlığı, kendi sayfasına bağlı).
 */
export default function DenetimTablosu({
  dil,
  kayitlar,
  kaynakMap,
  hedefler,
}: {
  dil: Dil;
  kayitlar: DenetimSatiri[];
  kaynakMap: Map<string, Kaynak>;
  hedefler?: Map<string, { ad: string; yol: string }>;
}) {
  const t = s(dil);
  const u = t.surum;
  if (!kayitlar.length) return <p>{u.hicYok}</p>;
  return (
    <table className="tablo">
      <thead>
        <tr>
          <th>{u.zaman}</th>
          <th>{u.kim}</th>
          {hedefler && <th>{t.pano.hedef}</th>}
          <th>{u.ne}</th>
        </tr>
      </thead>
      <tbody>
        {kayitlar.map((k) => {
          const hedef = k.hedef ? hedefler?.get(k.hedef) : undefined;
          return (
            <tr key={k.id}>
              <td>{tarih(k.ne_zaman, dil)}</td>
              <td>{k.kim_ad}</td>
              {hedefler && <td>{hedef ? <Link href={hedef.yol}>{hedef.ad}</Link> : k.hedef}</td>}
              <td className="denetim-islem">
                {k.islem === "yz_onerisi" ? (
                  <>
                    {u.denetimIslem.yz_onerisi} · <strong>{yzHedefi(k.alan, t)}</strong>
                    <br />
                    <small>{yzSonucu(k.yeni, t)}</small>
                    {yzKarar(k.gerekce, t) && (
                      <>
                        <br />
                        <small>{yzKarar(k.gerekce, t)}</small>
                      </>
                    )}
                  </>
                ) : k.islem === "yz_etiket_duzelt" ? (
                  <>
                    {u.denetimIslem.yz_etiket_duzelt} · <strong>{yzHedefi(k.alan, t)}</strong>
                    <br />
                    <small>
                      {etiketYazisi(k.eski, t)} → {etiketYazisi(k.yeni, t)}
                    </small>
                  </>
                ) : (
                  <>
                    {u.denetimIslem[k.islem] ?? k.islem}
                    {k.alan && (
                      <>
                        {" · "}
                        <strong>{k.alan === "rol" ? t.panel.rol : (t.alanlar[k.alan] ?? t.oneri.alanlar[k.alan] ?? k.alan)}</strong>
                        <br />
                        <small>
                          {goster(k.alan, k.eski, dil, t, kaynakMap).slice(0, 200)} → {goster(k.alan, k.yeni, dil, t, kaynakMap).slice(0, 200)}
                        </small>
                      </>
                    )}
                    {k.gerekce && (
                      <>
                        <br />
                        <small>
                          {u.gerekce}: {k.gerekce}
                        </small>
                      </>
                    )}
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
