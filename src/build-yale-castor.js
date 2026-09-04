import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const viewport=document.querySelector('#viewport');
const statusEl=document.querySelector('#status');
const exportBtn=document.querySelector('#exportBtn');

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
viewport.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x252b31);
scene.add(new THREE.HemisphereLight(0xffffff,0x44505a,2));
const sun=new THREE.DirectionalLight(0xffffff,2);
sun.position.set(5,10,7);sun.castShadow=true;scene.add(sun);

const camera=new THREE.PerspectiveCamera(45,1,.01,100);
camera.position.set(3,2.4,4);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,.7,0);controls.enableDamping=true;

const grid=new THREE.GridHelper(10,20,0x6f7882,0x3a424a);scene.add(grid);

const gltfLoader=new GLTFLoader();
const fbxLoader=new FBXLoader();
const root=new THREE.Group();
root.name='YaleWithDriver';
scene.add(root);

let driveClip=null;

function setShadows(obj){
  obj.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});
}

async function load(){
  statusEl.textContent='Cargando Yale…';
  const yale=await gltfLoader.loadAsync('./models/yale.glb');
  const yaleRoot=yale.scene;
  yaleRoot.name='Yale';
  yaleRoot.position.set(0,0,0);
  yaleRoot.rotation.set(0,0,0);
  yaleRoot.scale.set(.11,.11,.11);
  setShadows(yaleRoot);
  root.add(yaleRoot);

  statusEl.textContent='Cargando Castor…';
  const castor=await gltfLoader.loadAsync('./models/castorv2.glb');
  const castorRoot=castor.scene;
  castorRoot.name='CastorDriver';

  // Transformaciones relativas extraídas del JSON del editor:
  // Yale world Z = -1.7602
  // Castor world Z = -1.9261
  // => Castor relativo a Yale: Z = -0.1659
  castorRoot.position.set(0,.1679,-.1659);
  castorRoot.rotation.set(-1.5708,0,0);
  castorRoot.scale.set(4,4,4);
  setShadows(castorRoot);
  root.add(castorRoot);

  statusEl.textContent='Cargando Drive.fbx…';
  const drive=await fbxLoader.loadAsync('./anim/Drive.fbx');
  driveClip=drive.animations?.[0]||null;
  if(!driveClip)throw new Error('Drive.fbx no contiene un clip de animación.');
  driveClip=driveClip.clone();
  driveClip.name='Drive';

  // Preview
  const mixer=new THREE.AnimationMixer(castorRoot);
  mixer.clipAction(driveClip).play();
  scene.userData.mixer=mixer;

  const box=new THREE.Box3().setFromObject(root);
  const center=box.getCenter(new THREE.Vector3());
  const size=Math.max(1,box.getSize(new THREE.Vector3()).length());
  controls.target.copy(center);
  camera.position.copy(center.clone().add(new THREE.Vector3(size*.75,size*.5,size*.9)));
  controls.update();

  statusEl.textContent='Listo. El origen del GLB queda en el autoelevador.';
  exportBtn.disabled=false;
}

exportBtn.onclick=async()=>{
  exportBtn.disabled=true;
  statusEl.textContent='Exportando GLB…';
  try{
    const exporter=new GLTFExporter();
    const result=await exporter.parseAsync(root,{
      binary:true,
      animations:[driveClip],
      onlyVisible:false,
      trs:true
    });
    const blob=new Blob([result],{type:'model/gltf-binary'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='yale_castor_drive.glb';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    statusEl.textContent='GLB generado.';
  }catch(e){
    console.error(e);
    statusEl.textContent='Error al exportar: '+e.message;
  }finally{
    exportBtn.disabled=false;
  }
};

function resize(){
  const r=viewport.getBoundingClientRect();
  renderer.setSize(r.width,r.height,false);
  camera.aspect=r.width/r.height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);resize();

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt=clock.getDelta();
  scene.userData.mixer?.update(dt);
  controls.update();
  renderer.render(scene,camera);
}
animate();

load().catch(e=>{console.error(e);statusEl.textContent='Error: '+e.message});
