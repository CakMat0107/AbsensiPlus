# AbsensiPlus

MVP aplikasi absensi sekolah berbasis Streamlit.

## Fitur

- Role admin, kepala sekolah, wali kelas, dan guru.
- Kepala sekolah dan wali kelas dapat mengaktifkan **Mode guru**.
- Absensi guru masuk dan pulang.
- Pengajuan cuti dan tugas luar/absensi di luar sekolah.
- Penugasan guru pengganti ketika guru terjadwal berhalangan.
- Absensi murid per kelas dan per pelajaran.
- Dashboard ringkasan dan master data sekolah.

## Menjalankan

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

Data demo tersimpan di `absensiplus.db` (SQLite lokal). Saat pertama dijalankan tersedia akun demo untuk setiap role; pemilihannya tersedia di sidebar.

## Arsitektur produksi

Folder `supabase/migrations/` berisi skema PostgreSQL, RLS, dan tabel Realtime untuk backend produksi.
Folder `admin-web/` berisi panel admin React + TypeScript + Vite. Salin `.env.example` menjadi `.env`, isi URL dan anon key Supabase, lalu jalankan:

```bash
cd admin-web
npm install
npm run dev
```

Untuk Android, lihat `ANDROID_SETUP.md`. Aplikasi Android memakai project Kotlin + Jetpack Compose dan Supabase yang sama.
## Setup Supabase

Jalankan migration secara berurutan di Supabase SQL Editor:
`supabase/migrations/20260915000000_initial_schema.sql`, lalu
`supabase/migrations/20260915000001_auth_profile_trigger.sql`, lalu
`supabase/migrations/20260915000002_backfill_existing_profiles.sql`. Migration
kedua membuat sekolah demo dan trigger profil otomatis untuk user Auth baru;
migration ketiga membuat profil untuk user yang sudah dibuat sebelumnya.
Terakhir jalankan `supabase/migrations/20260915000003_fix_rls_profile_recursion.sql`
untuk memperbaiki policy RLS agar tidak rekursif.
