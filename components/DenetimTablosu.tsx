import Link from "next/link";
import { s } from "@/lib/sozluk";
import { goster } from "@/lib/sunucu/goster";
import type { DenetimSatiri } from "@/lib/sunucu/surum-depo";
import type { Dil, Kaynak } from "@/lib/tipler";

const tarih = (iso: string, dil: string) =>
  new Date(iso).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

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
              <td>
                {u.denetimIslem[k.islem] ?? k.islem}
                {k.alan && (
                  <>
                    {" · "}
                    <strong>{t.alanlar[k.alan] ?? t.oneri.alanlar[k.alan] ?? k.alan}</strong>
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
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
