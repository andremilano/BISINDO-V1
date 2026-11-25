import * as THREE from 'three';

// =========================================================================
// KAMUS ISYARAT BISINDO & SISTEM PERANGKAI KALIMAT (TEXT-TO-SIGN SEQUENCER)
// =========================================================================

/**
 * Helper untuk membuat Quaternion dari sudut Euler (dalam satuan derajat).
 * Rotasi dihitung relatif terhadap orientasi lokal sendi.
 */
export function buatRotasiDerajat(xDeg = 0, yDeg = 0, zDeg = 0, order = 'XYZ') {
    const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(xDeg),
        THREE.MathUtils.degToRad(yDeg),
        THREE.MathUtils.degToRad(zDeg),
        order
    );
    return new THREE.Quaternion().setFromEuler(euler);
}

/**
 * Helper untuk menekuk/merotasi tulang tertentu relatif terhadap basePose (pose istirahat).
 */
export function terapkanRotasiLokal(baseQuat, rotasiDelta) {
    if (!baseQuat) return new THREE.Quaternion();
    return baseQuat.clone().multiply(rotasiDelta);
}

/**
 * Helper untuk menekuk jari-jari tangan (kiri atau kanan).
 * @param {Object} basePose 
 * @param {Function} cariTulangJariFn 
 * @param {string} side 'R' atau 'L'
 * @param {Object} statusJari { thumb: deg, index: deg, mid: deg, ring: deg, pinky: deg }
 */
export function tekukJari(basePose, cariTulangJariFn, side, statusJari = {}) {
    const hasil = {};
    const daftar = [
        { key: 'thumb', tokens: ['thumb'] },
        { key: 'index', tokens: ['index'] },
        { key: 'mid', tokens: ['mid', 'middle'] },
        { key: 'ring', tokens: ['ring'] },
        { key: 'pinky', tokens: ['pinky', 'little'] }
    ];

    daftar.forEach(({ key, tokens }) => {
        const sudutTekuk = statusJari[key] ?? 0; // dalam derajat
        const rotX = buatRotasiDerajat(sudutTekuk, 0, 0);

        for (let segment = 1; segment <= 3; segment++) {
            const bone = cariTulangJariFn(side, tokens, segment);
            if (bone && basePose[bone.name]) {
                hasil[bone.name] = terapkanRotasiLokal(basePose[bone.name], rotX);
            }
        }
    });

    return hasil;
}

/**
 * Definisi Kamus Gerakan Kata BISINDO
 * Setiap entri memiliki fungsi pembuat keyframes dinamis berdasarkan waktuMulai.
 */
export const kamusKata = {
    // -------------------------------------------------------------
    // KATA: "HALO" / "HAI"
    // Gerakan: Tangan kanan naik ke samping kepala, telapak terbuka, melambai kiri-kanan
    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // KATA: "HALO" / "HAI"
    // Gerakan: Tangan kanan naik ke samping kepala di depan telinga, melambai
    // -------------------------------------------------------------
    halo: {
        id: 'halo',
        label: 'Halo',
        alias: ['halo', 'hai', 'hello', 'hi'],
        deskripsi: 'Mengangkat tangan kanan di samping kepala dan melambai.',
        durasi: 2.2,
        buatKeyframes(waktuMulai, basePose, cariBoneFn, cariJariFn) {
            const rUpperarm = cariBoneFn('_r_upperarm_');
            const rForearm = cariBoneFn('_r_forearm_');
            const rHand = cariBoneFn('_r_hand_');

            const jariTerbuka = tekukJari(basePose, cariJariFn, 'R', {
                thumb: 5, index: 0, mid: 0, ring: 0, pinky: 0
            });

            const kfs = [];
            kfs.push({ waktu: waktuMulai + 0.0, pose: {} });

            // 0.5s: Lengan kanan naik ke samping kepala (di depan telinga)
            kfs.push({
                waktu: waktuMulai + 0.5,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(20, -15, -50)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(90, 0, 0)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(0, 0, 0)) } : {}),
                    ...jariTerbuka
                }
            });

            // 0.8s: Lambai ke kanan (keluar)
            kfs.push({
                waktu: waktuMulai + 0.8,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(20, -15, -50)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(90, 0, 0)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(0, 0, 25)) } : {}),
                    ...jariTerbuka
                }
            });

            // 1.1s: Lambai ke kiri (kedalam)
            kfs.push({
                waktu: waktuMulai + 1.1,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(20, -15, -50)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(90, 0, 0)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(0, 0, -25)) } : {}),
                    ...jariTerbuka
                }
            });

            // 1.4s: Lambai ke kanan lagi
            kfs.push({
                waktu: waktuMulai + 1.4,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(20, -15, -50)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(90, 0, 0)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(0, 0, 20)) } : {}),
                    ...jariTerbuka
                }
            });

            // 1.8s: Mulai turun santai di depan samping tubuh
            kfs.push({
                waktu: waktuMulai + 1.8,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(10, -5, -20)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(35, 0, 0)) } : {}),
                    ...(rHand ? { [rHand.name]: basePose[rHand.name].clone() } : {})
                }
            });

            kfs.push({ waktu: waktuMulai + 2.2, pose: {} });
            return kfs;
        }
    },

    // -------------------------------------------------------------
    // KATA: "TERIMA KASIH"
    // Gerakan: Ujung jari tangan kanan dari depan dagu bergerak maju ke depan
    // -------------------------------------------------------------
    terima_kasih: {
        id: 'terima_kasih',
        label: 'Terima Kasih',
        alias: ['terima kasih', 'terimakasih', 'thanks', 'makasih'],
        deskripsi: 'Tangan terbuka dari dekat dagu/bibir bergerak maju ke arah lawan bicara.',
        durasi: 2.0,
        buatKeyframes(waktuMulai, basePose, cariBoneFn, cariJariFn) {
            const rUpperarm = cariBoneFn('_r_upperarm_');
            const rForearm = cariBoneFn('_r_forearm_');
            const rHand = cariBoneFn('_r_hand_');

            const jariRapat = tekukJari(basePose, cariJariFn, 'R', {
                thumb: 5, index: 5, mid: 5, ring: 5, pinky: 5
            });

            const kfs = [];
            kfs.push({ waktu: waktuMulai + 0.0, pose: {} });

            // 0.6s: Tangan kanan di depan dagu/bibir (posisi maju di depan tubuh)
            kfs.push({
                waktu: waktuMulai + 0.6,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(25, -20, -20)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(100, 0, -20)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(0, -10, 10)) } : {}),
                    ...jariRapat
                }
            });

            // 1.2s: Tangan bergerak maju lurus ke depan lawan bicara
            kfs.push({
                waktu: waktuMulai + 1.2,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(35, -10, -20)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(45, 0, 0)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(10, 0, 0)) } : {}),
                    ...jariRapat
                }
            });

            // 1.6s: Menurun perlahan
            kfs.push({
                waktu: waktuMulai + 1.6,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(15, -5, -10)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(20, 0, 0)) } : {})
                }
            });

            kfs.push({ waktu: waktuMulai + 2.0, pose: {} });
            return kfs;
        }
    },

    // -------------------------------------------------------------
    // KATA: "SAMA-SAMA"
    // Gerakan: Kedua tangan terbuka di depan dada, mengayun ramah ke depan
    // -------------------------------------------------------------
    sama_sama: {
        id: 'sama_sama',
        label: 'Sama-Sama',
        alias: ['sama-sama', 'sama sama', 'kembali'],
        deskripsi: 'Kedua tangan terbuka di depan dada digerakkan menyambut ke depan.',
        durasi: 2.0,
        buatKeyframes(waktuMulai, basePose, cariBoneFn, cariJariFn) {
            const rUpperarm = cariBoneFn('_r_upperarm_');
            const rForearm = cariBoneFn('_r_forearm_');
            const rHand = cariBoneFn('_r_hand_');
            const lUpperarm = cariBoneFn('_l_upperarm_');
            const lForearm = cariBoneFn('_l_forearm_');
            const lHand = cariBoneFn('_l_hand_');

            const jariRapatR = tekukJari(basePose, cariJariFn, 'R', { thumb: 5, index: 5, mid: 5, ring: 5, pinky: 5 });
            const jariRapatL = tekukJari(basePose, cariJariFn, 'L', { thumb: 5, index: 5, mid: 5, ring: 5, pinky: 5 });

            const kfs = [];
            kfs.push({ waktu: waktuMulai + 0.0, pose: {} });

            // 0.6s: Kedua tangan naik di depan dada/perut (Z maju, tidak menembus dada)
            kfs.push({
                waktu: waktuMulai + 0.6,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(25, -20, -15)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(70, 0, -10)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(10, -10, 0)) } : {}),
                    ...(lUpperarm ? { [lUpperarm.name]: terapkanRotasiLokal(basePose[lUpperarm.name], buatRotasiDerajat(25, 20, 15)) } : {}),
                    ...(lForearm ? { [lForearm.name]: terapkanRotasiLokal(basePose[lForearm.name], buatRotasiDerajat(70, 0, 10)) } : {}),
                    ...(lHand ? { [lHand.name]: terapkanRotasiLokal(basePose[lHand.name], buatRotasiDerajat(10, 10, 0)) } : {}),
                    ...jariRapatR,
                    ...jariRapatL
                }
            });

            // 1.2s: Mengayun maju ke depan
            kfs.push({
                waktu: waktuMulai + 1.2,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(35, -15, -15)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(50, 0, -10)) } : {}),
                    ...(lUpperarm ? { [lUpperarm.name]: terapkanRotasiLokal(basePose[lUpperarm.name], buatRotasiDerajat(35, 15, 15)) } : {}),
                    ...(lForearm ? { [lForearm.name]: terapkanRotasiLokal(basePose[lForearm.name], buatRotasiDerajat(50, 0, 10)) } : {}),
                    ...jariRapatR,
                    ...jariRapatL
                }
            });

            // 1.6s: Menurun santai
            kfs.push({
                waktu: waktuMulai + 1.6,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(15, -5, -10)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(25, 0, 0)) } : {}),
                    ...(lUpperarm ? { [lUpperarm.name]: terapkanRotasiLokal(basePose[lUpperarm.name], buatRotasiDerajat(15, 5, 10)) } : {}),
                    ...(lForearm ? { [lForearm.name]: terapkanRotasiLokal(basePose[lForearm.name], buatRotasiDerajat(25, 0, 0)) } : {})
                }
            });

            kfs.push({ waktu: waktuMulai + 2.0, pose: {} });
            return kfs;
        }
    },

    // -------------------------------------------------------------
    // KATA: "SAYA" / "AKU"
    // Gerakan: Tangan kanan dengan telunjuk mengarah ke dada dari depan
    // -------------------------------------------------------------
    saya: {
        id: 'saya',
        label: 'Saya',
        alias: ['saya', 'aku', 'gue', 'gw', 'me', 'i'],
        deskripsi: 'Jari telunjuk tangan kanan menunjuk ke arah dada sendiri.',
        durasi: 1.8,
        buatKeyframes(waktuMulai, basePose, cariBoneFn, cariJariFn) {
            const rUpperarm = cariBoneFn('_r_upperarm_');
            const rForearm = cariBoneFn('_r_forearm_');
            const rHand = cariBoneFn('_r_hand_');

            // Jari telunjuk lurus, jari lain tertekuk
            const jariTelunjuk = tekukJari(basePose, cariJariFn, 'R', {
                thumb: 60, index: 0, mid: 70, ring: 70, pinky: 70
            });

            const kfs = [];
            kfs.push({ waktu: waktuMulai + 0.0, pose: {} });

            // 0.7s: Tangan di depan dada (jarak aman Z > 20 dari dada)
            kfs.push({
                waktu: waktuMulai + 0.7,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(20, -25, -15)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(95, 0, -25)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(-10, -20, 10)) } : {}),
                    ...jariTelunjuk
                }
            });

            // 1.1s: Sedikit mendekat ke arah dada (tetap di depan dada)
            kfs.push({
                waktu: waktuMulai + 1.1,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(18, -25, -15)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(100, 0, -30)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(-10, -20, 10)) } : {}),
                    ...jariTelunjuk
                }
            });

            // 1.5s: Menjauh turun
            kfs.push({
                waktu: waktuMulai + 1.5,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(10, -10, -10)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(30, 0, 0)) } : {})
                }
            });

            kfs.push({ waktu: waktuMulai + 1.8, pose: {} });
            return kfs;
        }
    },

    // -------------------------------------------------------------
    // KATA: "KAMU" / "ANDA"
    // Gerakan: Tangan kanan dengan telunjuk menunjuk lurus ke depan
    // -------------------------------------------------------------
    kamu: {
        id: 'kamu',
        label: 'Kamu',
        alias: ['kamu', 'anda', 'kamu-kamu', 'you'],
        deskripsi: 'Jari telunjuk tangan kanan menunjuk lurus ke arah lawan bicara.',
        durasi: 1.8,
        buatKeyframes(waktuMulai, basePose, cariBoneFn, cariJariFn) {
            const rUpperarm = cariBoneFn('_r_upperarm_');
            const rForearm = cariBoneFn('_r_forearm_');
            const rHand = cariBoneFn('_r_hand_');

            const jariTelunjuk = tekukJari(basePose, cariJariFn, 'R', {
                thumb: 60, index: 0, mid: 70, ring: 70, pinky: 70
            });

            const kfs = [];
            kfs.push({ waktu: waktuMulai + 0.0, pose: {} });

            // 0.6s: Lengan kanan maju menunjuk ke depan lawan bicara
            kfs.push({
                waktu: waktuMulai + 0.6,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(35, -10, -20)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(35, 0, 0)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(0, 0, 0)) } : {}),
                    ...jariTelunjuk
                }
            });

            // 1.1s: Bertahan sejenak menunjuk
            kfs.push({
                waktu: waktuMulai + 1.1,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(38, -10, -20)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(30, 0, 0)) } : {}),
                    ...jariTelunjuk
                }
            });

            // 1.5s: Mulai turun
            kfs.push({
                waktu: waktuMulai + 1.5,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(15, -5, -10)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(15, 0, 0)) } : {})
                }
            });

            kfs.push({ waktu: waktuMulai + 1.8, pose: {} });
            return kfs;
        }
    },

    // -------------------------------------------------------------
    // KATA: "BAGUS" / "HEBAT"
    // Gerakan: Tangan kanan mengacungkan jempol ke depan dada
    // -------------------------------------------------------------
    bagus: {
        id: 'bagus',
        label: 'Bagus',
        alias: ['bagus', 'hebat', 'oke', 'mantap', 'good'],
        deskripsi: 'Mengacungkan jempol tangan kanan ke arah depan.',
        durasi: 1.8,
        buatKeyframes(waktuMulai, basePose, cariBoneFn, cariJariFn) {
            const rUpperarm = cariBoneFn('_r_upperarm_');
            const rForearm = cariBoneFn('_r_forearm_');
            const rHand = cariBoneFn('_r_hand_');

            const jempolMengacung = tekukJari(basePose, cariJariFn, 'R', {
                thumb: 0, index: 80, mid: 80, ring: 80, pinky: 80
            });

            const kfs = [];
            kfs.push({ waktu: waktuMulai + 0.0, pose: {} });

            // 0.6s: Angkat ke depan dada (Z aman di depan tubuh)
            kfs.push({
                waktu: waktuMulai + 0.6,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(25, -15, -15)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(80, 0, 0)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(0, -20, 0)) } : {}),
                    ...jempolMengacung
                }
            });

            // 1.1s: Sedikit menghentak jempol
            kfs.push({
                waktu: waktuMulai + 1.1,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(28, -15, -15)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(75, 0, 0)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(10, -20, 0)) } : {}),
                    ...jempolMengacung
                }
            });

            // 1.5s: Turun
            kfs.push({
                waktu: waktuMulai + 1.5,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(10, -5, -10)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(20, 0, 0)) } : {})
                }
            });

            kfs.push({ waktu: waktuMulai + 1.8, pose: {} });
            return kfs;
        }
    },

    // -------------------------------------------------------------
    // KATA: "APA KABAR"
    // Gerakan: Dua tangan di depan dada membuka ke samping dengan ramah
    // -------------------------------------------------------------
    apa_kabar: {
        id: 'apa_kabar',
        label: 'Apa Kabar',
        alias: ['apa kabar', 'apakabar', 'gimana', 'kabar'],
        deskripsi: 'Kedua tangan terbuka di depan dada membuka santai bertanya.',
        durasi: 2.2,
        buatKeyframes(waktuMulai, basePose, cariBoneFn, cariJariFn) {
            const rUpperarm = cariBoneFn('_r_upperarm_');
            const rForearm = cariBoneFn('_r_forearm_');
            const rHand = cariBoneFn('_r_hand_');
            const lUpperarm = cariBoneFn('_l_upperarm_');
            const lForearm = cariBoneFn('_l_forearm_');
            const lHand = cariBoneFn('_l_hand_');

            const jariR = tekukJari(basePose, cariJariFn, 'R', { thumb: 10, index: 10, mid: 10, ring: 10, pinky: 10 });
            const jariL = tekukJari(basePose, cariJariFn, 'L', { thumb: 10, index: 10, mid: 10, ring: 10, pinky: 10 });

            const kfs = [];
            kfs.push({ waktu: waktuMulai + 0.0, pose: {} });

            // 0.6s: Kedua tangan di depan dada (maju ke depan)
            kfs.push({
                waktu: waktuMulai + 0.6,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(20, -15, -15)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(70, 0, -10)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(10, -15, 0)) } : {}),
                    ...(lUpperarm ? { [lUpperarm.name]: terapkanRotasiLokal(basePose[lUpperarm.name], buatRotasiDerajat(20, 15, 15)) } : {}),
                    ...(lForearm ? { [lForearm.name]: terapkanRotasiLokal(basePose[lForearm.name], buatRotasiDerajat(70, 0, 10)) } : {}),
                    ...(lHand ? { [lHand.name]: terapkanRotasiLokal(basePose[lHand.name], buatRotasiDerajat(10, 15, 0)) } : {}),
                    ...jariR,
                    ...jariL
                }
            });

            // 1.2s: Membuka ke samping kiri dan kanan (ekspresi bertanya)
            kfs.push({
                waktu: waktuMulai + 1.2,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(15, -10, -35)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(50, 0, 10)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(15, -20, 0)) } : {}),
                    ...(lUpperarm ? { [lUpperarm.name]: terapkanRotasiLokal(basePose[lUpperarm.name], buatRotasiDerajat(15, 10, 35)) } : {}),
                    ...(lForearm ? { [lForearm.name]: terapkanRotasiLokal(basePose[lForearm.name], buatRotasiDerajat(50, 0, -10)) } : {}),
                    ...(lHand ? { [lHand.name]: terapkanRotasiLokal(basePose[lHand.name], buatRotasiDerajat(15, 20, 0)) } : {}),
                    ...jariR,
                    ...jariL
                }
            });

            // 1.7s: Turun santai
            kfs.push({
                waktu: waktuMulai + 1.7,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(10, -5, -10)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(20, 0, 0)) } : {}),
                    ...(lUpperarm ? { [lUpperarm.name]: terapkanRotasiLokal(basePose[lUpperarm.name], buatRotasiDerajat(10, 5, 10)) } : {}),
                    ...(lForearm ? { [lForearm.name]: terapkanRotasiLokal(basePose[lForearm.name], buatRotasiDerajat(20, 0, 0)) } : {})
                }
            });

            kfs.push({ waktu: waktuMulai + 2.2, pose: {} });
            return kfs;
        }
    },

    // -------------------------------------------------------------
    // KATA: "MAAF"
    // Gerakan: Tangan kanan terbuka di depan dada mengusap perlahan
    // -------------------------------------------------------------
    maaf: {
        id: 'maaf',
        label: 'Maaf',
        alias: ['maaf', 'sorry', 'minta maaf'],
        deskripsi: 'Telapak tangan kanan di depan dada mengusap perlahan.',
        durasi: 2.0,
        buatKeyframes(waktuMulai, basePose, cariBoneFn, cariJariFn) {
            const rUpperarm = cariBoneFn('_r_upperarm_');
            const rForearm = cariBoneFn('_r_forearm_');
            const rHand = cariBoneFn('_r_hand_');

            const jariRapat = tekukJari(basePose, cariJariFn, 'R', { thumb: 10, index: 5, mid: 5, ring: 5, pinky: 5 });

            const kfs = [];
            kfs.push({ waktu: waktuMulai + 0.0, pose: {} });

            // 0.6s: Telapak di depan dada (jarak aman di depan tubuh)
            kfs.push({
                waktu: waktuMulai + 0.6,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(20, -25, -15)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(95, 0, -20)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(-10, -20, 10)) } : {}),
                    ...jariRapat
                }
            });

            // 1.1s: Mengusap sedikit melingkar
            kfs.push({
                waktu: waktuMulai + 1.1,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(22, -22, -15)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(90, 0, -15)) } : {}),
                    ...(rHand ? { [rHand.name]: terapkanRotasiLokal(basePose[rHand.name], buatRotasiDerajat(-5, -15, 10)) } : {}),
                    ...jariRapat
                }
            });

            // 1.5s: Turun
            kfs.push({
                waktu: waktuMulai + 1.5,
                pose: {
                    ...(rUpperarm ? { [rUpperarm.name]: terapkanRotasiLokal(basePose[rUpperarm.name], buatRotasiDerajat(10, -5, -10)) } : {}),
                    ...(rForearm ? { [rForearm.name]: terapkanRotasiLokal(basePose[rForearm.name], buatRotasiDerajat(20, 0, 0)) } : {})
                }
            });

            kfs.push({ waktu: waktuMulai + 2.0, pose: {} });
            return kfs;
        }
    }
};

/**
 * Mengambil daftar seluruh kata yang didukung dalam kamus
 */
export function ambilDaftarKata() {
    return Object.values(kamusKata).map((item) => ({
        id: item.id,
        label: item.label,
        alias: item.alias,
        deskripsi: item.deskripsi,
        durasi: item.durasi
    }));
}

/**
 * Mencari kata dalam kamus berdasarkan teks (mencocokkan id atau alias)
 */
export function cariKata(teks) {
    const bersih = teks.trim().toLowerCase();
    for (const item of Object.values(kamusKata)) {
        if (item.id === bersih || item.alias.includes(bersih)) {
            return item;
        }
    }
    return null;
}

/**
 * PARSER & SEQUENCER KALIMAT (TEXT-TO-SIGN)
 * Memecah string kalimat menjadi token kata, mencocokkan frasa multi-kata ("terima kasih", "apa kabar"),
 * lalu menggabungkan keyframe setiap kata secara berurutan dan mulus.
 * 
 * @param {string} kalimatStr Kalimat input (cth: "halo kamu apa kabar")
 * @param {Object} basePose Snapshot orientasi awal seluruh tulang avatar
 * @param {Object} daftarTulang Map seluruh objek tulang avatar
 * @param {Function} cariBoneFn Fungsi pencari tulang rig
 * @param {Function} cariJariFn Fungsi pencari tulang jari
 * @returns {Object} { timelineData, durasiTotal, urutanKata, kataHilang }
 */
export function susunAnimasiKalimat(kalimatStr, basePose, daftarTulang, cariBoneFn, cariJariFn) {
    if (!kalimatStr || typeof kalimatStr !== 'string') {
        return { timelineData: [], durasiTotal: 0, urutanKata: [], kataHilang: [] };
    }

    const teksBersih = kalimatStr
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!teksBersih) {
        return { timelineData: [], durasiTotal: 0, urutanKata: [], kataHilang: [] };
    }

    // Ekstraksi kata & frasa (mencari frasa panjang terlebih dahulu)
    const tokens = teksBersih.split(' ');
    const kataTerpilih = [];
    const kataHilang = [];

    let index = 0;
    while (index < tokens.length) {
        // Cek frasa 3 kata (misal: "minta maaf ya")
        const frase3 = tokens.slice(index, index + 3).join(' ');
        const cocok3 = cariKata(frase3);
        if (cocok3) {
            kataTerpilih.push(cocok3);
            index += 3;
            continue;
        }

        // Cek frasa 2 kata (misal: "terima kasih", "apa kabar", "sama sama")
        const frase2 = tokens.slice(index, index + 2).join(' ');
        const cocok2 = cariKata(frase2);
        if (cocok2) {
            kataTerpilih.push(cocok2);
            index += 2;
            continue;
        }

        // Cek kata tunggal (misal: "halo", "saya", "kamu")
        const kata1 = tokens[index];
        const cocok1 = cariKata(kata1);
        if (cocok1) {
            kataTerpilih.push(cocok1);
        } else {
            kataHilang.push(kata1);
        }
        index++;
    }

    if (kataTerpilih.length === 0) {
        return { timelineData: [], durasiTotal: 0, urutanKata: [], kataHilang };
    }

    // Bangun Snapshot Penuh: Setiap keyframe harus memiliki entri untuk SEMUA tulang
    function buatSnapshotLengkap(poseSpesifik) {
        const snapshot = {};
        for (const nama in daftarTulang) {
            if (poseSpesifik && poseSpesifik[nama]) {
                snapshot[nama] = poseSpesifik[nama].clone();
            } else if (basePose[nama]) {
                snapshot[nama] = basePose[nama].clone();
            } else {
                snapshot[nama] = new THREE.Quaternion();
            }
        }
        return snapshot;
    }

    const timelineGabungan = [];
    let waktuSekarang = 0.0;

    // Keyframe awal mutlak di detik ke-0 (posisi netral)
    timelineGabungan.push({
        waktu: 0.0,
        rotasi: buatSnapshotLengkap({})
    });

    // Rangkai setiap kata secara berurutan
    kataTerpilih.forEach((itemKata, idx) => {
        // Jeda transisi antar-kata (0.25 detik)
        if (idx > 0) {
            waktuSekarang += 0.25;
        }

        const rawKfs = itemKata.buatKeyframes(waktuSekarang, basePose, cariBoneFn, cariJariFn);
        rawKfs.forEach((kf) => {
            timelineGabungan.push({
                waktu: parseFloat(kf.waktu.toFixed(3)),
                rotasi: buatSnapshotLengkap(kf.pose)
            });
        });

        // Majukan waktu ke akhir durasi kata ini
        const kfTerakhir = rawKfs[rawKfs.length - 1];
        if (kfTerakhir) {
            waktuSekarang = kfTerakhir.waktu;
        } else {
            waktuSekarang += itemKata.durasi;
        }
    });

    // Pastikan keyframe penutup kembali ke posisi netral
    waktuSekarang += 0.2;
    timelineGabungan.push({
        waktu: parseFloat(waktuSekarang.toFixed(3)),
        rotasi: buatSnapshotLengkap({})
    });

    // Urutkan keyframe berdasarkan waktu & eliminasi duplikat waktu sangat dekat
    timelineGabungan.sort((a, b) => a.waktu - b.waktu);
    const timelineBersih = [];
    timelineGabungan.forEach((item) => {
        if (timelineBersih.length === 0 || item.waktu - timelineBersih[timelineBersih.length - 1].waktu > 0.03) {
            timelineBersih.push(item);
        }
    });

    return {
        timelineData: timelineBersih,
        durasiTotal: waktuSekarang,
        urutanKata: kataTerpilih.map((k) => k.label),
        kataHilang
    };
}
