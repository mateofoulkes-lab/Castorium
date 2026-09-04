import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const $=s=>document.querySelector(s);
const STORAGE_KEY='castorium.mapEditor.v2';
const DB_NAME='castorium-editor-assets-v2';
const DB_STORE='blobs';
const PRESET_BEAVER_ID='preset-castor-v2';
const PRESET_BEAVER_URL='./models/castorv2.glb';

const LAYERS=['structure','machine','vehicle','product','worker','hotspot','zone','ui','helper'];
const COLORS={structure:0x657382,machine:0x7d8f72,vehicle:0x9a835b,product:0x8e684e,worker:0x7b6e91,hotspot:0xf0b95b,zone:0x557d8a,ui:0xa0697a,helper:0x7b7b7b};
const CATALOG={
'Estructura':[['wall','Pared','structure'],['column','Columna','structure'],['gate','Portón / acceso','structure'],['office','Bloque de oficina','structure'],['sector_sign','Cartel de sector','structure'],['camera_start','Cámara inicial','helper'],['camera_target','Target de cámara','helper']],
'Máquinas':[['cut_line','Línea de corte','machine'],['cut_blade','Cuchilla de corte','machine'],['cut_line_broken','Línea de corte rota','machine'],['pack_table','Mesa de embalaje','machine'],['conveyor','Cinta transportadora','machine'],['pack_robot','Robot de embalaje','machine'],['artisan_line','Línea artesanal','machine'],['crane_bridge','Puente grúa','machine'],['crane_trolley','Trolley de grúa','machine'],['crane_hook','Gancho de grúa','machine'],['crane_sling','Eslinga procedural','helper']],
'Vehículos':[['forklift','Autoelevador','vehicle'],['log_truck','Camión de troncos','vehicle'],['dispatch_truck','Camión de despacho','vehicle']],
'Producto':[['raw_log','Tronco entero','product'],['board','Tabla','product'],['board_stack','Pila de tablas','product'],['package','Paquete terminado','product']],
'Personajes':[['beaver','Castor','worker'],['pack_robot_character','Robot','worker'],['squirrel','Ardilla','worker']],
'Buffers':[['buffer','Buffer paramétrico','zone'],['storage_area','Área de depósito','zone']],
'Hotspots':[['work_point','Punto de trabajo','hotspot'],['maintenance_point','Punto mantenimiento','hotspot'],['pickup_point','Punto pickup','hotspot'],['drop_point','Punto drop','hotspot'],['idle_point','Punto idle','hotspot'],['accident_point','Punto accidente','hotspot'],['protest_point','Punto protesta','hotspot'],['quality_text_anchor','Anchor texto calidad','ui'],['machine_text_anchor','Anchor texto máquina','ui'],['blade_up','Cuchilla: arriba','hotspot'],['blade_down','Cuchilla: abajo','hotspot']]
};
const DYNAMIC_REFS=[['custom','Posición custom'],['cut1.outputFree','Corte 1 · salida libre'],['cut2.outputFree','Corte 2 · salida libre'],['cut3.outputFree','Corte 3 · salida libre'],['cutBuffer.free','Depósito corte · slot libre'],['artisanBuffer.free','Depósito artesanal · slot libre'],['finishedBuffer.free','Producto terminado · slot libre'],['pack1.inputFree','Embalaje 1 · entrada libre'],['pack2.inputFree','Embalaje 2 · entrada libre'],['pack1.outputFree','Embalaje 1 · salida libre'],['pack2.outputFree','Embalaje 2 · salida libre'],['dispatch.free','Camión despacho · slot libre']];

const viewport=$('#viewport');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;viewport.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x252b31);
const camera=new THREE.PerspectiveCamera(45,1,.05,1000);camera.position.set(18,20,22);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,0,0);orbit.enableDamping=true;
const transform=new TransformControls(camera,renderer.domElement);transform.setSpace('world');scene.add(transform.getHelper());
transform.addEventListener('dragging-changed',e=>orbit.enabled=!e.value);
scene.add(new THREE.HemisphereLight(0xffffff,0x45505b,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(15,25,12);sun.castShadow=true;scene.add(sun);
let grid=new THREE.GridHelper(60,60,0x87919c,0x4b555f);scene.add(grid);
const floorGroup=new THREE.Group();scene.add(floorGroup);const referenceGroup=new THREE.Group();scene.add(referenceGroup);const decalGroup=new THREE.Group();scene.add(decalGroup);const objectGroup=new THREE.Group();scene.add(objectGroup);const routeGroup=new THREE.Group();scene.add(routeGroup);
const loader=new GLTFLoader();const textureLoader=new THREE.TextureLoader();const clock=new THREE.Clock();

let data=defaultData(), selectedId=null, selectedThree=null, routeGhost=null,routeGhostInfo=null,currentTileId=null,floorPaint=false,eraseFloorMode=false,selectedDecalId=null,draggingDecal=false,referenceEdit=false,referenceDrag=null;
const runtime=new Map(),assetRuntime=new Map(),animationRuntime=new Map(),decalRuntime=new Map(),mixers=new Map();
let selectionBox=null,decalSelectionBox=null;
function defaultData(){return {version:2.5,gridSize:1,floor:{width:30,depth:20,cells:{},base:{name:null,repeatX:6,repeatY:4,rotate90:false},dirt:{name:null,repeatX:6,repeatY:4,rotate90:false}},reference:{name:null,visible:true,opacity:.45,x:0,z:0,width:30,height:20,rotation:0,keepAspect:true},decals:[],decalLibrary:[],objects:[],assets:[],animations:[],tiles:[],routes:[],layers:Object.fromEntries(LAYERS.map(x=>[x,true])),camera:{position:[18,20,22],target:[0,0,0]}};}
function isCharacterKind(kind){return info(kind).group==='Personajes'}
function uid(p='id'){return p+'-'+Math.random().toString(36).slice(2,9)}
function t0(){return {position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}}}
function serialT(o){return {position:{x:+o.position.x.toFixed(4),y:+o.position.y.toFixed(4),z:+o.position.z.toFixed(4)},rotation:{x:+o.rotation.x.toFixed(5),y:+o.rotation.y.toFixed(5),z:+o.rotation.z.toFixed(5)},scale:{x:+o.scale.x.toFixed(4),y:+o.scale.y.toFixed(4),z:+o.scale.z.toFixed(4)}}}
function applyT(o,t){o.position.set(t.position.x,t.position.y,t.position.z);o.rotation.set(t.rotation.x,t.rotation.y,t.rotation.z);o.scale.set(t.scale.x,t.scale.y,t.scale.z)}
function info(kind){for(const [group,a] of Object.entries(CATALOG))for(const i of a)if(i[0]===kind)return {group,label:i[1],layer:i[2]};return {group:'Otros',label:kind,layer:'helper'}}
function esc(s){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}

function openDb(){return new Promise((ok,no)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(DB_STORE);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function dbPut(k,v){const db=await openDb();return new Promise((ok,no)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(v,k);tx.oncomplete=ok;tx.onerror=()=>no(tx.error)})}
async function dbGet(k){const db=await openDb();return new Promise((ok,no)=>{const tx=db.transaction(DB_STORE,'readonly'),r=tx.objectStore(DB_STORE).get(k);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}

async function ensurePreset(){if(!data.assets.some(a=>a.id===PRESET_BEAVER_ID))data.assets.unshift({id:PRESET_BEAVER_ID,name:'🦫 Castor v2 (predefinido)',animations:[],preset:true});if(!await dbGet('model:'+PRESET_BEAVER_ID)){const r=await fetch(PRESET_BEAVER_URL);if(!r.ok)throw Error('No pude cargar castorv2.glb');await dbPut('model:'+PRESET_BEAVER_ID,await r.blob())}try{await loadAsset(PRESET_BEAVER_ID)}catch(e){console.warn('Preset castor:',e)}}
async function loadAsset(id){let p=assetRuntime.get(id);if(p)return p;const a=data.assets.find(x=>x.id===id);if(!a)throw Error('Asset inexistente');const blob=await dbGet('model:'+id);if(!blob)throw Error('Archivo no disponible en IndexedDB');const ab=await blob.arrayBuffer();const gltf=await new Promise((ok,no)=>loader.parse(ab,'',ok,no));p={scene:gltf.scene,animations:gltf.animations};assetRuntime.set(id,p);a.animations=gltf.animations.map(x=>x.name);return p}
async function assetInstance(id){const p=await loadAsset(id);const c=SkeletonUtils.clone(p.scene);c.userData.editorAnimations=p.animations;return c}
async function loadAnimationAsset(id){let p=animationRuntime.get(id);if(p)return p;const a=data.animations.find(x=>x.id===id);if(!a)throw Error('Animación inexistente');const blob=await dbGet('anim:'+id);if(!blob)throw Error('Archivo de animación no disponible');const ab=await blob.arrayBuffer();const gltf=await new Promise((ok,no)=>loader.parse(ab,'',ok,no));p={animations:gltf.animations};animationRuntime.set(id,p);a.clips=gltf.animations.map(x=>x.name||'Clip');return p}
async function uploadCharacterAnimation(file,kind){const id=uid('anim');await dbPut('anim:'+id,file);const rec={id,kind,name:file.name,clips:[]};data.animations.push(rec);try{await loadAnimationAsset(id)}catch(e){data.animations=data.animations.filter(x=>x.id!==id);alert('No pude leer las animaciones de ese GLB/GLTF: '+e.message);return}saveSoon();renderInspector()}
async function deleteCharacterAnimation(id){data.animations=data.animations.filter(x=>x.id!==id);animationRuntime.delete(id);const r=selected();if(r?.animation?.startsWith(id+'::'))r.animation=null;saveSoon();renderInspector()}

function placeholder(kind){const layer=info(kind).layer,g=new THREE.Group();if(layer==='hotspot'||layer==='ui'){const m=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),new THREE.MeshBasicMaterial({color:COLORS[layer],depthTest:false}));g.add(m);const r=new THREE.Mesh(new THREE.TorusGeometry(.34,.025,8,24),new THREE.MeshBasicMaterial({color:COLORS[layer],depthTest:false}));r.rotation.x=Math.PI/2;g.add(r);return g}let geo;if(kind==='storage_area'||kind==='buffer')geo=new THREE.BoxGeometry(2,.06,2);else if(kind.includes('truck'))geo=new THREE.BoxGeometry(3,1.4,1.5);else if(kind==='forklift')geo=new THREE.BoxGeometry(1.4,1.1,1);else if(kind==='wall')geo=new THREE.BoxGeometry(4,2.5,.18);else if(kind==='column')geo=new THREE.BoxGeometry(.35,3,.35);else geo=new THREE.BoxGeometry(1.7,1,1.4);const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:COLORS[layer],roughness:.8,transparent:kind==='buffer'||kind==='storage_area',opacity:kind==='buffer'||kind==='storage_area'?.38:1}));m.position.y=kind==='buffer'||kind==='storage_area'?0.03:(geo.parameters?.height||1)/2;g.add(m);return g}
function labelSprite(text){const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.fillStyle='#111c';x.fillRect(0,0,512,96);x.fillStyle='#fff';x.font='30px sans-serif';x.textAlign='center';x.fillText(text,256,58);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));s.scale.set(3.2,.6,1);s.position.y=1.7;s.userData.editorLabel=true;return s}
async function instantiate(rec){const old=runtime.get(rec.id);if(old){objectGroup.remove(old);runtime.delete(rec.id)}let obj=null;if(rec.assetId)try{obj=await assetInstance(rec.assetId)}catch(e){console.warn(e)}if(!obj)obj=placeholder(rec.kind);obj.userData.recordId=rec.id;obj.visible=rec.visible!==false&&data.layers[rec.layer]!==false;applyT(obj,rec.transform);obj.add(labelSprite(rec.name));objectGroup.add(obj);runtime.set(rec.id,obj);if(rec.kind==='buffer')refreshBuffer(rec);if(rec.animation)playAnimation(rec.id,rec.animation);return obj}
function autoAsset(kind){if(kind==='beaver')return PRESET_BEAVER_ID;return null}
function makeRecord(kind,name,assetId=null){const i=info(kind);return {id:uid(kind),kind,name:name||i.label,layer:i.layer,visible:true,assetId:assetId||autoAsset(kind),transform:t0(),meta:kind==='buffer'?{count:4,offset:{x:1.2,y:0,z:0},visualKind:'board_stack'}:{},animation:null}}
async function addRecord(kind,assetId=null){const r=makeRecord(kind,null,assetId);data.objects.push(r);await instantiate(r);select(r.id);saveSoon();renderTree()}

function clearSelectionBox(){if(selectionBox){scene.remove(selectionBox);selectionBox.geometry?.dispose?.();selectionBox.material?.dispose?.();selectionBox=null}}
function refreshSelectionBox(){clearSelectionBox();if(!selectedThree)return;selectionBox=new THREE.BoxHelper(selectedThree,0xffd54a);selectionBox.material.depthTest=false;selectionBox.material.transparent=true;selectionBox.material.opacity=.95;selectionBox.renderOrder=999;scene.add(selectionBox)}
function select(id){selectedId=id;selectedThree=runtime.get(id)||null;routeGhostInfo=null;if(selectedThree)transform.attach(selectedThree);else transform.detach();refreshSelectionBox();renderTree();renderInspector();$('#modeBadge').textContent='OBJETO'}
function selected(){return data.objects.find(o=>o.id===selectedId)||null}
function syncTransform(){if(routeGhostInfo&&transform.object===routeGhost){const r=data.routes.find(x=>x.id===routeGhostInfo.routeId),k=r?.keyframes.find(x=>x.id===routeGhostInfo.kfId);if(k){k.transform=serialT(routeGhost);saveSoon();redrawRoutes(false)}return}const r=selected();if(r&&selectedThree){r.transform=serialT(selectedThree);if(r.kind==='buffer')refreshBuffer(r);selectionBox?.update();saveSoon();renderInspector()}}
transform.addEventListener('objectChange',syncTransform);
function deleteSelected(){const r=selected();if(!r)return;objectGroup.remove(runtime.get(r.id));runtime.delete(r.id);data.objects=data.objects.filter(x=>x.id!==r.id);selectedId=null;selectedThree=null;transform.detach();clearSelectionBox();saveSoon();renderTree();renderInspector()}
function duplicate(){const r=selected();if(!r)return;const c=structuredClone(r);c.id=uid(r.kind);c.name+=' copia';c.transform.position.x+=data.gridSize;data.objects.push(c);instantiate(c).then(()=>select(c.id));saveSoon()}
function focus(){const o=transform.object||selectedThree;if(!o)return;const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new THREE.Vector3()),s=Math.max(1,b.getSize(new THREE.Vector3()).length());orbit.target.copy(c);camera.position.copy(c.clone().add(new THREE.Vector3(s,s*.8,s)));orbit.update()}

function renderTree(){const q=($('#treeFilter').value||'').toLowerCase();$('#sceneTree').innerHTML=data.objects.filter(o=>o.name.toLowerCase().includes(q)||o.kind.includes(q)).map(o=>`<div class="tree-item ${o.id===selectedId?'selected':''}" data-id="${o.id}"><button class="vis">${o.visible===false?'○':'●'}</button><span class="name">${esc(o.name)}</span><small>${info(o.kind).label}</small></div>`).join('')||'<div class="muted">Escena vacía</div>';document.querySelectorAll('.tree-item').forEach(el=>{el.onclick=e=>{if(e.target.classList.contains('vis'))return;select(el.dataset.id)};el.querySelector('.vis').onclick=e=>{e.stopPropagation();const r=data.objects.find(x=>x.id===el.dataset.id);r.visible=r.visible===false;const o=runtime.get(r.id);if(o)o.visible=r.visible&&data.layers[r.layer]!==false;saveSoon();renderTree()}})}
function renderLayers(){$('#layerList').innerHTML=LAYERS.map(l=>`<div class="layer-row"><input type="checkbox" data-layer="${l}" ${data.layers[l]!==false?'checked':''}><span>${l}</span></div>`).join('');document.querySelectorAll('[data-layer]').forEach(e=>e.onchange=()=>{data.layers[e.dataset.layer]=e.checked;data.objects.filter(o=>o.layer===e.dataset.layer).forEach(o=>{const x=runtime.get(o.id);if(x)x.visible=e.checked&&o.visible!==false});saveSoon()})}
function num(label,key,axis,val){return `<label>${label}</label><input class="tr" data-key="${key}" data-axis="${axis}" type="number" step="0.1" value="${(+val).toFixed(3)}">`}
function renderInspector(){const r=selected();if(!r){$('#inspector').innerHTML='<div class="muted">Seleccioná un objeto.</div>';return}
const assets=data.assets.map(a=>`<option value="${a.id}" ${a.id===r.assetId?'selected':''}>${esc(a.name)}</option>`).join('');
const baseClips=(data.assets.find(a=>a.id===r.assetId)?.animations||[]).map(a=>({value:'base::'+a,label:a}));
const charAnims=isCharacterKind(r.kind)?data.animations.filter(a=>a.kind===r.kind):[];
const externalClips=charAnims.flatMap(a=>(a.clips||[]).map(c=>({value:a.id+'::'+c,label:a.name+' · '+c})));
const clipOptions=[...baseClips,...externalClips].map(a=>`<option value="${esc(a.value)}" ${a.value===r.animation?'selected':''}>${esc(a.label)}</option>`).join('');
let special='';
if(r.kind==='buffer')special=`<div class="inspector-block"><h4>Buffer paramétrico</h4><div class="kv"><span>Cantidad</span><input id="bufCount" type="number" min="1" max="30" value="${r.meta.count}"></div><div class="inspector-grid"><label>Offset</label><input class="bo" data-a="x" type="number" step=".1" value="${r.meta.offset.x}"><input class="bo" data-a="y" type="number" step=".1" value="${r.meta.offset.y}"><input class="bo" data-a="z" type="number" step=".1" value="${r.meta.offset.z}"></div></div>`;
let characterBlock='';
if(isCharacterKind(r.kind)) characterBlock=`<div class="inspector-block"><h4>🎞 Animaciones de ${esc(info(r.kind).label)}</h4><label class="file-button wide">Cargar animación GLB / GLTF<input id="characterAnimUpload" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json"></label><small class="muted">Se guardan sólo para este tipo de personaje. El archivo puede contener sólo rig + animación.</small><div class="character-animation-list">${charAnims.map(a=>`<div class="asset-row"><span class="asset-name">${esc(a.name)}</span><small>${(a.clips||[]).length} clips</small><button data-del-char-anim="${a.id}">×</button></div>`).join('')||'<div class="muted">Todavía no cargaste animaciones para este personaje.</div>'}</div></div>`;
$('#inspector').innerHTML=`<div class="kv"><span>Nombre</span><input id="objName" value="${esc(r.name)}"></div><div class="kv"><span>Modelo</span><select id="objAsset"><option value="">Placeholder</option>${assets}</select></div>${clipOptions?`<div class="kv"><span>Animación preview</span><select id="objAnim"><option value="">Sin preview</option>${clipOptions}</select></div>`:''}<div class="inspector-block"><h4>Transform</h4><div class="inspector-grid"><span></span><b>X</b><b>Y</b><b>Z</b>${num('Pos','position','x',r.transform.position.x)}${num('','position','y',r.transform.position.y)}${num('','position','z',r.transform.position.z)}${num('Rot°','rotation','x',THREE.MathUtils.radToDeg(r.transform.rotation.x))}${num('','rotation','y',THREE.MathUtils.radToDeg(r.transform.rotation.y))}${num('','rotation','z',THREE.MathUtils.radToDeg(r.transform.rotation.z))}${num('Esc','scale','x',r.transform.scale.x)}${num('','scale','y',r.transform.scale.y)}${num('','scale','z',r.transform.scale.z)}</div></div>${special}${characterBlock}<div class="row"><button id="dupObj">Shift+D Duplicar</button><button id="delObj">Delete</button></div>`;
$('#objName').onchange=e=>{r.name=e.target.value;const old=runtime.get(r.id);old?.children.filter(x=>x.userData.editorLabel).forEach(x=>old.remove(x));old?.add(labelSprite(r.name));saveSoon();renderTree()};
$('#objAsset').onchange=async e=>{r.assetId=e.target.value||null;r.animation=null;await instantiate(r);select(r.id);saveSoon()};
$('#objAnim')?.addEventListener('change',e=>{r.animation=e.target.value||null;playAnimation(r.id,r.animation);saveSoon()});
document.querySelectorAll('.tr').forEach(el=>el.onchange=()=>{const v=+el.value;if(el.dataset.key==='rotation')r.transform.rotation[el.dataset.axis]=THREE.MathUtils.degToRad(v);else r.transform[el.dataset.key][el.dataset.axis]=v;applyT(selectedThree,r.transform);selectionBox?.update();saveSoon()});
$('#dupObj').onclick=duplicate;$('#delObj').onclick=deleteSelected;
if(r.kind==='buffer'){ $('#bufCount').onchange=e=>{r.meta.count=+e.target.value;refreshBuffer(r);saveSoon()};document.querySelectorAll('.bo').forEach(e=>e.onchange=()=>{r.meta.offset[e.dataset.a]=+e.value;refreshBuffer(r);saveSoon()})}
$('#characterAnimUpload')?.addEventListener('change',e=>e.target.files[0]&&uploadCharacterAnimation(e.target.files[0],r.kind));
document.querySelectorAll('[data-del-char-anim]').forEach(b=>b.onclick=()=>deleteCharacterAnimation(b.dataset.delCharAnim));
}
async function playAnimation(id,key){mixers.delete(id);if(!key)return;const o=runtime.get(id);if(!o)return;let clip=null;if(key.startsWith('base::')){const name=key.slice(6);clip=(o.userData.editorAnimations||[]).find(c=>c.name===name)}else{const split=key.indexOf('::');if(split>0){const aid=key.slice(0,split),name=key.slice(split+2);const p=await loadAnimationAsset(aid);clip=p.animations.find(c=>c.name===name)||p.animations[0]}}if(!clip)return;const m=new THREE.AnimationMixer(o);m.clipAction(clip).reset().play();mixers.set(id,m)}

function renderAssetLibrary(){$('#assetLibrary').innerHTML=data.assets.map(a=>`<div class="asset-row"><span class="asset-name">${esc(a.name)}</span><small>${(a.animations||[]).length} anim</small>${a.preset?'':'<button data-del="'+a.id+'">×</button>'}</div>`).join('');document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const id=b.dataset.del;data.assets=data.assets.filter(a=>a.id!==id);data.objects.filter(o=>o.assetId===id).forEach(o=>{o.assetId=null;instantiate(o)});assetRuntime.delete(id);saveSoon();renderAll()})}
async function uploadModel(file){const id=uid('asset');await dbPut('model:'+id,file);data.assets.push({id,name:file.name,animations:[]});try{await loadAsset(id)}catch(e){alert('No pude leer ese GLB/GLTF: '+e.message)}saveSoon();renderAll()}
function refreshBuffer(r){const root=runtime.get(r.id);if(!root)return;const old=root.getObjectByName('__bufferCopies');if(old)root.remove(old);const g=new THREE.Group();g.name='__bufferCopies';for(let i=1;i<Math.max(1,r.meta.count);i++){const p=placeholder(r.meta.visualKind||'board_stack');p.scale.set(.55,.55,.55);p.position.set(r.meta.offset.x*i,r.meta.offset.y*i,r.meta.offset.z*i);p.traverse(n=>{if(n.material){n.material=n.material.clone();n.material.transparent=true;n.material.opacity=.45}});g.add(p)}root.add(g)}

function renderCatalog(filter=''){const q=filter.toLowerCase(),assetOptions=data.assets.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');$('#objectCatalog').innerHTML=`<div style="margin-bottom:10px"><label>Modelo al crear <select id="createAsset"><option value="">Automático / placeholder</option>${assetOptions}</select></label><small class="muted" style="display:block;margin-top:4px">Castor usa Castor v2 automáticamente. Para cualquier otro objeto podés elegir un GLB acá.</small></div>`+Object.entries(CATALOG).map(([g,a])=>{const f=a.filter(x=>x[1].toLowerCase().includes(q)||x[0].includes(q));return f.length?`<div class="catalog-group"><h3>${g}</h3><div class="catalog-grid">${f.map(x=>`<button type="button" data-kind="${x[0]}">${x[1]}</button>`).join('')}</div></div>`:''}).join('');document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{const aid=$('#createAsset')?.value||null;addRecord(b.dataset.kind,aid);$('#objectDialog').close()})}


function ensureFloorV23(){
  data.floor=data.floor||{width:30,depth:20,cells:{}};
  data.floor.cells=data.floor.cells||{};
  data.floor.base=Object.assign({name:null,repeatX:6,repeatY:4,rotate90:false},data.floor.base||{});
  data.floor.dirt=Object.assign({name:null,repeatX:6,repeatY:4,rotate90:false},data.floor.dirt||{});
  data.decals=Array.isArray(data.decals)?data.decals:[];
  data.decalLibrary=Array.isArray(data.decalLibrary)?data.decalLibrary:[];
  data.reference=Object.assign({name:null,visible:true,opacity:.45,x:0,z:0,width:data.floor.width||30,height:data.floor.depth||20,rotation:0,keepAspect:true},data.reference||{});
}
async function uploadFloorLayer(file,layer){
  await dbPut('floor:'+layer,file);
  data.floor[layer].name=file.name;
  saveSoon();await rebuildFloorLayers();renderFloorControls();
}
async function floorTexture(layer){
  const blob=await dbGet('floor:'+layer);if(!blob)return null;
  return await new Promise((ok,no)=>{const u=URL.createObjectURL(blob);textureLoader.load(u,t=>{URL.revokeObjectURL(u);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;ok(t)},undefined,no)});
}
function clearFloorVisuals(){floorGroup.clear()}
async function addRepeatedLayer(layer,y,transparent){
  const cfg=data.floor[layer],tex=await floorTexture(layer);if(!tex)return;
  const w=data.floor.width,d=data.floor.depth,s=data.gridSize,rx=Math.max(1,+cfg.repeatX||1),ry=Math.max(1,+cfg.repeatY||1);
  const cellW=w*s/rx,cellD=d*s/ry;
  for(let x=0;x<rx;x++)for(let z=0;z<ry;z++){
    const t=tex.clone();t.needsUpdate=true;t.center.set(.5,.5);
    if(cfg.rotate90)t.rotation=THREE.MathUtils.degToRad(((x*37+z*53)%4)*90);
    const mat=new THREE.MeshStandardMaterial({map:t,side:THREE.DoubleSide,transparent,depthWrite:!transparent});
    const m=new THREE.Mesh(new THREE.PlaneGeometry(cellW,cellD),mat);m.rotation.x=-Math.PI/2;m.position.set((x-rx/2+.5)*cellW,y,(z-ry/2+.5)*cellD);floorGroup.add(m);
  }
}
async function rebuildFloorLayers(){
  clearFloorVisuals();
  const w=data.floor.width*data.gridSize,d=data.floor.depth*data.gridSize;
  const baseBg=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({color:0x343a40,side:THREE.DoubleSide}));
  baseBg.rotation.x=-Math.PI/2;baseBg.position.y=-.003;floorGroup.add(baseBg);
  await addRepeatedLayer('base',0,false);
  await addRepeatedLayer('dirt',.003,true);
}

async function uploadReference(file){
  await dbPut('reference:image',file);
  data.reference.name=file.name;
  if(!data.reference.width)data.reference.width=data.floor.width*data.gridSize;
  if(!data.reference.height)data.reference.height=data.floor.depth*data.gridSize;
  saveSoon();await rebuildReference();renderFloorControls();
}
async function rebuildReference(){
  referenceGroup.clear();
  const cfg=data.reference;if(!cfg?.name||cfg.visible===false)return;
  const blob=await dbGet('reference:image');if(!blob)return;
  const tex=await new Promise((ok,no)=>{const u=URL.createObjectURL(blob);textureLoader.load(u,t=>{URL.revokeObjectURL(u);t.colorSpace=THREE.SRGBColorSpace;ok(t)},undefined,no)});
  const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:Math.max(0,Math.min(1,+cfg.opacity||0)),side:THREE.DoubleSide,depthWrite:false,depthTest:false});
  const w=Math.max(.01,+cfg.width||1),h=Math.max(.01,+cfg.height||1),a=THREE.MathUtils.degToRad(cfg.rotation||0);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
  m.rotation.set(-Math.PI/2,0,a);m.position.set(+cfg.x||0,.02,+cfg.z||0);m.renderOrder=800;m.userData.referenceBody=true;referenceGroup.add(m);
  if(referenceEdit){
    const linePts=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]].map(([x,y])=>new THREE.Vector3(x,y,.001));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts),new THREE.LineBasicMaterial({color:0xffd54a,depthTest:false}));
    line.rotation.copy(m.rotation);line.position.copy(m.position);line.renderOrder=901;referenceGroup.add(line);
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{
      const local=new THREE.Vector3(sx*w/2,sy*h/2,0);const world=m.localToWorld(local.clone());
      const handle=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.12,Math.min(w,h)*.018),12,8),new THREE.MeshBasicMaterial({color:0xffd54a,depthTest:false}));
      handle.position.copy(world);handle.position.y=.035;handle.userData.referenceHandle={sx,sy};handle.renderOrder=902;referenceGroup.add(handle);
    });
  }
}
function referenceBasis(){
  const a=THREE.MathUtils.degToRad(data.reference.rotation||0);
  return {u:new THREE.Vector3(Math.cos(a),0,-Math.sin(a)),v:new THREE.Vector3(Math.sin(a),0,Math.cos(a))};
}
function rotateReference(delta){
  data.reference.rotation=(((data.reference.rotation||0)+delta)%360+360)%360;
  rebuildReference();renderFloorControls();saveSoon();
}
async function uploadDecal(file){
  const id=uid('decalAsset');await dbPut('decal:'+id,file);data.decalLibrary.push({id,name:file.name});saveSoon();renderFloorControls();
}
async function decalTexture(id){
  const blob=await dbGet('decal:'+id);if(!blob)return null;
  return await new Promise((ok,no)=>{const u=URL.createObjectURL(blob);textureLoader.load(u,t=>{URL.revokeObjectURL(u);t.colorSpace=THREE.SRGBColorSpace;ok(t)},undefined,no)});
}
async function instantiateDecal(rec){
  const old=decalRuntime.get(rec.id);if(old){decalGroup.remove(old);decalRuntime.delete(rec.id)}
  const tex=await decalTexture(rec.assetId);if(!tex)return;
  const mat=new THREE.MeshBasicMaterial({map:tex,transparent:rec.transparent!==false,side:THREE.DoubleSide,depthWrite:false});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);m.rotation.set(-Math.PI/2,0,THREE.MathUtils.degToRad(rec.rotation||0));m.position.set(rec.x||0,.008,rec.z||0);m.scale.set(rec.scaleX||1,rec.scaleY||1,1);m.userData.decalId=rec.id;decalGroup.add(m);decalRuntime.set(rec.id,m);return m;
}
async function rebuildDecals(){decalGroup.clear();decalRuntime.clear();for(const d of data.decals)await instantiateDecal(d);refreshDecalSelection()}
function selectedDecal(){return data.decals.find(d=>d.id===selectedDecalId)||null}
function clearDecalSelection(){selectedDecalId=null;refreshDecalSelection()}
function refreshDecalSelection(){
  if(decalSelectionBox){scene.remove(decalSelectionBox);decalSelectionBox.geometry?.dispose?.();decalSelectionBox.material?.dispose?.();decalSelectionBox=null}
  const m=selectedDecalId?decalRuntime.get(selectedDecalId):null;
  if(m){decalSelectionBox=new THREE.BoxHelper(m,0xffd54a);decalSelectionBox.material.depthTest=false;decalSelectionBox.material.transparent=true;decalSelectionBox.material.opacity=.95;decalSelectionBox.renderOrder=1000;scene.add(decalSelectionBox)}
  renderFloorControls();
}
function setDecalSelected(id){selectedDecalId=id;selectedId=null;selectedThree=null;transform.detach();clearSelectionBox();renderTree();renderInspector();renderFloorControls()}
async function placeDecalAt(assetId,p){
  if(!assetId)return;const rec={id:uid('decal'),assetId,x:+p.x.toFixed(4),z:+p.z.toFixed(4),rotation:0,scaleX:2,scaleY:2,locked:false,transparent:false};
  data.decals.push(rec);await instantiateDecal(rec);setDecalSelected(rec.id);saveSoon();
}
function rotateDecal(id,deg=45){const d=data.decals.find(x=>x.id===id);if(!d||d.locked)return;d.rotation=((d.rotation||0)+deg)%360;const m=decalRuntime.get(id);if(m)m.rotation.z=THREE.MathUtils.degToRad(d.rotation);saveSoon();renderFloorControls()}
function renderFloorControls(){
  const el=$('#floorV23');if(!el)return;
  const lib=data.decalLibrary.map(a=>`<div class="asset-row decal-library-item ${a.id===window.__selectedDecalAsset?'selected':''}" draggable="true" data-decal-asset="${a.id}"><span class="asset-name">${esc(a.name)}</span></div>`).join('')||'<div class="muted">Cargá JPG/PNG para la biblioteca.</div>';
  const d=selectedDecal();
  el.innerHTML=`
  <div class="floor-layer-card"><b>Capa base</b><label class="file-button wide">Cargar imagen<input id="baseUpload" type="file" accept="image/*"></label><small>${esc(data.floor.base.name||'Sin imagen')}</small><div class="row"><label>Rep X <input id="baseRX" type="number" min="1" max="50" value="${data.floor.base.repeatX}"></label><label>Rep Y <input id="baseRY" type="number" min="1" max="50" value="${data.floor.base.repeatY}"></label></div><label><input id="baseRot" type="checkbox" ${data.floor.base.rotate90?'checked':''}> Rotar mosaicos de a 90°</label></div>
  <div class="floor-layer-card"><b>Decals</b><label class="file-button wide">Agregar JPG / PNG<input id="decalUpload" type="file" accept="image/jpeg,image/png,image/webp"></label><small>Arrastrá al viewport o seleccioná y Ctrl+click. Click derecho sobre decal: +45°.</small><div id="decalLibraryV23">${lib}</div>${d?`<div class="decal-selected-panel"><b>Seleccionada</b><label><input id="decalLock" type="checkbox" ${d.locked?'checked':''}> Bloquear posición</label><div class="row"><label>Ancho <input id="decalSX" type="number" step=".1" value="${d.scaleX}"></label><label>Alto <input id="decalSY" type="number" step=".1" value="${d.scaleY}"></label></div><small>Rotación: ${d.rotation||0}°</small><button id="deleteDecal">Eliminar decal</button></div>`:''}</div>
  <div class="floor-layer-card reference-card ${referenceEdit?'editing':''}"><b>Imagen de referencia</b><label class="file-button wide">Cargar referencia<input id="referenceUpload" type="file" accept="image/*"></label><small>${esc(data.reference.name||'Sin imagen')}</small><label><input id="referenceVisible" type="checkbox" ${data.reference.visible!==false?'checked':''}> Mostrar referencia</label><label>Transparencia <input id="referenceOpacity" type="range" min="0" max="1" step=".05" value="${data.reference.opacity}"><span id="referenceOpacityValue">${Math.round((data.reference.opacity||0)*100)}%</span></label><div class="row reference-actions"><button id="referenceEditBtn" class="${referenceEdit?'active':''}">${referenceEdit?'✓ Editando':'✥ Editar referencia'}</button><button id="referenceRotL">↶ 90°</button><button id="referenceRotR">↷ 90°</button></div><label><input id="referenceKeepAspect" type="checkbox" ${data.reference.keepAspect!==false?'checked':''}> Mantener proporción al redimensionar</label><div class="row"><label>X <input id="referenceX" type="number" step=".1" value="${data.reference.x}"></label><label>Z <input id="referenceZ" type="number" step=".1" value="${data.reference.z}"></label></div><div class="row"><label>Ancho <input id="referenceW" type="number" min=".1" step=".1" value="${data.reference.width}"></label><label>Alto <input id="referenceH" type="number" min=".1" step=".1" value="${data.reference.height}"></label></div><small>${referenceEdit?'Arrastrá la imagen para moverla. Arrastrá una esquina amarilla para redimensionarla.':'Fuera del modo Editar no recibe clicks ni interfiere con la escena.'}</small></div>
  <div class="floor-layer-card"><b>Capa mugre</b><label class="file-button wide">Cargar PNG con alfa<input id="dirtUpload" type="file" accept="image/png,image/webp"></label><small>${esc(data.floor.dirt.name||'Sin imagen')}</small><div class="row"><label>Rep X <input id="dirtRX" type="number" min="1" max="50" value="${data.floor.dirt.repeatX}"></label><label>Rep Y <input id="dirtRY" type="number" min="1" max="50" value="${data.floor.dirt.repeatY}"></label></div><label><input id="dirtRot" type="checkbox" ${data.floor.dirt.rotate90?'checked':''}> Rotar mosaicos de a 90°</label></div>`;
  $('#baseUpload').onchange=e=>e.target.files[0]&&uploadFloorLayer(e.target.files[0],'base');$('#dirtUpload').onchange=e=>e.target.files[0]&&uploadFloorLayer(e.target.files[0],'dirt');$('#decalUpload').onchange=e=>e.target.files[0]&&uploadDecal(e.target.files[0]);$('#referenceUpload').onchange=e=>e.target.files[0]&&uploadReference(e.target.files[0]);
  [['baseRX','base','repeatX'],['baseRY','base','repeatY'],['dirtRX','dirt','repeatX'],['dirtRY','dirt','repeatY']].forEach(([id,l,k])=>$('#'+id).onchange=e=>{data.floor[l][k]=Math.max(1,+e.target.value||1);rebuildFloorLayers();saveSoon()});
  $('#baseRot').onchange=e=>{data.floor.base.rotate90=e.target.checked;rebuildFloorLayers();saveSoon()};$('#dirtRot').onchange=e=>{data.floor.dirt.rotate90=e.target.checked;rebuildFloorLayers();saveSoon()};
  $('#referenceVisible').onchange=e=>{data.reference.visible=e.target.checked;rebuildReference();saveSoon()};
  $('#referenceOpacity').oninput=e=>{data.reference.opacity=+e.target.value;$('#referenceOpacityValue').textContent=Math.round(data.reference.opacity*100)+'%';rebuildReference();saveSoon()};
  $('#referenceEditBtn').onclick=()=>{referenceEdit=!referenceEdit;referenceDrag=null;orbit.enabled=true;rebuildReference();renderFloorControls()};
  $('#referenceRotL').onclick=()=>rotateReference(-90);$('#referenceRotR').onclick=()=>rotateReference(90);
  $('#referenceKeepAspect').onchange=e=>{data.reference.keepAspect=e.target.checked;saveSoon()};
  [['referenceX','x'],['referenceZ','z'],['referenceW','width'],['referenceH','height']].forEach(([id,k])=>$('#'+id).onchange=e=>{data.reference[k]=+e.target.value;rebuildReference();saveSoon()});
  document.querySelectorAll('[data-decal-asset]').forEach(x=>{x.onclick=()=>{window.__selectedDecalAsset=x.dataset.decalAsset;renderFloorControls()};x.ondragstart=e=>{e.dataTransfer.setData('text/castorium-decal',x.dataset.decalAsset);window.__selectedDecalAsset=x.dataset.decalAsset}});
  if(d){$('#decalLock').onchange=e=>{d.locked=e.target.checked;saveSoon()};$('#decalSX').onchange=e=>{d.scaleX=Math.max(.05,+e.target.value||1);decalRuntime.get(d.id)?.scale.set(d.scaleX,d.scaleY,1);saveSoon()};$('#decalSY').onchange=e=>{d.scaleY=Math.max(.05,+e.target.value||1);decalRuntime.get(d.id)?.scale.set(d.scaleX,d.scaleY,1);saveSoon()};$('#deleteDecal').onclick=()=>{decalGroup.remove(decalRuntime.get(d.id));decalRuntime.delete(d.id);data.decals=data.decals.filter(x=>x.id!==d.id);selectedDecalId=null;saveSoon();renderFloorControls()}}
}
function floorPointFromEvent(e){const ray=rayFromEvent(e),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),p=new THREE.Vector3();return ray.ray.intersectPlane(plane,p)?p:null}
function copyFloorConfig(){
  const out={version:'2.5',size:{width:data.floor.width,depth:data.floor.depth,gridSize:data.gridSize},base:data.floor.base,dirt:data.floor.dirt,decalLibrary:data.decalLibrary,decals:data.decals};
  navigator.clipboard.writeText(JSON.stringify(out,null,2)).then(()=>alert('Configuración del piso copiada. Pegámela en el chat cuando quieras hardcodearla.'));
}
async function uploadTile(file){const id=uid('tile');await dbPut('tile:'+id,file);data.tiles.push({id,name:file.name});currentTileId=id;saveSoon();renderTiles()}
async function applyTile(mesh,cell){const id=typeof cell==='string'?cell:cell?.tileId;if(!id)return;const b=await dbGet('tile:'+id);if(!b)return;const u=URL.createObjectURL(b);textureLoader.load(u,t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.center.set(.5,.5);t.rotation=THREE.MathUtils.degToRad(typeof cell==='string'?0:(cell.rotation||0));mesh.material.map=t;mesh.material.color.set(0xffffff);mesh.material.needsUpdate=true;URL.revokeObjectURL(u)})}
function rebuildFloor(){floorGroup.clear();const w=data.floor.width,d=data.floor.depth,s=data.gridSize;for(let x=0;x<w;x++)for(let z=0;z<d;z++){const key=x+','+z,cell=data.floor.cells[key],m=new THREE.Mesh(new THREE.PlaneGeometry(s,s),new THREE.MeshStandardMaterial({color:cell?0xffffff:0x343a40,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set((x-w/2+.5)*s,0,(z-d/2+.5)*s);m.userData.floorCell={x,z,key};floorGroup.add(m);if(cell)applyTile(m,cell)}}
function renderTiles(){$('#tilePalette').innerHTML=data.tiles.map(t=>`<div class="tile-row"><div class="tile-thumb ${t.id===currentTileId?'active':''}" data-tile="${t.id}"></div><span>${esc(t.name)}</span></div>`).join('')||'<div class="muted">Cargá una textura para pintar.</div>';data.tiles.forEach(async t=>{const b=await dbGet('tile:'+t.id),e=document.querySelector(`[data-tile="${t.id}"]`);if(b&&e){const u=URL.createObjectURL(b);e.style.backgroundImage=`url(${u})`;e.onclick=()=>{currentTileId=t.id;eraseFloorMode=false;renderTiles()}}})}
function rayFromEvent(e){const r=renderer.domElement.getBoundingClientRect(),m=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1),ray=new THREE.Raycaster();ray.setFromCamera(m,camera);return ray}
function recordIdFromHit(obj){let o=obj;while(o&&o!==objectGroup){if(o.userData?.recordId)return o.userData.recordId;o=o.parent}return null}
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;const ray=rayFromEvent(e);
  if(referenceEdit&&e.button===0){
    const hits=ray.intersectObjects(referenceGroup.children,true);
    const handleHit=hits.find(h=>h.object.userData.referenceHandle);
    const bodyHit=hits.find(h=>h.object.userData.referenceBody);
    const p=floorPointFromEvent(e);
    if(handleHit&&p){
      const {sx,sy}=handleHit.object.userData.referenceHandle,{u,v}=referenceBasis(),c=new THREE.Vector3(data.reference.x,0,data.reference.z);
      const opposite=c.clone().addScaledVector(u,-sx*data.reference.width/2).addScaledVector(v,-sy*data.reference.height/2);
      referenceDrag={mode:'resize',sx,sy,opposite,aspect:Math.max(.0001,data.reference.width/Math.max(.0001,data.reference.height))};orbit.enabled=false;return;
    }
    if(bodyHit&&p){
      referenceDrag={mode:'move',offsetX:data.reference.x-p.x,offsetZ:data.reference.z-p.z};orbit.enabled=false;return;
    }
  }
  const decalHit=ray.intersectObjects(decalGroup.children,true)[0];
  if(decalHit){const id=decalHit.object.userData.decalId||decalHit.object.parent?.userData?.decalId;if(id){if(e.button===2){e.preventDefault();rotateDecal(id,45);setDecalSelected(id);return}setDecalSelected(id);const d=data.decals.find(x=>x.id===id);if(d&&!d.locked){draggingDecal=true;orbit.enabled=false}return}}
  if(e.ctrlKey&&e.button===0&&window.__selectedDecalAsset){const p=floorPointFromEvent(e);if(p){placeDecalAt(window.__selectedDecalAsset,p);return}}
if(floorPaint){const h=ray.intersectObjects(floorGroup.children,false).find(x=>x.object.userData.floorCell);if(!h)return;const k=h.object.userData.floorCell.key;if(e.button===2){e.preventDefault();const old=data.floor.cells[k];if(old){const cell=typeof old==='string'?{tileId:old,rotation:0}:old;cell.rotation=((cell.rotation||0)+90)%360;data.floor.cells[k]=cell}else if(currentTileId&&!eraseFloorMode)data.floor.cells[k]={tileId:currentTileId,rotation:90}}else{if(eraseFloorMode||!currentTileId)delete data.floor.cells[k];else data.floor.cells[k]={tileId:currentTileId,rotation:0}}rebuildFloor();saveSoon();return}if(e.button!==0)return;const hits=ray.intersectObjects(objectGroup.children,true).filter(h=>!h.object.userData?.editorLabel);for(const h of hits){const id=recordIdFromHit(h.object);if(id){select(id);return}}});
renderer.domElement.addEventListener('pointermove',e=>{
  if(referenceDrag){
    const p=floorPointFromEvent(e);if(!p)return;
    if(referenceDrag.mode==='move'){data.reference.x=+(p.x+referenceDrag.offsetX).toFixed(4);data.reference.z=+(p.z+referenceDrag.offsetZ).toFixed(4)}
    else if(referenceDrag.mode==='resize'){
      const {u,v}=referenceBasis(),delta=p.clone().sub(referenceDrag.opposite);let w=Math.max(.1,Math.abs(delta.dot(u))),h=Math.max(.1,Math.abs(delta.dot(v)));
      if(data.reference.keepAspect!==false){const a=referenceDrag.aspect;if(w/h>a)h=w/a;else w=h*a}
      data.reference.width=+w.toFixed(4);data.reference.height=+h.toFixed(4);
      const center=referenceDrag.opposite.clone().addScaledVector(u,referenceDrag.sx*w/2).addScaledVector(v,referenceDrag.sy*h/2);
      data.reference.x=+center.x.toFixed(4);data.reference.z=+center.z.toFixed(4);
    }
    rebuildReference();saveSoon();return;
  }
  if(!draggingDecal||!selectedDecalId)return;const d=selectedDecal();if(!d||d.locked)return;const p=floorPointFromEvent(e);if(!p)return;d.x=+p.x.toFixed(4);d.z=+p.z.toFixed(4);const m=decalRuntime.get(d.id);if(m)m.position.set(d.x,.008,d.z);saveSoon()
});
window.addEventListener('pointerup',()=>{if(referenceDrag){referenceDrag=null;orbit.enabled=true;renderFloorControls()}if(draggingDecal){draggingDecal=false;orbit.enabled=true}});
renderer.domElement.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('text/castorium-decal'))e.preventDefault()});
renderer.domElement.addEventListener('drop',e=>{const id=e.dataTransfer.getData('text/castorium-decal');if(!id)return;e.preventDefault();const p=floorPointFromEvent(e);if(p)placeDecalAt(id,p)});
renderer.domElement.addEventListener('contextmenu',e=>{if(floorPaint||rayFromEvent(e).intersectObjects(decalGroup.children,true).length)e.preventDefault()});

function addRoute(){const r={id:uid('route'),name:'Ruta '+(data.routes.length+1),vehicleAssetId:null,keyframes:[{id:uid('kf'),ref:'custom',transform:t0()},{id:uid('kf'),ref:'custom',transform:{...t0(),position:{x:4,y:0,z:0}}}]};data.routes.push(r);renderRoutes();selectKf(r.id,r.keyframes[0].id);saveSoon()}
function currentRoute(){return data.routes.find(r=>r.id===$('#routeSelect').value)||data.routes[0]||null}
function renderRoutes(){const s=$('#routeSelect');s.innerHTML=data.routes.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')||'<option value="">Sin rutas</option>';renderRouteEditor();redrawRoutes()}
function renderRouteEditor(){const r=currentRoute();if(!r){$('#routeEditor').innerHTML='<div class="muted">Creá una ruta.</div>';return}$('#routeSelect').value=r.id;const a=data.assets.map(x=>`<option value="${x.id}" ${r.vehicleAssetId===x.id?'selected':''}>${esc(x.name)}</option>`).join('');$('#routeEditor').innerHTML=`<div class="kv"><span>Nombre</span><input id="routeName" value="${esc(r.name)}"></div><div class="kv"><span>Modelo ghost</span><select id="routeAsset"><option value="">Placeholder autoelevador</option>${a}</select></div>${r.keyframes.map((k,i)=>`<div class="route-kf" data-kf="${k.id}"><b>Keyframe ${i+1}</b><select data-ref="${k.id}">${DYNAMIC_REFS.map(([v,l])=>`<option value="${v}" ${k.ref===v?'selected':''}>${l}</option>`).join('')}</select><small>${k.ref==='custom'?'Click acá y mové/rotá la copia fantasma':'Posición dinámica'}</small></div>`).join('')}<div class="route-actions"><button id="addKf">＋ Keyframe</button><button id="delRoute">Eliminar ruta</button></div>`;$('#routeName').onchange=e=>{r.name=e.target.value;saveSoon();renderRoutes()};$('#routeAsset').onchange=e=>{r.vehicleAssetId=e.target.value||null;saveSoon();redrawRoutes()};$('#addKf').onclick=()=>{const k={id:uid('kf'),ref:'custom',transform:structuredClone(r.keyframes.at(-1)?.transform||t0())};k.transform.position.x+=2;r.keyframes.push(k);saveSoon();renderRouteEditor();redrawRoutes()};$('#delRoute').onclick=()=>{data.routes=data.routes.filter(x=>x.id!==r.id);saveSoon();renderRoutes()};document.querySelectorAll('[data-ref]').forEach(s=>s.onchange=()=>{r.keyframes.find(k=>k.id===s.dataset.ref).ref=s.value;saveSoon();renderRouteEditor();redrawRoutes()});document.querySelectorAll('.route-kf').forEach(e=>e.onclick=x=>{if(x.target.tagName!=='SELECT')selectKf(r.id,e.dataset.kf)})}
async function selectKf(rid,kid){const r=data.routes.find(x=>x.id===rid),k=r?.keyframes.find(x=>x.id===kid);if(!k||k.ref!=='custom')return;if(routeGhost)routeGroup.remove(routeGhost);routeGhost=r.vehicleAssetId?await assetInstance(r.vehicleAssetId):placeholder('forklift');routeGhost.traverse(n=>{if(n.material){n.material=n.material.clone();n.material.transparent=true;n.material.opacity=.55}});applyT(routeGhost,k.transform);routeGroup.add(routeGhost);routeGhostInfo={routeId:rid,kfId:kid};selectedId=null;selectedThree=routeGhost;transform.attach(routeGhost);$('#modeBadge').textContent='RUTA · KEYFRAME'}
function dyn(ref){const r=data.objects.find(o=>o.meta?.refKey===ref||o.name===ref);return r?runtime.get(r.id)?.getWorldPosition(new THREE.Vector3()):null}
function redrawRoutes(keepGhost=true){[...routeGroup.children].forEach(c=>{if(keepGhost&&c===routeGhost)return;routeGroup.remove(c)});data.routes.forEach(r=>{const p=r.keyframes.map(k=>k.ref==='custom'?new THREE.Vector3(k.transform.position.x,k.transform.position.y+.08,k.transform.position.z):dyn(k.ref)).filter(Boolean);if(p.length>1){routeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),new THREE.LineBasicMaterial({color:0x69c9ff})));p.forEach(v=>{const s=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:0x69c9ff}));s.position.copy(v);routeGroup.add(s)})}})}

let saveTimer;function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveLocal,200)}function saveLocal(){data.gridSize=+$('#gridSize').value||1;data.camera={position:camera.position.toArray(),target:orbit.target.toArray()};localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
async function loadLocal(){const raw=localStorage.getItem(STORAGE_KEY);if(raw)try{data=Object.assign(defaultData(),JSON.parse(raw));data.animations=Array.isArray(data.animations)?data.animations:[]}catch{}ensureFloorV23();await ensurePreset();$('#gridSize').value=data.gridSize||1;$('#floorWidth').value=data.floor.width;$('#floorDepth').value=data.floor.depth;camera.position.fromArray(data.camera?.position||[18,20,22]);orbit.target.fromArray(data.camera?.target||[0,0,0]);updateGrid();await rebuildFloorLayers();await rebuildReference();await rebuildDecals();for(const o of data.objects)await instantiate(o);renderAll();saveLocal()}
function renderAll(){renderTree();renderLayers();renderInspector();renderAssetLibrary();renderTiles();renderCatalog();renderRoutes();renderFloorControls()}
function updateGrid(){scene.remove(grid);const s=+$('#gridSize').value||1,size=Math.max(data.floor.width,data.floor.depth)*s*1.5;grid=new THREE.GridHelper(size,Math.round(size/s),0x87919c,0x4b555f);grid.visible=$('#toggleGrid').classList.contains('active');scene.add(grid);data.gridSize=s;rebuildFloorLayers();saveSoon()}
function exportJson(){saveLocal();const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='castorium-map.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function importJson(file){data=Object.assign(defaultData(),JSON.parse(await file.text()));data.animations=Array.isArray(data.animations)?data.animations:[];ensureFloorV23();await ensurePreset();selectedId=null;selectedThree=null;transform.detach();clearSelectionBox();objectGroup.clear();runtime.clear();for(const o of data.objects)await instantiate(o);await rebuildFloorLayers();await rebuildReference();await rebuildDecals();renderAll();saveLocal()}

window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;const k=e.key.toLowerCase();if(e.shiftKey&&k==='d'){e.preventDefault();duplicate();return}if(k==='g'){transform.setMode('translate');$('#modeBadge').textContent='MOVER'}else if(k==='r'){transform.setMode('rotate');$('#modeBadge').textContent='ROTAR'}else if(k==='s'){transform.setMode('scale');$('#modeBadge').textContent='ESCALAR'}else if(k==='x'){transform.showX=true;transform.showY=false;transform.showZ=false}else if(k==='y'){transform.showX=false;transform.showY=true;transform.showZ=false}else if(k==='z'){transform.showX=false;transform.showY=false;transform.showZ=true}else if(k==='f')focus();else if(k==='h'&&selected()){const r=selected();r.visible=false;runtime.get(r.id).visible=false;renderTree();saveSoon()}else if(e.altKey&&k==='h'){data.objects.forEach(r=>{r.visible=true;const o=runtime.get(r.id);if(o)o.visible=data.layers[r.layer]!==false});renderTree();saveSoon()}else if(e.key==='Delete')deleteSelected();else if(k==='escape'){transform.showX=transform.showY=transform.showZ=true;$('#modeBadge').textContent='OBJETO'}});

$('#addObject').onclick=()=>{$('#objectDialog').showModal();renderCatalog()};$('#objectSearch').oninput=e=>renderCatalog(e.target.value);$('#treeFilter').oninput=renderTree;$('#modelUpload').onchange=e=>e.target.files[0]&&uploadModel(e.target.files[0]);$('#tileUpload').onchange=e=>e.target.files[0]&&uploadTile(e.target.files[0]);$('#gridSize').onchange=updateGrid;$('#toggleGrid').onclick=e=>{e.currentTarget.classList.toggle('active');grid.visible=e.currentTarget.classList.contains('active')};$('#focusSelected').onclick=focus;$('#floorMode').onclick=e=>{floorPaint=!floorPaint;e.currentTarget.classList.toggle('active',floorPaint);orbit.enabled=!floorPaint;$('#modeBadge').textContent=floorPaint?'PINTAR PISO':'OBJETO'};$('#eraseFloor').onclick=()=>{eraseFloorMode=true;currentTileId=null;renderTiles()};$('#resizeFloor').onclick=()=>{data.floor.width=Math.max(1,+$('#floorWidth').value);data.floor.depth=Math.max(1,+$('#floorDepth').value);updateGrid();rebuildFloorLayers();saveSoon()};$('#newScene').onclick=()=>{if(!confirm('¿Vaciar la escena?'))return;const assets=data.assets,tiles=data.tiles,animations=data.animations,decalLibrary=data.decalLibrary;data=defaultData();data.assets=assets;data.tiles=tiles;data.animations=animations;data.decalLibrary=decalLibrary;objectGroup.clear();runtime.clear();selectedId=null;selectedThree=null;transform.detach();clearSelectionBox();referenceGroup.clear();decalGroup.clear();decalRuntime.clear();rebuildFloorLayers();rebuildReference();renderAll();saveLocal()};$('#saveScene').onclick=()=>{saveLocal();alert('Guardado en este navegador.')};$('#exportScene').onclick=exportJson;$('#importScene').onchange=e=>e.target.files[0]&&importJson(e.target.files[0]);$('#copyFloorConfig').onclick=copyFloorConfig;$('#addRoute').onclick=addRoute;$('#routeSelect').onchange=()=>{renderRouteEditor();redrawRoutes()};
function resize(){const r=viewport.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}window.addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();mixers.forEach(m=>m.update(dt));selectionBox?.update();decalSelectionBox?.update();orbit.update();renderer.render(scene,camera)}animate();
loadLocal().catch(e=>{console.error(e);alert('Error inicializando editor: '+e.message)});
