# Bahan Update Pekerjaan — CMS Manekin BISINDO

Dokumen ini berisi poin-poin yang bisa disampaikan untuk update pekerjaan besok, disusun dari ringkasan cepat sampai rencana langkah berikutnya.

---

## 1. Ringkasan Singkat (Versi 30 Detik)
> *"Untuk sistem perekam gerakan kosakata BISINDO, saya sudah menyesuaikan pelacakan kamera ke **MediaPipe Holistic (`@mediapipe/tasks-vision`)**, memperbaiki logika retargeting lengan dan jari supaya gerakannya mengikuti tangan dengan natural, serta menambahkan dukungan model manekin **Mixamo (`T-Pose.fbx`)** yang jauh lebih ringan dan rapi rig-nya dibanding model sebelumnya."*

---

## 2. Poin Progres yang Sudah Dikerjakan

### A. Integrasi MediaPipe Terbaru (`google-ai-edge/mediapipe`)
- Mengganti pelacakan terpisah (`PoseLandmarker` + `HandLandmarker`) menjadi pipeline terpadu **`HolisticLandmarker`** (`@mediapipe/tasks-vision`) untuk melacak tubuh atas, tangan kiri, tangan kanan, dan wajah secara bersamaan.
- Menambahkan **akselerasi GPU dengan fallback otomatis ke CPU**, serta fallback ke `PoseLandmarker` + `HandLandmarker` apabila perangkat/browser tidak mendukung `HolisticLandmarker`.
- Menggunakan **`DrawingUtils`** resmi dari MediaPipe untuk menggambar landmark tubuh, tangan, dan kontur wajah pada preview webcam.

### B. Perbaikan Kualitas Gerakan Avatar (Retargeting 3D)
- **Memperbaiki arah tekukan jari & jempol:** Sebelumnya seluruh jari berputar di sumbu yang salah dan sempat mengenai node `_scaleCompensation`, sehingga jari terlihat bengkok ke samping. Sekarang pangkal jari & jempol diselaraskan secara 3D di ruang telapak, sedangkan ruas tengah dan ujung menekuk tepat ke arah dalam telapak.
- **Mengurangi pelintiran lengan & pergelangan:** Penyelarasan lengan atas kini mengikuti bidang tekuk siku anatomis (`upperarm` + `forearm`), membatasi lonjakan bahu/leher/tulang belakang, dan membagi puntiran pergelangan ke tulang `ForearmTwist` pada rig yang memilikinya.
- **Menghilangkan bias pose awal:** Pose netral tidak lagi terkunci ke posisi acak saat kamera baru dinyalakan.
- **Menambahkan Mode Cermin (Mirror):** Agar gerakan model terasa natural saat pengguna berkaca di preview webcam (bisa dinyalakan/dimatikan sesuai kebutuhan perekaman anatomis).

### C. Evaluasi & Migrasi ke Model Manekin Mixamo (`T-Pose.fbx`)
- Melakukan evaluasi teknis terhadap model lama (`avatar.glb`): berukuran **14,39 MB** dengan rig Character Creator yang cukup kompleks (**225 node**, termasuk **80 node `_scaleCompensation`** asimetris dan **40 tulang `twist`**, serta **0 blendshape wajah**).
- Menambahkan model manekin Mixamo **`T-Pose.fbx`** yang jauh lebih bersih dan ringan (**1,66 MB**, **65 tulang standar**, **5 jari lengkap**, tanpa `_scaleCompensation`).
- Menambahkan dukungan **`FBXLoader`**, normalisasi skala otomatis, penanganan duplikat tulang `Beta_Joints`, serta dropdown **Pemilih Model 3D** di UI sehingga tetap bisa beralih antara `T-Pose.fbx` dan `avatar.glb`.

### D. Pemeriksaan Build
- Sudah diverifikasi dengan pengecekan sintaks (`node --check main.js`) dan build produksi (`npm run build` / Vite) — berjalan sukses tanpa error.

---

## 3. Cara Demo Singkat Saat Meeting
1. Jalankan `npm run dev` lalu buka di browser.
2. Tunjukkan dropdown **Model 3D Aktif** di panel kiri atas (default sudah ke `Manekin Mixamo (T-Pose.fbx)`).
3. Buka tab **AI Kamera** → klik **Mulai Pelacakan MediaPipe**:
   - Gerakkan tangan, buka-tutup jari, kepalan, dan tekuk siku untuk menunjukkan gerakan model sudah mengikuti tangan dengan halus.
   - Tunjukkan toggle **Mode Cermin (Mirror)** bila perlu membandingkan mode cermin dan mode anatomis.
4. *(Opsional)* Jika ingin mendemokan tab **Kalimat** (`halo terima kasih`), pilih `Avatar Karakter (avatar.glb)` di dropdown model karena kamus kata awal disetel untuk model tersebut.

---

## 4. Catatan / Keterbatasan Saat Ini (Transparan ke Tim)
- **Rekam otomatis dari webcam belum tersambung ke timeline:** Saat ini tombol **Rekam Gerakan** masih menangkap pose secara manual di tab **Manual**; hasil pelacakan di tab **AI Kamera** baru tampil *real-time* dan belum otomatis direkam menjadi keyframe kosakata.
- **Kamus kata bawaan (`kamusIsyarat.js`) masih memakai sudut A-Pose (`avatar.glb`):** Untuk model baru `T-Pose.fbx`, kosakata perlu direkam ulang sesuai T-Pose.
- **Koneksi internet untuk MediaPipe:** File WASM dan model `.task` MediaPipe masih dimuat dari CDN saat pertama kali dipakai.
- **Ekspresi wajah:** Kedua model saat ini (`T-Pose.fbx` maupun `avatar.glb`) belum memiliki *morph targets/blendshapes* wajah.

---

## 5. Rencana Pekerjaan Selanjutnya (Next Steps)
1. **Fitur Rekam Kosakata dari AI Kamera:** Menambahkan tombol rekam di tab **AI Kamera** (dengan *countdown*, perekaman keyframe berkala ke `timelineData`, dan fitur *trim* awal/akhir).
2. **Integrasi Kamus Kosakata Dinamis:** Memungkinkan hasil rekaman (atau file `.json` yang diimpor) langsung disimpan sebagai kosakata baru (`localStorage` / backend) dan muncul di tab **Kalimat**.
3. **Editor Timeline Sederhana:** Menampilkan daftar keyframe, hapus/edit durasi satuan, dan kontrol kecepatan putar (`0.5x` / `1x`) untuk memeriksa detail gerakan jari BISINDO.
4. **Hosting Aset MediaPipe Lokal (Opsional):** Menyimpan file `.wasm` dan `.task` di `public/` agar proses perekaman lebih cepat dan stabil tanpa ketergantungan CDN.
