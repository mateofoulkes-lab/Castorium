import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const PATHS = {
  yale: '../models/yale.glb',
  castor: '../models/castorv2.glb',
  driving: '../anim/Driving.fbx'
};

const DEFAULT_TRANSFORM = {
  position: [0, 0, 0],
  rotationDegrees: [0, 0, 0],
  scale: [1, 1, 1]
};

const DEFAULT_LOAD_TRANSFORM = {
  position: [0, 0.65, 1.86],
  rotationDegrees: [0, 0, 0],
  scale: [1, 1, 1]
};

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1412);
scene.fog = new THREE.Fog(0x0d1412, 18, 70);

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 500);
camera.position.set(6, 4, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 1, 0);

const transform = new TransformControls(camera, renderer.domElement);
transform.setSize(0.78);
transform.addEventListener('dragging-changed', event => { orbit.enabled = !event.value; });
transform.addEventListener('objectChange', () => { syncInputs(); persist(); });
scene.add(transform.getHelper());

scene.add(new THREE.HemisphereLight(0xddeee6, 0x28322e, 2.3));
const keyLight = new THREE.DirectionalLight(0xfff1d8, 3.2);
keyLight.position.set(5, 9, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
scene.add(keyLight);

const grid = new THREE.GridHelper(30, 60, 0x55645d, 0x26322d);
grid.material.opacity = 0.55;
grid.material.transparent = true;
scene.add(grid);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.ShadowMaterial({ opacity: 0.22 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.002;
ground.receiveShadow = true;
scene.add(ground);

const yalePivot = new THREE.Group();
const castorPivot = new THREE.Group();
const loadPivot = new THREE.Group();
yalePivot.name = 'YalePivot';
castorPivot.name = 'CastorDriverPivot';
loadPivot.name = 'ForkLoadPivot';
scene.add(yalePivot, castorPivot, loadPivot);
let activeTarget = 'castor';
transform.attach(castorPivot);

const previewLogGeometry = new THREE.CylinderGeometry(.26, .29, 1.25, 8, 1, false);
previewLogGeometry.rotateZ(Math.PI / 2);
const previewLogMaterial = new THREE.MeshStandardMaterial({ color: 0xa85d31, roughness: .88 });
[
  [-.24, 0, 0],
  [.24, 0, 0],
  [0, .34, 0]
].forEach(([x,y,z], index) => {
  const log = new THREE.Mesh(previewLogGeometry, previewLogMaterial.clone());
  log.position.set(x, y, z);
  log.rotation.y = index === 2 ? .08 : 0;
  log.castShadow = true;
  log.receiveShadow = true;
  loadPivot.add(log);
});
loadPivot.position.fromArray(DEFAULT_LOAD_TRANSFORM.position);

let castorModel = null;
let mixer = null;
let action = null;
let activeClip = null;
let playing = false;
let skeletonHelper = null;
let scrubbing = false;
const clock = new THREE.Clock();

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

function prepareModel(model, { feetCenter = false } = {}) {
  model.traverse(child => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.material) child.material.side = THREE.DoubleSide;
  });
  if (feetCenter) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
  }
  return model;
}

function loadGLTF(path) {
  return new Promise((resolve, reject) => gltfLoader.load(path, resolve, undefined, reject));
}

function loadFBX(path) {
  return new Promise((resolve, reject) => fbxLoader.load(path, resolve, undefined, reject));
}

function setStatus(text, kind = 'loading') {
  const el = document.querySelector('#assetStatus');
  el.textContent = text;
  el.className = `status ${kind}`;
}

async function loadScene() {
  try {
    const [yaleGLTF, castorGLTF] = await Promise.all([loadGLTF(PATHS.yale), loadGLTF(PATHS.castor)]);
    const yaleModel = prepareModel(yaleGLTF.scene, { feetCenter: true });
    castorModel = prepareModel(castorGLTF.scene, { feetCenter: true });
    yalePivot.add(yaleModel);
    castorPivot.add(castorModel);
    if (!restore()) setSuggestedStart();
    syncInputs();
    frameScene();
    setStatus('Modelos listos', 'ok');

    if (castorGLTF.animations.length) {
      applyClip(castorModel, castorGLTF.animations[0], 'Animación incluida en GLB');
    }

    try {
      const animationSource = await loadFBX(PATHS.driving);
      applyAnimationSource(animationSource, 'Driving.fbx del repositorio');
    } catch (error) {
      document.querySelector('#animationMessage').textContent = 'Driving.fbx no está disponible en el repositorio. Cargalo con el botón de arriba.';
      setStatus('Falta Driving.fbx', 'warn');
    }
  } catch (error) {
    console.error(error);
    setStatus('No se pudieron cargar los GLB', 'error');
    document.querySelector('#animationMessage').textContent = 'Abrí esta carpeta mediante un servidor HTTP desde la raíz del repositorio.';
  }
}

function applyAnimationSource(source, label) {
  const sourceClip = source.animations?.[0];
  if (!sourceClip || !castorModel) throw new Error('El FBX no contiene una animación utilizable.');
  source.updateMatrixWorld(true);
  castorModel.updateMatrixWorld(true);

  const targetNames = new Set();
  castorModel.traverse(node => targetNames.add(node.name));
  const matchingTracks = sourceClip.tracks.filter(track => {
    try { return targetNames.has(THREE.PropertyBinding.parseTrackName(track.name).nodeName); }
    catch { return false; }
  }).length;

  let clip = sourceClip;
  let method = 'enlace directo';
  if (matchingTracks === 0) {
    try {
      clip = SkeletonUtils.retargetClip(castorModel, source, sourceClip, { fps: 30 });
      method = 'retarget automático';
    } catch (error) {
      console.warn('No se pudo retargetear; se probará el clip original.', error);
    }
  }
  applyClip(castorModel, clip, `${label} · ${method}`);
  setStatus('Modelos + animación listos', 'ok');
  document.querySelector('#animationMessage').textContent = `${label} aplicada mediante ${method}.`;
}

function applyClip(root, clip, label) {
  if (mixer) mixer.stopAllAction();
  mixer = new THREE.AnimationMixer(root);
  activeClip = clip;
  action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
  playing = true;
  document.querySelector('#playPause').disabled = false;
  document.querySelector('#animationTime').disabled = false;
  document.querySelector('#animationTime').max = String(clip.duration || 1);
  document.querySelector('#duration').textContent = `${(clip.duration || 0).toFixed(2)} s`;
  document.querySelector('#clipName').textContent = clip.name || 'driving';
  document.querySelector('#animationMessage').textContent = label;
  updatePlayButton();
  persist();
}

function frameScene() {
  const box = new THREE.Box3();
  if (yalePivot.children.length) box.expandByObject(yalePivot);
  if (castorPivot.children.length) box.expandByObject(castorPivot);
  if (loadPivot.children.length) box.expandByObject(loadPivot);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.45;
  camera.position.copy(center).add(new THREE.Vector3(distance * .75, distance * .5, distance));
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  orbit.target.copy(center);
  orbit.update();
}

function setSuggestedStart() {
  const yaleBox = new THREE.Box3().setFromObject(yalePivot);
  const castorBox = new THREE.Box3().setFromObject(castorPivot);
  const yaleSize = yaleBox.getSize(new THREE.Vector3());
  const castorSize = castorBox.getSize(new THREE.Vector3());
  if (!yaleSize.y || !castorSize.y) return;

  const suggestedScale = yaleSize.y * 0.52 / castorSize.y;
  const visibleCastorWidth = castorSize.x * suggestedScale;
  DEFAULT_TRANSFORM.scale = [suggestedScale, suggestedScale, suggestedScale];
  DEFAULT_TRANSFORM.position = [yaleBox.max.x + visibleCastorWidth * 0.72, 0, 0];
  castorPivot.scale.fromArray(DEFAULT_TRANSFORM.scale);
  castorPivot.position.fromArray(DEFAULT_TRANSFORM.position);
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function transformConfig(pivot) {
  return {
    position: pivot.position.toArray().map(value => round(value)),
    rotationDegrees: [pivot.rotation.x, pivot.rotation.y, pivot.rotation.z].map(value => round(THREE.MathUtils.radToDeg(value), 3)),
    scale: pivot.scale.toArray().map(value => round(value))
  };
}

function currentConfig() {
  return {
    format: 'CASTORIUM_VEHICLE_FIT_V2',
    vehicleModel: 'models/yale.glb',
    driverModel: 'models/castorv2.glb',
    animation: 'anim/Driving.fbx',
    pivotNormalization: 'feet-center',
    driver: transformConfig(castorPivot),
    loadPoint: transformConfig(loadPivot),
    loadPreview: {
      geometry: 'cargoLogGeometry',
      count: 3,
      note: 'loadPoint es local al vehicle de la Yale y debe aplicarse al cargoGroup'
    },
    animationSpeed: round(Number(document.querySelector('#animationSpeed').value) || 1, 3),
    loop: true
  };
}

function updateOutput() {
  const config = currentConfig();
  document.querySelector('#outputText').value = `${config.format}\n${JSON.stringify(config, null, 2)}`;
}

function activePivot() { return activeTarget === 'load' ? loadPivot : castorPivot; }

function setActiveTarget(target) {
  activeTarget = target;
  transform.attach(activePivot());
  document.querySelectorAll('[data-target]').forEach(button => button.classList.toggle('active', button.dataset.target === target));
  document.querySelector('#targetLabel').textContent = target === 'load' ? 'Punto de carga / troncos' : 'Castor conductor';
  syncInputs();
}

function syncInputs() {
  const pivot = activePivot();
  const vectors = {
    position: pivot.position,
    rotation: {
      x: THREE.MathUtils.radToDeg(pivot.rotation.x),
      y: THREE.MathUtils.radToDeg(pivot.rotation.y),
      z: THREE.MathUtils.radToDeg(pivot.rotation.z)
    },
    scale: pivot.scale
  };
  document.querySelectorAll('[data-vector]').forEach(group => {
    const vector = vectors[group.dataset.vector];
    group.querySelectorAll('[data-axis]').forEach(input => { input.value = round(vector[input.dataset.axis], 4); });
  });
  updateOutput();
}

function applyInput(group, axis, value) {
  if (!Number.isFinite(value)) return;
  const pivot = activePivot();
  if (group === 'position') pivot.position[axis] = value;
  if (group === 'rotation') pivot.rotation[axis] = THREE.MathUtils.degToRad(value);
  if (group === 'scale') {
    const safeValue = Math.max(0.001, value);
    if (document.querySelector('#lockScale').checked) pivot.scale.setScalar(safeValue);
    else pivot.scale[axis] = safeValue;
  }
  pivot.updateMatrixWorld(true);
  syncInputs();
  persist();
}

function persist() {
  localStorage.setItem('castorium-driver-fit-v1', JSON.stringify(currentConfig()));
  updateOutput();
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem('castorium-driver-fit-v1'));
    if (!saved) return false;
    const driver = saved.driver || saved;
    const load = saved.loadPoint || DEFAULT_LOAD_TRANSFORM;
    castorPivot.position.fromArray(driver.position || DEFAULT_TRANSFORM.position);
    castorPivot.rotation.set(...(driver.rotationDegrees || DEFAULT_TRANSFORM.rotationDegrees).map(THREE.MathUtils.degToRad));
    castorPivot.scale.fromArray(driver.scale || DEFAULT_TRANSFORM.scale);
    loadPivot.position.fromArray(load.position || DEFAULT_LOAD_TRANSFORM.position);
    loadPivot.rotation.set(...(load.rotationDegrees || DEFAULT_LOAD_TRANSFORM.rotationDegrees).map(THREE.MathUtils.degToRad));
    loadPivot.scale.fromArray(load.scale || DEFAULT_LOAD_TRANSFORM.scale);
    if (saved.animationSpeed) document.querySelector('#animationSpeed').value = saved.animationSpeed;
    return true;
  } catch (error) {
    console.warn('No se pudo restaurar el ajuste anterior.', error);
    return false;
  }
}

function resetTransform() {
  const pivot = activePivot();
  const defaults = activeTarget === 'load' ? DEFAULT_LOAD_TRANSFORM : DEFAULT_TRANSFORM;
  pivot.position.fromArray(defaults.position);
  pivot.rotation.set(...defaults.rotationDegrees.map(THREE.MathUtils.degToRad));
  pivot.scale.fromArray(defaults.scale);
  syncInputs();
  persist();
  frameScene();
}

function updatePlayButton() {
  document.querySelector('#playPause').textContent = playing ? '❚❚ Pausar' : '▶ Reproducir';
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  transform.setMode(button.dataset.mode);
  document.querySelectorAll('[data-mode]').forEach(item => item.classList.toggle('active', item === button));
}));

document.querySelectorAll('[data-target]').forEach(button => button.addEventListener('click', () => setActiveTarget(button.dataset.target)));

document.querySelectorAll('[data-vector]').forEach(group => {
  group.querySelectorAll('[data-axis]').forEach(input => input.addEventListener('change', () => applyInput(group.dataset.vector, input.dataset.axis, Number(input.value))));
});

document.querySelector('#animationFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  setStatus('Cargando FBX local…', 'loading');
  const url = URL.createObjectURL(file);
  try {
    const source = await loadFBX(url);
    applyAnimationSource(source, file.name);
  } catch (error) {
    console.error(error);
    setStatus('FBX incompatible', 'error');
    document.querySelector('#animationMessage').textContent = 'El archivo no contiene un clip FBX válido o su esqueleto no es compatible.';
  } finally { URL.revokeObjectURL(url); }
});

document.querySelector('#playPause').addEventListener('click', () => {
  if (!action) return;
  playing = !playing;
  action.paused = !playing;
  updatePlayButton();
});

document.querySelector('#animationSpeed').addEventListener('input', event => {
  if (mixer) mixer.timeScale = Math.max(0.05, Number(event.target.value) || 1);
  persist();
});

const timeline = document.querySelector('#animationTime');
timeline.addEventListener('pointerdown', () => { scrubbing = true; });
window.addEventListener('pointerup', () => { scrubbing = false; });
timeline.addEventListener('input', event => {
  if (!mixer || !activeClip) return;
  mixer.setTime(Number(event.target.value));
});

document.querySelector('#resetTransform').addEventListener('click', resetTransform);
document.querySelector('#focusAll').addEventListener('click', frameScene);
document.querySelector('#toggleGrid').addEventListener('click', event => {
  grid.visible = !grid.visible;
  ground.visible = grid.visible;
  event.currentTarget.classList.toggle('active', grid.visible);
});
document.querySelector('#toggleSkeleton').addEventListener('click', event => {
  if (!castorModel) return;
  if (!skeletonHelper) {
    skeletonHelper = new THREE.SkeletonHelper(castorModel);
    skeletonHelper.material.depthTest = false;
    skeletonHelper.renderOrder = 10;
    scene.add(skeletonHelper);
  }
  skeletonHelper.visible = !skeletonHelper.visible;
  event.currentTarget.classList.toggle('active', skeletonHelper.visible);
});

document.querySelector('#copyOutput').addEventListener('click', async event => {
  await navigator.clipboard.writeText(document.querySelector('#outputText').value);
  const previous = event.currentTarget.textContent;
  event.currentTarget.textContent = '✓ Copiado';
  setTimeout(() => { event.currentTarget.textContent = previous; }, 1300);
});

window.addEventListener('keydown', event => {
  if (event.target.matches('input, textarea')) return;
  const modeByKey = { g: 'translate', r: 'rotate', s: 'scale' };
  const mode = modeByKey[event.key.toLowerCase()];
  if (mode) document.querySelector(`[data-mode="${mode}"]`).click();
  if (event.key.toLowerCase() === 'f') frameScene();
  if (event.code === 'Space') { event.preventDefault(); document.querySelector('#playPause').click(); }
});

function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(viewport);

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (mixer && playing) mixer.update(delta);
  if (mixer && activeClip && !scrubbing) {
    const current = mixer.time % activeClip.duration;
    timeline.value = String(current);
    document.querySelector('#currentTime').textContent = `${current.toFixed(2)} s`;
  }
  orbit.update();
  renderer.render(scene, camera);
}

setActiveTarget('castor');
resize();
loadScene();
animate();

