import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { ambilDaftarKata, susunAnimasiKalimat } from './kamusIsyarat.js';

// 1. Setup Scene, Kamera, dan Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.4, 2.0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Pencahayaan Utama
const light = new THREE.AmbientLight(0xffffff, 2);
scene.add(light);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// 2. Tambahkan Kontrol Kamera (OrbitControls)
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.05;
orbit.target.set(0, 1.2, 0);

// 3. Tambahkan Kontrol Gizmo Mouse (TransformControls)
const transformControl = new TransformControls(camera, renderer.domElement);
transformControl.setMode('rotate'); 
transformControl.setSpace('local'); 
transformControl.size = 0.8; 
scene.add(transformControl.getHelper()); 

// SINKRONISASI TOTAL: Memaksa kulit mengikuti tulang saat diputar
transformControl.addEventListener('change', () => {
    if (avatarModel && transformControl.object) {
        transformControl.object.updateMatrix();
        avatarModel.updateMatrixWorld(true);
        avatarModel.traverse((obj) => {
            if (obj.isSkinnedMesh && obj.skeleton) {
                obj.skeleton.update();
            }
        });
    }
});

// Mencegah kamera ikut bergerak saat sumbu sedang diputar
transformControl.addEventListener('dragging-changed', (event) => {
    orbit.enabled = !event.value;
});

// 4. Setup Variabel dan Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let avatarModel = null;
const daftarTulang = {}; 
const dropdown = document.getElementById('pilihSendi');
const selectModel = document.getElementById('pilihModel');
const logStatus = document.getElementById('logStatus');
const btnHandTracking = document.getElementById('btnHandTracking');
const handVideo = document.getElementById('videoTangan');
const handCanvas = document.getElementById('canvasTangan');
const handPreview = document.getElementById('previewTangan');
const handStatus = document.getElementById('statusTangan');
const chkMirrorTracking = document.getElementById('chkMirrorTracking');

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const HOLISTIC_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task';
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let holisticLandmarker = null;
let handLandmarker = null;
let poseLandmarker = null;
let mediaPipeVision = null;
let drawingUtils = null;
let activeMediaPipeMode = null; // 'holistic' | 'fallback'
let activeDelegateLabel = '';
let cameraStream = null;
let handTrackingActive = false;
let handFrameId = null;
let lastVideoTime = -1;
let lastVideoFrameAt = 0;
let lastMediaPipeTimestamp = 0;
let isSwitchingFallback = false;
const fingerFlexions = new Map();
const handRetargetData = {};
const bodyRetargetData = [];
let poseSpaceToAvatar = null;
let avatarPoseFrame = null;

// STRUKTUR DATA REKAMAN: Menyimpan urutan waktu dan rotasi quaternion tulang
let timelineData = []; 
let totalWaktu = 0;
let mixerAnimation = null;
let basePose = {}; // Menyimpan pose awal default

// 5. Muat Model (.FBX / .GLB) & Kumpulkan Sendi ke Dropdown
const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
let currentLoadToken = 0;

function bersihkanModelAktif() {
    transformControl.detach();
    if (mixerAnimation) {
        mixerAnimation.stopAllAction();
        mixerAnimation = null;
    }

    if (avatarModel) {
        scene.remove(avatarModel);
        avatarModel.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
            mats.forEach((m) => m.dispose?.());
        });
        avatarModel = null;
    }

    Object.keys(daftarTulang).forEach((k) => delete daftarTulang[k]);
    Object.keys(handRetargetData).forEach((k) => delete handRetargetData[k]);
    bodyRetargetData.length = 0;
    fingerFlexions.clear();
    basePose = {};
    timelineData = [];
    totalWaktu = 0;
    avatarPoseFrame = null;
    poseSpaceToAvatar = null;

    if (dropdown) {
        dropdown.innerHTML = '<option value="">-- Klik Manekin / Pilih Sendi --</option>';
    }
}

function terapkanModelKeScene(model, modelUrl) {
    avatarModel = model;
    scene.add(avatarModel);

    // Normalisasi skala bila model dalam satuan sentimeter (mis. Mixamo FBX)
    avatarModel.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(avatarModel);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 10) {
        const scaleFactor = 1.75 / size.y;
        avatarModel.scale.multiplyScalar(scaleFactor);
        avatarModel.updateMatrixWorld(true);
    }

    const scaledBox = new THREE.Box3().setFromObject(avatarModel);
    const center = scaledBox.getCenter(new THREE.Vector3());
    avatarModel.position.x -= center.x;
    avatarModel.position.z -= center.z;
    avatarModel.position.y += -0.5 - scaledBox.min.y;
    avatarModel.updateMatrixWorld(true);

    mixerAnimation = new THREE.AnimationMixer(avatarModel);

    avatarModel.traverse((object) => {
        if (!object.isBone) return;
        object.matrixAutoUpdate = true;
        const namaLower = object.name.toLowerCase();
        if (namaLower.includes('scalecompensation')) return;

        // Saring tulang yang relevan dengan gerakan tubuh atas, bahu, lengan, & jari
        const relevan = namaLower.includes('arm')
            || namaLower.includes('hand')
            || namaLower.includes('finger')
            || namaLower.includes('index')
            || namaLower.includes('mid')
            || namaLower.includes('middle')
            || namaLower.includes('ring')
            || namaLower.includes('pinky')
            || namaLower.includes('little')
            || namaLower.includes('thumb')
            || namaLower.includes('clavicle')
            || namaLower.includes('shoulder')
            || namaLower.includes('spine')
            || namaLower.includes('neck')
            || namaLower.includes('head')
            || namaLower.includes('hips')
            || namaLower.includes('pelvis');

        // Pertahankan tulang induk pertama bila terdapat duplikat nama (mis. Beta_Joints pada Mixamo FBX)
        if (relevan && !daftarTulang[object.name]) {
            daftarTulang[object.name] = object;
            basePose[object.name] = object.quaternion.clone();

            if (dropdown) {
                const option = document.createElement('option');
                option.value = object.name;
                option.text = object.name
                    .replace('CC_Base_', '')
                    .replace(/^mixamorig:?/i, '');
                dropdown.add(option);
            }
        }
    });

    inisialisasiRetargetTangan();
    inisialisasiRetargetTubuh();
    if (logStatus) {
        const namaFile = modelUrl.split('/').pop();
        logStatus.innerText = `Model '${namaFile}' dimuat (${Object.keys(daftarTulang).length} tulang aktif). Siap.`;
    }
}

function muatModelAvatar(modelUrl) {
    const token = ++currentLoadToken;
    bersihkanModelAktif();
    if (logStatus) logStatus.innerText = `Memuat model '${modelUrl.split('/').pop()}'...`;

    const isFbx = modelUrl.toLowerCase().endsWith('.fbx');
    const onLoaded = (loaded) => {
        if (token !== currentLoadToken) return;
        const model = isFbx ? loaded : loaded.scene;
        terapkanModelKeScene(model, modelUrl);
    };
    const onError = (error) => {
        if (token !== currentLoadToken) return;
        console.error('Gagal memuat model 3D:', error);
        if (logStatus) logStatus.innerText = `Gagal memuat file '${modelUrl}'.`;
    };

    if (isFbx) {
        fbxLoader.load(modelUrl, onLoaded, undefined, onError);
    } else {
        gltfLoader.load(modelUrl, onLoaded, undefined, onError);
    }
}

const initialModelUrl = selectModel?.value || '/T-Pose.fbx';
muatModelAvatar(initialModelUrl);

if (selectModel) {
    selectModel.addEventListener('change', (event) => {
        if (handTrackingActive) hentikanDeteksiTangan('Pelacakan dihentikan karena model diganti.');
        muatModelAvatar(event.target.value);
    });
}

// 6. Fungsi Pilih Sendi
function pilihSendiAktif(namaTulang) {
    if (!namaTulang) {
        transformControl.detach();
        return;
    }
    const tulang = daftarTulang[namaTulang];
    if (tulang) {
        tulang.updateMatrixWorld(true); 
        transformControl.attach(tulang);
        dropdown.value = namaTulang; 
    }
}

function cariTulangDariHit(hit) {
    const mesh = hit.object;

    if (mesh.isSkinnedMesh && mesh.skeleton && hit.face && hit.barycoord) {
        const skinIndex = mesh.geometry.getAttribute('skinIndex');
        const skinWeight = mesh.geometry.getAttribute('skinWeight');

        if (skinIndex && skinWeight) {
            const bobotPerTulang = new Map();
            const vertices = [hit.face.a, hit.face.b, hit.face.c];
            const barycentric = [hit.barycoord.x, hit.barycoord.y, hit.barycoord.z];

            vertices.forEach((vertex, vertexIndex) => {
                for (let influence = 0; influence < 4; influence++) {
                    const boneIndex = skinIndex.getComponent(vertex, influence);
                    const bone = mesh.skeleton.bones[boneIndex];

                    if (bone && daftarTulang[bone.name]) {
                        const weight = skinWeight.getComponent(vertex, influence) * barycentric[vertexIndex];
                        bobotPerTulang.set(bone.name, (bobotPerTulang.get(bone.name) || 0) + weight);
                    }
                }
            });

            const namaTulang = [...bobotPerTulang.entries()]
                .sort((a, b) => b[1] - a[1])[0]?.[0];

            if (namaTulang) return daftarTulang[namaTulang];
        }
    }

    let bone = mesh.isBone ? mesh : null;
    mesh.traverseAncestors((ancestor) => {
        if (ancestor.isBone && !bone) bone = ancestor;
    });
    return bone;
}

const jariMediaPipe = [
    { nama: 'thumb', token: ['thumb'], sendi: [[0, 1, 2], [1, 2, 3], [2, 3, 4]] },
    { nama: 'index', token: ['index'], sendi: [[0, 5, 6], [5, 6, 7], [6, 7, 8]] },
    { nama: 'middle', token: ['mid', 'middle'], sendi: [[0, 9, 10], [9, 10, 11], [10, 11, 12]] },
    { nama: 'ring', token: ['ring'], sendi: [[0, 13, 14], [13, 14, 15], [14, 15, 16]] },
    { nama: 'pinky', token: ['pinky', 'little'], sendi: [[0, 17, 18], [17, 18, 19], [18, 19, 20]] }
];

function sudutTekukan(landmarks, triplet) {
    const [previousIndex, jointIndex, nextIndex] = triplet;
    const previous = landmarks[previousIndex];
    const joint = landmarks[jointIndex];
    const next = landmarks[nextIndex];
    const first = new THREE.Vector3(previous.x - joint.x, previous.y - joint.y, previous.z - joint.z).normalize();
    const second = new THREE.Vector3(next.x - joint.x, next.y - joint.y, next.z - joint.z).normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(first.dot(second), -1, 1));
    return Math.min(Math.PI - angle, 1.6);
}

const MIXAMO_BONE_ALIASES = {
    '_pelvis_': ['mixamorighips'],
    '_spine01_': ['mixamorigspine'],
    '_spine02_': ['mixamorigspine2', 'mixamorigspine1'],
    '_necktwist01_': ['mixamorigneck'],
    '_necktwist02_': ['mixamorighead'],
    '_l_clavicle_': ['mixamorigleftshoulder'],
    '_r_clavicle_': ['mixamorigrightshoulder'],
    '_l_upperarm_': ['mixamorigleftarm'],
    '_r_upperarm_': ['mixamorigrightarm'],
    '_l_forearm_': ['mixamorigleftforearm'],
    '_r_forearm_': ['mixamorigrightforearm'],
    '_l_hand_': ['mixamoriglefthand'],
    '_r_hand_': ['mixamorigrighthand']
};

function cariTulangJari(side, tokens, segment) {
    const sideLower = side.toLowerCase();
    const sideToken = `_${sideLower}_`;
    const sideWord = sideLower === 'l' ? 'left' : 'right';

    return Object.values(daftarTulang).find((bone) => {
        const name = bone.name.toLowerCase();
        if (name.includes('scalecompensation')) return false;
        if (name.includes(sideToken) && tokens.some((token) => name.includes(`_${token}${segment}_`))) {
            return true;
        }
        const compact = name.replace(/[:_]/g, '');
        return tokens.some((token) => compact.includes(`${sideWord}hand${token}${segment}`));
    });
}

function cariBoneRig(fragment) {
    const ccMatch = Object.values(daftarTulang).find((bone) => {
        const name = bone.name.toLowerCase();
        return name.includes(fragment) && !name.includes('scalecompensation');
    });
    if (ccMatch) return ccMatch;

    const aliases = MIXAMO_BONE_ALIASES[fragment] || [];
    for (const alias of aliases) {
        const found = Object.values(daftarTulang).find(
            (bone) => bone.name.toLowerCase().replace(/[:_]/g, '') === alias
        );
        if (found) return found;
    }
    return null;
}

function clampQuaternionSudut(q, baseQ, maxRad) {
    if (!baseQ || maxRad <= 0) return q;
    const rel = baseQ.clone().invert().multiply(q).normalize();
    if (rel.w < 0) rel.set(-rel.x, -rel.y, -rel.z, -rel.w);
    const angle = 2 * Math.acos(THREE.MathUtils.clamp(rel.w, -1, 1));
    if (angle <= maxRad || angle < 1e-5) return q;
    const scale = Math.sin(maxRad * 0.5) / Math.sin(angle * 0.5);
    const clampedRel = new THREE.Quaternion(
        rel.x * scale,
        rel.y * scale,
        rel.z * scale,
        Math.cos(maxRad * 0.5)
    );
    return baseQ.clone().multiply(clampedRel);
}

function ekstrakTwistY(q) {
    const proj = new THREE.Quaternion(0, q.y, 0, q.w);
    if (proj.lengthSq() < 1e-8) return 0;
    proj.normalize();
    return 2 * Math.atan2(proj.y, proj.w);
}

function buatFramePose(xDirection, yDirection) {
    const xAxis = xDirection.clone();
    const yAxis = yDirection.clone();
    if (xAxis.lengthSq() < 1e-8 || yAxis.lengthSq() < 1e-8) return null;

    xAxis.normalize();
    yAxis.addScaledVector(xAxis, -yAxis.dot(xAxis));
    if (yAxis.lengthSq() < 1e-8) return null;
    yAxis.normalize();

    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    yAxis.crossVectors(zAxis, xAxis).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
    );
}

const MP_WORLD_FRAME = buatFramePose(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, -1, 0)
);

function sinkronkanSkeletonAvatar() {
    if (!avatarModel) return;
    avatarModel.updateMatrixWorld(true);
    avatarModel.traverse((obj) => {
        if (obj.isSkinnedMesh && obj.skeleton) {
            obj.skeleton.update();
        }
    });
}

function tambahRetargetTubuh(bone, childBone, from, to, options = {}) {
    if (!bone || !childBone) return;

    const bonePosition = bone.getWorldPosition(new THREE.Vector3());
    const childPosition = childBone.getWorldPosition(new THREE.Vector3());
    const boneWorldOrientation = bone.getWorldQuaternion(new THREE.Quaternion());
    const restDirectionWorld = childPosition.sub(bonePosition).normalize();

    const restBendWorld = new THREE.Vector3().crossVectors(restDirectionWorld, new THREE.Vector3(0, 0, 1));
    const restX = restBendWorld.lengthSq() > 1e-6
        ? restBendWorld.normalize()
        : new THREE.Vector3(1, 0, 0).applyQuaternion(boneWorldOrientation).normalize();
    const restZ = new THREE.Vector3().crossVectors(restX, restDirectionWorld).normalize();
    const restBasis = new THREE.Matrix4().makeBasis(restX, restDirectionWorld, restZ);
    const restBasisQ = new THREE.Quaternion().setFromRotationMatrix(restBasis);
    const boneToBasis = boneWorldOrientation.clone().invert().multiply(restBasisQ);

    bodyRetargetData.push({
        bone,
        childBone,
        from,
        to,
        side: options.side ?? null,
        role: options.role ?? 'limb',
        minVis: options.minVis ?? 0.35,
        smooth: options.smooth ?? 0.45,
        weight: options.weight ?? 1.0,
        maxAngle: options.maxAngle ?? Math.PI,
        restDirectionWorld,
        restWorldOrientation: boneWorldOrientation,
        boneToBasis,
        smoothedDirection: null,
        smoothedElbowNormal: null
    });
}

function inisialisasiRetargetTubuh() {
    bodyRetargetData.length = 0;
    const leftClavicle = cariBoneRig('_l_clavicle_');
    const rightClavicle = cariBoneRig('_r_clavicle_');
    const pelvis = cariBoneRig('_pelvis_') || avatarModel.getObjectByName('CC_Base_Pelvis_03');
    const spine = cariBoneRig('_spine01_');
    if (leftClavicle && rightClavicle && pelvis && spine) {
        const leftPosition = leftClavicle.getWorldPosition(new THREE.Vector3());
        const rightPosition = rightClavicle.getWorldPosition(new THREE.Vector3());
        const pelvisPosition = pelvis.getWorldPosition(new THREE.Vector3());
        const spinePosition = spine.getWorldPosition(new THREE.Vector3());
        const shoulderCenter = leftPosition.add(rightPosition).multiplyScalar(0.5);
        avatarPoseFrame = buatFramePose(
            leftClavicle.getWorldPosition(new THREE.Vector3()).sub(rightClavicle.getWorldPosition(new THREE.Vector3())),
            shoulderCenter.sub(pelvisPosition).add(spinePosition.sub(pelvisPosition).multiplyScalar(0.2))
        );
    }

    if (avatarPoseFrame && MP_WORLD_FRAME) {
        poseSpaceToAvatar = avatarPoseFrame.clone().multiply(MP_WORLD_FRAME.clone().invert());
    } else if (MP_WORLD_FRAME) {
        poseSpaceToAvatar = MP_WORLD_FRAME.clone().invert();
    } else {
        poseSpaceToAvatar = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    }

    tambahRetargetTubuh(
        cariBoneRig('_spine01_'),
        cariBoneRig('_spine02_'),
        [23, 24], [11, 12],
        { role: 'spine', minVis: 0.65, smooth: 0.25, maxAngle: 0.4 }
    );
    tambahRetargetTubuh(
        cariBoneRig('_necktwist01_'),
        cariBoneRig('_necktwist02_'),
        [11, 12], [7, 8],
        { role: 'neck', minVis: 0.5, smooth: 0.25, maxAngle: 0.4 }
    );

    for (const side of ['L', 'R']) {
        const sideToken = `_${side.toLowerCase()}_`;
        tambahRetargetTubuh(
            cariBoneRig(`${sideToken}clavicle_`),
            cariBoneRig(`${sideToken}upperarm_`),
            [11, 12], [side === 'L' ? 11 : 12],
            { side, role: 'clavicle', minVis: 0.4, smooth: 0.3, weight: 0.35, maxAngle: 0.35 }
        );
        tambahRetargetTubuh(
            cariBoneRig(`${sideToken}upperarm_`),
            cariBoneRig(`${sideToken}forearm_`),
            [side === 'L' ? 11 : 12], [side === 'L' ? 13 : 14],
            { side, role: 'upperarm', minVis: 0.35, smooth: 0.45 }
        );
        tambahRetargetTubuh(
            cariBoneRig(`${sideToken}forearm_`),
            cariBoneRig(`${sideToken}hand_`),
            [side === 'L' ? 13 : 14], [side === 'L' ? 15 : 16],
            { side, role: 'forearm', minVis: 0.35, smooth: 0.45 }
        );
    }
}

function titikPose(landmarks, indices, minVis = 0.35) {
    if (!landmarks || indices.some((index) => !landmarks[index] || (landmarks[index].visibility ?? 1) < minVis)) return null;
    const point = new THREE.Vector3();
    indices.forEach((index) => {
        point.x += landmarks[index].x;
        point.y += landmarks[index].y;
        point.z += landmarks[index].z;
    });
    return point.multiplyScalar(1 / indices.length);
}

function arahPoseAvatar(landmarks, from, to, minVis = 0.35) {
    const start = titikPose(landmarks, from, minVis);
    const end = titikPose(landmarks, to, minVis);
    if (!start || !end) return null;
    const dir = end.sub(start);
    if (dir.lengthSq() < 1e-8) return null;
    return dir.normalize().applyQuaternion(poseSpaceToAvatar).normalize();
}

function aturPoseTubuh(poseWorldLandmarks) {
    if (!poseWorldLandmarks || !poseSpaceToAvatar) return 0;

    let appliedSegments = 0;
    bodyRetargetData.forEach((retarget) => {
        const targetDirection = arahPoseAvatar(poseWorldLandmarks, retarget.from, retarget.to, retarget.minVis);
        if (!targetDirection) {
            if (basePose[retarget.bone.name]) {
                retarget.bone.quaternion.slerp(basePose[retarget.bone.name], 0.12);
                retarget.bone.updateWorldMatrix(true, true);
            }
            retarget.smoothedDirection = null;
            return;
        }

        if (retarget.smoothedDirection) {
            retarget.smoothedDirection.lerp(targetDirection, retarget.smooth).normalize();
        } else {
            retarget.smoothedDirection = targetDirection.clone();
        }

        let targetWorldOrientation = null;

        if (retarget.role === 'upperarm') {
            const shoulderIdx = retarget.side === 'L' ? [11] : [12];
            const elbowIdx = retarget.side === 'L' ? [13] : [14];
            const wristIdx = retarget.side === 'L' ? [15] : [16];
            const forearmDir = arahPoseAvatar(poseWorldLandmarks, elbowIdx, wristIdx, 0.35);

            if (forearmDir) {
                const elbowCross = new THREE.Vector3().crossVectors(retarget.smoothedDirection, forearmDir);
                if (elbowCross.length() > 0.22) {
                    elbowCross.normalize();
                    if (retarget.smoothedElbowNormal) {
                        if (retarget.smoothedElbowNormal.dot(elbowCross) < 0) elbowCross.negate();
                        retarget.smoothedElbowNormal.lerp(elbowCross, 0.35).normalize();
                    } else {
                        retarget.smoothedElbowNormal = elbowCross.clone();
                    }
                    const xAxis = retarget.smoothedElbowNormal.clone();
                    const yAxis = retarget.smoothedDirection.clone();
                    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
                    xAxis.crossVectors(yAxis, zAxis).normalize();
                    const basisQ = new THREE.Quaternion().setFromRotationMatrix(
                        new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
                    );
                    targetWorldOrientation = basisQ.multiply(retarget.boneToBasis.clone().invert());
                }
            }
        }

        if (!targetWorldOrientation && retarget.role === 'forearm') {
            const curBonePos = retarget.bone.getWorldPosition(new THREE.Vector3());
            const curChildPos = retarget.childBone.getWorldPosition(new THREE.Vector3());
            const curDir = curChildPos.sub(curBonePos);
            if (curDir.lengthSq() > 1e-8) {
                curDir.normalize();
                const curWorldQ = retarget.bone.getWorldQuaternion(new THREE.Quaternion());
                targetWorldOrientation = new THREE.Quaternion()
                    .setFromUnitVectors(curDir, retarget.smoothedDirection)
                    .multiply(curWorldQ);
            }
        }

        if (!targetWorldOrientation) {
            const correction = new THREE.Quaternion().setFromUnitVectors(
                retarget.restDirectionWorld,
                retarget.smoothedDirection
            );
            targetWorldOrientation = correction.multiply(retarget.restWorldOrientation);
        }

        const parentOrientation = retarget.bone.parent.getWorldQuaternion(new THREE.Quaternion());
        let targetLocalQuat = parentOrientation.invert().multiply(targetWorldOrientation).normalize();

        if (basePose[retarget.bone.name]) {
            if (retarget.weight < 1.0) {
                targetLocalQuat = basePose[retarget.bone.name].clone().slerp(targetLocalQuat, retarget.weight);
            }
            if (retarget.maxAngle < Math.PI) {
                targetLocalQuat = clampQuaternionSudut(targetLocalQuat, basePose[retarget.bone.name], retarget.maxAngle);
            }
        }

        retarget.bone.quaternion.slerp(targetLocalQuat, retarget.smooth);
        retarget.bone.updateWorldMatrix(true, true);
        appliedSegments++;
    });
    return appliedSegments;
}

function orientasiTelapak(wrist, indexBase, pinkyBase, middleBase) {
    const yAxis = middleBase.clone().sub(wrist);
    const xAxis = pinkyBase.clone().sub(indexBase);

    if (yAxis.lengthSq() < 1e-8 || xAxis.lengthSq() < 1e-8) return null;
    yAxis.normalize();
    xAxis.addScaledVector(yAxis, -xAxis.dot(yAxis));
    if (xAxis.lengthSq() < 1e-8) return null;
    xAxis.normalize();

    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    xAxis.crossVectors(yAxis, zAxis).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    return new THREE.Quaternion().setFromRotationMatrix(basis);
}

function inisialisasiRetargetTangan() {
    Object.keys(handRetargetData).forEach((k) => delete handRetargetData[k]);
    for (const side of ['L', 'R']) {
        const s = side.toLowerCase();
        const handBone = cariBoneRig(`_${s}_hand_`);
        const indexBone = cariTulangJari(side, ['index'], 1);
        const pinkyBone = cariTulangJari(side, ['pinky', 'little'], 1);
        const middleBone = cariTulangJari(side, ['mid', 'middle'], 1);
        if (!handBone || !indexBone || !pinkyBone || !middleBone) continue;

        const wrist = handBone.getWorldPosition(new THREE.Vector3());
        const indexBase = indexBone.getWorldPosition(new THREE.Vector3());
        const pinkyBase = pinkyBone.getWorldPosition(new THREE.Vector3());
        const middleBase = middleBone.getWorldPosition(new THREE.Vector3());
        const avatarPalmOrientation = orientasiTelapak(wrist, indexBase, pinkyBase, middleBase);
        if (!avatarPalmOrientation) continue;

        const palmInwardWorld = new THREE.Vector3(0, 0, side === 'L' ? 1 : -1)
            .applyQuaternion(avatarPalmOrientation)
            .normalize();
        const handWorldOrientation = handBone.getWorldQuaternion(new THREE.Quaternion());
        const fingerRig = {};

        jariMediaPipe.forEach((finger) => {
            const b1 = cariTulangJari(side, finger.token, 1);
            const b2 = cariTulangJari(side, finger.token, 2);
            const b3 = cariTulangJari(side, finger.token, 3);
            if (!b1 || !b2 || !b3) return;

            const p1 = b1.getWorldPosition(new THREE.Vector3());
            const p2 = b2.getWorldPosition(new THREE.Vector3());
            const p3 = b3.getWorldPosition(new THREE.Vector3());
            const restDir1World = p2.clone().sub(p1).normalize();
            const restDir2World = p3.clone().sub(p2).normalize();
            const q1World = b1.getWorldQuaternion(new THREE.Quaternion());
            const q2World = b2.getWorldQuaternion(new THREE.Quaternion());
            const q3World = b3.getWorldQuaternion(new THREE.Quaternion());
            const p1ParentWorld = b1.parent.getWorldQuaternion(new THREE.Quaternion());

            const curlAxisWorld = new THREE.Vector3().crossVectors(restDir2World, palmInwardWorld);
            const curlFallback = new THREE.Vector3(0, 0, side === 'L' ? -1 : 1);
            const curlAxis2Local = curlAxisWorld.lengthSq() > 1e-6
                ? curlAxisWorld.clone().normalize().applyQuaternion(q2World.clone().invert()).normalize()
                : curlFallback.clone();
            const curlAxis3Local = curlAxisWorld.lengthSq() > 1e-6
                ? curlAxisWorld.clone().normalize().applyQuaternion(q3World.clone().invert()).normalize()
                : curlFallback.clone();

            fingerRig[finger.nama] = {
                sendi: finger.sendi,
                b1, b2, b3,
                restDir1World,
                restDir2InPalm: restDir2World.clone().applyQuaternion(avatarPalmOrientation.clone().invert()).normalize(),
                q1World,
                p1ParentWorld,
                curlAxis2Local,
                curlAxis3Local
            };
        });

        handRetargetData[side] = {
            side,
            bone: handBone,
            twist01: cariBoneRig(`_${s}_forearmtwist01_`),
            twist02: cariBoneRig(`_${s}_forearmtwist02_`),
            avatarPalmBase: avatarPalmOrientation,
            boneToPalm: handWorldOrientation.clone().invert().multiply(avatarPalmOrientation),
            fingerRig
        };
    }
}

function aturOrientasiTangan(side, landmarks) {
    const retarget = handRetargetData[side];
    if (!retarget || !landmarks || landmarks.length < 21) return null;

    const toAvatarSpace = poseSpaceToAvatar || new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    const point = (index) => new THREE.Vector3(
        landmarks[index].x,
        landmarks[index].y,
        landmarks[index].z
    ).applyQuaternion(toAvatarSpace);

    const cameraPalmOrientation = orientasiTelapak(point(0), point(5), point(17), point(9));
    if (!cameraPalmOrientation) return null;

    const targetHandWorld = cameraPalmOrientation.clone().multiply(retarget.boneToPalm.clone().invert());
    const parentWorld = retarget.bone.parent.getWorldQuaternion(new THREE.Quaternion());
    let targetLocalQuat = parentWorld.invert().multiply(targetHandWorld).normalize();
    if (basePose[retarget.bone.name]) {
        targetLocalQuat = clampQuaternionSudut(targetLocalQuat, basePose[retarget.bone.name], 1.4);
    }
    retarget.bone.quaternion.slerp(targetLocalQuat, 0.45);
    retarget.bone.updateWorldMatrix(true, true);

    if (basePose[retarget.bone.name]) {
        const deltaHand = basePose[retarget.bone.name].clone().invert().multiply(retarget.bone.quaternion);
        const twistY = THREE.MathUtils.clamp(ekstrakTwistY(deltaHand), -1.8, 1.8);
        if (retarget.twist01 && basePose[retarget.twist01.name]) {
            const qTwist1 = basePose[retarget.twist01.name].clone().multiply(
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), twistY * 0.35)
            );
            retarget.twist01.quaternion.slerp(qTwist1, 0.45);
        }
        if (retarget.twist02 && basePose[retarget.twist02.name]) {
            const qTwist2 = basePose[retarget.twist02.name].clone().multiply(
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), twistY * 0.35)
            );
            retarget.twist02.quaternion.slerp(qTwist2, 0.45);
        }
    }

    return { cameraPalmOrientation, toAvatarSpace };
}

function resetTanganHalus(side) {
    const retarget = handRetargetData[side];
    if (retarget?.bone && basePose[retarget.bone.name]) {
        retarget.bone.quaternion.slerp(basePose[retarget.bone.name], 0.2);
    }
    if (retarget?.twist01 && basePose[retarget.twist01.name]) {
        retarget.twist01.quaternion.slerp(basePose[retarget.twist01.name], 0.2);
    }
    if (retarget?.twist02 && basePose[retarget.twist02.name]) {
        retarget.twist02.quaternion.slerp(basePose[retarget.twist02.name], 0.2);
    }

    jariMediaPipe.forEach((finger) => {
        for (let jointIndex = 0; jointIndex < finger.sendi.length; jointIndex++) {
            const bone = cariTulangJari(side, finger.token, jointIndex + 1);
            if (!bone || !basePose[bone.name]) continue;
            const prev = fingerFlexions.get(bone.name) || 0;
            const next = prev * 0.8;
            fingerFlexions.set(bone.name, next < 0.005 ? 0 : next);
            bone.quaternion.slerp(basePose[bone.name], 0.2);
        }
    });
}

function aturPoseDariTangan(trackingResult) {
    const handsBySide = {
        L: trackingResult.leftHandWorldLandmarks,
        R: trackingResult.rightHandWorldLandmarks
    };

    for (const side of ['L', 'R']) {
        const landmarks = handsBySide[side];
        const retarget = handRetargetData[side];
        if (!landmarks || landmarks.length < 21 || !retarget) {
            resetTanganHalus(side);
            continue;
        }

        const palmState = aturOrientasiTangan(side, landmarks);
        if (!palmState) continue;

        const { cameraPalmOrientation, toAvatarSpace } = palmState;
        const invMpPalm = cameraPalmOrientation.clone().invert();
        const segVecAvatarRest = (a, b) => {
            const v = new THREE.Vector3(
                landmarks[b].x - landmarks[a].x,
                landmarks[b].y - landmarks[a].y,
                landmarks[b].z - landmarks[a].z
            );
            if (v.lengthSq() < 1e-8) return null;
            return v.normalize()
                .applyQuaternion(toAvatarSpace)
                .applyQuaternion(invMpPalm)
                .applyQuaternion(retarget.avatarPalmBase)
                .normalize();
        };

        Object.entries(retarget.fingerRig).forEach(([namaJari, rig]) => {
            const [t1, t2, t3] = rig.sendi;

            // Segmen 1 (MCP / Thumb CMC): align 3D vector in palm-local space (curl + splay + thumb opposition)
            const targetDir1 = segVecAvatarRest(t1[1], t1[2]);
            if (targetDir1 && basePose[rig.b1.name]) {
                const corr1 = new THREE.Quaternion().setFromUnitVectors(rig.restDir1World, targetDir1);
                const targetRestWorld1 = corr1.multiply(rig.q1World);
                let targetLocal1 = rig.p1ParentWorld.clone().invert().multiply(targetRestWorld1).normalize();
                targetLocal1 = clampQuaternionSudut(targetLocal1, basePose[rig.b1.name], 1.65);
                rig.b1.quaternion.slerp(targetLocal1, 0.45);
                rig.b1.updateWorldMatrix(true, true);
            }

            // Segmen 2 (PIP / Thumb MCP)
            if (namaJari === 'thumb') {
                const targetDir2Mp = new THREE.Vector3(
                    landmarks[t2[2]].x - landmarks[t2[1]].x,
                    landmarks[t2[2]].y - landmarks[t2[1]].y,
                    landmarks[t2[2]].z - landmarks[t2[1]].z
                );
                if (targetDir2Mp.lengthSq() > 1e-8 && basePose[rig.b2.name]) {
                    const dir2Palm = targetDir2Mp.normalize().applyQuaternion(toAvatarSpace).applyQuaternion(invMpPalm);
                    const curHandWorld = retarget.bone.getWorldQuaternion(new THREE.Quaternion());
                    const curPalmWorld = curHandWorld.multiply(retarget.boneToPalm);
                    const targetDir2World = dir2Palm.applyQuaternion(curPalmWorld).normalize();

                    const p2 = rig.b2.getWorldPosition(new THREE.Vector3());
                    const p3 = rig.b3.getWorldPosition(new THREE.Vector3());
                    const curDir2World = p3.sub(p2);
                    if (curDir2World.lengthSq() > 1e-8) {
                        const corr2 = new THREE.Quaternion().setFromUnitVectors(curDir2World.normalize(), targetDir2World);
                        const targetWorld2 = corr2.multiply(rig.b2.getWorldQuaternion(new THREE.Quaternion()));
                        const parentWorld2 = rig.b2.parent.getWorldQuaternion(new THREE.Quaternion());
                        let targetLocal2 = parentWorld2.invert().multiply(targetWorld2).normalize();
                        targetLocal2 = clampQuaternionSudut(targetLocal2, basePose[rig.b2.name], 1.35);
                        rig.b2.quaternion.slerp(targetLocal2, 0.45);
                        rig.b2.updateWorldMatrix(true, true);
                    }
                }
            } else if (basePose[rig.b2.name]) {
                const targetFlex2 = sudutTekukan(landmarks, t2);
                const prev2 = fingerFlexions.get(rig.b2.name) || 0;
                const smooth2 = prev2 + (targetFlex2 - prev2) * 0.45;
                fingerFlexions.set(rig.b2.name, smooth2);
                const rot2 = new THREE.Quaternion().setFromAxisAngle(rig.curlAxis2Local, smooth2);
                rig.b2.quaternion.copy(basePose[rig.b2.name]).multiply(rot2);
            }

            // Segmen 3 (DIP / Thumb IP)
            if (basePose[rig.b3.name]) {
                const targetFlex3 = sudutTekukan(landmarks, t3);
                const prev3 = fingerFlexions.get(rig.b3.name) || 0;
                const smooth3 = prev3 + (targetFlex3 - prev3) * 0.45;
                fingerFlexions.set(rig.b3.name, smooth3);
                const rot3 = new THREE.Quaternion().setFromAxisAngle(rig.curlAxis3Local, smooth3);
                rig.b3.quaternion.copy(basePose[rig.b3.name]).multiply(rot3);
            }
        });
    }
}

function gambarLandmarkMediaPipe(trackingResult) {
    if (!handVideo.videoWidth || !handVideo.videoHeight) return;
    if (handCanvas.width !== handVideo.videoWidth || handCanvas.height !== handVideo.videoHeight) {
        handCanvas.width = handVideo.videoWidth;
        handCanvas.height = handVideo.videoHeight;
    }

    const context = handCanvas.getContext('2d');
    context.clearRect(0, 0, handCanvas.width, handCanvas.height);

    if (!drawingUtils && mediaPipeVision?.DrawingUtils) {
        drawingUtils = new mediaPipeVision.DrawingUtils(context);
    }
    if (!drawingUtils) return;

    const scaleWidth = Math.max(2, handCanvas.width / 240);
    const poseConnections = mediaPipeVision.HolisticLandmarker?.POSE_CONNECTIONS
        || mediaPipeVision.PoseLandmarker?.POSE_CONNECTIONS;
    const handConnections = mediaPipeVision.HolisticLandmarker?.HAND_CONNECTIONS
        || mediaPipeVision.HandLandmarker?.HAND_CONNECTIONS;
    const faceContours = mediaPipeVision.HolisticLandmarker?.FACE_LANDMARKS_CONTOURS;

    if (trackingResult.faceLandmarks && faceContours) {
        drawingUtils.drawConnectors(trackingResult.faceLandmarks, faceContours, {
            color: 'rgba(255, 255, 255, 0.35)',
            lineWidth: 1
        });
    }

    if (trackingResult.poseLandmarks && poseConnections) {
        const pose = trackingResult.poseLandmarks;
        const visibleConnections = poseConnections.filter(({ start, end }) =>
            (pose[start]?.visibility ?? 0) >= 0.35 && (pose[end]?.visibility ?? 0) >= 0.35
        );
        drawingUtils.drawConnectors(pose, visibleConnections, {
            color: '#65b8ff',
            lineWidth: scaleWidth
        });
        drawingUtils.drawLandmarks(
            pose.filter((lm) => (lm.visibility ?? 0) >= 0.35),
            { color: '#65b8ff', fillColor: '#65b8ff', radius: scaleWidth * 1.1 }
        );
    }

    const handDrawings = [
        { landmarks: trackingResult.leftHandLandmarks, color: '#39d98a' },
        { landmarks: trackingResult.rightHandLandmarks, color: '#ffca3a' }
    ];
    handDrawings.forEach(({ landmarks, color }) => {
        if (!landmarks || !handConnections) return;
        drawingUtils.drawConnectors(landmarks, handConnections, {
            color,
            lineWidth: scaleWidth
        });
        drawingUtils.drawLandmarks(landmarks, {
            color,
            fillColor: color,
            radius: scaleWidth * 1.1
        });
    });
}

async function buatTaskDenganDelegate(factoryFn, modelAssetPath, extraOptions) {
    for (const delegate of ['GPU', 'CPU']) {
        try {
            const task = await factoryFn({
                baseOptions: { modelAssetPath, delegate },
                runningMode: 'VIDEO',
                ...extraOptions
            });
            return { task, delegate };
        } catch (err) {
            console.warn(`MediaPipe ${delegate} delegate gagal untuk ${modelAssetPath}:`, err);
        }
    }
    throw new Error(`Gagal memuat model MediaPipe: ${modelAssetPath}`);
}

async function inisialisasiFallbackPoseDanHand(vision) {
    const [poseRes, handRes] = await Promise.all([
        buatTaskDenganDelegate(
            (opts) => mediaPipeVision.PoseLandmarker.createFromOptions(vision, opts),
            POSE_MODEL_URL,
            {
                numPoses: 1,
                minPoseDetectionConfidence: 0.4,
                minPosePresenceConfidence: 0.4,
                minTrackingConfidence: 0.4
            }
        ),
        buatTaskDenganDelegate(
            (opts) => mediaPipeVision.HandLandmarker.createFromOptions(vision, opts),
            HAND_MODEL_URL,
            {
                numHands: 2,
                minHandDetectionConfidence: 0.4,
                minHandPresenceConfidence: 0.4,
                minTrackingConfidence: 0.4
            }
        )
    ]);
    poseLandmarker = poseRes.task;
    handLandmarker = handRes.task;
    activeMediaPipeMode = 'fallback';
    activeDelegateLabel = `Pose+Hand (${poseRes.delegate})`;
}

async function inisialisasiMediaPipe() {
    if (activeMediaPipeMode) return;

    mediaPipeVision = await import('@mediapipe/tasks-vision');
    const vision = await mediaPipeVision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

    try {
        const holisticRes = await buatTaskDenganDelegate(
            (opts) => mediaPipeVision.HolisticLandmarker.createFromOptions(vision, opts),
            HOLISTIC_MODEL_URL,
            {
                minFaceDetectionConfidence: 0.4,
                minFacePresenceConfidence: 0.4,
                minPoseDetectionConfidence: 0.4,
                minPosePresenceConfidence: 0.4,
                minHandLandmarksConfidence: 0.4
            }
        );
        holisticLandmarker = holisticRes.task;
        activeMediaPipeMode = 'holistic';
        activeDelegateLabel = `Holistic (${holisticRes.delegate})`;
    } catch (holisticError) {
        console.warn('HolisticLandmarker tidak tersedia, beralih ke PoseLandmarker + HandLandmarker:', holisticError);
        await inisialisasiFallbackPoseDanHand(vision);
    }
}

function ekstrakHasilFallback(poseResult, handResult) {
    const poseLandmarks = poseResult?.landmarks?.[0] || null;
    const poseWorldLandmarks = poseResult?.worldLandmarks?.[0] || null;

    let leftHandLandmarks = null;
    let leftHandWorldLandmarks = null;
    let rightHandLandmarks = null;
    let rightHandWorldLandmarks = null;

    const leftWrist = poseLandmarks?.[15];
    const rightWrist = poseLandmarks?.[16];

    (handResult?.worldLandmarks || []).forEach((worldLandmarks, handIndex) => {
        const landmarks = handResult.landmarks?.[handIndex];
        const category = handResult.handedness?.[handIndex]?.[0]?.categoryName?.toLowerCase();
        if (!landmarks || worldLandmarks.length < 21) return;

        const wrist = landmarks[0];
        const leftDistance = leftWrist ? Math.hypot(wrist.x - leftWrist.x, wrist.y - leftWrist.y) : Infinity;
        const rightDistance = rightWrist ? Math.hypot(wrist.x - rightWrist.x, wrist.y - rightWrist.y) : Infinity;
        const side = Number.isFinite(leftDistance) && Number.isFinite(rightDistance)
            ? (leftDistance <= rightDistance ? 'L' : 'R')
            : (category === 'left' ? 'R' : 'L');

        if (side === 'L' && !leftHandLandmarks) {
            leftHandLandmarks = landmarks;
            leftHandWorldLandmarks = worldLandmarks;
        } else if (side === 'R' && !rightHandLandmarks) {
            rightHandLandmarks = landmarks;
            rightHandWorldLandmarks = worldLandmarks;
        }
    });

    return {
        poseLandmarks,
        poseWorldLandmarks,
        leftHandLandmarks,
        leftHandWorldLandmarks,
        rightHandLandmarks,
        rightHandWorldLandmarks,
        faceLandmarks: null
    };
}

function deteksiFrameMediaPipe(timestamp) {
    if (activeMediaPipeMode === 'holistic' && holisticLandmarker) {
        const res = holisticLandmarker.detectForVideo(handVideo, timestamp);
        return {
            poseLandmarks: res.poseLandmarks?.[0] || null,
            poseWorldLandmarks: res.poseWorldLandmarks?.[0] || null,
            leftHandLandmarks: res.leftHandLandmarks?.[0] || null,
            leftHandWorldLandmarks: res.leftHandWorldLandmarks?.[0] || null,
            rightHandLandmarks: res.rightHandLandmarks?.[0] || null,
            rightHandWorldLandmarks: res.rightHandWorldLandmarks?.[0] || null,
            faceLandmarks: res.faceLandmarks?.[0] || null
        };
    }

    if (activeMediaPipeMode === 'fallback' && poseLandmarker && handLandmarker) {
        const poseResult = poseLandmarker.detectForVideo(handVideo, timestamp);
        const handResult = handLandmarker.detectForVideo(handVideo, timestamp);
        return ekstrakHasilFallback(poseResult, handResult);
    }

    return null;
}

function mirrorWorldLandmarks(landmarks) {
    if (!landmarks) return null;
    return landmarks.map((lm) => ({ ...lm, x: -lm.x }));
}

function siapkanPoseRetarget(trackingResult) {
    if (!chkMirrorTracking?.checked) return trackingResult;

    let poseWorld = mirrorWorldLandmarks(trackingResult.poseWorldLandmarks);
    if (poseWorld) {
        const swapPairs = [[7, 8], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24]];
        for (const [a, b] of swapPairs) {
            if (poseWorld[a] && poseWorld[b]) {
                const tmp = poseWorld[a];
                poseWorld[a] = poseWorld[b];
                poseWorld[b] = tmp;
            }
        }
    }

    return {
        ...trackingResult,
        poseWorldLandmarks: poseWorld,
        leftHandWorldLandmarks: mirrorWorldLandmarks(trackingResult.rightHandWorldLandmarks),
        rightHandWorldLandmarks: mirrorWorldLandmarks(trackingResult.leftHandWorldLandmarks)
    };
}

async function prosesFrameTangan() {
    if (!handTrackingActive) return;
    handFrameId = requestAnimationFrame(prosesFrameTangan);
    if (isSwitchingFallback) return;

    if (handVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        handStatus.innerText = 'Menunggu frame webcam...';
        return;
    }
    if (handVideo.currentTime === lastVideoTime) {
        if (performance.now() - lastVideoFrameAt > 2000) {
            handStatus.innerText = 'Webcam aktif tetapi frame tidak berubah. Periksa izin dan perangkat kamera.';
        }
        return;
    }

    lastVideoTime = handVideo.currentTime;
    lastVideoFrameAt = performance.now();
    try {
        const timestamp = Math.max(performance.now(), lastMediaPipeTimestamp + 1);
        lastMediaPipeTimestamp = timestamp;

        const trackingResult = deteksiFrameMediaPipe(timestamp);
        if (!trackingResult) return;

        gambarLandmarkMediaPipe(trackingResult);
        const retargetInput = siapkanPoseRetarget(trackingResult);
        const appliedSegments = aturPoseTubuh(retargetInput.poseWorldLandmarks);
        aturPoseDariTangan(retargetInput);
        sinkronkanSkeletonAvatar();

        const detectedHands = (trackingResult.leftHandLandmarks ? 1 : 0) + (trackingResult.rightHandLandmarks ? 1 : 0);
        const visiblePoints = trackingResult.poseLandmarks?.filter((lm) => (lm.visibility ?? 0) >= 0.35).length || 0;
        const faceBadge = trackingResult.faceLandmarks ? ', wajah aktif' : '';
        const message = appliedSegments > 0
            ? `[${activeDelegateLabel}] Terdeteksi: ${appliedSegments} segmen tubuh, ${detectedHands} tangan${faceBadge}.`
            : visiblePoints > 0 || detectedHands > 0
                ? `[${activeDelegateLabel}] Terdeteksi ${visiblePoints} titik tubuh & ${detectedHands} tangan; posisikan bahu hingga siku di kamera.`
                : `[${activeDelegateLabel}] Belum ada pose atau tangan terdeteksi. Pastikan tubuh atas terlihat jelas.`;
        if (handStatus.innerText !== message) handStatus.innerText = message;
    } catch (error) {
        if (activeMediaPipeMode === 'holistic' && activeDelegateLabel.includes('GPU')) {
            console.warn('Holistic GPU gagal saat inferensi, beralih ke CPU/fallback:', error);
            isSwitchingFallback = true;
            try {
                holisticLandmarker?.close();
                holisticLandmarker = null;
                activeMediaPipeMode = null;
                const vision = await mediaPipeVision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
                try {
                    holisticLandmarker = await mediaPipeVision.HolisticLandmarker.createFromOptions(vision, {
                        baseOptions: { modelAssetPath: HOLISTIC_MODEL_URL, delegate: 'CPU' },
                        runningMode: 'VIDEO',
                        minFaceDetectionConfidence: 0.4,
                        minFacePresenceConfidence: 0.4,
                        minPoseDetectionConfidence: 0.4,
                        minPosePresenceConfidence: 0.4,
                        minHandLandmarksConfidence: 0.4
                    });
                    activeMediaPipeMode = 'holistic';
                    activeDelegateLabel = 'Holistic (CPU)';
                } catch {
                    await inisialisasiFallbackPoseDanHand(vision);
                }
                return;
            } catch (fallbackErr) {
                console.error('Fallback CPU gagal:', fallbackErr);
            } finally {
                isSwitchingFallback = false;
            }
        }
        console.error('Gagal memproses frame MediaPipe:', error);
        handStatus.innerText = `Error pelacakan: ${error.message}`;
    }
}

function hentikanDeteksiTangan(message = 'Webcam nonaktif.') {
    handTrackingActive = false;
    if (handFrameId !== null) cancelAnimationFrame(handFrameId);
    handFrameId = null;
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    handVideo.srcObject = null;
    handPreview.hidden = true;
    if (drawingUtils) {
        drawingUtils.close();
        drawingUtils = null;
    }
    if (handCanvas.width && handCanvas.height) {
        handCanvas.getContext('2d')?.clearRect(0, 0, handCanvas.width, handCanvas.height);
    }
    handStatus.innerText = message;
    btnHandTracking.textContent = 'Mulai Pelacakan MediaPipe';
    dropdown.disabled = false;
    isSwitchingFallback = false;
    fingerFlexions.clear();
    for (const nama in daftarTulang) {
        if (basePose[nama]) daftarTulang[nama].quaternion.copy(basePose[nama]);
    }
    bodyRetargetData.forEach((retarget) => {
        retarget.smoothedDirection = null;
        retarget.smoothedElbowNormal = null;
    });
    sinkronkanSkeletonAvatar();
}

if (btnHandTracking) {
    btnHandTracking.addEventListener('click', async () => {
        if (handTrackingActive) {
            hentikanDeteksiTangan();
            return;
        }

        btnHandTracking.disabled = true;
        handStatus.innerText = 'Meminta akses kamera...';
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            handVideo.srcObject = cameraStream;
            await handVideo.play();
            handPreview.hidden = false;

            if (!activeMediaPipeMode) {
                handStatus.innerText = 'Memuat model MediaPipe Holistic...';
                await inisialisasiMediaPipe();
            }

            if (mixerAnimation) mixerAnimation.stopAllAction();
            transformControl.detach();
            dropdown.disabled = true;
            handTrackingActive = true;
            lastVideoTime = -1;
            lastVideoFrameAt = performance.now();
            btnHandTracking.textContent = 'Hentikan Pelacakan';
            handStatus.innerText = `Pelacakan ${activeDelegateLabel} aktif. Pastikan tubuh atas terlihat.`;
            handFrameId = requestAnimationFrame(prosesFrameTangan);
        } catch (error) {
            console.error('Gagal memulai MediaPipe:', error);
            const message = error.name === 'NotAllowedError'
                ? 'Akses kamera ditolak. Izinkan kamera di browser.'
                : 'MediaPipe gagal dimulai. Periksa kamera dan koneksi internet.';
            hentikanDeteksiTangan(message);
        } finally {
            btnHandTracking.disabled = false;
        }
    });
}

window.addEventListener('beforeunload', () => {
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    if (holisticLandmarker) holisticLandmarker.close();
    if (handLandmarker) handLandmarker.close();
    if (poseLandmarker) poseLandmarker.close();
    if (drawingUtils) drawingUtils.close();
});

// 7. Event Listener: Klik Manekin
window.addEventListener('click', (event) => {
    if (!dropdown || handTrackingActive || event.target.tagName === 'SELECT' || event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT' || transformControl.dragging) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (avatarModel) {
        const intersects = raycaster.intersectObjects(avatarModel.children, true);
        if (intersects.length > 0) {
            const bone = cariTulangDariHit(intersects[0]);

            if (bone && daftarTulang[bone.name]) {
                console.log("🎯 Berhasil Klik Sendi:", bone.name);
                pilihSendiAktif(bone.name);
            }
        }
    }
});

if (dropdown) {
    dropdown.addEventListener('change', (event) => pilihSendiAktif(event.target.value));
}

// ========================================================
// LOGIKA UTAMA: PERANGKAI KALIMAT, CMS & EKSPOR/IMPOR FILE
// ========================================================

// Fungsi Universal: Memutar Timeline Keyframe pada Model Avatar
function putarTimeline(dataTimeline, durasi, namaKlip = 'Gerakan_BISINDO') {
    if (!dataTimeline || dataTimeline.length < 2) return;

    transformControl.detach(); // Sembunyikan Gizmo

    // Kembalikan ke pose awal default sebelum mulai
    for (const nama in daftarTulang) {
        daftarTulang[nama].quaternion.copy(basePose[nama]);
    }
    if (avatarModel) {
        avatarModel.updateMatrixWorld(true);
        avatarModel.traverse((obj) => {
            if (obj.isSkinnedMesh && obj.skeleton) obj.skeleton.update();
        });
    }

    const tracks = [];
    for (const namaTulang in daftarTulang) {
        const times = [];
        const values = [];

        dataTimeline.forEach((kf) => {
            times.push(kf.waktu);
            const q = kf.rotasi[namaTulang] || basePose[namaTulang];
            values.push(q.x, q.y, q.z, q.w);
        });

        const trackName = `${namaTulang}.quaternion`;
        tracks.push(new THREE.QuaternionKeyframeTrack(trackName, times, values));
    }

    const clip = new THREE.AnimationClip(namaKlip, durasi, tracks);
    mixerAnimation.stopAllAction();
    const action = mixerAnimation.clipAction(clip);
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();
}

// 1. Inisialisasi Navigasi Tab
const tabBtns = document.querySelectorAll('.tab-btn');
const tabKontens = document.querySelectorAll('.tab-konten');
tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('aktif'));
        tabKontens.forEach((k) => k.classList.remove('aktif'));
        btn.classList.add('aktif');
        const targetId = btn.getAttribute('data-tab');
        const targetTab = document.getElementById(targetId);
        if (targetTab) targetTab.classList.add('aktif');
    });
});

// 2. Inisialisasi Chips Kata Cepat dari Kamus
const daftarChips = document.getElementById('daftarChips');
const inputKalimat = document.getElementById('inputKalimat');
if (daftarChips && inputKalimat) {
    const listKata = ambilDaftarKata();
    listKata.forEach((item) => {
        const chip = document.createElement('span');
        chip.className = 'chip-kata';
        chip.innerText = item.label;
        chip.title = `${item.deskripsi} (${item.durasi}s)`;
        chip.addEventListener('click', () => {
            const val = inputKalimat.value.trim();
            if (!val) {
                inputKalimat.value = item.id.replace('_', ' ');
            } else {
                inputKalimat.value = `${val} ${item.id.replace('_', ' ')}`;
            }
            inputKalimat.focus();
        });
        daftarChips.appendChild(chip);
    });
}

// 3. Tombol Terjemahkan & Mainkan Kalimat (Text-to-Sign)
const btnPlayKalimat = document.getElementById('btnPlayKalimat');
const btnStopKalimat = document.getElementById('btnStopKalimat');

if (btnPlayKalimat) {
    btnPlayKalimat.addEventListener('click', () => {
        if (!avatarModel) {
            alert('Model avatar sedang dimuat, harap tunggu.');
            return;
        }

        const teks = inputKalimat ? inputKalimat.value : '';
        if (!teks.trim()) {
            alert('Silakan ketik kalimat atau klik kata dari pilihan cepat.');
            return;
        }

        const hasil = susunAnimasiKalimat(teks, basePose, daftarTulang, cariBoneRig, cariTulangJari);
        if (hasil.urutanKata.length === 0) {
            if (logStatus) {
                logStatus.innerText = `⚠️ Kata tidak ditemukan di kamus. Coba: ${ambilDaftarKata().map((k) => k.label).join(', ')}`;
            }
            return;
        }

        // Simpan hasil ke timelineData agar dapat diekspor atau diputar ulang
        timelineData = hasil.timelineData;
        totalWaktu = hasil.durasiTotal;

        let pesan = `▶️ Memainkan: "${hasil.urutanKata.join(' ➔ ')}" (${totalWaktu.toFixed(1)}s)`;
        if (hasil.kataHilang.length > 0) {
            pesan += ` | Kata belum di kamus: [${hasil.kataHilang.join(', ')}]`;
        }
        if (logStatus) logStatus.innerText = pesan;

        putarTimeline(timelineData, totalWaktu, 'Kalimat_BISINDO');
        if (btnStopKalimat) btnStopKalimat.style.display = 'block';
    });
}

if (btnStopKalimat) {
    btnStopKalimat.addEventListener('click', () => {
        if (mixerAnimation) mixerAnimation.stopAllAction();
        for (const nama in daftarTulang) {
            daftarTulang[nama].quaternion.copy(basePose[nama]);
        }
        if (avatarModel) {
            avatarModel.updateMatrixWorld(true);
            avatarModel.traverse((obj) => {
                if (obj.isSkinnedMesh && obj.skeleton) obj.skeleton.update();
            });
        }
        btnStopKalimat.style.display = 'none';
        if (logStatus) logStatus.innerText = 'Gerakan dihentikan. Posisi manekin netral.';
    });
}

// 4. Tombol Rekam Keyframe Manual (CMS)
const btnRecord = document.getElementById('btnRecord');
if (btnRecord) {
    btnRecord.addEventListener('click', () => {
        if (!avatarModel) return;

        const inputDetik = parseFloat(document.getElementById('inputDetik').value) || 1.0;

        if (timelineData.length === 0) {
            const initialSnapshot = {};
            for (const nama in daftarTulang) {
                initialSnapshot[nama] = basePose[nama].clone();
            }
            timelineData.push({ waktu: 0, rotasi: initialSnapshot });
        }

        totalWaktu += inputDetik;

        const snapshotTulang = {};
        for (const nama in daftarTulang) {
            snapshotTulang[nama] = daftarTulang[nama].quaternion.clone();
        }

        timelineData.push({
            waktu: parseFloat(totalWaktu.toFixed(2)),
            rotasi: snapshotTulang
        });

        if (logStatus) {
            logStatus.innerText = `Tersimpan ${timelineData.length - 1} pose gerakan (Total durasi: ${totalWaktu.toFixed(1)} detik)`;
        }
    });
}

// 5. Tombol Putar Timeline Manual
const btnPlay = document.getElementById('btnPlay');
if (btnPlay) {
    btnPlay.addEventListener('click', () => {
        if (timelineData.length < 2) {
            if (logStatus) logStatus.innerText = '⚠️ Rekaman kosong! Rekam beberapa gerakan dulu.';
            return;
        }

        if (logStatus) logStatus.innerText = '▶️ Memutar rekaman timeline...';
        putarTimeline(timelineData, totalWaktu, 'Gerakan_Model_CMS');
    });
}

// 6. Tombol Hapus Semua Rekaman
const btnClear = document.getElementById('btnClear');
if (btnClear) {
    btnClear.addEventListener('click', () => {
        timelineData = [];
        totalWaktu = 0;
        if (mixerAnimation) mixerAnimation.stopAllAction();

        for (const nama in daftarTulang) {
            daftarTulang[nama].quaternion.copy(basePose[nama]);
        }
        if (avatarModel) {
            avatarModel.updateMatrixWorld(true);
            avatarModel.traverse((obj) => {
                if (obj.isSkinnedMesh && obj.skeleton) obj.skeleton.update();
            });
        }

        if (logStatus) logStatus.innerText = 'Rekaman dihapus. Posisi manekin di-reset.';
    });
}

// 7. Tombol Ekspor & Impor File JSON
const btnExportJson = document.getElementById('btnExportJson');
const btnImportJson = document.getElementById('btnImportJson');
const inputFileJson = document.getElementById('inputFileJson');

if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
        if (timelineData.length < 2) {
            alert('Belum ada rekaman animasi untuk disimpan! Silakan susun kalimat atau rekam gerakan manual terlebih dahulu.');
            return;
        }

        const dataEkspor = {
            tipe: 'BISINDO_ANIMATION_RECORDING',
            versi: '1.0',
            dibuatPada: new Date().toISOString(),
            durasiTotal: totalWaktu,
            jumlahKeyframes: timelineData.length,
            keyframes: timelineData.map((kf) => ({
                waktu: kf.waktu,
                rotasi: Object.fromEntries(
                    Object.entries(kf.rotasi).map(([nama, q]) => [
                        nama,
                        { x: parseFloat(q.x.toFixed(5)), y: parseFloat(q.y.toFixed(5)), z: parseFloat(q.z.toFixed(5)), w: parseFloat(q.w.toFixed(5)) }
                    ])
                )
            }))
        };

        const jsonStr = JSON.stringify(dataEkspor, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const capWaktu = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = `gerakan_bisindo_${capWaktu}.json`;
        a.click();
        URL.revokeObjectURL(url);

        if (logStatus) logStatus.innerText = `💾 File rekaman berhasil diunduh (${timelineData.length} keyframe).`;
    });
}

if (btnImportJson && inputFileJson) {
    btnImportJson.addEventListener('click', () => inputFileJson.click());
    inputFileJson.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.keyframes || !Array.isArray(data.keyframes) || data.keyframes.length === 0) {
                    throw new Error('Format file JSON rekaman tidak valid.');
                }

                timelineData = data.keyframes.map((kf) => {
                    const rotasiMap = {};
                    for (const nama in kf.rotasi) {
                        const q = kf.rotasi[nama];
                        rotasiMap[nama] = new THREE.Quaternion(q.x, q.y, q.z, q.w);
                    }
                    return { waktu: kf.waktu, rotasi: rotasiMap };
                });

                totalWaktu = data.durasiTotal || timelineData[timelineData.length - 1].waktu;
                if (logStatus) {
                    logStatus.innerText = `📂 File '${file.name}' berhasil dimuat (${timelineData.length} keyframe, ${totalWaktu.toFixed(1)}s). Memutar...`;
                }
                putarTimeline(timelineData, totalWaktu, 'Imported_File');
            } catch (err) {
                console.error(err);
                alert('Gagal membaca file JSON: ' + err.message);
            } finally {
                inputFileJson.value = '';
            }
        };
        reader.readAsText(file);
    });
}


// 8. Loop Animasi Render (Menggunakan Clock Internal)
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    orbit.update();
    
    const delta = clock.getDelta();
    if (mixerAnimation) mixerAnimation.update(delta);
    
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
