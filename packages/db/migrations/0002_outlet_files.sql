-- File kecil milik outlet (saat ini: gambar QRIS statis). Disimpan di database agar tidak butuh layanan
-- penyimpanan terpisah; dibatasi 512 KB per file.
create table outlet_files (
  outlet_id uuid not null references outlets(id) on delete cascade,
  kind text not null check (kind in ('qris')),
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  data bytea not null check (octet_length(data) between 1 and 524288),
  updated_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (outlet_id, kind)
);
create index on outlet_files (updated_by);
