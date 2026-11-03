import { DURUM_CUMLESI, GENEL_TURU, durumCumlesi, g } from "@/lib/gezi";
import type { Dil, Olgu } from "@/lib/tipler";

/**
 * "ZİYARET BİLGİSİ" kartı (mobil uygulamadan, 3 Kas 2026):
 * - Bugün: envanterin "Günümüz" bilgisinde yapının bugünkü kullanımını söyleyen cümle varsa, sayfasıyla.
 * - Açık mı / Ücret: türe göre genel bilgi; eserin kendi saati olmadığı açıkça yazar.
 * - Konum yaklaşıksa uyarı. Namaz vakitleri ibadet yerlerinde Ziyaret adabı kartında.
 * Metin yalnızca Türkçe envanterden geldiği için "Bugün" satırı İngilizce sayfada çevirisi varsa çeviriyle gösterilir.
 */
export default function ZiyaretBilgisi({ dil, tur, olgular, yaklasik }: { dil: Dil; tur: string; olgular: Olgu[]; yaklasik: boolean }) {
  const t = g(dil).bilgi;
  const genel = t.genel[GENEL_TURU[tur] ?? "yapi"];
  const durum = olgular.find((o) => o.kategori === "gunumuz" && DURUM_CUMLESI.test(o.metin.tr));
  const muze = durum && /müze/i.test(durum.metin.tr);
  const durumMetni = durum ? (dil === "en" && durum.metin.en ? durum.metin.en : durumCumlesi(durum.metin.tr)) : undefined;
  return (
    <section className="ziyaret-karti" aria-labelledby="ziyaret-bilgisi">
      <h2 id="ziyaret-bilgisi" className="kart-baslik">
        {t.baslik}
      </h2>
      <dl>
        {durum && durumMetni && (
          <div>
            <dt>{t.bugun}</dt>
            <dd lang={dil === "en" && !durum.metin.en ? "tr" : undefined}>
              {durumMetni}
              {durum.sayfa && <small>{t.sayfa(durum.sayfa)}</small>}
            </dd>
          </div>
        )}
        <div>
          <dt>{t.acikMi}</dt>
          <dd>{muze ? t.muzeAcik : genel.acik}</dd>
        </div>
        <div>
          <dt>{t.ucret}</dt>
          <dd>{muze ? t.muzeUcret : genel.ucret}</dd>
        </div>
        {yaklasik && (
          <div>
            <dt>{t.konum}</dt>
            <dd>{t.yaklasik}</dd>
          </div>
        )}
      </dl>
      <small className="not">{t.not}</small>
    </section>
  );
}
