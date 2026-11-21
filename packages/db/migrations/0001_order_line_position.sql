-- Urutan baris layanan di nota harus sama dengan urutan saat kasir memasukkannya.
-- Semua baris dibuat dalam satu transaksi (created_at sama), jadi butuh kolom urutan sendiri.
alter table order_lines add column position smallint not null default 0;
create index order_lines_order_position on order_lines (order_id, position);
