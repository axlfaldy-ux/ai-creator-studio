# AI Creator Studio

Kerangka mobile-first untuk merancang visual dan video. Repository GitHub proyek ini bernama `ai-creator-studio`. Aplikasi saat ini memiliki unggah referensi lokal, alur generate/edit gambar melalui backend OpenAI (aktif setelah API key disetel), navigasi halaman hasil dan koleksi, service worker PWA, serta endpoint health. Generasi video belum terhubung.

## Struktur

- `src/` — antarmuka React + TypeScript dan stylesheet responsif.
- `public/` — manifest, ikon, dan service worker PWA.
- `server/` — backend Node.js/Express, health check, dan adapter OpenAI Image API.
- `server/providers/` — batas integrasi provider video; tidak mengasumsikan API Google Flow.
- `test/` — tes backend dengan provider tiruan, tanpa request AI eksternal.
- `vite.config.ts` — server frontend development dan proxy `/api` ke backend lokal.

## Menjalankan di Termux

Pastikan Node.js dan npm tersedia. Dari direktori proyek:

```sh
npm ci
npm run dev
```

Buka `http://127.0.0.1:5173` pada browser perangkat yang sama. Vite meneruskan endpoint `/api` ke backend lokal pada port `3001`; health endpoint tersedia di `http://127.0.0.1:3001/api/health`.

Jalankan tes backend tanpa memanggil layanan AI:

```sh
npm test
```

Untuk membuat dan melihat bundel produksi lokal:

```sh
npm run build
npm run preview
```

Preview Vite berjalan pada port `4173`. Server Express dapat menyajikan bundel `dist/` setelah build. Untuk pengalaman offline, buka versi produksi setidaknya sekali agar service worker menyimpan app shell dan aset.

## API gambar dan konfigurasi

Frontend mengirim prompt serta referensi ke `POST /api/images/generate`. Backend memakai OpenAI Image API untuk membuat gambar dari prompt atau mengedit referensi. API key dibaca hanya di backend dari `OPENAI_API_KEY`; jangan menaruhnya di browser atau variabel `VITE_*`. Model dapat diatur melalui `OPENAI_IMAGE_MODEL` (default `gpt-image-2.5-flare`).

Untuk Termux, salin `.env.example` menjadi `.env`, isi key pada berkas lokal yang diabaikan Git, lalu jalankan:

```sh
set -a
. ./.env
set +a
npm run dev
```

Jangan commit `.env`. Panggilan OpenAI dapat menggunakan kredit dan menimbulkan biaya API. Tanpa key, health check tetap berjalan, sedangkan endpoint generate memberi status bahwa provider belum dikonfigurasi.

Sebelum deployment, gunakan build command `npm ci && npm run build` dan start command `npm run start:server`. Pada production, Express menyajikan frontend dan API dari origin yang sama serta mendengarkan pada `0.0.0.0:$PORT`. `/api/health` dapat digunakan sebagai health check hosting.

**Jangan membuka endpoint generate dengan API key aktif ke publik sebelum autentikasi pengguna dan batas belanja provider ditetapkan.** Pembatasan per IP yang tersedia saat ini hanya perlindungan awal, bukan pengganti autentikasi.

## PWA Android dan iPhone

Manifest dan service worker tersedia. Host versi produksi melalui HTTPS. Pada iPhone, buka URL di Safari lalu pilih **Share → Add to Home Screen**. Di Android, gunakan menu pemasangan aplikasi pada browser yang mendukung PWA. Mode `localhost` Termux hanya untuk pengembangan; URL HTTP lokal bukan deployment HTTPS untuk perangkat lain.

## Google Flow dan video

UI video tetap informatif dan tidak mengirim permintaan palsu. Belum ada endpoint atau kontrak API Flow yang dipasang. Batas integrasi disiapkan di backend; adapter dapat ditambahkan setelah Google menyediakan API resmi untuk alur yang dimaksud. API video Google lain tidak otomatis berarti integrasi Google Flow.

## Keamanan dan pengembangan lanjutan

`.gitignore` mengecualikan `node_modules/`, `dist/`, berkas `.env`, kredensial package manager, private key, dan berkas umum token/credential/password. `.env.example` berisi nama variabel dan placeholder kosong saja. Jangan menaruh rahasia di kode frontend atau berkas yang di-commit. Tombol UI hanya boleh mengklaim hasil setelah backend mengembalikan hasil nyata.
