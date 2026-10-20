"use client";
import Link from "next/link";
import { useState } from "react";
import { metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import type { CokDilli, Dil, Rota } from "@/lib/tipler";

type Durak = Rota["duraklar"][number];

/** Mobil uygulamadaki damga: iki halka arasında üstte eser, altta il · yıl yazısı, ortada yıldız. */
function Damga({ durak, il }: { durak: Durak; il: string }) {
  const u = `u-${il}-${durak.eser_id}`;
  const a = `a-${il}-${durak.eser_id}`;
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <circle cx="60" cy="60" r="56" strokeWidth="3" />
        <circle cx="60" cy="60" r="50" strokeWidth="1" />
        <circle cx="60" cy="60" r="30" strokeWidth="1.5" />
      </g>
      <path id={u} d="M18 60a42 42 0 0 1 84 0" fill="none" />
      <path id={a} d="M14 60a46 46 0 0 0 92 0" fill="none" />
      <text fontSize="10.5" fontWeight="700" fill="currentColor" letterSpacing="1">
        <textPath href={`#${u}`} startOffset="50%" textAnchor="middle">
          {durak.damga_ust}
        </textPath>
      </text>
      <text fontSize="9" fontWeight="700" fill="currentColor" letterSpacing="1">
        <textPath href={`#${a}`} startOffset="50%" textAnchor="middle">
          {durak.damga_alt}
        </textPath>
      </text>
      <path d="M60 46l4 10 11 .5-8.5 7 3 10.5-9.5-6-9.5 6 3-10.5-8.5-7 11-.5z" fill="currentColor" />
    </svg>
  );
}

/** Pasaport: il rotası seçici, damga ızgarası ve rozetler (mobil uygulamanın pasaport sekmesiyle aynı görünüm). */
export default function Pasaport({
  dil,
  pullar,
  rotalar,
  iller,
  adlar,
}: {
  dil: Dil;
  pullar: string[];
  rotalar: Rota[];
  iller: { id: string; ad: CokDilli }[];
  adlar: Map<string, CokDilli>;
}) {
  const u = s(dil).uyelik;
  const alinan = (r: Rota) => r.duraklar.filter((d) => pullar.includes(d.eser_id)).length;
  // Açılışta en çok pul alınan rota seçili gelir.
  const [secili, setSecili] = useState(() => [...rotalar].sort((x, y) => alinan(y) - alinan(x))[0]?.il);
  const rota = rotalar.find((r) => r.il === secili);
  const ilAdi = (il: string) => metin(iller.find((i) => i.id === il)?.ad, dil) || il;
  const eserAdi = (id: string) => metin(adlar.get(id), dil) || id;
  const rotadaki = new Set(rotalar.flatMap((r) => r.duraklar.map((d) => d.eser_id)));
  const digerleri = pullar.filter((id) => !rotadaki.has(id));

  if (!rota) return null;
  const sayi = alinan(rota);
  const toplam = rota.duraklar.length;
  const rotaAdi = u.rota(ilAdi(rota.il));
  const rozetler = [
    { simge: "🧭", gereken: 1, ...u.rozetIlk },
    { simge: "🌙", gereken: Math.ceil(toplam / 2), ...u.rozetYari(Math.ceil(toplam / 2)) },
    { simge: "🏛️", gereken: toplam, ...u.rozetTamam(rotaAdi, toplam) },
  ];

  return (
    <>
      <p className="not">{u.pulSayisi(pullar.length)}</p>
      <div className="rota-secici" role="group" aria-label={u.pullar}>
        {rotalar.map((r) => (
          <button key={r.il} type="button" aria-pressed={r.il === secili} onClick={() => setSecili(r.il)}>
            {ilAdi(r.il)}
          </button>
        ))}
      </div>

      <div className="pasaport-kart">
        <div className="pul-sayac">
          <span className="kart-baslik">{rotaAdi.toLocaleUpperCase(dil === "tr" ? "tr" : "en")}</span>
          <b>
            {sayi} / {toplam}
          </b>
        </div>
        <div className="pasaport-ilerleme" aria-hidden="true">
          <i style={{ width: `${(sayi / toplam) * 100}%` }} />
        </div>
        <ul className="pullar-izgara">
          {rota.duraklar.map((d) => (
            <li key={d.eser_id}>
              <Link
                href={`/${dil}/eser/${d.eser_id}`}
                className={pullar.includes(d.eser_id) ? "pul alindi" : "pul"}
                title={eserAdi(d.eser_id)}
                aria-label={pullar.includes(d.eser_id) ? u.pulAlindi(eserAdi(d.eser_id)) : eserAdi(d.eser_id)}
              >
                {pullar.includes(d.eser_id) ? <Damga durak={d} il={rota.il} /> : eserAdi(d.eser_id)}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="pasaport-kart">
        <span className="kart-baslik">{u.rozetler}</span>
        <ul className="rozetler">
          {rozetler.map((r) => (
            <li key={r.simge} className={sayi >= r.gereken ? "rozet-satir kazanildi" : "rozet-satir"}>
              <span className="rozet-simge" aria-hidden="true">
                {r.simge}
              </span>
              <span>
                <b>{r.ad}</b>
                <small>{r.aciklama}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {digerleri.length > 0 && (
        <div className="pasaport-kart">
          <span className="kart-baslik">{u.digerPullar}</span>
          <ul className="pul-listesi">
            {digerleri.map((id) => (
              <li key={id}>
                <Link href={`/${dil}/eser/${id}`}>{eserAdi(id)}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
