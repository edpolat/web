// Vakıf oyunu motoru. Ekrandan bağımsızdır; web (/oyun) ve mobil uygulama aynı dosyayı kullanır.
// Kurallar ve katsayılar mobil plandaki "Vakıf oyununun işleyişi" bölümüyle birebir aynıdır
// (denge düzeltmesi sonrası sürüm). Durum düz bir nesnedir: JSON'a yazılıp geri okunabilir.

export type Mulk = "hamam" | "han" | "arazi" | "nakit";
export type Amac = "asevi" | "medrese" | "cesme";
export type Mutevelli = "durust" | "becerikli";
export type Olay = "deprem" | "yangin" | "kuraklik" | "savas" | "enflasyon";
export type KotuOlay = Olay | "zimmet" | "sandik_bos";
export type Secim = "fon" | "nakit" | "kis";
export type Ders = "ayakta" | "fon" | "zimmet" | "tek_kaynak" | "gider";

export type Ayar = {
  sermaye: Record<Mulk, number>;
  amac: Amac;
  /** Gelirin yüzde kaçı önce yedek fona ayrılır (0-50, 5'er). */
  fon: number;
  mutevelli: Mutevelli;
};

export const MULKLER: Mulk[] = ["hamam", "han", "arazi", "nakit"];
export const SERMAYE_TOPLAMI = 100;
export const HEDEF_YIL = 600;
export const TUR_YILI = 10;

/** Her 10 yılda sandıktan çıkması gereken hizmet gideri. */
export const AMAC_GIDERI: Record<Amac, number> = { asevi: 26, medrese: 22, cesme: 12 };

/** 1 birimin 10 yıllık geliri ve bakımı. Nakit gelir getirmez, sandığa birim başına 0,02 katar. */
export const GELIR: Record<Exclude<Mulk, "nakit">, number> = { hamam: 0.8, han: 0.72, arazi: 0.36 };
export const BAKIM: Record<Exclude<Mulk, "nakit">, number> = { hamam: 0.2, han: 0.07, arazi: 0 };
export const NAKIT_KATKISI = 0.02;

export const MUTEVELLI_CARPANI: Record<Mutevelli, number> = { durust: 1, becerikli: 1.05 };
export const ZIMMET_IHTIMALI = 0.15;
export const ZIMMET_ORANI = 0.6;
export const ZIMMET_ESIGI = 10;

/** Bir turda olay çıkma ihtimalleri (toplam %36). */
export const OLAY_IHTIMALI: Record<Olay, number> = {
  deprem: 0.09,
  yangin: 0.09,
  kuraklik: 0.06,
  savas: 0.06,
  enflasyon: 0.06,
};
/** Olayda yıkılan pay. */
export const YIKIM: Record<"deprem" | "yangin", Partial<Record<Mulk, number>>> = {
  deprem: { hamam: 0.8, han: 0.4 },
  yangin: { han: 0.6 },
};
export const ENFLASYON = { nakit: 0.4, fon: 0.2, gider: 0.12 };
export const ONARIM_CARPANI = 1.1;
export const KISMA_TURU = 2;
export const GERI_GELME_TURU = 4;
export const COKUS_ESIGI = 3;
export const TEK_KAYNAK_ESIGI = 45;

export const VARSAYILAN_AYAR: Ayar = {
  sermaye: { hamam: 30, han: 30, arazi: 20, nakit: 20 },
  amac: "asevi",
  fon: 20,
  mutevelli: "durust",
};
// Sunum tohumu: varsayılan ayarlarla 600 yıl ayakta kalır, hamamı 70 yapan vakıf aynı tohumla 130. yılda depremde çöker.
export const VARSAYILAN_TOHUM = 186;

export type Hasar = Partial<Record<Mulk, number>>;

export type Tur = {
  yil: number;
  olay: Olay | null;
  zimmet: number;
  gelir: number;
  /** Gelirden fon payı ve bakım düşüldükten, nakit katkısı eklendikten sonra hizmete kalan. */
  kalan: number;
  ihtiyac: number;
  /** Turun sonunda (karar öncesi) fondaki para. */
  fon: number;
  /** Karar verildiyse sonrasındaki fon. */
  fonSonra?: number;
  sandikBos: boolean;
  bedel?: number;
  karar?: Secim;
};

export type BekleyenKarar = { olay: "deprem" | "yangin"; hasar: Hasar; bedel: number };

export type Sonuc = {
  ayakta: boolean;
  yil: number;
  cokenOlay?: KotuOlay;
  ders: Ders;
  iyiKarar?: { yil: number; olay: Olay; secim: Secim; bedel: number };
  olaySayisi: number;
  kararSayisi: number;
  bosSayisi: number;
};

export type Durum = {
  ayar: Ayar;
  tohum: number;
  /** Rastgele sayı üretecinin iç durumu; aynı tohum aynı oyunu verir. */
  rng: number;
  yil: number;
  mulk: Record<Mulk, number>;
  fon: number;
  giderCarpani: number;
  /** Hizmet kısıldığı için yıkılıp yavaşça geri gelen mülkler. */
  gerigelen: { mulk: Mulk; miktar: number; kalanTur: number }[];
  kismaTuru: number;
  usteUsteBos: number;
  sonKotuOlay?: KotuOlay;
  turlar: Tur[];
  bekleyen?: BekleyenKarar;
  sonuc?: Sonuc;
};

/** mulberry32: küçük, hızlı ve her ortamda aynı sonucu veren üreteç. */
function rastgele(d: Durum): number {
  d.rng = (d.rng + 0x6d2b79f5) | 0;
  let t = d.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const yuvarla = (n: number) => Math.round(n * 10) / 10;

export function sermayeToplami(ayar: Ayar): number {
  return MULKLER.reduce((t, m) => t + ayar.sermaye[m], 0);
}

export function gecerliAyar(ayar: Ayar): boolean {
  return (
    sermayeToplami(ayar) === SERMAYE_TOPLAMI &&
    MULKLER.every((m) => ayar.sermaye[m] >= 0) &&
    ayar.fon >= 0 &&
    ayar.fon <= 50
  );
}

export function kur(ayar: Ayar, tohum: number = VARSAYILAN_TOHUM): Durum {
  if (!gecerliAyar(ayar)) throw new Error("Sermaye toplamı 100 olmalı, yedek fon %0-50 arasında olmalı.");
  return {
    ayar: structuredClone(ayar),
    tohum,
    rng: tohum | 0,
    yil: 0,
    mulk: { ...ayar.sermaye },
    fon: 0,
    giderCarpani: 1,
    gerigelen: [],
    kismaTuru: 0,
    usteUsteBos: 0,
    turlar: [],
  };
}

function olaySec(r: number): Olay | null {
  let esik = 0;
  for (const olay of Object.keys(OLAY_IHTIMALI) as Olay[]) {
    esik += OLAY_IHTIMALI[olay];
    if (r < esik) return olay;
  }
  return null;
}

/** Bir tur (10 yıl) oynatır. Karar bekleniyorsa ya da oyun bittiyse durumu olduğu gibi döndürür. */
export function ilerle(onceki: Durum): Durum {
  if (onceki.sonuc || onceki.bekleyen) return onceki;
  const d = structuredClone(onceki);

  // 1. Zaman ilerler; yarıda kalan onarımların dörtte biri tamamlanır.
  d.yil += TUR_YILI;
  for (const g of d.gerigelen) {
    d.mulk[g.mulk] += g.miktar / GERI_GELME_TURU;
    g.kalanTur -= 1;
  }
  d.gerigelen = d.gerigelen.filter((g) => g.kalanTur > 0);

  // 2. Becerikli mütevelli için zimmet zarı.
  let zimmet = 0;
  if (d.ayar.mutevelli === "becerikli" && rastgele(d) < ZIMMET_IHTIMALI && d.fon > ZIMMET_ESIGI) {
    zimmet = d.fon * ZIMMET_ORANI;
    d.fon -= zimmet;
    d.sonKotuOlay = "zimmet";
  }

  // 3. Olay.
  const olay = olaySec(rastgele(d));
  if (olay) d.sonKotuOlay = olay;
  if (olay === "enflasyon") {
    d.mulk.nakit *= 1 - ENFLASYON.nakit;
    d.fon *= 1 - ENFLASYON.fon;
    d.giderCarpani *= 1 + ENFLASYON.gider;
  }

  // 4. Gelir ve yedek fon payı.
  const gelir =
    (d.mulk.hamam * GELIR.hamam +
      (olay === "savas" ? 0 : d.mulk.han * GELIR.han) +
      (olay === "kuraklik" ? 0 : d.mulk.arazi * GELIR.arazi)) *
    MUTEVELLI_CARPANI[d.ayar.mutevelli];
  const fonPayi = (gelir * d.ayar.fon) / 100;
  d.fon += fonPayi;

  // 5. Bakım, sonra hizmet.
  const bakim = d.mulk.hamam * BAKIM.hamam + d.mulk.han * BAKIM.han + d.mulk.arazi * BAKIM.arazi;
  const kalan = gelir - fonPayi - bakim + NAKIT_KATKISI * d.mulk.nakit;
  // Hizmet kısıldıysa sandıktan yarısı çıkar, ama o tur hizmet tam ödenmemiş sayılır.
  const kisildi = d.kismaTuru > 0;
  const ihtiyac = AMAC_GIDERI[d.ayar.amac] * d.giderCarpani * (kisildi ? 0.5 : 1);
  if (kisildi) d.kismaTuru -= 1;

  // 6. Açık fondan kapanır; fon da yetmezse sandık boş kalır. Fazla para birikmez.
  let sandikBos = false;
  if (kalan < ihtiyac) {
    const acik = ihtiyac - kalan;
    if (d.fon >= acik) d.fon -= acik;
    else {
      d.fon = 0;
      sandikBos = true;
    }
  }
  if (sandikBos || kisildi) {
    d.usteUsteBos += 1;
    if (!olay && !zimmet) d.sonKotuOlay ??= "sandik_bos";
  } else d.usteUsteBos = 0;

  const tur: Tur = {
    yil: d.yil,
    olay,
    zimmet: yuvarla(zimmet),
    gelir: yuvarla(gelir),
    kalan: yuvarla(kalan),
    ihtiyac: yuvarla(ihtiyac),
    fon: yuvarla(d.fon),
    sandikBos,
  };
  d.turlar.push(tur);

  if (d.usteUsteBos >= COKUS_ESIGI) {
    d.sonuc = sonucYaz(d, false);
    return d;
  }

  // Deprem ya da yangında mülk yıkıldıysa oyun durur ve oyuncuya sorar.
  if (olay === "deprem" || olay === "yangin") {
    const hasar: Hasar = {};
    let toplam = 0;
    for (const [m, oran] of Object.entries(YIKIM[olay]) as [Mulk, number][]) {
      const miktar = d.mulk[m] * oran;
      if (miktar > 0) {
        hasar[m] = miktar;
        toplam += miktar;
      }
    }
    if (toplam > 0) {
      d.bekleyen = { olay, hasar, bedel: yuvarla(toplam * ONARIM_CARPANI) };
      tur.bedel = d.bekleyen.bedel;
      return d;
    }
  }

  if (d.yil >= HEDEF_YIL) d.sonuc = sonucYaz(d, true);
  return d;
}

/** Bekleyen kararda hangi seçeneklerin açık olduğu. */
export function acikSecimler(d: Durum): Record<Secim, boolean> {
  const b = d.bekleyen;
  return {
    fon: !!b && d.fon >= b.bedel,
    nakit: !!b && d.mulk.nakit > 0,
    kis: !!b,
  };
}

export function karar(onceki: Durum, secim: Secim): Durum {
  const b = onceki.bekleyen;
  if (!b || !acikSecimler(onceki)[secim]) return onceki;
  const d = structuredClone(onceki);
  const hasar = Object.entries(b.hasar) as [Mulk, number][];

  if (secim === "fon") {
    d.fon -= b.bedel;
  } else if (secim === "nakit") {
    const harcanan = Math.min(d.mulk.nakit, b.bedel);
    const onarilan = harcanan / b.bedel;
    d.mulk.nakit -= harcanan;
    for (const [m, miktar] of hasar) d.mulk[m] -= miktar * (1 - onarilan);
  } else {
    for (const [m, miktar] of hasar) {
      d.mulk[m] -= miktar;
      d.gerigelen.push({ mulk: m, miktar, kalanTur: GERI_GELME_TURU });
    }
    d.kismaTuru = KISMA_TURU;
  }

  const tur = d.turlar[d.turlar.length - 1];
  tur.karar = secim;
  tur.fonSonra = yuvarla(d.fon);
  delete d.bekleyen;
  if (d.yil >= HEDEF_YIL) d.sonuc = sonucYaz(d, true);
  return d;
}

/** Karar anına, oyunun sonuna ya da en çok `enFazlaTur` tura kadar ilerler. */
export function karaKadar(d: Durum, enFazlaTur = HEDEF_YIL / TUR_YILI): Durum {
  let simdi = d;
  for (let i = 0; i < enFazlaTur && !simdi.sonuc && !simdi.bekleyen; i++) simdi = ilerle(simdi);
  return simdi;
}

function sonucYaz(d: Durum, ayakta: boolean): Sonuc {
  const kararlar = d.turlar.filter((t) => t.karar && t.olay);
  // İyi karar: mülkü kurtaran (fondan ya da nakitle onarılan) en büyük hasar.
  const onarilan = kararlar
    .filter((t) => t.karar !== "kis")
    .sort((a, b) => (b.bedel ?? 0) - (a.bedel ?? 0))[0];
  const kur = d.ayar.sermaye;
  let ders: Ders;
  if (ayakta) ders = "ayakta";
  else if (d.ayar.fon < 15) ders = "fon";
  else if (d.sonKotuOlay === "zimmet") ders = "zimmet";
  else if (kur.hamam >= TEK_KAYNAK_ESIGI || kur.han >= TEK_KAYNAK_ESIGI || kur.arazi >= TEK_KAYNAK_ESIGI)
    ders = "tek_kaynak";
  else ders = "gider";
  return {
    ayakta,
    yil: d.yil,
    cokenOlay: ayakta ? undefined : d.sonKotuOlay,
    ders,
    iyiKarar: onarilan
      ? { yil: onarilan.yil, olay: onarilan.olay as Olay, secim: onarilan.karar as Secim, bedel: onarilan.bedel ?? 0 }
      : undefined,
    olaySayisi: d.turlar.filter((t) => t.olay).length,
    kararSayisi: kararlar.length,
    bosSayisi: d.turlar.filter((t) => t.sandikBos).length,
  };
}

/** Mobil plandaki ölçümün oyuncusu: hasarı önce yedek fonla, fon yetmezse nakitle onarır, o da yoksa hizmeti kısar. */
export function onaranOyuncu(d: Durum): Secim {
  const acik = acikSecimler(d);
  return acik.fon ? "fon" : acik.nakit ? "nakit" : "kis";
}
export const kisanOyuncu = (): Secim => "kis";

/** Oyunu sonuna kadar verilen oyuncuyla oynatır. */
export function oynat(ayar: Ayar, tohum: number, oyuncu: (d: Durum) => Secim = onaranOyuncu): Sonuc {
  let d = kur(ayar, tohum);
  while (!d.sonuc) {
    d = karaKadar(d);
    if (d.bekleyen) d = karar(d, oyuncu(d));
  }
  return d.sonuc;
}

/** Aynı ayarla `adet` farklı tohumda ayakta kalma oranı (0-1). */
export function ayaktaKalmaOrani(ayar: Ayar, adet = 300, oyuncu?: (d: Durum) => Secim): number {
  let ayakta = 0;
  for (let tohum = 1; tohum <= adet; tohum++) if (oynat(ayar, tohum, oyuncu).ayakta) ayakta++;
  return ayakta / adet;
}
