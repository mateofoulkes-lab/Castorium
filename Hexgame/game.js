import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const $ = selector => document.querySelector(selector);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const rad = THREE.MathUtils.degToRad;
const TAU = Math.PI * 2;
const SAVE_KEY = 'castorium-fork-forest-v1';
const HEX_RADIUS = 15;
const TILE_CONTENT_SPREAD = 3;
const PLAYER_VISUAL_SCALE = .5;
const TILE_Y = .34;
const PATHS = {
  yale: '../models/yale.glb',
  castor: '../models/castorv2.glb',
  driving: '../anim/Driving.fbx'
};
const PROP_PATHS = {
  tallTree: './assets/tree-tall.glb',
  roundTree: './assets/tree-round.glb',
  rock: './assets/rock.glb',
  bush: './assets/bush.glb',
  reeds: './assets/reeds.glb',
  cloud: './assets/cloud.glb'
};

const DRIVER_FIT = {
  position: [0, 1.5912, -2.0504],
  rotationDegrees: [-89.505, -1.143, 4.341],
  scale: [30, 30, 30]
};

const WOOD_TYPES = {
  pine:{ id:'pine', name:'Pino', short:'PIN', icon:'🌲' },
  birch:{ id:'birch', name:'Abedul', short:'ABE', icon:'◻' },
  hardwood:{ id:'hardwood', name:'Madera dura', short:'DUR', icon:'◆' },
  ancient:{ id:'ancient', name:'Madera ancestral', short:'ANT', icon:'✦' }
};

const BIOMES = [
  { id:'pine', name:'Pinar Miel', woodType:'pine', color:0x70bd78, edge:0x327253, leaf:0x3f9a65, trunk:0x96542e, value:4, regrow:16, tree:'tallTree', icon:'🌲' },
  { id:'birch', name:'Claro de Abedules', woodType:'birch', color:0xa9d786, edge:0x5b8f60, leaf:0x8bc66d, trunk:0xe8dfc0, value:6, regrow:18, tree:'roundTree', icon:'🌳' },
  { id:'berry', name:'Arboleda Baya', woodType:'hardwood', color:0xc790bd, edge:0x78537f, leaf:0xa44e83, trunk:0x80503b, value:9, regrow:22, tree:'roundTree', icon:'🍒' },
  { id:'marsh', name:'Juncal Turquesa', woodType:'hardwood', color:0x63c2aa, edge:0x267b73, leaf:0x3c9b72, trunk:0x7e5c36, value:12, regrow:25, tree:'tallTree', icon:'🌿' },
  { id:'amber', name:'Bosque Ámbar', woodType:'ancient', color:0xe3a65e, edge:0x9a5d3f, leaf:0xd27c45, trunk:0x6f4934, value:17, regrow:29, tree:'roundTree', icon:'🍁' },
  { id:'moon', name:'Sauces Lunares', woodType:'ancient', color:0x8e91cf, edge:0x55588f, leaf:0x8175ca, trunk:0xb9b5c9, value:24, regrow:34, tree:'tallTree', icon:'✨' }
];

const UPGRADE_DEFS = [
  { id:'capacity', icon:'╫', name:'Horquillas anchas', text:'Un tronco extra por viaje.', base:22, max:8 },
  { id:'speed', icon:'↯', name:'Motor alegre', text:'+16% de velocidad máxima.', base:26, max:9 },
  { id:'value', icon:'✦', name:'Corte preciso', text:'+25% de madera por entrega.', base:30, max:10, requiresWood:'birch' },
  { id:'magnet', icon:'∩', name:'Imán de corteza', text:'Los troncos vuelan hacia las horquillas.', base:34, max:7, requiresWood:'birch' },
  { id:'regrow', icon:'♧', name:'Lluvia paciente', text:'El bosque vuelve 12% más rápido.', base:38, max:7, requiresWood:'hardwood' },
  { id:'golden', icon:'✺', name:'Anillos dorados', text:'+4% de árboles dorados.', base:48, max:6, requiresWood:'ancient' },
  { id:'combo', icon:'×', name:'Racha larga', text:'+1.5 s para conservar el combo.', base:44, max:6 },
  { id:'auto', icon:'A', name:'Capataz Castor', text:'Desbloquea el piloto automático.', base:65, max:1, requiresWood:'hardwood' },
  { id:'mill', icon:'⚙', name:'Sierra gemela', text:'+12% de duplicar una entrega.', base:58, max:7, requiresWood:'hardwood' },
  { id:'power', icon:'◆', name:'Miel concentrada', text:'Los power-ups duran 20% más.', base:55, max:6, requiresWood:'ancient' },
  { id:'fleet', icon:'F', name:'Compañero de turno', text:'Suma un autoelevador ayudante.', base:115, max:4, requiresWood:'ancient' },
  { id:'offline', icon:'☾', name:'Turno nocturno', text:'+35% de producción al volver.', base:70, max:6, requiresWood:'birch' }
];

const MISSIONS = [
  { title:'La primera carga', text:'Llevá 3 troncos al aserradero.', type:'deliver', target:3, reward:12 },
  { title:'Dique con futuro', text:'Juntá 45 de madera.', type:'earn', target:45, reward:2, stars:true },
  { title:'Más allá del borde', text:'Descubrí un hexágono vecino.', type:'expand', target:1, reward:18 },
  { title:'Sin soltar el volante', text:'Alcanzá una racha x4.', type:'combo', target:4, reward:3, stars:true },
  { title:'Ingeniería castor', text:'Comprá 3 mejoras.', type:'upgrade', target:3, reward:25 },
  { title:'Pequeño imperio', text:'Tené 5 territorios activos.', type:'tiles', target:5, reward:5, stars:true },
  { title:'Carga seria', text:'Entregá 30 troncos en total.', type:'deliver', target:30, reward:60 },
  { title:'Bosque que canta', text:'Alcanzá rango 6.', type:'level', target:6, reward:8, stars:true }
];

const defaultState = () => ({
  wood:0, woodByType:{pine:0,birch:0,hardwood:0,ancient:0}, stars:0, level:1, xp:0, shift:1, shiftLeft:62,
  cargo:[], delivered:0, earned:0, expanded:0, upgradesBought:0,
  missionIndex:0, missionBase:0, unlocked:['0,0'],
  upgrades:Object.fromEntries(UPGRADE_DEFS.map(u => [u.id, 0])),
  player:{ x:0, z:1.5, yaw:0 }, auto:false, sound:true,
  lastSeen:Date.now()
});
let state = defaultState();
let pendingSave = null;
try { pendingSave = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa6ded8);
scene.fog = new THREE.FogExp2(0xa6ded8, .004);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 700);
camera.position.set(15, 17, 20);
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#game').appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .22, .35, .95);
composer.addPass(bloomPass);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.enablePan = false;
orbit.minDistance = 11;
orbit.maxDistance = 190;
orbit.minPolarAngle = rad(32);
orbit.maxPolarAngle = rad(67);
orbit.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xe9fff5, 0x426650, 2.2));
const sun = new THREE.DirectionalLight(0xfff2cb, 4.4);
sun.position.set(-12, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -150; sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150; sun.shadow.camera.bottom = -150;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
sun.shadow.bias = -.00015;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9ae7d3, 1.2);
fill.position.set(14, 8, -12); scene.add(fill);

const waterUniforms = { uTime:{value:0}, uSun:{value:new THREE.Vector3(-1,.8,.4)} };
const water = new THREE.Mesh(new THREE.PlaneGeometry(1000,1000,80,80), new THREE.ShaderMaterial({
  uniforms:waterUniforms, transparent:true,
  vertexShader:`uniform float uTime; varying float vWave; varying vec2 vUv; void main(){vUv=uv;vec3 p=position;float w=sin(p.x*.23+uTime*.7)*.11+cos(p.y*.19-uTime*.55)*.09;p.z+=w;vWave=w;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader:`uniform float uTime; varying float vWave; varying vec2 vUv; void main(){float bands=.5+.5*sin((vUv.x+vUv.y)*95.+uTime*.7);vec3 deep=vec3(.20,.57,.62);vec3 light=vec3(.45,.82,.78);vec3 c=mix(deep,light,.45+vWave*1.9);c+=bands*.018;gl_FragColor=vec4(c,.93);}`
}));
water.rotation.x = -Math.PI/2; water.position.y = -.65; water.receiveShadow = true; scene.add(water);

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const input = { up:false, down:false, left:false, right:false };
const tiles = new Map();
const lockedTiles = new Map();
const resources = [];
const logs = [];
const particles = [];
const floats = [];
const powerups = [];
const helpers = [];
const clouds = [];
const assetTemplates = {};
const mixers = [];
const interactive = [];
let player = null;
let depot = null;
let sawWheel = null;
let running = false;
let paused = true;
let shopReason = 'manual';
let pointerStart = null;
let saveTimer = 0;
let powerupSpawnTimer = 14;
let combo = 1;
let comboTimer = 0;
let activePower = null;
let powerTimer = 0;
let missionProgress = 0;
let cameraGoal = new THREE.Vector3();
let expansionPulse = 0;
let coreAssets = null;
let worldBuilt = false;

class SoundGarden {
  constructor(){ this.ctx=null; this.master=null; this.engine=null; this.engineGain=null; this.enabled=true; }
  start(){
    if(this.ctx){ this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value=.24; this.master.connect(this.ctx.destination);
    this.engine = this.ctx.createOscillator(); this.engine.type='sawtooth'; this.engine.frequency.value=46;
    this.engineGain=this.ctx.createGain(); this.engineGain.gain.value=0; this.engine.connect(this.engineGain).connect(this.master); this.engine.start();
  }
  setEngine(amount){ if(!this.ctx)return; this.engine.frequency.setTargetAtTime(45+amount*35,this.ctx.currentTime,.08); this.engineGain.gain.setTargetAtTime(this.enabled?amount*.035:0,this.ctx.currentTime,.08); }
  tone(freq=440,duration=.12,type='sine',volume=.14,slide=0){
    if(!this.ctx||!this.enabled)return; const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+duration);
    g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(this.master);o.start(t);o.stop(t+duration+.02);
  }
  noise(duration=.08,volume=.08){
    if(!this.ctx||!this.enabled)return;const n=Math.floor(this.ctx.sampleRate*duration),b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=b;g.gain.value=volume;s.connect(g).connect(this.master);s.start();
  }
  click(){this.tone(520,.05,'sine',.08,120)}
  chop(){this.noise(.11,.14);this.tone(95,.12,'triangle',.16,-28)}
  pickup(){this.tone(480,.08,'sine',.1,210)}
  deliver(){[330,495,660].forEach((f,i)=>setTimeout(()=>this.tone(f,.16,'sine',.11,60),i*65))}
  upgrade(){[420,560,760].forEach((f,i)=>setTimeout(()=>this.tone(f,.25,'triangle',.12,90),i*85))}
  expand(){this.noise(.25,.07);[180,270,405].forEach((f,i)=>setTimeout(()=>this.tone(f,.35,'sine',.11,130),i*90))}
  power(){this.tone(240,.55,'sawtooth',.1,720)}
}
const audio = new SoundGarden();

function loadGLTF(url){ return new Promise((resolve,reject)=>gltfLoader.load(url,resolve,undefined,reject)); }function loadFBX(url){ return new Promise((resolve,reject)=>fbxLoader.load(url,resolve,undefined,reject)); }
function key(q,r){ return `${q},${r}`; }
function parseKey(value){ return value.split(',').map(Number); }
function hexPosition(q,r){ return new THREE.Vector3(Math.sqrt(3)*HEX_RADIUS*(q+r/2),0,1.5*HEX_RADIUS*r); }
function hexNeighbors(q,r){ return [[q+1,r],[q+1,r-1],[q,r-1],[q-1,r],[q-1,r+1],[q,r+1]]; }
function seeded(q,r,n=0){ const x=Math.sin(q*127.1+r*311.7+n*74.7)*43758.5453; return x-Math.floor(x); }
function smoothAngle(a,b,t){ let d=(b-a+Math.PI)%(TAU)-Math.PI; return a+d*t; }
function modelBounds(model){ model.updateMatrixWorld(true); return new THREE.Box3().setFromObject(model); }
function normalizeFeet(model){
  const box=modelBounds(model),center=box.getCenter(new THREE.Vector3());
  model.position.x-=center.x; model.position.z-=center.z; model.position.y-=box.min.y; model.updateMatrixWorld(true); return model;
}
function normalizeHeight(model,height=1){ const size=modelBounds(model).getSize(new THREE.Vector3()); if(size.y)model.scale.setScalar(height/size.y); return model; }
function shadows(root){ root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}}); return root; }

function hexGeometry(radius,depth){
  const shape=new THREE.Shape();
  for(let i=0;i<6;i++){const a=Math.PI/3*i+Math.PI/6,x=Math.cos(a)*radius,y=Math.sin(a)*radius;i?shape.lineTo(x,y):shape.moveTo(x,y)}
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.13,bevelThickness:.13,curveSegments:1});
  geometry.rotateX(Math.PI/2); geometry.translate(0,depth,0); geometry.computeVertexNormals(); return geometry;
}
const tileGeometry=hexGeometry(HEX_RADIUS-.28,.62);
const edgeGeometry=hexGeometry(HEX_RADIUS-.08,.62);
const lockGeometry=hexGeometry(HEX_RADIUS-.35,.34);
const particleGeometry=new THREE.IcosahedronGeometry(.1,0);
const logGeometry=new THREE.CylinderGeometry(.13,.145,.625,8,1,false);
logGeometry.rotateZ(Math.PI/2);
const cargoLogGeometry=new THREE.CylinderGeometry(.26,.29,1.25,8,1,false);
cargoLogGeometry.rotateZ(Math.PI/2);
const stumpGeometry=new THREE.CylinderGeometry(.42,.5,.28,8);

function makeTextSprite(text,color='#fff7d0',scale=1){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const c=canvas.getContext('2d');
  c.font='900 58px Nunito, sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=13;c.strokeStyle='#173328';c.strokeText(text,256,78);c.fillStyle=color;c.fillText(text,256,78);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});
  const sprite=new THREE.Sprite(material);sprite.scale.set(4.2*scale,1.3*scale,1);return sprite;
}

function cloneProp(name,height,tint=null){
  const source=assetTemplates[name]; if(!source)return null;
  const model=source.clone(true); normalizeFeet(model); normalizeHeight(model,height); shadows(model);  if(tint!==null) model.traverse(o=>{if(o.isMesh&&o.material){o.material=o.material.clone();o.material.color.lerp(new THREE.Color(tint),.34);}});
  return model;
}

function makeFallbackTree(biome,height=2.3){
  const g=new THREE.Group(),trunk=new THREE.Mesh(new THREE.CylinderGeometry(.2,.31,height*.48,7),new THREE.MeshStandardMaterial({color:biome.trunk,roughness:.9}));
  trunk.position.y=height*.24;trunk.castShadow=true;g.add(trunk);
  const leafMat=new THREE.MeshStandardMaterial({color:biome.leaf,roughness:.82});
  for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.ConeGeometry(height*(.36-i*.045),height*.48,7),leafMat);crown.position.y=height*(.48+i*.18);crown.castShadow=true;g.add(crown)}
  return g;
}

function createTile(q,r,biomeIndex=0,animate=true){
  const biome=BIOMES[biomeIndex%BIOMES.length],group=new THREE.Group(),pos=hexPosition(q,r);group.position.copy(pos);
  const edgeMat=new THREE.MeshStandardMaterial({color:biome.edge,roughness:.88});
  const topMat=new THREE.MeshStandardMaterial({color:biome.color,roughness:.82,metalness:.02,emissive:biome.color,emissiveIntensity:.025});
  const edge=new THREE.Mesh(edgeGeometry,edgeMat);edge.position.y=-.12;edge.castShadow=true;edge.receiveShadow=true;group.add(edge);
  const top=new THREE.Mesh(tileGeometry,topMat);top.position.y=.08;top.castShadow=true;top.receiveShadow=true;group.add(top);
  const tile={q,r,key:key(q,r),group,biome,biomeIndex,resources:[],top,edge};
  top.userData.tile=tile;interactive.push(top);tiles.set(tile.key,tile);scene.add(group);
  if(animate){group.scale.set(.01,.01,.01);tween(group.scale,{x:1,y:1,z:1},.65,'back');burst(pos.clone().setY(.4),biome.color,24,1.8)}
  decorateTile(tile);spawnResources(tile);return tile;
}

function createLockedTile(q,r){
  const tileKey=key(q,r);if(tiles.has(tileKey)||lockedTiles.has(tileKey))return;
  const pos=hexPosition(q,r),group=new THREE.Group();group.position.copy(pos);
  const material=new THREE.MeshStandardMaterial({color:0x9acfb3,transparent:true,opacity:.52,roughness:.82,emissive:0x4da878,emissiveIntensity:.22,depthWrite:true});
  const mesh=new THREE.Mesh(lockGeometry,material);mesh.position.y=-.06;group.add(mesh);
  const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:6},(_,i)=>{const a=i*Math.PI/3+Math.PI/6;return new THREE.Vector3(Math.cos(a)*(HEX_RADIUS-.42),.4,Math.sin(a)*(HEX_RADIUS-.42))})),new THREE.LineBasicMaterial({color:0xf0fff4,transparent:true,opacity:.82}));group.add(ring);
  const label=makeTextSprite(`⬡ ${expansionCost()}`, '#fff4bd', .72);label.position.y=1.15;group.add(label);
  const tile={q,r,key:tileKey,group,mesh,ring,label};mesh.userData.lockedTile=tile;interactive.push(mesh);lockedTiles.set(tileKey,tile);scene.add(group);
}

function refreshLockedLabels(){ lockedTiles.forEach(tile=>{tile.group.remove(tile.label);tile.label.material.map.dispose();tile.label.material.dispose();tile.label=makeTextSprite(`⬡ ${expansionCost()}`,'#fff4bd',.72);tile.label.position.y=1.15;tile.group.add(tile.label);}); }

function decorateTile(tile){
  const {group,biome,q,r}=tile;
  for(let i=0;i<5;i++){
    const angle=seeded(q,r,i+30)*TAU,radial=(3.2+seeded(q,r,i+50)*.9)*TILE_CONTENT_SPREAD;let prop;
    if(biome.id==='marsh')prop=cloneProp('reeds',.65,biome.leaf);else if(i%3===0)prop=cloneProp('bush',.55,biome.leaf);else prop=cloneProp('rock',.32,biome.edge);
    if(!prop)continue;prop.position.set(Math.cos(angle)*radial,TILE_Y+.38,Math.sin(angle)*radial);prop.rotation.y=seeded(q,r,i+90)*TAU;group.add(prop);
  }
}

function spawnResources(tile){
  const count=tile.key==='0,0'?6:5+Math.floor(seeded(tile.q,tile.r,90)*3);
  for(let i=0;i<count;i++){
    const a=seeded(tile.q,tile.r,i+2)*TAU,rr=(1.35+seeded(tile.q,tile.r,i+12)*2.3)*TILE_CONTENT_SPREAD;
    const local=new THREE.Vector3(Math.cos(a)*rr,TILE_Y+.44,Math.sin(a)*rr);
    if(tile.key==='0,0'&&local.length()<2)local.multiplyScalar(1.5);
    const height=1.75+seeded(tile.q,tile.r,i+18)*1.15;
    let model=cloneProp(tile.biome.tree,height,tile.biome.leaf);if(!model)model=makeFallbackTree(tile.biome,height);
    model.position.copy(local);model.rotation.y=seeded(tile.q,tile.r,i+26)*TAU;
    const golden=seeded(tile.q,tile.r,i+70)<goldenChance();if(golden)model.traverse(o=>{if(o.isMesh&&o.material){o.material=o.material.clone();o.material.emissive=new THREE.Color(0xffbb35);o.material.emissiveIntensity=.42;}});
    const tree={group:model,tile,active:true,golden,regen:0,value:tile.biome.value*(golden?3:1),baseScale:model.scale.clone()};
    model.userData.tree=tree;model.traverse(o=>{if(o.isMesh){o.userData.tree=tree;interactive.push(o)}});tile.group.add(model);
    const hitProxy=new THREE.Mesh(new THREE.CylinderGeometry(.72,.86,height,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));
    hitProxy.position.set(local.x,TILE_Y+.44+height*.5,local.z);hitProxy.userData.tree=tree;tile.group.add(hitProxy);interactive.push(hitProxy);tree.hitProxy=hitProxy;
    tile.resources.push(tree);resources.push(tree);
  }
}

function unlockAround(tile){ hexNeighbors(tile.q,tile.r).forEach(([q,r])=>createLockedTile(q,r)); }
function expansionCost(){ return Math.round(28*Math.pow(1.58,Math.max(0,tiles.size-1))/5)*5; }
function biomeForIndex(index){ return Math.min(index,BIOMES.length-1); }

function unlockTile(locked,free=false){
  const cost=expansionCost();if(!free&&state.wood<cost){toast(`Faltan <strong>${cost-state.wood}</strong> de madera`);audio.click();return false}
  if(!free)state.wood-=cost;
  interactive.splice(interactive.indexOf(locked.mesh),1);lockedTiles.delete(locked.key);scene.remove(locked.group);
  const tile=createTile(locked.q,locked.r,biomeForIndex(tiles.size),true);state.unlocked.push(tile.key);state.expanded++;missionEvent('expand',1);missionEvent('tiles',tiles.size);
  unlockAround(tile);refreshLockedLabels();audio.expand();toast(`${tile.biome.icon} <strong>${tile.biome.name}</strong> descubierto`);frameTerritory();updateHUD();saveGame();return true;
}

function createDepot(){
  const g=new THREE.Group();g.position.set(0,TILE_Y+.53,0);scene.add(g);
  const pad=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.55,.18,32),new THREE.MeshStandardMaterial({color:0xe9c46b,roughness:.72,emissive:0xffad42,emissiveIntensity:.12}));pad.receiveShadow=true;g.add(pad);
  const inner=new THREE.Mesh(new THREE.TorusGeometry(1.05,.08,8,32),new THREE.MeshStandardMaterial({color:0xfff1a8,emissive:0xffc24c,emissiveIntensity:.7}));inner.rotation.x=Math.PI/2;inner.position.y=.13;g.add(inner);
  const building=new THREE.Group();building.position.set(-.2,.25,-.2);g.add(building);
  const woodMat=new THREE.MeshStandardMaterial({color:0x9b5d35,roughness:.9}),roofMat=new THREE.MeshStandardMaterial({color:0x315f4c,roughness:.82});
  const hut=new THREE.Mesh(new THREE.BoxGeometry(1.2,.9,.9),woodMat);hut.position.y=.55;hut.castShadow=true;building.add(hut);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(1.05,.55,4),roofMat);roof.rotation.y=Math.PI/4;roof.position.y=1.28;roof.castShadow=true;building.add(roof);
  sawWheel=new THREE.Mesh(new THREE.TorusGeometry(.35,.09,8,12),new THREE.MeshStandardMaterial({color:0xdde5d5,metalness:.55,roughness:.35,emissive:0xffd26b,emissiveIntensity:.15}));sawWheel.rotation.y=Math.PI/2;sawWheel.position.set(.7,.75,.05);building.add(sawWheel);
  const sign=makeTextSprite('ASERRADERO','#fff4bd',.46);sign.position.set(0,2,0);g.add(sign);depot=g;
}

function createPlayer(yaleGLTF,castorGLTF,drivingFBX){
  const group=new THREE.Group(),visual=new THREE.Group(),vehicle=new THREE.Group(),cargoGroup=new THREE.Group();group.add(visual);visual.add(vehicle);vehicle.add(cargoGroup);scene.add(group);
  const yale=normalizeFeet(shadows(yaleGLTF.scene));vehicle.add(yale);
  const driverPivot=new THREE.Group(),castor=normalizeFeet(shadows(castorGLTF.scene));driverPivot.add(castor);vehicle.add(driverPivot);
  driverPivot.position.fromArray(DRIVER_FIT.position);driverPivot.rotation.set(...DRIVER_FIT.rotationDegrees.map(rad));driverPivot.scale.fromArray(DRIVER_FIT.scale);
  vehicle.scale.setScalar(.57*PLAYER_VISUAL_SCALE);
  const mixer=new THREE.AnimationMixer(castor),clip=drivingFBX.animations?.[0]||castorGLTF.animations?.[0];if(clip){mixer.clipAction(clip).play();mixers.push(mixer)}
  const glow=new THREE.PointLight(0xffb449,.58,3.2,2);glow.position.set(0,1.1,1.35);visual.add(glow);
  const targetRing=new THREE.Mesh(new THREE.RingGeometry(.45,.6,28),new THREE.MeshBasicMaterial({color:0xffdb73,transparent:true,opacity:.7,side:THREE.DoubleSide}));targetRing.rotation.x=-Math.PI/2;targetRing.visible=false;scene.add(targetRing);
  player={group,visual,vehicle,cargoGroup,targetRing,target:null,targetTree:null,yaw:state.player.yaw||0,speed:0,manual:0,deliveryCooldown:0};
  group.position.set(state.player.x||0,TILE_Y+.42,state.player.z||1.5);group.rotation.y=player.yaw;
  rebuildCargo();
}

function createHelper(index){
  const g=new THREE.Group(),bodyMat=new THREE.MeshStandardMaterial({color:[0x75c6d9,0xf07f63,0xa98cdd,0x7fc779][index%4],roughness:.55,metalness:.08}),dark=new THREE.MeshStandardMaterial({color:0x26342f,roughness:.7});
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.1,.7,1.45),bodyMat);body.position.y=.65;body.castShadow=true;g.add(body);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(.9,.85,.72),new THREE.MeshStandardMaterial({color:0xdff4e9,roughness:.3,transparent:true,opacity:.82}));cab.position.set(0,1.28,-.18);cab.castShadow=true;g.add(cab);
  [-.53,.53].forEach(x=>[-.48,.48].forEach(z=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.16,10),dark);w.rotation.z=Math.PI/2;w.position.set(x,.35,z);g.add(w)}));
  const fork=new THREE.Mesh(new THREE.BoxGeometry(.12,.1,1.15),dark);fork.position.set(-.27,.25,.98);g.add(fork);const fork2=fork.clone();fork2.position.x=.27;g.add(fork2);
  g.scale.setScalar(.58);g.position.set(Math.cos(index*2)*2,TILE_Y+.42,Math.sin(index*2)*2);scene.add(g);
  helpers.push({group:g,target:new THREE.Vector3(),speed:1.8+index*.15,timer:0,index});
}

function rebuildCargo(){
  if(!player)return;player.cargoGroup.clear();state.cargo.forEach((value,i)=>{const log=new THREE.Mesh(cargoLogGeometry,new THREE.MeshStandardMaterial({color:0xa85d31,roughness:.88}));log.position.set((i%2-.5)*.48,.65+Math.floor(i/2)*.34,1.86);log.rotation.y=(i%2)*.1;log.castShadow=true;player.cargoGroup.add(log)});renderCargo();
}

async function loadAssets(){
  $('#loadingDetail').textContent='Ensamblando el autoelevador';
  const core=await Promise.all([loadGLTF(PATHS.yale),loadGLTF(PATHS.castor),loadFBX(PATHS.driving)]);
  $('#loadingDetail').textContent='Trayendo árboles CC0';
  const propEntries=Object.entries(PROP_PATHS);
  const props=await Promise.all(propEntries.map(async([name,path])=>{try{return [name,(await loadGLTF(path)).scene]}catch(error){console.warn(`Prop opcional ${name} no disponible`,error);return [name,null]}}));
  props.forEach(([name,model])=>{if(model)assetTemplates[name]=model});
  return core;
}

function buildWorld(core){
  createDepot();
  const unlocked=(state.unlocked?.length?state.unlocked:['0,0']);
  unlocked.forEach((tileKey,index)=>{const [q,r]=parseKey(tileKey);createTile(q,r,biomeForIndex(index),false)});
  tiles.forEach(tile=>unlockAround(tile));
  createPlayer(...core);
  for(let i=0;i<(state.upgrades.fleet||0);i++)createHelper(i);
  createClouds();frameTerritory();updateHUD();updateMission(true);
}

function createClouds(){
  for(let i=0;i<8;i++){let cloud=cloneProp('cloud',1.1+Math.random()*.7);if(!cloud){cloud=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7}))}
    cloud.position.set(-48+i*13,13+Math.random()*7,-42-(i%3)*7);cloud.scale.x*=2.2;scene.add(cloud);clouds.push({group:cloud,speed:.25+Math.random()*.2});}
}

function frameTerritory(){
  scene.updateMatrixWorld(true);
  const box=new THREE.Box3();tiles.forEach(tile=>box.expandByObject(tile.group));lockedTiles.forEach(tile=>box.expandByObject(tile.mesh));if(box.isEmpty())return;
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());cameraGoal.copy(center);orbit.target.copy(center);
  const max=Math.max(size.x,size.z,10),distance=clamp(max*1.35,46,180);const dir=new THREE.Vector3(.65,.72,.8).normalize();camera.position.copy(center).addScaledVector(dir,distance);orbit.update();
}

function tween(target,to,duration=.4,ease='out',done=null){
  particles.push({tween:true,target,from:{...Object.fromEntries(Object.keys(to).map(k=>[k,target[k]]))},to,duration,age:0,ease,done});
}

function burst(position,color=0xffffff,count=12,speed=1){
  const material=new THREE.MeshBasicMaterial({color,transparent:true});
  for(let i=0;i<count;i++){const mesh=new THREE.Mesh(particleGeometry,material);mesh.position.copy(position);const a=Math.random()*TAU,v=.7+Math.random()*speed;scene.add(mesh);particles.push({mesh,velocity:new THREE.Vector3(Math.cos(a)*v,.8+Math.random()*2,Math.sin(a)*v),age:0,life:.55+Math.random()*.55,spin:Math.random()*5});}
}

function floatText(text,position,color='#fff4bd',scale=1){const sprite=makeTextSprite(text,color,.75*scale);sprite.position.copy(position).add(new THREE.Vector3(0,1.7,0));scene.add(sprite);floats.push({sprite,age:0,life:1.15});}
function toast(html){const el=document.createElement('div');el.className='toast';el.innerHTML=html;$('#toastLayer').appendChild(el);setTimeout(()=>el.remove(),1700)}

function spawnLogs(tree){  const count=tree.golden?4:2+(Math.random()<.28?1:0);const world=tree.group.getWorldPosition(new THREE.Vector3());
  for(let i=0;i<count;i++){const mesh=new THREE.Mesh(logGeometry,new THREE.MeshStandardMaterial({color:tree.golden?0xd99627:tree.tile.biome.trunk,roughness:.88,emissive:tree.golden?0xff9b19:0,emissiveIntensity:tree.golden?.25:0}));mesh.position.copy(world).add(new THREE.Vector3((Math.random()-.5)*.4,.55,(Math.random()-.5)*.4));mesh.rotation.y=Math.random()*TAU;mesh.castShadow=true;scene.add(mesh);logs.push({mesh,value:tree.value,woodType:tree.tile.biome.woodType,age:0,velocity:new THREE.Vector3((Math.random()-.5)*2,1.8+Math.random(),(Math.random()-.5)*2)});}
}

function harvestTree(tree){
  if(!tree?.active)return;tree.active=false;tree.regen=tree.tile.biome.regrow*regrowMultiplier();audio.chop();comboHit();
  const pos=tree.group.getWorldPosition(new THREE.Vector3());burst(pos.clone().setY(1.3),tree.golden?0xffcc42:tree.tile.biome.leaf,tree.golden?30:18,2.2);floatText(tree.golden?'¡DORADO!':'CRACK!',pos,tree.golden?'#ffe06f':'#fff4bd',tree.golden?1.2:.82);
  tween(tree.group.scale,{x:tree.baseScale.x*1.15,y:.02,z:tree.baseScale.z*1.15},.32,'in',()=>{tree.group.visible=false;tree.group.scale.copy(tree.baseScale)});spawnLogs(tree);
  missionEvent('combo',combo);
}

function collectLog(log){
  if(state.cargo.length>=capacity())return;const index=logs.indexOf(log);if(index>=0)logs.splice(index,1);scene.remove(log.mesh);state.cargo.push({value:log.value,woodType:log.woodType||'pine'});audio.pickup();comboHit();burst(player.group.position.clone().setY(1),0xffc45d,7,.8);floatText('+ TRONCO',player.group.position,'#ffe39a',.62);rebuildCargo();
}

function deliverCargo(){
  if(!state.cargo.length||player.deliveryCooldown>0)return;player.deliveryCooldown=.7;
  const normalized=state.cargo.map(item=>typeof item==='number'?{value:item,woodType:'pine'}:item);
  const raw=normalized.reduce((a,b)=>a+b.value,0),double=Math.random()<state.upgrades.mill*.12?2:1,power=activePower?.id==='double'?2:1;
  const gain=Math.round(raw*valueMultiplier()*combo*double*power),count=normalized.length;
  const newlyUnlocked=[];
  normalized.forEach(item=>{const type=item.woodType||'pine';const before=state.woodByType[type]||0;state.woodByType[type]=before+item.value;if(before<=0&&state.woodByType[type]>0)newlyUnlocked.push(type)});
  state.wood+=gain;state.earned+=gain;state.delivered+=count;state.cargo=[];
  addXp(count*5+Math.round(gain*.08));missionEvent('deliver',count);missionEvent('earn',gain);audio.deliver();burst(depot.position.clone().setY(1),0xffd55f,24,2.4);floatText(`+${gain} MADERA`,depot.position,'#ffe277',1.12);
  newlyUnlocked.forEach(type=>{const wood=WOOD_TYPES[type];if(wood)toast(`${wood.icon} Nueva madera: <strong>${wood.name}</strong> · nuevas mejoras disponibles`)});
  if(double>1)toast('⚙️ <strong>Sierra gemela</strong> duplicó la carga');rebuildCargo();updateHUD();saveGame();
}

function comboHit(){comboTimer=6+state.upgrades.combo*1.5;combo=clamp(combo+1,1,8);if(combo>=5&&combo-1<5){bloomPass.strength=.52;toast('🔥 <strong>RACHA DEL DIQUE</strong>');}renderCombo();}
function updateCombo(dt){if(combo<=1)return;comboTimer-=dt;if(comboTimer<=0){combo=1;bloomPass.strength=.22;renderCombo()}else renderCombo();}

function capacity(){return 2+state.upgrades.capacity}
function speedMultiplier(){return (1+state.upgrades.speed*.16)*(activePower?.id==='turbo'?1.65:1)}
function valueMultiplier(){return (1+state.upgrades.value*.25)*(1+state.stars*.03)}
function magnetRadius(){return 1.2+state.upgrades.magnet*.55+(activePower?.id==='magnet'?5:0)}
function regrowMultiplier(){return Math.pow(.88,state.upgrades.regrow)}
function goldenChance(){return .025+state.upgrades.golden*.04}
function powerDuration(){return 1+state.upgrades.power*.2}
function xpNeeded(){return Math.round(28*Math.pow(1.27,state.level-1))}

function addXp(amount){
  state.xp+=amount;while(state.xp>=xpNeeded()){state.xp-=xpNeeded();state.level++;state.stars+=1;missionEvent('level',state.level);audio.upgrade();burst(player.group.position.clone().setY(1.5),0xffe36a,38,3);floatText(`RANGO ${state.level}`,player.group.position,'#fff28a',1.35);toast(`♜ Nuevo rango: <strong>${state.level}</strong>`);if(state.level%3===0)setTimeout(()=>openShop('rank'),650)}updateHUD();
}

function spawnPowerup(){
  if(powerups.length||!tiles.size)return;const tile=[...tiles.values()][Math.floor(Math.random()*tiles.size)],a=Math.random()*TAU,r=(1+Math.random()*2.6)*TILE_CONTENT_SPREAD;
  const types=[{id:'turbo',name:'TURBO MIEL',color:0xffa43f,icon:'⚡'},{id:'magnet',name:'IMÁN DE RÍO',color:0x67d0d5,icon:'🧲'},{id:'double',name:'DOBLE CORTE',color:0xb18be8,icon:'✦'},{id:'rain',name:'LLUVIA VERDE',color:0x65cf83,icon:'☂'}],type=types[Math.floor(Math.random()*types.length)];
  const group=new THREE.Group(),gem=new THREE.Mesh(new THREE.OctahedronGeometry(.45,0),new THREE.MeshStandardMaterial({color:type.color,emissive:type.color,emissiveIntensity:1.2,metalness:.25,roughness:.18}));gem.castShadow=true;group.add(gem);const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.07,8,24),new THREE.MeshBasicMaterial({color:type.color}));ring.rotation.x=Math.PI/2;group.add(ring);const light=new THREE.PointLight(type.color,2.5,6);group.add(light);group.position.copy(tile.group.position).add(new THREE.Vector3(Math.cos(a)*r,1.15,Math.sin(a)*r));scene.add(group);powerups.push({group,type,age:0});
}

function activatePower(type){
  audio.power();burst(player.group.position.clone().setY(1.3),type.color,28,2.5);floatText(type.name,player.group.position,'#ffffff',1);if(type.id==='rain'){resources.forEach(tree=>{tree.regen=0;tree.active=true;tree.group.visible=true});toast('☂ Todo el bosque volvió a crecer');return}
  activePower=type;powerTimer=10*powerDuration();$('#powerupName').textContent=type.name;$('#powerupBanner').classList.add('show');
}

function updatePower(dt){
  powerupSpawnTimer-=dt;if(powerupSpawnTimer<=0){spawnPowerup();powerupSpawnTimer=18+Math.random()*11}
  powerups.forEach((p,i)=>{p.age+=dt;p.group.rotation.y+=dt*1.8;p.group.position.y=1.18+Math.sin(p.age*3)*.16;if(player&&p.group.position.distanceTo(player.group.position)<1.25){activatePower(p.type);scene.remove(p.group);powerups.splice(i,1)}});
  if(activePower){powerTimer-=dt;$('#powerupTimer').style.transform=`scaleX(${clamp(powerTimer/(10*powerDuration()),0,1)})`;if(powerTimer<=0){activePower=null;$('#powerupBanner').classList.remove('show')}}
}

function setDestination(point,tree=null){
  if(!player)return;player.target=point.clone();player.target.y=player.group.position.y;player.targetTree=tree;player.targetRing.position.set(point.x,TILE_Y+.64,point.z);player.targetRing.visible=true;input.up=input.down=false;
}

function pointIsOnLand(point){
  const margin=1.015,halfWidth=Math.sqrt(3)*HEX_RADIUS*.5*margin,maxZ=HEX_RADIUS*margin,edge=Math.sqrt(3)*HEX_RADIUS*margin;
  for(const tile of tiles.values()){
    const local=point.clone().sub(tile.group.position),x=Math.abs(local.x),z=Math.abs(local.z);
    if(x<=halfWidth&&z<=maxZ&&x+Math.sqrt(3)*z<=edge)return true;
  }
  return false;
}

function updatePlayer(dt){
  if(!player)return;player.deliveryCooldown=Math.max(0,player.deliveryCooldown-dt);let throttle=0,steer=0;
  if(input.up||input.down||input.left||input.right){player.target=null;player.targetTree=null;player.targetRing.visible=false;throttle=(input.up?1:0)-(input.down?1:0);steer=(input.left?1:0)-(input.right?1:0);player.manual=2;}
  if(state.auto&&state.upgrades.auto&& !player.target){
    if(state.cargo.length>=capacity()||(!resources.some(t=>t.active)&&state.cargo.length))setDestination(depot.position);
    else{const candidates=resources.filter(t=>t.active);if(candidates.length){candidates.sort((a,b)=>a.group.getWorldPosition(new THREE.Vector3()).distanceToSquared(player.group.position)-b.group.getWorldPosition(new THREE.Vector3()).distanceToSquared(player.group.position));const tree=candidates[0];setDestination(tree.group.getWorldPosition(new THREE.Vector3()),tree)}}
  }
  if(player.target){
    const delta=player.target.clone().sub(player.group.position),distance=delta.length(),desired=Math.atan2(delta.x,delta.z);player.yaw=smoothAngle(player.yaw,desired,clamp(dt*4.6,0,1));throttle=distance>.35?1:0;if(distance<.55){player.target=null;player.targetRing.visible=false;if(player.targetTree?.active)harvestTree(player.targetTree);player.targetTree=null;}
  }else if(throttle){player.yaw+=steer*dt*2.1*(throttle<0?-1:1)}
  const maxSpeed=4.6*speedMultiplier(),desiredSpeed=throttle*maxSpeed;player.speed=lerp(player.speed,desiredSpeed,clamp(dt*(throttle?3.6:6),0,1));
  const forward=new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw)),before=player.group.position.clone();player.group.position.addScaledVector(forward,player.speed*dt);
  if(!pointIsOnLand(player.group.position)){player.group.position.copy(before);player.speed*=.25;if(player.target){player.target=null;player.targetRing.visible=false}}
  player.group.rotation.y=player.yaw;player.visual.rotation.z=lerp(player.visual.rotation.z,-steer*.06,dt*5);player.visual.position.y=Math.sin(performance.now()*.012)*Math.min(Math.abs(player.speed)*.006,.022);
  audio.setEngine(clamp(Math.abs(player.speed)/maxSpeed,0,1));
  if(depot&&player.group.position.distanceTo(depot.position)<1.6)deliverCargo();
  resources.forEach(tree=>{if(tree.active&&tree.group.getWorldPosition(new THREE.Vector3()).distanceTo(player.group.position)<1.0)harvestTree(tree)});  logs.slice().forEach(log=>{const d=log.mesh.position.distanceTo(player.group.position);if(d<magnetRadius()&&state.cargo.length<capacity()){log.mesh.position.lerp(player.group.position.clone().add(new THREE.Vector3(0,.65,0)),clamp(dt*(7+state.upgrades.magnet),0,1));if(d<.65)collectLog(log)}});
  player.targetRing.rotation.z+=dt*.9;state.player={x:player.group.position.x,z:player.group.position.z,yaw:player.yaw};
}

function updateResources(dt){
  resources.forEach(tree=>{if(!tree.active){tree.regen-=dt;if(tree.regen<=0){tree.active=true;tree.group.visible=true;tree.group.scale.set(.01,.01,.01);tween(tree.group.scale,{x:tree.baseScale.x,y:tree.baseScale.y,z:tree.baseScale.z},.55,'back');burst(tree.group.getWorldPosition(new THREE.Vector3()).setY(.8),tree.tile.biome.leaf,8,.8)}}});
  logs.slice().forEach(log=>{log.age+=dt;if(log.age<.65){log.velocity.y-=5.8*dt;log.mesh.position.addScaledVector(log.velocity,dt);if(log.mesh.position.y<.62){log.mesh.position.y=.62;log.velocity.y*=-.28;log.velocity.x*=.7;log.velocity.z*=.7}}else log.mesh.rotation.y+=dt*.08});
}

function updateHelpers(dt){
  helpers.forEach((h,i)=>{h.timer-=dt;if(h.timer<=0||h.group.position.distanceTo(h.target)<.5){const tile=[...tiles.values()][Math.floor(Math.random()*tiles.size)];h.target.copy(tile.group.position).add(new THREE.Vector3((Math.random()-.5)*16,0,(Math.random()-.5)*16));h.timer=4+Math.random()*4;if(Math.random()<.5){const passive=Math.round((2+i)*valueMultiplier());state.wood+=passive;state.earned+=passive;missionEvent('earn',passive);floatText(`+${passive}`,h.group.position,'#baf3c7',.55)}}const d=h.target.clone().sub(h.group.position),yaw=Math.atan2(d.x,d.z);h.group.rotation.y=smoothAngle(h.group.rotation.y,yaw,dt*2);h.group.position.addScaledVector(d.normalize(),h.speed*dt)});
}

function updateEffects(dt){
  particles.slice().forEach(p=>{p.age+=dt;if(p.tween){let t=clamp(p.age/p.duration,0,1);if(p.ease==='back'){const c=1.70158;t=1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)}else if(p.ease==='in')t=t*t;else t=1-Math.pow(1-t,3);Object.keys(p.to).forEach(k=>p.target[k]=lerp(p.from[k],p.to[k],t));if(p.age>=p.duration){particles.splice(particles.indexOf(p),1);p.done?.()}return}p.velocity.y-=3.5*dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.rotation.x+=p.spin*dt;p.mesh.rotation.y+=p.spin*dt;p.mesh.material.opacity=1-p.age/p.life;p.mesh.scale.setScalar(1-p.age/p.life*.6);if(p.age>=p.life){scene.remove(p.mesh);particles.splice(particles.indexOf(p),1)}});
  floats.slice().forEach(f=>{f.age+=dt;f.sprite.position.y+=dt*.8;f.sprite.material.opacity=1-f.age/f.life;if(f.age>=f.life){scene.remove(f.sprite);f.sprite.material.map.dispose();f.sprite.material.dispose();floats.splice(floats.indexOf(f),1)}});
}

function updateAmbient(dt,time){
  waterUniforms.uTime.value=time;clouds.forEach(c=>{c.group.position.x+=c.speed*dt;if(c.group.position.x>62)c.group.position.x=-62});if(sawWheel)sawWheel.rotation.z-=dt*2.4;
  let lockIndex=0;lockedTiles.forEach(tile=>{tile.group.position.y=Math.sin(time*1.6+lockIndex)*.08;tile.ring.material.opacity=.65+Math.sin(time*2+lockIndex)*.17;lockIndex++});sun.intensity=3.9+Math.sin(time*.08)*.4;
}

function updateShift(dt){
  state.shiftLeft-=dt;if(state.shiftLeft<=0){state.shiftLeft=0;openShop('sunset')}const total=62;$('#shiftTime').textContent=`${String(Math.floor(state.shiftLeft/60)).padStart(2,'0')}:${String(Math.floor(state.shiftLeft%60)).padStart(2,'0')}`;$('#shiftBar').style.transform=`scaleX(${state.shiftLeft/total})`;
}

function upgradeCost(def,level=state.upgrades[def.id]){return Math.round(def.base*Math.pow(1.72,level)/5)*5}
function hasRequiredWood(def){return !def.requiresWood||(state.woodByType?.[def.requiresWood]||0)>0}
function shopChoices(){
  const available=UPGRADE_DEFS.filter(d=>state.upgrades[d.id]<d.max&&hasRequiredWood(d));const ranked=available.sort((a,b)=>{const boostA=(a.id==='auto'&&!state.upgrades.auto)?-2:Math.random();const boostB=(b.id==='auto'&&!state.upgrades.auto)?-2:Math.random();return boostA-boostB});return ranked.slice(0,3);
}
function renderShop(){
  const grid=$('#upgradeGrid');grid.innerHTML='';shopChoices().forEach(def=>{const level=state.upgrades[def.id],cost=upgradeCost(def),button=document.createElement('button');button.className='upgrade-card';button.disabled=state.wood<cost;const woodReq=def.requiresWood?WOOD_TYPES[def.requiresWood]:null;button.innerHTML=`<span class="upgrade-icon">${def.icon}</span><div><h3>${def.name}</h3><p>${def.text}</p>${woodReq?`<small class="wood-requirement">${woodReq.icon} Requiere ${woodReq.name}</small>`:''}</div><footer><span>▰ ${cost}</span><small>NIVEL ${level}/${def.max}</small></footer>`;button.addEventListener('click',()=>buyUpgrade(def));grid.appendChild(button)});$('#nextExpansion').textContent=`${expansionCost()} madera`;
}
function buyUpgrade(def){
  const cost=upgradeCost(def);if(!hasRequiredWood(def)||state.wood<cost)return;state.wood-=cost;state.upgrades[def.id]++;state.upgradesBought++;missionEvent('upgrade',1);audio.upgrade();toast(`${def.icon} <strong>${def.name}</strong> mejorado`);if(def.id==='fleet')createHelper(state.upgrades.fleet-1);if(def.id==='capacity')rebuildCargo();if(def.id==='auto'){$('#autoButton').classList.remove('locked');$('#autoButton span').textContent='○'}updateHUD();renderShop();saveGame();
}
function openShop(reason='manual'){
  if($('#shop').classList.contains('visible')||$('#welcome').classList.contains('visible'))return;shopReason=reason;paused=true;$('#shop').classList.add('visible');$('#shop').setAttribute('aria-hidden','false');$('#shopKicker').textContent=reason==='sunset'?`ATARDECER · FIN DEL TURNO ${state.shift}`:'TALLER DEL DIQUE';$('#shopTitle').textContent=reason==='rank'?'El bosque celebra tu nuevo rango':reason==='sunset'?'Una mejora antes del próximo turno':'Ajustes y buenas ideas';$('#continueButton').innerHTML=reason==='sunset'?'Siguiente turno <span>→</span>':'Volver al bosque <span>→</span>';renderShop();audio.click();
}
function closeShop(){
  $('#shop').classList.remove('visible');$('#shop').setAttribute('aria-hidden','true');if(shopReason==='sunset'){state.shift++;state.shiftLeft=62;$('#shiftLabel').textContent=`TURNO ${state.shift}`}paused=false;clock.getDelta();saveGame();audio.click();
}

function missionValue(type){switch(type){case'deliver':return state.delivered;case'earn':return state.earned;case'expand':return state.expanded;case'combo':return combo;case'upgrade':return state.upgradesBought;case'tiles':return tiles.size;case'level':return state.level;default:return 0}}
function updateMission(resetBase=false){
  const mission=MISSIONS[state.missionIndex%MISSIONS.length];if(resetBase)state.missionBase=missionValue(mission.type);missionProgress=Math.max(0,missionValue(mission.type)-state.missionBase);if(['combo','tiles','level'].includes(mission.type))missionProgress=missionValue(mission.type);
  $('#missionTitle').textContent=mission.title;$('#missionText').textContent=mission.text;$('#missionCount').textContent=`${Math.min(missionProgress,mission.target)} / ${mission.target}`;$('#missionBar').style.width=`${clamp(missionProgress/mission.target*100,0,100)}%`;
}
function missionEvent(type){
  const mission=MISSIONS[state.missionIndex%MISSIONS.length];if(mission.type!==type)return;updateMission();if(missionProgress>=mission.target){if(mission.stars){state.stars+=mission.reward;toast(`✦ Misión completa · <strong>+${mission.reward} estrellas</strong>`)}else{state.wood+=mission.reward;toast(`▰ Misión completa · <strong>+${mission.reward} madera</strong>`)}audio.upgrade();burst(player?.group.position.clone().setY(2)||new THREE.Vector3(),0xffef76,35,2.5);state.missionIndex++;state.missionBase=missionValue(MISSIONS[state.missionIndex%MISSIONS.length].type);setTimeout(()=>updateMission(),700);updateHUD();saveGame()}
}

function renderCargo(){const el=$('#cargoSlots');el.innerHTML='';for(let i=0;i<capacity();i++){const slot=document.createElement('i');slot.className=`cargo-slot ${i<state.cargo.length?'filled':''}`;el.appendChild(slot)}$('#cargoValue').textContent=`${state.cargo.length} / ${capacity()}`}
function renderCombo(){const el=$('#combo');el.classList.toggle('show',combo>1);el.querySelector('b').textContent=`x${combo}`;el.querySelector('i').style.transform=`scaleX(${clamp(comboTimer/(6+state.upgrades.combo*1.5),0,1)})`}
function updateHUD(){
  $('#woodValue').textContent=Math.floor(state.wood).toLocaleString('es-AR');
  const woodSummary=$('#woodTypeSummary');if(woodSummary)woodSummary.textContent=Object.values(WOOD_TYPES).map(w=>`${w.short} ${Math.floor(state.woodByType?.[w.id]||0)}`).join(' · ');
  $('#starValue').textContent=state.stars.toLocaleString('es-AR');$('#levelValue').textContent=state.level;$('#shiftLabel').textContent=`TURNO ${state.shift}`;renderCargo();if(state.upgrades.auto){$('#autoButton').classList.remove('locked');$('#autoButton span').textContent=state.auto?'●':'○';$('#autoButton').classList.toggle('active',state.auto)}updateMission();
}

function saveGame(){if(!running)return;state.lastSeen=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(state))}
function restoreSave(){if(!pendingSave)return;state={...defaultState(),...pendingSave,woodByType:{...defaultState().woodByType,...pendingSave.woodByType},upgrades:{...defaultState().upgrades,...pendingSave.upgrades},cargo:[]};const elapsed=Math.min((Date.now()-(state.lastSeen||Date.now()))/1000,4*3600),rate=(.045+state.upgrades.fleet*.08+(state.unlocked?.length||1)*.012)*(1+state.upgrades.offline*.35),gain=Math.floor(elapsed*rate);if(gain>2){state.wood+=gain;state.earned+=gain;setTimeout(()=>toast(`🌙 Turno nocturno · <strong>+${gain} madera</strong>`),900)}}

function startGame(continueSave=false){
  audio.start();if(continueSave)restoreSave();else{state=defaultState();localStorage.removeItem(SAVE_KEY)}audio.enabled=state.sound;if(!worldBuilt){buildWorld(coreAssets);worldBuilt=true}$('#soundButton').classList.toggle('active',state.sound);$('#soundButton span').textContent=state.sound?'♪':'×';$('#welcome').classList.remove('visible');$('#welcome').setAttribute('aria-hidden','true');running=true;paused=false;clock.getDelta();updateHUD();setTimeout(()=>$('#inputHint').classList.add('hide'),8500);saveGame();
}

function handlePointer(event){
  if(!running||paused)return;const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(interactive,false);if(hits.length){const data=hits[0].object.userData;if(data.lockedTile){unlockTile(data.lockedTile);return}if(data.tree?.active){setDestination(data.tree.group.getWorldPosition(new THREE.Vector3()),data.tree);return}if(data.tile){const point=hits[0].point;setDestination(point);return}}
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-(TILE_Y+.5)),point=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,point)&&pointIsOnLand(point))setDestination(point);
}

renderer.domElement.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY}});
renderer.domElement.addEventListener('pointerup',e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)<8)handlePointer(e);pointerStart=null});
window.addEventListener('keydown',e=>{if(e.repeat)return;const k=e.key.toLowerCase();if(k==='w'||k==='arrowup')input.up=true;if(k==='s'||k==='arrowdown')input.down=true;if(k==='a'||k==='arrowleft')input.left=true;if(k==='d'||k==='arrowright')input.right=true;if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault()});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='w'||k==='arrowup')input.up=false;if(k==='s'||k==='arrowdown')input.down=false;if(k==='a'||k==='arrowleft')input.left=false;if(k==='d'||k==='arrowright')input.right=false});

$('#startButton').addEventListener('click',()=>startGame(false));
$('#continueSaveButton').addEventListener('click',()=>startGame(true));
$('#continueButton').addEventListener('click',closeShop);
$('#shopButton').addEventListener('click',()=>openShop('manual'));
$('#autoButton').addEventListener('click',()=>{if(!state.upgrades.auto){toast('🔒 Se desbloquea en el taller');return}state.auto=!state.auto;player.target=null;updateHUD();saveGame();audio.click()});
$('#soundButton').addEventListener('click',()=>{state.sound=!state.sound;audio.enabled=state.sound;$('#soundButton').classList.toggle('active',state.sound);$('#soundButton span').textContent=state.sound?'♪':'×';audio.click();saveGame()});
if(pendingSave){$('#continueSaveButton').hidden=false;$('#startButton').textContent='Nueva expedición'}

function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setSize(w,h);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8))}
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame();else clock.getDelta()});

function animate(){
  const dt=Math.min(clock.getDelta(),.05),time=performance.now()/1000;if(running&&!paused){mixers.forEach(m=>m.update(dt));updatePlayer(dt);updateResources(dt);updateHelpers(dt);updateEffects(dt);updatePower(dt);updateCombo(dt);updateShift(dt);saveTimer+=dt;if(saveTimer>7){saveTimer=0;saveGame()}}else updateEffects(dt);
  updateAmbient(dt,time);orbit.update();composer.render();
}

async function init(){
  try{coreAssets=await loadAssets();$('#loading').classList.add('hide');renderer.setAnimationLoop(animate)}
  catch(error){console.error(error);$('#loadingDetail').textContent='No se pudieron cargar los modelos. Serví el repo por HTTP.';$('#loading .loader-hex').textContent='!'}
}
init();