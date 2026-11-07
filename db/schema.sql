-- Platform Web Interaktif Informasi dan Pemetaan Potensi Desa Bendungan
-- Skema PostgreSQL mengikuti ERD pada proposal (Tabel 1): 4 entitas, nama kolom sama.
-- Penambahan (bukan dari proposal, untuk integritas data): constraint UNIQUE, CHECK, FK, dan index.

CREATE TABLE IF NOT EXISTS admin (
  id_admin    SERIAL PRIMARY KEY,
  nama        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL,
  password    VARCHAR(255) NOT NULL,          -- berisi HASH (scrypt), bukan kata sandi asli
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS kategori_potensi (
  id_kategori    SERIAL PRIMARY KEY,
  nama_kategori  VARCHAR(80) NOT NULL,
  deskripsi      TEXT,
  icon           VARCHAR(100),
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT kategori_nama_unique UNIQUE (nama_kategori)
);

CREATE TABLE IF NOT EXISTS potensi_desa (
  id_potensi    SERIAL PRIMARY KEY,
  id_kategori   INTEGER NOT NULL,
  id_admin      INTEGER,                      -- NULL untuk data contoh atau data yang diimpor
  nama_potensi  VARCHAR(150) NOT NULL,
  deskripsi     TEXT,
  alamat        VARCHAR(255),
  latitude      NUMERIC(9,6),                 -- boleh NULL: koordinat aktual belum tersedia (proposal Bab 3.2.5)
  longitude     NUMERIC(9,6),
  kontak        VARCHAR(30),
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft' (belum tampil publik) atau 'terbit'
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_potensi_kategori FOREIGN KEY (id_kategori) REFERENCES kategori_potensi (id_kategori) ON DELETE RESTRICT,
  CONSTRAINT fk_potensi_admin    FOREIGN KEY (id_admin)    REFERENCES admin (id_admin) ON DELETE SET NULL,
  CONSTRAINT potensi_status_check CHECK (status IN ('draft', 'terbit')),
  CONSTRAINT potensi_lat_check    CHECK (latitude  IS NULL OR latitude  BETWEEN -90 AND 90),
  CONSTRAINT potensi_lng_check    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT potensi_koordinat_pasangan CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE TABLE IF NOT EXISTS foto_potensi (
  id_foto     SERIAL PRIMARY KEY,
  id_potensi  INTEGER NOT NULL,
  url_foto    VARCHAR(255) NOT NULL,
  caption     VARCHAR(200),
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_foto_potensi FOREIGN KEY (id_potensi) REFERENCES potensi_desa (id_potensi) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_potensi_status_kategori ON potensi_desa (status, id_kategori);
CREATE INDEX IF NOT EXISTS idx_potensi_updated ON potensi_desa (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_foto_potensi ON foto_potensi (id_potensi);
