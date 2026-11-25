# CMS Manekin BISINDO (`BISINDO-V1`)

Aplikasi web 3D berbasis **Three.js**, **Vite**, dan **MediaPipe Holistic (`@mediapipe/tasks-vision`)** untuk memvisualisasikan, menyusun, dan merekam gerakan bahasa isyarat **BISINDO** ke dalam format keyframe `.JSON`.

---

## Fitur Utama
- **Pemilih Model 3D:** Mendukung manekin **Mixamo (`public/T-Pose.fbx`)** sebagai model default yang ringan, serta **Avatar Karakter (`public/avatar.glb`)**.
- **AI Kamera (MediaPipe Holistic):** Pelacakan tubuh atas, kedua tangan/jari, dan kontur wajah secara *real-time* via webcam menggunakan `HolisticLandmarker` (akselerasi GPU dengan fallback otomatis ke CPU serta fallback `PoseLandmarker` + `HandLandmarker`), lengkap dengan toggle **Mode Cermin (Mirror)**.
- **Manual Posing & Timeline CMS:** Memilih sendi lewat klik langsung pada manekin 3D atau dropdown, memutar tulang menggunakan *gizmo* 3D (`TransformControls`), merekam urutan keyframe beserta durasinya, dan memutar ulang animasi.
- **Ekspor & Impor `.JSON`:** Menyimpan seluruh keyframe rotasi sendi (*quaternion*) menjadi file `.json` dan memuatnya kembali kapan saja.
- **Text-to-Sign (Tab Kalimat):** Merangkai kata dari kamus isyarat di `kamusIsyarat.js` menjadi animasi kalimat.

---

## Prasyarat
Pastikan perangkat sudah terpasang:
- **Git**
- **Node.js** versi `20.19+` atau `22.12+` (beserta `npm`)
- **Browser modern** (Chrome / Edge / Firefox) dengan **Webcam** dan **koneksi internet** (diperlukan saat pertama kali memuat runtime WASM dan model `.task` MediaPipe dari CDN)

---

## Cara Mulai (Dari Ambil Kode Hingga Bisa Dibuka)

1. **Clone repository dari GitHub:**
   ```bash
   git clone https://github.com/andremilano/BISINDO-V1.git
   cd BISINDO-V1
   ```

2. **Install seluruh dependensi:**
   ```bash
   npm install
   ```

3. **Jalankan server pengembangan (Vite):**
   ```bash
   npm run dev
   ```

4. **Buka di browser:**
   Buka alamat lokal yang muncul di terminal (biasanya `http://localhost:5173`).
   > **Catatan:** Akses webcam hanya diizinkan browser pada `http://localhost` atau `https://`. Jika muncul popup izin kamera, pilih **Allow / Izinkan**.

5. **Build produksi (opsional):**
   ```bash
   npm run build
   ```
   Hasil build akan tersimpan di folder `dist/`.

---

## Cara Menggunakan & Merekam Pergerakan

### 1. Pelacakan Gerakan via Webcam (Tab `AI Kamera`)
1. Pastikan **Model 3D Aktif** di panel kiri atas sudah dipilih (default: `Manekin Mixamo (T-Pose.fbx)`).
2. Buka tab **AI Kamera**.
3. Atur opsi **Mode Cermin (Mirror seperti webcam)**:
   - **Dicentang:** Gerakan manekin mencerminkan preview webcam secara langsung.
   - **Tidak dicentang:** Mengikuti sisi anatomis asli (tangan kanan pengguna menggerakkan tangan kanan manekin).
4. Klik **Mulai Pelacakan MediaPipe**, izinkan akses kamera, lalu posisikan tubuh bagian atas (bahu, siku, pergelangan, dan jari) agar terlihat jelas di kamera.
5. Klik **Hentikan Pelacakan** jika sudah selesai.

### 2. Merekam Keyframe Gerakan & Ekspor ke JSON (Tab `Manual` → Tab `File`)
1. Buka tab **Manual**.
2. Bentuk pose manekin:
   - **Klik kiri** langsung pada bagian tubuh/jari manekin di layar 3D (atau pilih tulang melalui dropdown **Pilih Sendi Aktif**).
   - Putar sumbu rotasi (*gizmo* RGB) hingga posisi lengan/jari sesuai.
   - Gunakan klik-seret di area kosong untuk memutar kamera (`OrbitControls`), dan scroll untuk zoom.
3. Isi **Durasi ke Pose Ini (detik)** (misalnya `1.0` detik).
4. Klik **Rekam Gerakan** untuk menyimpan pose sebagai keyframe. Ulangi langkah 2–4 untuk pose berikutnya hingga gerakan kosakata lengkap.
5. Klik **Putar Rekaman Timeline** untuk meninjau animasi, atau **Hapus Rekaman / Reset** untuk menghapus rekaman dan mengembalikan posisi netral.
6. Untuk menyimpan hasil rekaman, buka tab **File** → klik **Unduh Rekaman (.JSON)**. File tersebut dapat diputar kembali kapan saja lewat tombol **Muat File Rekaman (.JSON)**.

### 3. Mencoba Penerjemah Kalimat (Tab `Kalimat`)
1. Pada dropdown **Model 3D Aktif**, pilih **`Avatar Karakter (avatar.glb)`** *(catatan: sudut gerakan pada kamus kata bawaan `kamusIsyarat.js` saat ini dikalibrasi untuk A-Pose `avatar.glb`)*.
2. Ketik kata/kalimat di kolom input atau klik chip kata cepat yang tersedia.
3. Klik **Terjemahkan & Mainkan**.

---

## Struktur Proyek

```text
├── index.html          # Tampilan UI panel kontrol, import map, dan kanvas 3D
├── main.js             # Setup Three.js, loader FBX/GLB, MediaPipe Holistic, retargeting & CMS timeline
├── kamusIsyarat.js     # Kamus kosakata BISINDO statis & sequencer kalimat
├── public/
│   ├── T-Pose.fbx      # Manekin standar Mixamo (65 tulang, default)
│   └── avatar.glb      # Avatar karakter Character Creator
├── package.json        # Daftar dependensi (three, @mediapipe/tasks-vision, vite)
└── UPDATE_PEKERJAAN.md # Ringkasan progres teknis proyek
```
