import { notFound } from "next/navigation";

// Tanınmayan her adres (ör. /tr/yanlis-sayfa) sitenin kendi "bulunamadı" sayfasını menüyle birlikte gösterir.
export default function Bilinmeyen() {
  notFound();
}
