-- laundry-kasir: skema database inti kasir (migrasi pertama)
-- Postgres 15+. Semua waktu timestamptz (UTC). Uang dalam rupiah utuh (bigint), mata uang di businesses.currency.
-- Hak akses: dicek di lapisan data (setiap query difilter business_id dari sesi). Klien tidak pernah terhubung langsung ke database.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- =====================================================================
-- 0. Better Auth (dibuat oleh CLI Better Auth + plugin username).
--    Ditampilkan di sini agar file ini bisa dijalankan utuh untuk uji coba.
--    Di proyek, buat ulang dengan CLI-nya, jangan diedit manual.
-- =====================================================================
create table "user" (
  id text primary key,
  name text not null,
  email text not null unique,          -- staf tanpa email: <uuid>@staff.invalid
  "emailVerified" boolean not null default false,
  image text,
  username text unique,                -- staf: <kode_usaha>_<nama>
  "displayUsername" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create table session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user"(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index on session ("userId");
create table account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index on account ("userId");
create table verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- =====================================================================
-- 1. Usaha, outlet, staf
-- =====================================================================
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  code text not null unique check (code ~ '^[a-z0-9]{3,12}$'),   -- kode usaha untuk login staf
  owner_user_id text not null references "user"(id) on delete restrict,
  currency char(3) not null default 'IDR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on businesses (owner_user_id);

create table outlets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  code text not null check (code ~ '^[A-Z0-9]{2,6}$'),           -- awalan nomor nota
  address text,
  phone_wa text,
  timezone text not null default 'Asia/Jakarta'
    check (timezone in ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura')),
  lat double precision,
  lng double precision,
  attendance_radius_m integer check (attendance_radius_m between 10 and 5000),
  nota_header text,
  nota_footer text,
  wa_template text,
  qris_image_path text,                                            -- QRIS statis milik outlet (storage)
  pay_later_needs_approval boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code),
  unique (id, business_id)
);
create index on outlets (business_id);

create table staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  outlet_id uuid,                                                  -- null = semua outlet (owner / supervisor)
  user_id text not null unique references "user"(id) on delete cascade,
  name text not null,
  phone text,
  role text not null check (role in ('owner','supervisor','kasir','produksi','kurir')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (outlet_id, business_id) references outlets(id, business_id) on delete restrict,
  check (role in ('owner','supervisor') or outlet_id is not null),
  unique (id, business_id)
);
create index on staff (business_id);
create index on staff (outlet_id);

-- =====================================================================
-- 2. Pelanggan, layanan
-- =====================================================================
create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone_wa text check (phone_wa ~ '^62[0-9]{8,13}$'),              -- disimpan format 62xxx
  address text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create index on customers (business_id);
create unique index customers_phone_per_business on customers (business_id, phone_wa) where phone_wa is not null;
create index customers_name_trgm on customers using gin (name gin_trgm_ops);

create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  outlet_id uuid not null,
  name text not null,
  pricing_unit text not null check (pricing_unit in ('kg','pcs')),
  price bigint not null check (price >= 0),                         -- rupiah per unit
  duration_hours integer not null check (duration_hours > 0),      -- kilat 3, reguler 72
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (outlet_id, business_id) references outlets(id, business_id) on delete cascade
);
create index on services (business_id);
create index on services (outlet_id, active, sort_order);

create table item_types (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table promos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  outlet_id uuid,                                                  -- null = semua outlet
  name text not null,
  kind text not null check (kind in ('persen','nominal')),
  value bigint not null check (value > 0),
  service_id uuid references services(id) on delete cascade,      -- null = semua layanan
  active_from timestamptz,
  active_to timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'persen' or value <= 100),
  check (active_to is null or active_from is null or active_to > active_from),
  foreign key (outlet_id, business_id) references outlets(id, business_id) on delete cascade
);
create index on promos (business_id);
create index on promos (outlet_id);
create index on promos (service_id);

-- =====================================================================
-- 3. Order (nota)
-- =====================================================================
create table nota_counters (                                       -- nomor nota per outlet per hari, tanpa bentrok
  outlet_id uuid not null references outlets(id) on delete cascade,
  day date not null,
  last_seq integer not null default 0,
  primary key (outlet_id, day)
);

create table orders (
  id uuid primary key default gen_random_uuid(),                   -- boleh dibuat di aplikasi kasir (idempotency)
  business_id uuid not null references businesses(id) on delete cascade,
  outlet_id uuid not null,
  nota_number text not null,                                       -- contoh: MLG1-261121-007
  customer_id uuid not null,
  cashier_staff_id uuid not null,
  promo_id uuid references promos(id) on delete set null,
  status text not null default 'baru'
    check (status in ('baru','diproses','selesai','diambil','batal')),
  received_at timestamptz not null default now(),
  due_at timestamptz,
  finished_at timestamptz,
  taken_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  total bigint not null,
  paid_total bigint not null default 0,
  payment_status text not null default 'belum_bayar'
    check (payment_status in ('belum_bayar','sebagian','lunas')),
  tracking_token text not null unique
    default encode(gen_random_bytes(16), 'hex'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outlet_id, nota_number),
  check (total = subtotal - discount and total >= 0),
  check (paid_total between 0 and total),
  check (payment_status = case
           when paid_total = 0 and total > 0 then 'belum_bayar'
           when paid_total < total then 'sebagian'
           else 'lunas' end),
  check ((status = 'diambil') = (taken_at is not null)),
  check ((status = 'batal') = (cancelled_at is not null)),
  foreign key (outlet_id, business_id) references outlets(id, business_id) on delete restrict,
  foreign key (customer_id, business_id) references customers(id, business_id) on delete restrict,
  foreign key (cashier_staff_id, business_id) references staff(id, business_id) on delete restrict
);
create index on orders (business_id, received_at desc);
create index on orders (outlet_id, status, received_at desc);
create index on orders (customer_id, received_at desc);
create index on orders (cashier_staff_id);
create index on orders (promo_id);
create index orders_unpaid on orders (outlet_id, received_at) where payment_status <> 'lunas' and status <> 'batal';

create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  service_name text not null,                                      -- salinan saat transaksi
  unit text not null check (unit in ('kg','pcs')),
  unit_price bigint not null check (unit_price >= 0),
  qty numeric(8,2) not null check (qty > 0),
  line_total bigint not null check (line_total >= 0),              -- round(qty * unit_price), dihitung di server
  item_counts jsonb not null default '{}',                         -- { "<item_type_id>": jumlah_pcs }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (unit <> 'pcs' or qty = trunc(qty))
);
create index on order_lines (order_id);
create index on order_lines (service_id);

create table status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  staff_id uuid references staff(id) on delete set null,
  note text,
  at timestamptz not null default now()
);
create index on status_events (order_id, at);
create index on status_events (staff_id);

create table pay_later_approvals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  requested_by uuid not null references staff(id) on delete restrict,
  decided_by uuid references staff(id) on delete restrict,
  status text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak')),
  note text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'menunggu') = (decided_at is null))
);
create unique index one_open_request_per_order on pay_later_approvals (order_id) where status = 'menunggu';
create index on pay_later_approvals (requested_by);
create index on pay_later_approvals (decided_by);

-- =====================================================================
-- 4. Pembayaran dan deposit
-- =====================================================================
create table payments (
  id uuid primary key default gen_random_uuid(),                   -- boleh dibuat di aplikasi kasir (idempotency)
  business_id uuid not null references businesses(id) on delete cascade,
  outlet_id uuid not null,
  order_id uuid references orders(id) on delete restrict,          -- null untuk top up deposit
  customer_id uuid not null,
  kind text not null check (kind in ('order','pelunasan','topup','refund')),
  method text not null check (method in ('tunai','qris','debit','deposit','ewallet')),
  amount bigint not null check (amount > 0),
  cash_received bigint check (cash_received is null or cash_received >= amount),   -- untuk hitung kembalian
  external_ref text unique,                                        -- id transaksi gateway (QRIS dinamis)
  staff_id uuid references staff(id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'topup') = (order_id is null)),
  check (kind <> 'topup' or method <> 'deposit'),
  foreign key (outlet_id, business_id) references outlets(id, business_id) on delete restrict,
  foreign key (customer_id, business_id) references customers(id, business_id) on delete restrict
);
create index on payments (business_id, paid_at desc);
create index on payments (outlet_id, paid_at desc);
create index on payments (order_id);
create index on payments (customer_id);
create index on payments (staff_id);

create table deposit_ledger (                                      -- saldo deposit = sum(amount)
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null,
  amount bigint not null check (amount <> 0),                      -- + top up, - dipakai bayar
  reason text not null check (reason in ('topup','bayar','refund','koreksi')),
  payment_id uuid references payments(id) on delete restrict,
  staff_id uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (customer_id, business_id) references customers(id, business_id) on delete restrict
);
create index on deposit_ledger (customer_id, created_at);
create index on deposit_ledger (business_id);
create index on deposit_ledger (payment_id);
create index on deposit_ledger (staff_id);

-- =====================================================================
-- 5. Kas, absensi, pesan
-- =====================================================================
create table expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  outlet_id uuid not null,
  category text not null check (category in ('bahan','gas','listrik_air','gaji','sewa','perawatan','lainnya')),
  amount bigint not null check (amount > 0),
  note text,
  spent_on date not null,                                          -- tanggal menurut zona waktu outlet
  staff_id uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (outlet_id, business_id) references outlets(id, business_id) on delete restrict
);
create index on expenses (outlet_id, spent_on desc);
create index on expenses (business_id, spent_on desc);
create index on expenses (staff_id);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  lat double precision,
  lng double precision,
  distance_m integer,
  within_radius boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out_at is null or check_out_at > check_in_at)
);
create index on attendance (staff_id, check_in_at desc);
create index on attendance (outlet_id, check_in_at desc);
create index on attendance (business_id);

create table message_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  channel text not null check (channel in ('wa_manual','wa_api','sms')),
  template text not null,                                          -- nota, siap_diambil, pengingat_tagihan
  to_phone text not null,
  status text not null default 'dibuat' check (status in ('dibuat','terkirim','gagal')),
  provider_message_id text unique,
  staff_id uuid references staff(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on message_logs (order_id);
create index on message_logs (business_id, created_at desc);
create index on message_logs (staff_id);
