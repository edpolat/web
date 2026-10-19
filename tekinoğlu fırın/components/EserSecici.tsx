"use client";
import Link from "next/link";
import { useState } from "react";
import { sadelestir } from "@/lib/filtre";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

type Props = { dil: Dil; eserler: { id: string; ad: string; alt: string }[] };

/** Yönetim panelinde düzenlenecek eseri adıyla bulma listesi. */
export default function EserSecici({ dil, eserler }: Props) {
  const t = s(dil);
  const [ara, setAra] = useState("");
  const q = sadelestir(ara.trim());
  const liste = eserler.filter((e) => !q || sadelestir(`${e.ad} ${e.alt}`).includes(q));
  return (
    <div className="form">
      <label>
        {t.eserAra}
        <input type="search" value={ara} onChange={(e) => setAra(e.target.value)} />
      </label>
      <ul className="yonetim-liste">
        {liste.map((e) => (
          <li key={e.id}>
            <Link href={`/${dil}/yonetim/eser/${e.id}`}>{e.ad}</Link> <small className="not">{e.alt}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
