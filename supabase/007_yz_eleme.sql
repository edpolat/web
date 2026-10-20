-- Aşama 6B: öneri kuyruğunda YZ ön eleme. 006_yz.sql'den sonra çalıştırılır; tekrar çalıştırmak zarar vermez.
-- YZ etiketleri yz_analizleri'nde (tur = 'eleme') durur. Editör etiketi yanlış bulursa düzeltir; düzeltme burada saklanır
-- (YZ'nin ne kadar doğru çalıştığını ölçmek için) ve ekranda YZ'nin etiketinin yerine geçer. Hiçbir öneri silinmez ya da gizlenmez.

create table if not exists public.yz_etiket_duzeltmeleri (
  id bigint generated always as identity primary key,
  oneri_id bigint not null references public.bilgi_onerileri (id),
  analiz_id bigint references public.yz_analizleri (id),
  yz_etiketler jsonb,
  yz_oncelik text,
  etiketler jsonb not null,
  oncelik text not null check (oncelik in ('yuksek', 'normal', 'dusuk')),
  kim uuid references auth.users (id),
  kim_ad text,
  ne_zaman timestamptz not null default now()
);
create index if not exists yz_etiket_duzeltmeleri_oneri on public.yz_etiket_duzeltmeleri (oneri_id, ne_zaman desc);

alter table public.yz_etiket_duzeltmeleri enable row level security;
drop policy if exists "panel etiket duzeltmelerini okur" on public.yz_etiket_duzeltmeleri;
create policy "panel etiket duzeltmelerini okur" on public.yz_etiket_duzeltmeleri for select to authenticated
  using (exists (select 1 from public.kullanici_rolleri where kullanici = auth.uid()));

-- Editör etiketi düzeltir (eser.onayla). YZ'nin o anki etiketi yanına yazılır; denetim kaydına da girer.
create or replace function public.yz_etiket_duzelt(p_oneri bigint, p_analiz bigint, p_etiketler jsonb, p_oncelik text)
returns bigint language plpgsql security definer set search_path = public as $$
declare a yz_analizleri; o bilgi_onerileri; yeni_id bigint;
begin
  if not izin_var('eser.onayla') then raise exception 'yetki yok' using errcode = '42501'; end if;
  if jsonb_typeof(p_etiketler) <> 'array' or exists (
    select 1 from jsonb_array_elements_text(p_etiketler) e
    where e not in ('spam', 'anlamsiz', 'kaynaksiz', 'kaynak_alakasiz', 'mevcut_bilgiyle_ayni', 'mevcut_bilgiyle_celisiyor', 'degerli')
  ) then raise exception 'gecersiz etiket'; end if;
  select * into o from bilgi_onerileri where id = p_oneri;
  if o.id is null then raise exception 'oneri bulunamadi'; end if;
  if p_analiz is not null then
    select * into a from yz_analizleri where id = p_analiz and tur = 'eleme' and hedef_tur = 'oneri' and hedef_id = p_oneri;
  end if;
  insert into yz_etiket_duzeltmeleri (oneri_id, analiz_id, yz_etiketler, yz_oncelik, etiketler, oncelik, kim, kim_ad)
  values (p_oneri, a.id, a.sonuc->'etiketler', a.sonuc->>'oncelik', p_etiketler, p_oncelik, auth.uid(), benim_adim())
  returning id into yeni_id;
  insert into denetim_kaydi (kim, kim_ad, islem, hedef, alan, eski, yeni, gerekce)
  values (auth.uid(), benim_adim(), 'yz_etiket_duzelt', o.eser_id, 'oneri #' || p_oneri,
          jsonb_build_object('etiketler', a.sonuc->'etiketler', 'oncelik', a.sonuc->>'oncelik'),
          jsonb_build_object('etiketler', p_etiketler, 'oncelik', p_oncelik), 'YZ etiketi elle düzeltildi');
  return yeni_id;
end $$;

revoke execute on function public.yz_etiket_duzelt(bigint, bigint, jsonb, text) from public, anon;
grant execute on function public.yz_etiket_duzelt(bigint, bigint, jsonb, text) to authenticated;
grant select on public.yz_etiket_duzeltmeleri to authenticated, service_role;
