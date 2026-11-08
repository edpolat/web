/** Onay bekleyenler panelinde lacivert başlık şeritli bölüm (Süreç, Eser, Bilgi, Karar). */
export function Bolum({ baslik, children, sinif }: { baslik: string; children: React.ReactNode; sinif?: string }) {
  return (
    <section className={`ib-bolum${sinif ? ` ${sinif}` : ""}`} aria-label={baslik}>
      <p className="ib-serit">{baslik}</p>
      <div className="ib-ic">{children}</div>
    </section>
  );
}

/** Panel düzeninde bölüm başlıkları. Verilmezse kart eski (tek parça) düzeniyle çizilir. */
export type PanelBasliklari = { eser: string; bilgi: string; karar: string };
