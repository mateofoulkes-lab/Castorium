// ===== Castorium extension v4: roster, manual staff assignment, purchases, union and cheats =====

const JOBS = {
  cutter: { label:"Corte", icon:"🪚" },
  packer: { label:"Embalaje", icon:"📦" },
  forklift: { label:"Autoelevador", icon:"🚜" },
  crane: { label:"Grúa", icon:"🏗️" },
  maintenance: { label:"Mantenimiento", icon:"🔧" },
  classifier: { label:"Clasificación", icon:"🧐" },
  dispatcher: { label:"Despacho", icon:"📋" },
  supervisor: { label:"Supervisión", icon:"👔" },
  engineer: { label:"Ingeniería", icon:"💡" },
};

state.union = { heat:12, demand:null, lastDemandDay:1, strikeUntilDay:null, supervisorPush:false };
state.staffAssignments = {
  cutter:[null,null,null],
  packer:[null,null],
  crane:null,
  classifier:null,
  maintenance:null,
  dispatcher:null,
  supervisor:null,
  engineer:[null,null],
};
state.craneAutonomous = false;
state.dispatchAutonomous = false;
state.ui = { expandedWorkerId:null };
state.forkliftSerial = 1;
const FORKLIFT_COST = 12000;

function skillSeed(worker, role){
  if(role === worker.role) return worker.skill;
  const related = {
    cutter:["maintenance","classifier"], packer:["dispatcher","forklift"],
    forklift:["crane","dispatcher"], crane:["forklift","maintenance"],
    maintenance:["cutter","forklift"], classifier:["cutter","packer"],
    dispatcher:["packer","forklift"], supervisor:["dispatcher","engineer"],
    engineer:["maintenance","supervisor"],
  };
  const near = (related[worker.role]||[]).includes(role);
  const hash = [...(worker.id+role)].reduce((s,c)=>s+c.charCodeAt(0),0);
  return clamp((near ? 26 : 10) + (hash % (near ? 20 : 18)), 5, 48);
}
function ensureWorkerSkills(worker){
  if(!worker) return;
  worker.skills ??= {};
  Object.keys(JOBS).forEach(role=>{
    if(worker.skills[role] == null) worker.skills[role] = skillSeed(worker,role);
  });
  worker.familiarity ??= {};
  worker.reassignHistory ??= [];
}
function jobSkill(worker,role){ ensureWorkerSkills(worker); return worker?.skills?.[role] ?? 0; }
function assignmentRoleForMachine(machineId){
  if(state.cuttingLines.some(l=>l?.id===machineId)) return "cutter";
  if(state.packagingLines.some(l=>l?.id===machineId)) return "packer";
  return null;
}
function gainJobSkill(worker,role,amount=0.035){
  if(!worker || !role) return;
  ensureWorkerSkills(worker);
  const current = worker.skills[role];
  const slowdown = current < 30 ? 1.8 : current < 60 ? 1 : current < 80 ? .55 : .22;
  worker.skills[role] = clamp(current + amount*slowdown,0,100);
}
const __baseGainFamiliarity = gainFamiliarity;
gainFamiliarity = function(worker,machineId){
  __baseGainFamiliarity(worker,machineId);
  gainJobSkill(worker, assignmentRoleForMachine(machineId), 0.045);
};
effectiveSkill = function(worker,machineId){
  if(!worker) return 58;
  const role = assignmentRoleForMachine(machineId) || worker.role;
  const fam = worker.familiarity?.[machineId] ?? 0;
  return jobSkill(worker,role) + Math.min(10,fam/10);
};

function hiredWorkerById(id){ return id ? state.workers[id] ?? null : null; }
function isTraining(worker){ return Boolean(worker?.trainingUntilDay && state.day < worker.trainingUntilDay); }
function unionOnStrike(){ return state.union.strikeUntilDay != null && state.day < state.union.strikeUntilDay; }

function removeWorkerFromAssignments(workerId){
  ["cutter","packer","engineer"].forEach(role=>{
    state.staffAssignments[role] = state.staffAssignments[role].map(id=>id===workerId?null:id);
  });
  ["crane","classifier","maintenance","dispatcher","supervisor"].forEach(role=>{
    if(state.staffAssignments[role]===workerId) state.staffAssignments[role]=null;
  });
  Object.values(state.forklifts).forEach(f=>{ if(f.workerId===workerId) f.workerId=null; });
}
function currentAssignment(workerId){
  for(const role of ["cutter","packer","engineer"]){
    const idx=state.staffAssignments[role].indexOf(workerId);
    if(idx>=0) return {role,index:idx};
  }
  for(const role of ["crane","classifier","maintenance","dispatcher","supervisor"]){
    if(state.staffAssignments[role]===workerId) return {role,index:null};
  }
  for(const [key,f] of Object.entries(state.forklifts)){
    if(f.workerId===workerId) return {role:"forklift",index:key};
  }
  return null;
}
function reassignmentHeat(worker,oldAssignment,newRole){
  if(!oldAssignment) return;
  worker.reassignHistory = (worker.reassignHistory||[]).filter(day=>state.day-day<=7);
  worker.reassignHistory.push(state.day);
  let heat = oldAssignment.role===newRole ? 2 : 5;
  if(worker.reassignHistory.length>=3) heat += 4;
  addUnionHeat(heat, worker.name+" fue cambiado de puesto");
}
function warnIfUnfit(worker,role){
  const s=Math.round(jobSkill(worker,role));
  if(s>=45) return true;
  return confirm(`${worker.name} tiene sólo ${s}/100 de habilidad en ${JOBS[role].label}.\n\nPuede trabajar igual, pero será lento y propenso a errores cuando implementemos seguridad/accidentes.\n\n¿Asignarlo de todos modos?`);
}
function assignWorker(workerId,role,index=null){
  const worker=hiredWorkerById(workerId);
  if(!worker || isTraining(worker)) return;
  ensureWorkerSkills(worker);
  if(!warnIfUnfit(worker,role)) return;
  const old=currentAssignment(workerId);
  reassignmentHeat(worker,old,role);
  removeWorkerFromAssignments(workerId);
  if(role==="cutter" || role==="packer" || role==="engineer"){
    state.staffAssignments[role][Number(index)] = workerId;
  } else if(role==="forklift"){
    const f=state.forklifts[index];
    if(!f) return;
    if(f.workerId && f.workerId!==workerId) removeWorkerFromAssignments(f.workerId);
    f.workerId=workerId;
  } else {
    const displaced=state.staffAssignments[role];
    if(displaced && displaced!==workerId) removeWorkerFromAssignments(displaced);
    state.staffAssignments[role]=workerId;
  }
  addLog(`👷 ${worker.name} asignado a ${JOBS[role].label}${index!=null&&role!=="forklift"?" "+(Number(index)+1):""}.`);
  render();
}

workerForSlot = function(role,index){
  if(role==="cutter" || role==="packer"){
    const w=hiredWorkerById(state.staffAssignments[role][index]);
    return w && !isTraining(w) ? w : null;
  }
  return null;
};

const __baseHire = hire;
hire = function(id){
  const candidate=WORKER_CATALOG.find(w=>w.id===id);
  const wasHired=isHired(id);
  __baseHire(id);
  if(wasHired || !isHired(id)) return;
  const worker=state.workers[id];
  ensureWorkerSkills(worker);
  if(candidate?.role==="forklift" && state.forklifts[id]) delete state.forklifts[id];
  addLog(`📌 ${worker.name} pasó a la plantilla. Arrastralo desde el panel derecho al puesto que quieras.`);
  render();
};

function buyForklift(){
  if(Object.keys(state.forklifts).length>=4) return addLog("⚠ El estacionamiento admite como máximo 4 autoelevadores."),render();
  if(!spend(FORKLIFT_COST)) return addLog("⚠ No alcanzan las ramitas para el autoelevador."),render();
  const key=`fleet-${state.forkliftSerial++}`;
  state.forklifts[key]={id:uid("forklift"),workerId:null,health:100,broken:false,trips:0,cooldown:0,autonomous:false,upgrades:{capacity:0,speed:0,durability:0},upgradeOpen:false};
  addLog(`🚜 Autoelevador ${Object.keys(state.forklifts).length} comprado. Falta asignarle conductor.`);
  render();
}
buyForkliftUpgrade = function(key,kind){
  const f=state.forklifts[key]; if(!f)return;
  const prop=kind==="forkliftCapacity"?"capacity":kind==="forkliftSpeed"?"speed":"durability";
  const cost=upgradeCost(kind,f.upgrades[prop]); if(cost==null)return;
  if(!spend(cost)) return addLog("⚠ No alcanzan las ramitas."),render();
  f.upgrades[prop]++;
  addLog(`🚜 Autoelevador: mejora ${kind} instalada.`);render();
};
automateForklift = function(key){
  const f=state.forklifts[key];if(!f||f.autonomous)return;
  if(!tech("fullAutomation"))return addLog("⚠ Requiere Automatización integral."),render();
  if(!spend(48000))return addLog("⚠ Autoelevador autónomo cuesta 48.000 🌿."),render();
  f.autonomous=true; f.workerId=null; addUnionHeat(10,"un autoelevador pasó a ser autónomo");
  addLog("🤖 Autoelevador convertido a autónomo.");render();
};

function assigned(role,index=null){
  if(role==="cutter"||role==="packer"||role==="engineer") return hiredWorkerById(state.staffAssignments[role][index]);
  return hiredWorkerById(state.staffAssignments[role]);
}
function availableForWork(worker){ return worker && !isTraining(worker) && !unionOnStrike(); }

runCrane = function(){
  if(state.craneAutonomous){
    if(state.incomingTruck?.logs.length) return moveItem("incoming",state.incomingTruck.logs[0].id,"rawYard",true);
    const idx=state.cuttingLines.findIndex(l=>l&&!l.input&&!l.broken);
    return idx>=0&&state.rawYard.length?moveItem("rawYard",state.rawYard[0].id,`cutLine:${idx}`,true):false;
  }
  const w=assigned("crane"); if(!availableForWork(w))return false;
  let changed=false;
  if(state.incomingTruck?.logs.length) changed=moveItem("incoming",state.incomingTruck.logs[0].id,"rawYard",true);
  else { const idx=state.cuttingLines.findIndex(l=>l&&!l.input&&!l.broken); if(idx>=0&&state.rawYard.length) changed=moveItem("rawYard",state.rawYard[0].id,`cutLine:${idx}`,true); }
  if(changed) gainJobSkill(w,"crane",.05);
  return changed;
};
runCutters = function(){
  let changed=false;
  state.cuttingLines.forEach((line,i)=>{
    if(!line)return;
    const w=workerForSlot("cutter",i);
    if(line.autonomous) changed=cutOnce(i,true,null)||changed;
    else if(availableForWork(w)) changed=cutOnce(i,true,w)||changed;
    if(humanSupervisorPushActive()&&!line.autonomous&&availableForWork(w)) changed=cutOnce(i,true,w)||changed;
  });
  return changed;
};
runPackers = function(){
  let changed=false;
  state.packagingLines.forEach((line,i)=>{
    if(!line)return;
    const w=workerForSlot("packer",i);
    if(line.robot) changed=packagingStep(i,true,null)||changed;
    else if(availableForWork(w)){ changed=packagingStep(i,true,w)||changed; if(changed)gainJobSkill(w,"packer",.025); }
    if(humanSupervisorPushActive()&&!line.robot&&availableForWork(w)) changed=packagingStep(i,true,w)||changed;
  });
  return changed;
};
runClassifier = function(){
  if(!state.artisanLine)return false;
  const autonomous=state.artisanLine.autonomous;
  const w=assigned("classifier");
  if(!autonomous&&!availableForWork(w))return false;
  let changed=false;
  if(state.artisanLine.input) changed=artisanStep(true);
  else if(state.artisanLine.output) changed=moveItem("artisanLine:output",state.artisanLine.output.id,"artisanYard",true);
  else {
    const c=[];
    state.cuttingLines.forEach((l,i)=>l?.outputs.forEach(s=>{if(canImproveQuality(s.quality))c.push({s,source:`cutLine:${i}:output`});}));
    state.cutBuffer.forEach(s=>{if(canImproveQuality(s.quality))c.push({s,source:"cutBuffer"});});
    c.sort((a,b)=>qMeta(a.s.quality).rank-qMeta(b.s.quality).rank);
    if(c.length)changed=moveItem(c[0].source,c[0].s.id,"artisanLine",true);
  }
  if(changed&&!autonomous)gainJobSkill(w,"classifier",.04);
  return changed;
};
function runOneForklift(f){
  if(f.broken)return false;
  const w=hiredWorkerById(f.workerId);
  if(!f.autonomous&&!availableForWork(w))return false;
  if(f.cooldown>0){f.cooldown--;return false;}
  let changed=false;
  for(let n=0;n<forkliftCapacity(f);n++){
    const task=forkliftTask();if(!task)break;
    const id=firstTaskItemId(task);
    if(id&&moveItem(task.source,id,task.target,true)){changed=true;f.trips++;degradeMachine(f,CONFIG.forkliftWearPerTrip,"Un autoelevador");}
  }
  f.cooldown=Math.max(0,2-f.upgrades.speed);
  if(changed&&!f.autonomous)gainJobSkill(w,"forklift",.045);
  return changed;
}
runForklifts = function(){let changed=false;Object.values(state.forklifts).forEach(f=>changed=runOneForklift(f)||changed);return changed;};

const __baseRunMaintenance=runMaintenance;
runMaintenance=function(){
  const w=assigned("maintenance");if(!availableForWork(w))return false;
  const changed=__baseRunMaintenance();
  if(changed)gainJobSkill(w,"maintenance",.045);
  return changed;
};
runDispatcher=function(){
  if(state.dispatchTruck.length<state.order.quantity)return false;
  if(state.dispatchAutonomous)return dispatchOrder(true);
  const w=assigned("dispatcher");if(!availableForWork(w))return false;
  const changed=dispatchOrder(true);if(changed)gainJobSkill(w,"dispatcher",.08);return changed;
};

function unionWorkers(){return hiredWorkers().filter(w=>w.role!=="engineer"&&w.role!=="supervisor");}
function unionHeatLabel(){const h=state.union.heat;return h<25?"🧊 fría":h<50?"🙂 tranquila":h<75?"🌡️ caliente":"🔥 al rojo";}
function addUnionHeat(amount,reason){state.union.heat=clamp(state.union.heat+amount,0,100);if(reason)addLog(`🐿️ Temperatura gremial +${amount}: ${reason}.`);}
function applyRaise(pct){unionWorkers().forEach(w=>w.salary=Math.round(w.salary*(1+pct/100)));}
function clearDemand(){state.union.demand=null;state.union.lastDemandDay=state.day;}
function startStrike(reason){state.union.strikeUntilDay=state.day+1;state.union.heat=clamp(state.union.heat+12,0,100);state.union.supervisorPush=false;addLog(`🪧 HUELGA por 1 día: ${reason}.`);}
function acceptUnionDemand(){if(!state.union.demand)return;const p=state.union.demand.raisePct;applyRaise(p);state.union.heat=clamp(state.union.heat-20,0,100);addLog(`🤝 Aumento del ${p}% aceptado.`);clearDemand();render();}
function negotiateUnionDemand(){if(!state.union.demand)return;const sup=assigned("supervisor");const chance=clamp(.48+(sup?jobSkill(sup,"supervisor")/500:0)-state.union.heat/600,.2,.78);const req=state.union.demand.raisePct;if(Math.random()<chance){const agreed=Math.max(2,Math.ceil(req/2));applyRaise(agreed);state.union.heat=clamp(state.union.heat-12,0,100);addLog(`🤝 Acuerdo salarial: ${agreed}%.`);}else startStrike("fracasó la negociación salarial");clearDemand();render();}
function refuseUnionDemand(){if(!state.union.demand)return;if(Math.random()<clamp(.2+(100-state.union.heat)/500,.2,.38)){state.union.heat=clamp(state.union.heat+8,0,100);addLog("🐿️ El gremio reculó por ahora.");}else startStrike("se rechazó el reclamo salarial");clearDemand();render();}
function maybeCreateUnionDemand(){if(state.union.demand||!unionWorkers().length||state.day-state.union.lastDemandDay<18)return;if(Math.random()<clamp(.12+state.union.heat/220,.12,.58)){const p=randomInt(5,12);state.union.demand={raisePct:p,day:state.day};state.union.lastDemandDay=state.day;addLog(`🐿️ El gremio pidió un aumento del ${p}%.`);}}
function completeTrainings(){hiredWorkers().forEach(w=>{if(w.trainingUntilDay&&state.day>=w.trainingUntilDay){ensureWorkerSkills(w);const role=w.trainingRole;if(role)w.skills[role]=clamp(w.skills[role]+(w.pendingTrainingGain||0),0,100);w.trainingUntilDay=null;w.trainingRole=null;w.pendingTrainingGain=0;addLog(`🎓 ${w.name} volvió de capacitación.`);}});}
function unionDailyUpdate(){completeTrainings();if(state.union.strikeUntilDay!=null&&state.day>=state.union.strikeUntilDay){state.union.strikeUntilDay=null;addLog("🪧 Terminó la huelga.");}state.union.heat=clamp(state.union.heat-.7+(state.union.supervisorPush?3.2:0),0,100);maybeCreateUnionDemand();render();}
let __observedDay=state.day;setInterval(()=>{while(__observedDay<state.day){__observedDay++;unionDailyUpdate();}},250);

function humanSupervisorPushActive(){return availableForWork(assigned("supervisor"))&&state.union.supervisorPush;}
function toggleSupervisorPush(){if(!assigned("supervisor"))return;state.union.supervisorPush=!state.union.supervisorPush;if(state.union.supervisorPush){addUnionHeat(6,"el supervisor empezó a apretar el ritmo");addLog("👔 Ritmo forzado activado.");}else addLog("👔 Ritmo normal restaurado.");render();}
function trainingCost(worker,role){return 2500+Math.round(jobSkill(worker,role))*55;}
function trainWorkerForRole(id,role){const w=hiredWorkerById(id);if(!w||isTraining(w))return;ensureWorkerSkills(w);const cost=trainingCost(w,role);if(!spend(cost))return addLog("⚠ No alcanzan las ramitas para la capacitación."),render();removeWorkerFromAssignments(id);w.trainingUntilDay=state.day+3;w.trainingRole=role;w.pendingTrainingGain=5;addLog(`🎓 ${w.name}: capacitación en ${JOBS[role].label} por 3 días.`);render();}

function automateCrane(){if(state.craneAutonomous||!tech("fullAutomation"))return;if(!spend(55000))return addLog("⚠ Grúa autónoma: 55.000 🌿."),render();state.craneAutonomous=true;state.staffAssignments.crane=null;addUnionHeat(13,"automatización total de la grúa");addLog("🤖 Grúa autónoma instalada.");render();}
function automateDispatch(){if(state.dispatchAutonomous||!tech("fullAutomation"))return;if(!spend(32000))return addLog("⚠ Despacho autónomo: 32.000 🌿."),render();state.dispatchAutonomous=true;state.staffAssignments.dispatcher=null;addUnionHeat(9,"automatización total de despacho");addLog("🤖 Despacho autónomo instalado.");render();}
const __autoCut=automateCut;automateCut=function(i){const before=state.cuttingLines[i]?.autonomous;__autoCut(i);if(!before&&state.cuttingLines[i]?.autonomous){state.staffAssignments.cutter[i]=null;addUnionHeat(14,"una línea de corte reemplazó un puesto");}};
const __autoPack=automatePack;automatePack=function(i){const before=state.packagingLines[i]?.robot;__autoPack(i);if(!before&&state.packagingLines[i]?.robot){state.staffAssignments.packer[i]=null;addUnionHeat(12,"un robot de embalaje reemplazó un puesto");}};
const __autoArtisan=automateArtisan;automateArtisan=function(){const before=state.artisanLine?.autonomous,assist=state.artisanLine?.aiAssist;__autoArtisan();if(!assist&&state.artisanLine?.aiAssist)addUnionHeat(3,"se incorporó IA a clasificación");if(!before&&state.artisanLine?.autonomous){state.staffAssignments.classifier=null;addUnionHeat(11,"clasificación pasó a ser autónoma");}};

function portraitFor(w){return `<div class="worker-portrait"><span>🦫</span><b>${w.icon}</b></div>`;}
function assignmentLabel(w){const a=currentAssignment(w.id);if(!a)return "Disponible";if(a.role==="forklift")return "Autoelevador";return JOBS[a.role].label+(a.index!=null?" "+(Number(a.index)+1):"");}
function skillBar(role,value){return `<div class="skill-row"><span>${JOBS[role].icon} ${JOBS[role].label}</span><progress max="100" value="${value}"></progress><b>${Math.round(value)}</b></div>`;}
function renderRoster(){
  const workers=hiredWorkers();
  if(!workers.length)return `<p class="muted">Todavía no contrataste a nadie.</p>`;
  return workers.map(w=>{ensureWorkerSkills(w);const expanded=state.ui.expandedWorkerId===w.id;const status=isTraining(w)?`🎓 capacitación hasta día ${w.trainingUntilDay}`:assignmentLabel(w);return `<article class="roster-card ${expanded?"expanded":""}" draggable="${!isTraining(w)}" data-worker-id="${w.id}">
    <div class="roster-head">${portraitFor(w)}<div><b>${w.name}</b><small>${w.title}</small><span class="worker-status">${status}</span></div><button class="expand-worker" data-worker="${w.id}">${expanded?"−":"+"}</button></div>
    ${expanded?`<div class="worker-detail">${Object.keys(JOBS).map(role=>skillBar(role,jobSkill(w,role))).join("")}
      <div class="training-row"><select class="training-role" data-worker="${w.id}">${Object.entries(JOBS).map(([r,j])=>`<option value="${r}">${j.label}</option>`).join("")}</select><button class="train-role" data-worker="${w.id}" ${isTraining(w)?"disabled":""}>🎓 Capacitar 3 días</button></div>
      <small>Sueldo: ${formatMoney(w.salary)} 🌿/mes · especialidad original: ${JOBS[w.role]?.label||w.title}</small>
    </div>`:""}
  </article>`;}).join("");
}
renderWorkers=function(){
  const candidates=WORKER_CATALOG.filter(w=>!isHired(w.id));
  if(!candidates.length)return `<p class="muted">No hay candidatos disponibles por ahora.</p>`;
  return candidates.map(w=>`<div class="hire-card">${portraitFor(w)}<div><b>${w.name}</b><small>${w.title}</small><p>${w.desc}</p><button class="hire-worker" data-id="${w.id}" ${state.money<w.hire||(w.role==="engineer"&&!state.engineering.built)?"disabled":""}>Contratar · ${formatMoney(w.hire)} 🌿</button><small>${formatMoney(w.salary)} 🌿/mes</small></div></div>`).join("");
};

renderForklifts=function(){
  const entries=Object.entries(state.forklifts);
  if(!entries.length)return `<span class="muted">Estacionamiento vacío. Comprá un autoelevador desde Comprar.</span>`;
  return entries.map(([key,f],i)=>{const w=hiredWorkerById(f.workerId);const menu=f.upgradeOpen?`<div class="upgrade-menu"><button class="forklift-upgrade" data-worker="${key}" data-kind="forkliftCapacity" ${f.upgrades.capacity>=1?"disabled":""}>📦📦 Doble carga</button><button class="forklift-upgrade" data-worker="${key}" data-kind="forkliftSpeed" ${f.upgrades.speed>=2?"disabled":""}>⚡ Velocidad ${f.upgrades.speed}/2</button><button class="forklift-upgrade" data-worker="${key}" data-kind="forkliftDurability" ${f.upgrades.durability>=2?"disabled":""}>🔩 Durabilidad ${f.upgrades.durability}/2</button><button class="auto-forklift" data-worker="${key}" ${f.autonomous||!tech("fullAutomation")?"disabled":""}>🤖 Autónomo · 48.000 🌿</button></div>`:"";return `<div class="machine staff-drop forklift-card" data-staff-role="forklift" data-staff-index="${key}"><b>🚜 Autoelevador ${i+1}</b> · ${healthText(f)}<br><div class="assignment-slot">${f.autonomous?"🤖 Autónomo":w?`🦫 ${w.name} · habilidad ${Math.round(jobSkill(w,"forklift"))}`:"👷 Arrastrá un conductor acá"}</div><small>Viajes ${f.trips} · carga ${forkliftCapacity(f)}</small><div class="action-row"><button class="repair-line" data-kind="forklift" data-id="${key}" ${f.health>=100?"disabled":""}>🔧 Reparar</button><button class="toggle-forklift" data-worker="${key}">⚙️ Mejoras</button></div>${menu}</div>`;}).join("");
};

function decorateLineAssignments(){
  document.querySelectorAll("#cutLines .machine:not(.empty)").forEach((el,i)=>{el.classList.add("staff-drop");el.dataset.staffRole="cutter";el.dataset.staffIndex=i;const w=workerForSlot("cutter",i);el.querySelector(".assignment-slot")?.remove();el.insertAdjacentHTML("afterbegin",`<div class="assignment-slot">${state.cuttingLines[i]?.autonomous?"🤖 Línea autónoma":w?`🦫 ${w.name} · corte ${Math.round(jobSkill(w,"cutter"))}`:"👷 Arrastrá un operador acá"}</div>`);});
  document.querySelectorAll("#packLines .machine:not(.empty)").forEach((el,i)=>{el.classList.add("staff-drop");el.dataset.staffRole="packer";el.dataset.staffIndex=i;const w=workerForSlot("packer",i);el.querySelector(".assignment-slot")?.remove();el.insertAdjacentHTML("afterbegin",`<div class="assignment-slot">${state.packagingLines[i]?.robot?"🤖 Robot de embalaje":w?`🦫 ${w.name} · embalaje ${Math.round(jobSkill(w,"packer"))}`:"👷 Arrastrá un embalador acá"}</div>`);});
}
function supportSlot(role,label,disabled=false){const w=assigned(role);return `<div class="support-assignment staff-drop ${disabled?"disabled":""}" data-staff-role="${role}"><b>${label}</b><span>${disabled?"🤖 Automatizado":w?`🦫 ${w.name} · ${Math.round(jobSkill(w,role))}/100`:"Arrastrá personal acá"}</span></div>`;}
function renderSupportAssignments(){
  const target=document.querySelector("#supportAssignments");if(!target)return;
  target.innerHTML=[
    supportSlot("crane","🏗️ Grúa",state.craneAutonomous),
    supportSlot("classifier","🧐 Línea artesanal",state.artisanLine?.autonomous),
    supportSlot("maintenance","🔧 Mantenimiento"),
    supportSlot("dispatcher","📋 Despacho",state.dispatchAutonomous),
    supportSlot("supervisor","👔 Supervisión"),
    ...(state.engineering.built?[0,1].map(i=>{const w=assigned("engineer",i);return `<div class="support-assignment staff-drop" data-staff-role="engineer" data-staff-index="${i}"><b>💡 Ingeniería ${i+1}</b><span>${w?`🦫 ${w.name} · ${Math.round(jobSkill(w,"engineer"))}/100`:"Arrastrá ingeniero acá"}</span></div>`;}):[])
  ].join("");
}
function renderUnion(){const h=Math.round(state.union.heat);let html=`<b>${unionHeatLabel()} · ${h}/100</b><progress max="100" value="${h}"></progress>`;if(unionOnStrike())html+=`<span class="warn">🪧 Huelga activa hasta el día ${state.union.strikeUntilDay}. Sólo jefe y automatismos.</span>`;if(state.union.demand){const p=state.union.demand.raisePct;html+=`<b>🐿️ Reclamo salarial +${p}%</b><div class="action-row"><button class="union-accept">Aceptar</button><button class="union-negotiate">Negociar</button><button class="union-refuse">Rechazar</button></div>`;}return html;}
function renderSupervisor(){const w=assigned("supervisor");return w?`<b>👔 ${w.name}</b> · Supervisión ${Math.round(jobSkill(w,"supervisor"))}/100<div class="action-row"><button class="supervisor-push">${state.union.supervisorPush?"🛑 Ritmo normal":"⚡ Presionar producción"}</button></div>`:`<span class="muted">Arrastrá un trabajador al puesto de Supervisor.</span>`;}

engineeringDevelop=function(){
  if(!state.engineering.built)return false;
  const engineers=state.staffAssignments.engineer.map(hiredWorkerById).filter(availableForWork);
  if(!engineers.length)return false;
  const c=engineeringCandidates();if(!c.length)return false;
  const pick=c[randomInt(0,c.length-1)];
  state.engineering.unlocked.add(pick.id);
  engineers.forEach(w=>gainJobSkill(w,"engineer",.12));
  addLog(`💡 Ingeniería desarrolló: ${pick.name}.`);
  return true;
};

const __baseRenderEngineering=renderEngineering;
renderEngineering=function(){let html=__baseRenderEngineering();if(tech("fullAutomation"))html+=`<div class="upgrade-menu"><button class="auto-crane" ${state.craneAutonomous?"disabled":""}>🤖 Grúa autónoma · 55.000 🌿</button><button class="auto-dispatch" ${state.dispatchAutonomous?"disabled":""}>🤖 Despacho autónomo · 32.000 🌿</button></div>`;return html;};

const __baseRender=render;
render=function(){
  __baseRender();
  const roster=document.querySelector("#personnelRoster");if(roster)roster.innerHTML=renderRoster();
  const union=document.querySelector("#union");if(union)union.innerHTML=renderUnion();
  const sup=document.querySelector("#supervisor");if(sup)sup.innerHTML=renderSupervisor();
  const bf=document.querySelector("#buyForklift");if(bf)bf.disabled=Object.keys(state.forklifts).length>=4||state.money<FORKLIFT_COST;
  decorateLineAssignments();renderSupportAssignments();
};

function bindStaffDrag(){
  document.querySelectorAll(".roster-card[draggable=true]").forEach(card=>card.addEventListener("dragstart",e=>{e.dataTransfer.setData("application/x-castorium-worker",card.dataset.workerId);}));
  document.querySelectorAll(".staff-drop").forEach(zone=>{
    zone.addEventListener("dragover",e=>{if(e.dataTransfer.types.includes("application/x-castorium-worker")){e.preventDefault();zone.classList.add("staff-dragover");}});
    zone.addEventListener("dragleave",()=>zone.classList.remove("staff-dragover"));
    zone.addEventListener("drop",e=>{const id=e.dataTransfer.getData("application/x-castorium-worker");if(!id)return;e.preventDefault();e.stopPropagation();zone.classList.remove("staff-dragover");assignWorker(id,zone.dataset.staffRole,zone.dataset.staffIndex??null);});
  });
}
const __baseBind=bindDynamicEvents;
bindDynamicEvents=function(){
  __baseBind();
  bindStaffDrag();
  document.querySelectorAll(".expand-worker").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();state.ui.expandedWorkerId=state.ui.expandedWorkerId===b.dataset.worker?null:b.dataset.worker;render();}));
  document.querySelectorAll(".roster-card").forEach(card=>card.addEventListener("click",e=>{if(e.target.closest("button,select"))return;state.ui.expandedWorkerId=state.ui.expandedWorkerId===card.dataset.workerId?null:card.dataset.workerId;render();}));
  document.querySelectorAll(".train-role").forEach(b=>b.addEventListener("click",()=>{const select=document.querySelector(`.training-role[data-worker="${b.dataset.worker}"]`);trainWorkerForRole(b.dataset.worker,select?.value||"cutter");}));
  document.querySelector(".supervisor-push")?.addEventListener("click",toggleSupervisorPush);
  document.querySelector(".union-accept")?.addEventListener("click",acceptUnionDemand);
  document.querySelector(".union-negotiate")?.addEventListener("click",negotiateUnionDemand);
  document.querySelector(".union-refuse")?.addEventListener("click",refuseUnionDemand);
  document.querySelector(".auto-crane")?.addEventListener("click",automateCrane);
  document.querySelector(".auto-dispatch")?.addEventListener("click",automateDispatch);
};

document.querySelector("#openPurchase")?.addEventListener("click",()=>document.querySelector("#purchaseDialog")?.showModal());
document.querySelector("#closePurchase")?.addEventListener("click",()=>document.querySelector("#purchaseDialog")?.close());
document.querySelector("#openHiring")?.addEventListener("click",()=>document.querySelector("#hireDialog")?.showModal());
document.querySelector("#closeHiring")?.addEventListener("click",()=>document.querySelector("#hireDialog")?.close());
document.querySelector("#buyForklift")?.addEventListener("click",buyForklift);

window.__castoriumState=state;window.__castoriumRender=render;
let __cheatBuffer="";
document.addEventListener("keydown",event=>{if(event.ctrlKey||event.altKey||event.metaKey||event.key.length!==1)return;__cheatBuffer=(__cheatBuffer+event.key.toUpperCase()).slice(-10);if(__cheatBuffer.endsWith("KLAPAUCIUS")){state.money+=100000;__cheatBuffer="";addLog("🪄 KLAPAUCIUS: +100.000 🌿. El Banco Central del Castor no hará preguntas.");render();}});

hiredWorkers().forEach(ensureWorkerSkills);
render();
