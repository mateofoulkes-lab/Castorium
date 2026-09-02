
const CONFIG = {
  startingMoney: 50000,
  logTruckCost: 1000,
  logsPerTruck: 5,
  cutsPerStack: 10,
  cutsPerLog: 80,
  cuttingLineCost: 35000,
  packagingLineCost: 8000,
  artisanLineCost: 18000,
  cuttingSlots: 3,
  packagingSlots: 2,
  packagingSteps: ["Envolver", "Cantoneras", "Zunchar", "Etiquetar", "Liberar"],
  payrollEveryDays: 30,
  automationMs: 700,
  wearPerCut: 0.18,
  wearPerPackStep: 0.08,
  forkliftWearPerTrip: 0.45,
  manualRepair: 4,
  maintenanceRepair: 8,
};

const QUALITY = {
  scrap: { name: "Chatarra", icon: "🗑️", price: 120, rank: 0 },
  third: { name: "Tercera", icon: "🥉", price: 420, rank: 1 },
  second: { name: "Segunda", icon: "🥈", price: 700, rank: 2 },
  first: { name: "Primera", icon: "🥇", price: 1050, rank: 3 },
  premium: { name: "Premium", icon: "💎", price: 1650, rank: 4 },
};

const WORKER_CATALOG = [
  { id: "crane-1", role: "crane", icon: "🏗️", name: "Tito Álamo", title: "Gruero", hire: 3500, salary: 900, skill: 66, max: 1, desc: "Descarga camiones y alimenta líneas de corte vacías." },

  { id: "cutter-1", role: "cutter", icon: "🪚", name: "Nora Viruta", title: "Operadora de corte", hire: 4500, salary: 1100, skill: 70, max: 3, desc: "Opera una línea de corte. Una operadora no puede atender dos líneas a la vez." },
  { id: "cutter-2", role: "cutter", icon: "🪚", name: "Pipo Dientón", title: "Operador de corte", hire: 4800, salary: 1150, skill: 66, max: 3, desc: "Segundo puesto de corte para cuando la planta crece." },
  { id: "cutter-3", role: "cutter", icon: "🪚", name: "Susana Astilla", title: "Operadora de corte", hire: 5200, salary: 1250, skill: 78, max: 3, desc: "Tercer puesto de corte. Tiene muy buena mano para la calidad." },

  { id: "packer-1", role: "packer", icon: "📦", name: "Marta Serrucho", title: "Embaladora", hire: 4500, salary: 1050, skill: 72, max: 2, desc: "Opera una línea de embalaje." },
  { id: "packer-2", role: "packer", icon: "📦", name: "Raúl Castiñeiro", title: "Embalador", hire: 4900, salary: 1150, skill: 69, max: 2, desc: "Segundo embalador para la segunda línea." },

  { id: "forklift-1", role: "forklift", icon: "🚜", name: "Beto Incisivo", title: "Autoelevadorista", hire: 5000, salary: 1200, skill: 68, max: 4, desc: "Opera el Autoelevador 1." },
  { id: "forklift-2", role: "forklift", icon: "🚜", name: "Lidia Paleta", title: "Autoelevadorista", hire: 5300, salary: 1250, skill: 72, max: 4, desc: "Opera el Autoelevador 2." },
  { id: "forklift-3", role: "forklift", icon: "🚜", name: "René Roedor", title: "Autoelevadorista", hire: 5600, salary: 1300, skill: 76, max: 4, desc: "Opera el Autoelevador 3." },
  { id: "forklift-4", role: "forklift", icon: "🚜", name: "Cacho Quebracho", title: "Autoelevadorista", hire: 6000, salary: 1400, skill: 82, max: 4, desc: "Opera el Autoelevador 4. Es el último espacio del estacionamiento." },

  { id: "maintenance-1", role: "maintenance", icon: "🔧", name: "Rubén Rodamiento", title: "Guardia de mantenimiento", hire: 6500, salary: 1500, skill: 76, max: 1, desc: "Repara líneas y autoelevadores deteriorados." },
  { id: "classifier-1", role: "classifier", icon: "🧐", name: "Elsa Nogal", title: "Clasificadora artesanal", hire: 7500, salary: 1600, skill: 68, max: 1, desc: "Prioriza pilas de peor calidad y las mejora en la línea artesanal." },
  { id: "dispatcher-1", role: "dispatcher", icon: "📋", name: "Omar Represa", title: "Despachante", hire: 5200, salary: 1200, skill: 74, max: 1, desc: "Despacha automáticamente el camión cuando el pedido está completo." },
];

let nextId = 1;
const uid = (prefix) => `${prefix}-${nextId++}`;

const state = {
  money: CONFIG.startingMoney,
  day: 1,
  minute: 8 * 60,
  speed: 1,
  boss: "libre",
  incomingTruck: null,
  rawYard: [],
  cuttingLines: Array.from({ length: CONFIG.cuttingSlots }, () => null),
  cutBuffer: [],
  artisanLine: null,
  artisanYard: [],
  packagingLines: Array.from({ length: CONFIG.packagingSlots }, () => null),
  finishedYard: [],
  order: createOrder(3),
  dispatchTruck: [],
  completedOrders: 0,
  workers: {},
  forklifts: {},
  classifierLevel: 1,
  lastPayrollDay: 1,
  log: [],
};

function createOrder(quantity = randomInt(3, 7)) { return { id: uid("order"), quantity }; }
function createLog() { return { id: uid("log"), type: "log", cutsRemaining: CONFIG.cutsPerLog }; }
function createCutStack(quality) { return { id: uid("stack"), type: "stack", quality }; }
function createFinishedPackage(quality) { return { id: uid("package"), type: "package", quality }; }
function newCuttingLine(slot) {
  return { id: uid("cutline"), slot, input: null, cutProgress: 0, outputs: [], health: 100, broken: false, upgrades: { speed: 0, output: 0 }, upgradeOpen: false };
}
function newPackagingLine(slot) {
  return { id: uid("packline"), slot, queue: [], step: 0, outputs: [], health: 100, broken: false, upgrades: { capacity: 0 }, upgradeOpen: false };
}
function newArtisanLine() { return { id: uid("artisan"), input: null, progress: 0, output: null }; }
function newForklift(workerId) {
  return { id: uid("forklift"), workerId, health: 100, broken: false, trips: 0, cooldown: 0, upgrades: { capacity: 0, speed: 0 }, upgradeOpen: false };
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function formatMoney(v) { return new Intl.NumberFormat("es-AR").format(Math.round(v)); }
function hiredWorkers() { return Object.values(state.workers); }
function workersByRole(role) { return hiredWorkers().filter((w) => w.role === role); }
function workerCount(role) { return workersByRole(role).length; }
function hasWorker(role) { return workerCount(role) > 0; }
function isHired(id) { return Boolean(state.workers[id]); }
function bestWorker(role) { return workersByRole(role).sort((a,b) => b.skill-a.skill)[0] ?? null; }
function cutOutputCapacity(line) { return 1 + line.upgrades.output; }
function packCapacity(line) { return 1 + line.upgrades.capacity; }
function cutInterval(line) { return Math.max(90, 260 - line.upgrades.speed * 55); }
function forkliftCapacity(f) { return 1 + f.upgrades.capacity; }
function forkliftCooldown(f) { return Math.max(1, 3 - f.upgrades.speed); }
function qMeta(key) { return QUALITY[key] ?? QUALITY.third; }
function qLabel(key) { const q=qMeta(key); return `${q.icon} ${q.name}`; }
function itemValue(item) { return qMeta(item.quality).price; }

function timeLabel() {
  const hour = Math.floor(state.minute/60)%24;
  const minute = Math.floor(state.minute%60);
  const shift = hour < 14 ? "Mañana" : hour < 22 ? "Tarde" : "Noche";
  return `Día ${state.day} · ${shift} · ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
}
function addLog(message) {
  const stamp=timeLabel().split(" · ").at(-1);
  state.log.unshift(`${stamp} — ${message}`);
  state.log=state.log.slice(0,90);
}
function setBoss(text) { state.boss=text; }
function spend(amount) { if(state.money<amount) return false; state.money-=amount; return true; }

function buyLogs() {
  if(state.incomingTruck) return addLog("⚠ Ya hay un camión esperando en recepción."),render();
  if(!spend(CONFIG.logTruckCost)) return addLog("⚠ No alcanzan las ramitas."),render();
  state.incomingTruck={id:uid("truck"),logs:Array.from({length:CONFIG.logsPerTruck},createLog)};
  addLog("🚚 Llegó un camión con 5 troncos."); render();
}
function buyCuttingLine() {
  const slot=state.cuttingLines.findIndex(x=>x===null);
  if(slot<0) return addLog("⚠ Los 3 espacios de corte ya están ocupados."),render();
  if(!spend(CONFIG.cuttingLineCost)) return addLog("⚠ No alcanzan las ramitas."),render();
  state.cuttingLines[slot]=newCuttingLine(slot); addLog(`🪚 Línea de corte instalada en espacio ${slot+1}.`); render();
}
function buyPackagingLine() {
  const slot=state.packagingLines.findIndex(x=>x===null);
  if(slot<0) return addLog("⚠ Los 2 espacios de embalaje ya están ocupados."),render();
  if(!spend(CONFIG.packagingLineCost)) return addLog("⚠ No alcanzan las ramitas."),render();
  state.packagingLines[slot]=newPackagingLine(slot); addLog(`📦 Línea de embalaje instalada en espacio ${slot+1}.`); render();
}
function buyArtisanLine() {
  if(state.artisanLine) return;
  if(!spend(CONFIG.artisanLineCost)) return addLog("⚠ No alcanzan las ramitas."),render();
  state.artisanLine=newArtisanLine(); addLog("🧰 Línea de troncos artesanales instalada."); render();
}

function hire(id) {
  const c=WORKER_CATALOG.find(x=>x.id===id);
  if(!c||isHired(id)) return;
  if(workerCount(c.role)>=c.max) return addLog("⚠ Ya alcanzaste el máximo para ese puesto."),render();
  if(!spend(c.hire)) return addLog("⚠ No alcanzan las ramitas para contratar."),render();
  state.workers[id]={...c,hiredDay:state.day};
  if(c.role==="forklift") state.forklifts[id]=newForklift(id);
  addLog(`${c.icon} ${c.name} fue contratado como ${c.title}.`); render();
}
function trainClassifier() {
  if(!hasWorker("classifier")||state.classifierLevel>=2) return;
  if(!spend(9000)) return addLog("⚠ No alcanzan las ramitas para capacitar al personal."),render();
  state.classifierLevel=2;
  const w=bestWorker("classifier"); if(w) w.skill+=12;
  addLog("🎓 Clasificación avanzada desbloqueada: Primera → Premium."); render();
}

function upgradeCost(kind,level) {
  const table={
    cutSpeed:[1800,4200,9000],
    cutOutput:[2500,6000],
    packCapacity:[2600,6200,12500],
    forkliftCapacity:[6500],
    forkliftSpeed:[2400,5600],
  };
  return table[kind]?.[level] ?? null;
}
function buyCutUpgrade(index,kind) {
  const line=state.cuttingLines[index]; if(!line)return;
  const key=kind==="cutSpeed"?"speed":"output";
  const cost=upgradeCost(kind,line.upgrades[key]); if(cost==null)return;
  if(!spend(cost)) return addLog("⚠ No alcanzan las ramitas para esa mejora."),render();
  line.upgrades[key]++; addLog(`⚙️ Línea ${index+1}: mejora comprada.`); render();
}
function buyPackUpgrade(index) {
  const line=state.packagingLines[index]; if(!line)return;
  const cost=upgradeCost("packCapacity",line.upgrades.capacity); if(cost==null)return;
  if(!spend(cost)) return addLog("⚠ No alcanzan las ramitas para esa mejora."),render();
  line.upgrades.capacity++; addLog(`⚙️ Embalaje ${index+1}: capacidad de línea ${packCapacity(line)}.`); render();
}
function buyForkliftUpgrade(workerId,kind) {
  const f=state.forklifts[workerId]; if(!f)return;
  const key=kind==="forkliftCapacity"?"capacity":"speed";
  const cost=upgradeCost(kind,f.upgrades[key]); if(cost==null)return;
  if(!spend(cost)) return addLog("⚠ No alcanzan las ramitas para esa mejora."),render();
  f.upgrades[key]++;
  addLog(`🚜 ${state.workers[workerId].name}: ${kind==="forkliftCapacity"?"doble carga":"velocidad"} mejorada.`);
  render();
}

function qualityFromCut(line,skill) {
  const score=line.health*0.62+skill*0.38+randomInt(-18,18);
  if(score<35)return "scrap";
  if(score<55)return "third";
  if(score<73)return "second";
  return "first";
}
function degradeMachine(machine,amount,label="Una máquina") {
  machine.health=clamp(machine.health-amount,0,100);
  if(!machine.broken && machine.health<38) {
    const chance=(38-machine.health)/300;
    if(Math.random()<chance) { machine.broken=true; addLog(`💥 ${label} se rompió y quedó fuera de servicio.`); }
  }
}
function cutOnce(lineIndex,automated=false,operator=null) {
  const line=state.cuttingLines[lineIndex];
  if(!line?.input||line.broken||line.outputs.length>=cutOutputCapacity(line))return false;
  if(!automated)setBoss(`operando corte ${lineIndex+1}`);
  line.cutProgress++; line.input.cutsRemaining--; degradeMachine(line,CONFIG.wearPerCut,`Línea de corte ${lineIndex+1}`);
  if(line.cutProgress>=CONFIG.cutsPerStack) {
    line.cutProgress=0;
    const skill=automated&&operator?operator.skill:58;
    const quality=qualityFromCut(line,skill);
    line.outputs.push(createCutStack(quality));
    addLog(`🟫 Línea ${lineIndex+1} produjo una pila ${qLabel(quality)}.`);
  }
  if(line.input?.cutsRemaining<=0) { addLog(`🪵 Tronco agotado en línea ${lineIndex+1}.`); line.input=null; }
  if(!automated)render(); return true;
}
function packagingStep(lineIndex,automated=false) {
  const line=state.packagingLines[lineIndex];
  if(!line||line.broken||!line.queue.length||line.outputs.length>=packCapacity(line))return false;
  if(!automated)setBoss(`embalando en línea ${lineIndex+1}`);
  const action=CONFIG.packagingSteps[line.step];
  if(!automated)addLog(`📦 ${action} — línea de embalaje ${lineIndex+1}.`);
  line.step++; degradeMachine(line,CONFIG.wearPerPackStep,`Embalaje ${lineIndex+1}`);
  if(line.step>=CONFIG.packagingSteps.length) {
    const stack=line.queue.shift(); line.outputs.push(createFinishedPackage(stack.quality)); line.step=0;
    addLog(`✅ Paquete ${qLabel(stack.quality)} terminado en embalaje ${lineIndex+1}.`);
  }
  if(!automated)render(); return true;
}
function nextQuality(q) {
  if(q==="third")return "second";
  if(q==="second")return "first";
  if(q==="first"&&state.classifierLevel>=2)return "premium";
  return null;
}
function artisanStep(automated=false) {
  const line=state.artisanLine; if(!line?.input||line.output)return false;
  const next=nextQuality(line.input.quality); if(!next)return false;
  if(!automated)setBoss("reapilando en línea artesanal");
  line.progress++;
  if(line.progress>=10) {
    const item=line.input; item.quality=next; line.input=null; line.progress=0; line.output=item;
    addLog(`✨ Línea artesanal mejoró una pila a ${qLabel(next)}.`);
  }
  if(!automated)render(); return true;
}
function repairLine(kind,index,automated=false) {
  const line=kind==="cut"?state.cuttingLines[index]:state.packagingLines[index];
  if(!line||line.health>=100)return false;
  line.health=clamp(line.health+(automated?CONFIG.maintenanceRepair:CONFIG.manualRepair),0,100);
  if(line.broken&&line.health>=45){line.broken=false;addLog(`🔧 ${kind==="cut"?"Línea de corte":"Embalaje"} ${index+1} volvió a servicio.`);}
  if(!automated){setBoss(`reparando ${kind==="cut"?"línea":"embalaje"} ${index+1}`);render();}
  return true;
}
function repairForklift(workerId,automated=false) {
  const f=state.forklifts[workerId]; if(!f||f.health>=100)return false;
  f.health=clamp(f.health+(automated?CONFIG.maintenanceRepair:CONFIG.manualRepair),0,100);
  if(f.broken&&f.health>=45){f.broken=false;addLog(`🔧 Autoelevador de ${state.workers[workerId].name} volvió a servicio.`);}
  if(!automated){setBoss(`reparando autoelevador de ${state.workers[workerId].name}`);render();}
  return true;
}

function dispatchOrder(automated=false) {
  if(state.dispatchTruck.length<state.order.quantity) {
    if(!automated){addLog(`⚠ El camión necesita ${state.order.quantity-state.dispatchTruck.length} paquete(s) más.`);render();}
    return false;
  }
  const sold=state.dispatchTruck.splice(0,state.order.quantity);
  const revenue=sold.reduce((s,x)=>s+itemValue(x),0);
  state.money+=revenue; state.completedOrders++;
  addLog(`🚛 Pedido despachado. +${formatMoney(revenue)} 🌿 según calidad.`);
  state.order=createOrder(); if(!automated)setBoss("libre"); render(); return true;
}

function findItem(source,id) {
  if(source==="incoming")return state.incomingTruck?.logs.find(x=>x.id===id)??null;
  if(source==="rawYard")return state.rawYard.find(x=>x.id===id)??null;
  if(source==="cutBuffer")return state.cutBuffer.find(x=>x.id===id)??null;
  if(source==="artisanYard")return state.artisanYard.find(x=>x.id===id)??null;
  if(source==="finishedYard")return state.finishedYard.find(x=>x.id===id)??null;
  if(source==="artisanLine:input")return state.artisanLine?.input?.id===id?state.artisanLine.input:null;
  if(source==="artisanLine:output")return state.artisanLine?.output?.id===id?state.artisanLine.output:null;
  const [kind,indexText,part]=source.split(":"); const index=Number(indexText);
  if(kind==="cutLine"){const line=state.cuttingLines[index];return part==="input"?line?.input:line?.outputs.find(x=>x.id===id)??null;}
  if(kind==="packLine"){const line=state.packagingLines[index];return part==="queue"?line?.queue.find(x=>x.id===id)??null:line?.outputs.find(x=>x.id===id)??null;}
  return null;
}
function removeArrayItem(arr,id){const i=arr.findIndex(x=>x.id===id);if(i<0)return null;return arr.splice(i,1)[0];}
function removeItem(source,id){
  if(source==="incoming"){const x=removeArrayItem(state.incomingTruck.logs,id);if(state.incomingTruck.logs.length===0){addLog("🚚 Camión de materia prima vacío; se retiró.");state.incomingTruck=null;}return x;}
  if(source==="rawYard")return removeArrayItem(state.rawYard,id);
  if(source==="cutBuffer")return removeArrayItem(state.cutBuffer,id);
  if(source==="artisanYard")return removeArrayItem(state.artisanYard,id);
  if(source==="finishedYard")return removeArrayItem(state.finishedYard,id);
  if(source==="artisanLine:input"){const x=state.artisanLine.input;state.artisanLine.input=null;state.artisanLine.progress=0;return x;}
  if(source==="artisanLine:output"){const x=state.artisanLine.output;state.artisanLine.output=null;return x;}
  const [kind,indexText,part]=source.split(":");const index=Number(indexText);
  if(kind==="cutLine"){const line=state.cuttingLines[index];if(part==="input"&&line?.input?.id===id){const x=line.input;line.input=null;return x;}return removeArrayItem(line.outputs,id);}
  if(kind==="packLine"){const line=state.packagingLines[index];return part==="queue"?removeArrayItem(line.queue,id):removeArrayItem(line.outputs,id);}
  return null;
}
function canImproveQuality(q){return q==="third"||q==="second"||(q==="first"&&state.classifierLevel>=2);}
function canDrop(item,target){
  if(!item)return false;
  if(target==="rawYard")return item.type==="log";
  if(target==="cutBuffer"||target==="artisanYard")return item.type==="stack";
  if(target==="finishedYard")return item.type==="package";
  if(target==="dispatchTruck")return item.type==="package"&&state.dispatchTruck.length<state.order.quantity;
  if(target==="artisanLine")return item.type==="stack"&&state.artisanLine&&!state.artisanLine.input&&canImproveQuality(item.quality);
  const [kind,indexText]=target.split(":");const index=Number(indexText);
  if(kind==="cutLine")return item.type==="log"&&state.cuttingLines[index]&&!state.cuttingLines[index].input;
  if(kind==="packLine"){const line=state.packagingLines[index];return item.type==="stack"&&line&&line.queue.length<packCapacity(line);}
  return false;
}
function placeItem(item,target){
  if(target==="rawYard")state.rawYard.push(item);
  else if(target==="cutBuffer")state.cutBuffer.push(item);
  else if(target==="artisanYard")state.artisanYard.push(item);
  else if(target==="finishedYard")state.finishedYard.push(item);
  else if(target==="dispatchTruck")state.dispatchTruck.push(item);
  else if(target==="artisanLine")state.artisanLine.input=item;
  else {const [kind,indexText]=target.split(":");const index=Number(indexText);if(kind==="cutLine")state.cuttingLines[index].input=item;if(kind==="packLine")state.packagingLines[index].queue.push(item);}
}
function moveItem(source,id,target,automated=false){
  const item=findItem(source,id);if(!canDrop(item,target))return false;
  const removed=removeItem(source,id);placeItem(removed,target);
  if(!automated){setBoss(target==="rawYard"||target.startsWith("cutLine")?"en grúa":"en autoelevador");render();}
  return true;
}

function runCrane(){
  if(!hasWorker("crane"))return false;
  if(state.incomingTruck?.logs.length)return moveItem("incoming",state.incomingTruck.logs[0].id,"rawYard",true);
  const empty=state.cuttingLines.findIndex(l=>l&&!l.input&&!l.broken);
  if(empty>=0&&state.rawYard.length)return moveItem("rawYard",state.rawYard[0].id,`cutLine:${empty}`,true);
  return false;
}
function runCutters(){
  const workers=workersByRole("cutter");
  let changed=false;
  workers.forEach((w,i)=>{const line=state.cuttingLines[i];if(line)changed=cutOnce(i,true,w)||changed;});
  return changed;
}
function eligibleForArtisan(stack){return canImproveQuality(stack.quality);}
function runClassifier(){
  if(!hasWorker("classifier")||!state.artisanLine)return false;
  if(state.artisanLine.input)return artisanStep(true);
  if(state.artisanLine.output)return moveItem("artisanLine:output",state.artisanLine.output.id,"artisanYard",true);
  const c=[];
  state.cuttingLines.forEach((l,i)=>l?.outputs.forEach(s=>{if(eligibleForArtisan(s))c.push({stack:s,source:`cutLine:${i}:output`});}));
  state.cutBuffer.forEach(s=>{if(eligibleForArtisan(s))c.push({stack:s,source:"cutBuffer"});});
  c.sort((a,b)=>qMeta(a.stack.quality).rank-qMeta(b.stack.quality).rank);
  if(!c.length)return false;
  if(Math.random()>(state.classifierLevel>=2?0.8:0.6))return false;
  return moveItem(c[0].source,c[0].stack.id,"artisanLine",true);
}
function nextForkliftMove(){
  for(let i=0;i<state.packagingLines.length;i++){const l=state.packagingLines[i];if(l?.outputs.length&&state.dispatchTruck.length<state.order.quantity)return {source:`packLine:${i}:output`,id:l.outputs[0].id,target:"dispatchTruck"};}
  if(state.finishedYard.length&&state.dispatchTruck.length<state.order.quantity)return {source:"finishedYard",id:state.finishedYard[0].id,target:"dispatchTruck"};
  for(let i=0;i<state.packagingLines.length;i++){
    const l=state.packagingLines[i];if(!l||l.queue.length>=packCapacity(l))continue;
    if(state.artisanYard.length)return {source:"artisanYard",id:state.artisanYard[0].id,target:`packLine:${i}`};
    if(state.cutBuffer.length)return {source:"cutBuffer",id:state.cutBuffer[0].id,target:`packLine:${i}`};
    for(let c=0;c<state.cuttingLines.length;c++){const cut=state.cuttingLines[c];if(cut?.outputs.length&&!eligibleForArtisan(cut.outputs[0]))return {source:`cutLine:${c}:output`,id:cut.outputs[0].id,target:`packLine:${i}`};}
  }
  for(let i=0;i<state.cuttingLines.length;i++){const l=state.cuttingLines[i];if(l?.outputs.length)return {source:`cutLine:${i}:output`,id:l.outputs[0].id,target:"cutBuffer"};}
  for(let i=0;i<state.packagingLines.length;i++){const l=state.packagingLines[i];if(l?.outputs.length)return {source:`packLine:${i}:output`,id:l.outputs[0].id,target:"finishedYard"};}
  return null;
}
function runForklift(worker){
  const f=state.forklifts[worker.id];if(!f||f.broken)return false;
  if(f.cooldown>0){f.cooldown--;return false;}
  let moved=0;
  for(let n=0;n<forkliftCapacity(f);n++){
    const task=nextForkliftMove();if(!task)break;
    if(moveItem(task.source,task.id,task.target,true))moved++;
  }
  if(moved){
    f.trips++; f.cooldown=forkliftCooldown(f);
    degradeMachine(f,CONFIG.forkliftWearPerTrip,`Autoelevador de ${worker.name}`);
    return true;
  }
  return false;
}
function runForklifts(){let changed=false;workersByRole("forklift").forEach(w=>changed=runForklift(w)||changed);return changed;}
function runPackers(){
  const workers=workersByRole("packer");
  let changed=false;
  workers.forEach((w,i)=>{const line=state.packagingLines[i];if(line)changed=packagingStep(i,true)||changed;});
  return changed;
}
function runDispatcher(){return hasWorker("dispatcher")&&state.dispatchTruck.length>=state.order.quantity?dispatchOrder(true):false;}
function runMaintenance(){
  if(!hasWorker("maintenance"))return false;
  const c=[];
  state.cuttingLines.forEach((l,i)=>{if(l&&l.health<82)c.push({kind:"cut",index:i,health:l.health});});
  state.packagingLines.forEach((l,i)=>{if(l&&l.health<82)c.push({kind:"pack",index:i,health:l.health});});
  Object.entries(state.forklifts).forEach(([workerId,f])=>{if(f.health<82)c.push({kind:"forklift",workerId,health:f.health});});
  c.sort((a,b)=>a.health-b.health);if(!c.length)return false;
  const x=c[0];return x.kind==="forklift"?repairForklift(x.workerId,true):repairLine(x.kind,x.index,true);
}
function payroll(){const total=hiredWorkers().reduce((s,w)=>s+w.salary,0);if(!total)return;state.money-=total;addLog(`💸 Sueldos del mes: -${formatMoney(total)} 🌿.`);}

function draggableItem(item,source,label){return `<span class="item" draggable="true" data-id="${item.id}" data-source="${source}" title="Arrastrar">${label}</span>`;}
function stackChip(s,source){return draggableItem(s,source,`🟫 ${qLabel(s.quality)}`);}
function packageChip(p,source){return draggableItem(p,source,`📦 ${qLabel(p.quality)}`);}
function upgradeButton(label,kind,level,max,cost,index,machine){
  if(level>=max)return `<button disabled>✅ ${label} · MAX</button>`;
  return `<button class="machine-upgrade" data-machine="${machine}" data-index="${index}" data-kind="${kind}">⚙️ ${label} · ${formatMoney(cost)} 🌿</button>`;
}
function healthText(m){const s=m.broken?"💥 ROTO":m.health<45?"🔴 crítico":m.health<70?"🟠 gastado":"🟢 operativo";return `${s} · ${Math.round(m.health)}%`;}
function assignedWorker(role,index){return workersByRole(role)[index]??null;}

function renderCuttingLines(){
  return state.cuttingLines.map((line,index)=>{
    if(!line)return `<div class="machine empty">Espacio ${index+1}<br>vacío</div>`;
    const input=line.input?draggableItem(line.input,`cutLine:${index}:input`,`🪵 ${line.input.cutsRemaining}/80`):`<span class="warn">Sin tronco</span>`;
    const outputs=line.outputs.length?line.outputs.map(x=>stackChip(x,`cutLine:${index}:output`)).join(""):"Salida libre";
    const op=assignedWorker("cutter",index);
    const blocked=!line.input||line.broken||line.outputs.length>=cutOutputCapacity(line);
    const speedCost=upgradeCost("cutSpeed",line.upgrades.speed), outCost=upgradeCost("cutOutput",line.upgrades.output);
    return `<div class="machine dropzone" data-drop="cutLine:${index}">
      <b>Línea ${index+1}</b><br>Operador: ${op?`🦫 ${op.name} · hab. ${op.skill}`:"🦫 Jefe / manual"}<br>
      Estado: ${healthText(line)}<br>Entrada: ${input}<br>
      <progress max="${CONFIG.cutsPerStack}" value="${line.cutProgress}"></progress><small>${line.cutProgress}/${CONFIG.cutsPerStack} cortes</small><br>
      Salida (${line.outputs.length}/${cutOutputCapacity(line)}): ${outputs}
      <div class="action-row"><button class="hold-cut" data-line="${index}" ${blocked?"disabled":""}>🪚 Mantener / clickear</button><button class="repair-line" data-kind="cut" data-index="${index}" ${line.health>=100?"disabled":""}>🔧 Reparar</button><button class="toggle-upgrades" data-machine="cut" data-index="${index}">⚙️ Mejoras</button></div>
      ${line.upgradeOpen?`<div class="upgrade-menu">${upgradeButton("Ritmo de corte","cutSpeed",line.upgrades.speed,3,speedCost,index,"cut")}${upgradeButton("Acumulador de salida","cutOutput",line.upgrades.output,2,outCost,index,"cut")}</div>`:""}
    </div>`;
  }).join("");
}
function renderPackagingLines(){
  return state.packagingLines.map((line,index)=>{
    if(!line)return `<div class="machine empty">Espacio ${index+1}<br>vacío</div>`;
    const queue=line.queue.length?line.queue.map(x=>stackChip(x,`packLine:${index}:queue`)).join(""):`<span class="warn">Vacía</span>`;
    const outputs=line.outputs.length?line.outputs.map(x=>packageChip(x,`packLine:${index}:output`)).join(""):"Salida libre";
    const op=assignedWorker("packer",index);
    const action=line.queue.length?CONFIG.packagingSteps[line.step]:"Esperando carga";
    const blocked=!line.queue.length||line.broken||line.outputs.length>=packCapacity(line);
    const cost=upgradeCost("packCapacity",line.upgrades.capacity);
    return `<div class="machine dropzone" data-drop="packLine:${index}">
      <b>Embalaje ${index+1}</b><br>Embalador: ${op?`🦫 ${op.name}`:"🦫 Jefe / manual"}<br>
      Estado: ${healthText(line)}<br>Entrada (${line.queue.length}/${packCapacity(line)}): ${queue}<br>
      <progress max="5" value="${line.step}"></progress><small>${line.step}/5 · ${action}</small><br>
      Salida (${line.outputs.length}/${packCapacity(line)}): ${outputs}
      <div class="action-row"><button class="pack-step" data-line="${index}" ${blocked?"disabled":""}>📦 ${action}</button><button class="repair-line" data-kind="pack" data-index="${index}" ${line.health>=100?"disabled":""}>🔧 Reparar</button><button class="toggle-upgrades" data-machine="pack" data-index="${index}">⚙️ Mejoras</button></div>
      ${line.upgradeOpen?`<div class="upgrade-menu">${upgradeButton("Capacidad de línea +1 entrada/salida","packCapacity",line.upgrades.capacity,3,cost,index,"pack")}</div>`:""}
    </div>`;
  }).join("");
}
function renderArtisanLine(){
  if(!state.artisanLine)return `<span class="muted">Todavía no instalada.</span>`;
  const l=state.artisanLine,input=l.input?stackChip(l.input,"artisanLine:input"):`<span class="warn">Sin pila</span>`,output=l.output?stackChip(l.output,"artisanLine:output"):"Salida libre",next=l.input?nextQuality(l.input.quality):null;
  return `<div class="machine dropzone" data-drop="artisanLine"><b>Línea artesanal</b><br>Entrada: ${input}<br>Objetivo: ${next?qLabel(next):l.input?"No admite mejora":"Esperando pila"}<br><progress max="10" value="${l.progress}"></progress><small>${l.progress}/10 troncos reapilados</small><br>Salida: ${output}<div class="action-row"><button id="artisanStep" ${!l.input||!next||l.output?"disabled":""}>🪵 Reapilar 1 tronco</button></div></div>`;
}
function renderWorkers(){
  return WORKER_CATALOG.map(w=>{
    const hired=isHired(w.id),maxed=workerCount(w.role)>=w.max;
    const extra=w.role==="classifier"&&hired?`<div class="action-row">${state.classifierLevel>=2?`<button disabled>🎓 Clasificación avanzada</button>`:`<button id="trainClassifier" ${state.money<9000?"disabled":""}>🎓 Primera → Premium · 9.000 🌿</button>`}</div>`:"";
    return `<div class="worker-card ${hired?"hired":""}"><b>${w.icon} ${w.name}</b><br><small>${w.title} · habilidad ${w.skill}</small><p>${w.desc}</p>${hired?`<span class="good">Contratado · ${formatMoney(w.salary)} 🌿/mes</span>${extra}`:`<button class="hire-worker" data-id="${w.id}" ${state.money<w.hire||maxed?"disabled":""}>Contratar · ${formatMoney(w.hire)} 🌿</button><small>Sueldo: ${formatMoney(w.salary)} 🌿/mes</small>`}</div>`;
  }).join("");
}
function renderForklifts(){
  const hired=workersByRole("forklift");
  if(!hired.length)return `<span class="muted">🚜 Estacionamiento vacío. Hay 4 lugares.</span>`;
  return hired.map(w=>{
    const f=state.forklifts[w.id];
    const capCost=upgradeCost("forkliftCapacity",f.upgrades.capacity),speedCost=upgradeCost("forkliftSpeed",f.upgrades.speed);
    return `<div class="machine"><b>🚜 Autoelevador ${w.id.split("-")[1]} · ${w.name}</b><br>Estado: ${healthText(f)}<br>Viajes: ${f.trips}<br>Capacidad: ${forkliftCapacity(f)} paquete(s) por viaje · Velocidad: nivel ${f.upgrades.speed+1}
      <div class="action-row"><button class="repair-forklift" data-worker="${w.id}" ${f.health>=100?"disabled":""}>🔧 Reparar</button><button class="forklift-upgrade" data-worker="${w.id}" data-kind="forkliftCapacity" ${capCost==null?"disabled":""}>📦📦 Doble carga ${capCost==null?"· MAX":`· ${formatMoney(capCost)} 🌿`}</button><button class="forklift-upgrade" data-worker="${w.id}" data-kind="forkliftSpeed" ${speedCost==null?"disabled":""}>⚡ Velocidad ${speedCost==null?"· MAX":`· ${formatMoney(speedCost)} 🌿`}</button></div>
    </div>`;
  }).join("");
}
function renderMaintenance(){
  const rows=[];
  state.cuttingLines.forEach((l,i)=>{if(l)rows.push(`🪚 Corte ${i+1}: ${healthText(l)}`);});
  state.packagingLines.forEach((l,i)=>{if(l)rows.push(`📦 Embalaje ${i+1}: ${healthText(l)}`);});
  Object.entries(state.forklifts).forEach(([id,f])=>rows.push(`🚜 ${state.workers[id].name}: ${healthText(f)}`));
  const guard=bestWorker("maintenance");
  return `<div>${guard?`🔧 Guardia: <b>${guard.name}</b> · atiende automáticamente el equipo más deteriorado.`:"Sin guardia contratada: reparaciones manuales."}</div><div>${rows.length?rows.join("<br>"):"Todavía no hay equipos instalados."}</div>`;
}
function tutorialText(){
  if(!state.cuttingLines.some(Boolean))return "1. Comprá tu primera línea de corte.";
  if(!state.incomingTruck&&state.rawYard.length===0&&!state.cuttingLines.some(l=>l?.input))return "2. Comprá un camión de troncos.";
  if(state.completedOrders>0)return "✅ Loop dominado. Ahora escalá personal, logística, mantenimiento y calidad.";
  return "Seguí produciendo y completá el pedido actual.";
}

let activeHold=null;
function stopHold(){if(activeHold)clearInterval(activeHold);activeHold=null;}
function render(){
  document.querySelector("#money").textContent=formatMoney(state.money);
  document.querySelector("#clock").textContent=timeLabel();
  document.querySelector("#boss").textContent=`🦫 Jefe: ${state.boss}`;
  document.querySelector("#tutorial").innerHTML=`<b>🎯 Tutorial</b><div class="tutorial-step">${tutorialText()}</div>`;
  document.querySelector("#workers").innerHTML=renderWorkers();
  document.querySelector("#forkliftParking").innerHTML=renderForklifts();
  document.querySelector("#incoming").innerHTML=state.incomingTruck?`<div>Camión: ${state.incomingTruck.logs.length}/5 troncos</div>${state.incomingTruck.logs.map(x=>draggableItem(x,"incoming","🪵")).join("")}`:"Sin camión";
  document.querySelector("#rawYard").innerHTML=state.rawYard.length?state.rawYard.map(x=>draggableItem(x,"rawYard",`🪵 ${x.cutsRemaining}`)).join(""):"Vacía";
  document.querySelector("#cutLines").innerHTML=renderCuttingLines();
  document.querySelector("#cutBuffer").innerHTML=state.cutBuffer.length?state.cutBuffer.map(x=>stackChip(x,"cutBuffer")).join(""):"Vacía";
  document.querySelector("#artisanLine").innerHTML=renderArtisanLine();
  document.querySelector("#artisanYard").innerHTML=state.artisanYard.length?state.artisanYard.map(x=>stackChip(x,"artisanYard")).join(""):"Vacío";
  document.querySelector("#packLines").innerHTML=renderPackagingLines();
  document.querySelector("#finishedYard").innerHTML=state.finishedYard.length?state.finishedYard.map(x=>packageChip(x,"finishedYard")).join(""):"Vacía";
  const value=state.dispatchTruck.reduce((s,x)=>s+itemValue(x),0);
  document.querySelector("#dispatchTruck").innerHTML=`Carga: ${state.dispatchTruck.length}/${state.order.quantity} · valor ${formatMoney(value)} 🌿<br>${state.dispatchTruck.map(x=>`${qMeta(x.quality).icon}📦`).join(" ")}<div class="action-row"><button id="dispatchButton" ${state.dispatchTruck.length<state.order.quantity?"disabled":""}>🚛 Despachar</button></div>`;
  document.querySelector("#order").innerHTML=`<b>Pedido #${state.order.id.split("-")[1]}</b> · ${state.order.quantity} paquetes · paga según calidad real cargada`;
  document.querySelector("#qualityPrices").innerHTML=Object.values(QUALITY).map(q=>`${q.icon} ${q.name}: <b>${formatMoney(q.price)} 🌿</b>`).join(" · ");
  document.querySelector("#maintenance").innerHTML=renderMaintenance();
  document.querySelector("#log").innerHTML=state.log.map(e=>`<div class="log-entry">${e}</div>`).join("");
  document.querySelector("#buyLogs").disabled=Boolean(state.incomingTruck)||state.money<CONFIG.logTruckCost;
  document.querySelector("#buyCutLine").disabled=!state.cuttingLines.includes(null)||state.money<CONFIG.cuttingLineCost;
  document.querySelector("#buyPackLine").disabled=!state.packagingLines.includes(null)||state.money<CONFIG.packagingLineCost;
  document.querySelector("#buyArtisanLine").disabled=Boolean(state.artisanLine)||state.money<CONFIG.artisanLineCost;
  bindDynamicEvents();
}
function bindDynamicEvents(){
  document.querySelectorAll("[draggable=true]").forEach(el=>el.addEventListener("dragstart",e=>e.dataTransfer.setData("application/json",JSON.stringify({id:el.dataset.id,source:el.dataset.source}))));
  document.querySelectorAll(".dropzone").forEach(zone=>{
    zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("dragover");});
    zone.addEventListener("dragleave",()=>zone.classList.remove("dragover"));
    zone.addEventListener("drop",e=>{e.preventDefault();zone.classList.remove("dragover");try{const d=JSON.parse(e.dataTransfer.getData("application/json"));moveItem(d.source,d.id,zone.dataset.drop);}catch{}});
  });
  document.querySelectorAll(".pack-step").forEach(b=>b.addEventListener("click",()=>packagingStep(Number(b.dataset.line))));
  document.querySelectorAll(".hold-cut").forEach(b=>{
    b.addEventListener("click",()=>cutOnce(Number(b.dataset.line)));
    b.addEventListener("pointerdown",()=>{stopHold();const i=Number(b.dataset.line);activeHold=setInterval(()=>cutOnce(i),cutInterval(state.cuttingLines[i]));});
  });
  document.querySelectorAll(".repair-line").forEach(b=>b.addEventListener("click",()=>repairLine(b.dataset.kind,Number(b.dataset.index))));
  document.querySelectorAll(".repair-forklift").forEach(b=>b.addEventListener("click",()=>repairForklift(b.dataset.worker)));
  document.querySelectorAll(".forklift-upgrade").forEach(b=>b.addEventListener("click",()=>buyForkliftUpgrade(b.dataset.worker,b.dataset.kind)));
  document.querySelector("#artisanStep")?.addEventListener("click",()=>artisanStep(false));
  document.querySelectorAll(".toggle-upgrades").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.index);const line=b.dataset.machine==="cut"?state.cuttingLines[i]:state.packagingLines[i];line.upgradeOpen=!line.upgradeOpen;render();}));
  document.querySelectorAll(".machine-upgrade").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.index);if(b.dataset.machine==="cut")buyCutUpgrade(i,b.dataset.kind);else buyPackUpgrade(i);}));
  document.querySelectorAll(".hire-worker").forEach(b=>b.addEventListener("click",()=>hire(b.dataset.id)));
  document.querySelector("#trainClassifier")?.addEventListener("click",trainClassifier);
  document.querySelector("#dispatchButton")?.addEventListener("click",()=>dispatchOrder(false));
}

document.addEventListener("pointerup",stopHold);
document.addEventListener("pointercancel",stopHold);
document.addEventListener("visibilitychange",stopHold);
document.querySelector("#buyLogs").addEventListener("click",buyLogs);
document.querySelector("#buyCutLine").addEventListener("click",buyCuttingLine);
document.querySelector("#buyPackLine").addEventListener("click",buyPackagingLine);
document.querySelector("#buyArtisanLine").addEventListener("click",buyArtisanLine);
document.querySelectorAll("[data-speed]").forEach(b=>b.addEventListener("click",()=>{state.speed=Number(b.dataset.speed);document.querySelectorAll("[data-speed]").forEach(x=>x.classList.toggle("active",x===b));}));

let automationElapsed=0;
setInterval(()=>{
  if(!state.speed)return;
  state.minute+=state.speed;
  while(state.minute>=1440){state.minute-=1440;state.day++;addLog(`🌅 Comienza el día ${state.day}.`);if(state.day-state.lastPayrollDay>=CONFIG.payrollEveryDays){payroll();state.lastPayrollDay=state.day;}}
  automationElapsed+=1000*state.speed;
  if(automationElapsed>=CONFIG.automationMs){
    automationElapsed=0;
    const changed=Boolean(runMaintenance()|runCrane()|runCutters()|runClassifier()|runForklifts()|runPackers()|runDispatcher());
    if(changed)render(); else document.querySelector("#clock").textContent=timeLabel();
  } else document.querySelector("#clock").textContent=timeLabel();
},1000);

addLog("🦫 Bienvenido a Castorium. El galpón está vacío.");
render();
