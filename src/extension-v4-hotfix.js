// v4.2: maintenance hotfix + reliable staff drops + supervisor auto-assignment + Engineering purchase + bigger cheat.
function runAssignedMaintenance(){
  const w=assigned("maintenance");
  if(!availableForWork(w))return false;
  const list=[];
  state.cuttingLines.forEach((m,i)=>{if(m&&m.health<82)list.push({m,label:`Corte ${i+1}`});});
  state.packagingLines.forEach((m,i)=>{if(m&&m.health<82)list.push({m,label:`Embalaje ${i+1}`});});
  Object.values(state.forklifts).forEach((m,i)=>{if(m.health<82)list.push({m,label:`Autoelevador ${i+1}`});});
  list.sort((a,b)=>a.m.health-b.m.health);
  for(const x of list){
    if(isAutomatedMachine(x.m)&&!state.maintenanceAutomationTrained)continue;
    const changed=repairMachine(x.m,x.label,true);
    if(changed)gainJobSkill(w,"maintenance",.05);
    return changed;
  }
  return false;
}
runMaintenance=runAssignedMaintenance;

function trainAssignedMaintenanceAutomation(){
  const w=assigned("maintenance");
  if(!w||state.maintenanceAutomationTrained||!tech("fullAutomation"))return;
  if(!spend(14000))return addLog("⚠ Capacitación en automatización industrial: 14.000 🌿."),render();
  state.maintenanceAutomationTrained=true;
  gainJobSkill(w,"maintenance",5);
  addLog(`🎓 ${w.name} quedó habilitado para reparar equipos automatizados.`);
  render();
}
renderMaintenance=function(){
  const rows=[];
  state.cuttingLines.forEach((m,i)=>m&&rows.push(`🪚 Corte ${i+1}: ${healthText(m)}`));
  state.packagingLines.forEach((m,i)=>m&&rows.push(`📦 Embalaje ${i+1}: ${healthText(m)}`));
  Object.values(state.forklifts).forEach((m,i)=>rows.push(`🚜 Auto ${i+1}: ${healthText(m)}`));
  const w=assigned("maintenance");
  return `${w?`🔧 ${w.name} · habilidad ${Math.round(jobSkill(w,"maintenance"))}/100`:"Sin personal asignado a mantenimiento"}${state.maintenanceAutomationTrained?" · 🤖 automatización habilitada":""}<br>${rows.join("<br>")||"Sin equipos"}${tech("fullAutomation")&&w&&!state.maintenanceAutomationTrained?'<div class="action-row"><button class="train-auto-maint">🎓 Automatización industrial · 14.000 🌿</button></div>':""}`;
};

// Staff assignment hitboxes: the visible assignment strip owns personnel drops.
function ensureDedicatedStaffSlots(){
  document.querySelectorAll("#cutLines .machine:not(.empty), #packLines .machine:not(.empty), #forkliftParking .machine").forEach(machine=>{
    const slot=machine.querySelector(".assignment-slot");
    if(!slot)return;
    slot.classList.add("staff-drop-surface");
    slot.dataset.staffRole=machine.dataset.staffRole||"";
    if(machine.dataset.staffIndex!=null)slot.dataset.staffIndex=machine.dataset.staffIndex;
  });
}
function bindDedicatedStaffDrops(){
  document.querySelectorAll(".staff-drop-surface").forEach(slot=>{
    if(slot.dataset.staffBound==="1")return;
    slot.dataset.staffBound="1";
    slot.addEventListener("dragover",e=>{e.preventDefault();e.stopPropagation();slot.classList.add("staff-dragover");},true);
    slot.addEventListener("dragleave",e=>{e.stopPropagation();slot.classList.remove("staff-dragover");},true);
    slot.addEventListener("drop",e=>{
      e.preventDefault();e.stopPropagation();slot.classList.remove("staff-dragover");
      try{
        const raw=e.dataTransfer.getData("application/x-castorium-worker")||e.dataTransfer.getData("text/castorium-worker");
        if(!raw)return;
        assignWorker(raw,slot.dataset.staffRole,slot.dataset.staffIndex??null);
      }catch{}
    },true);
  });
}

// Supervisor: hiring one is enough to enable automatic filling of vacant posts.
state.supervisorAutoAssign=true;
function bestAvailableWorkerFor(role,excluded=new Set()){
  return hiredWorkers()
    .filter(w=>!excluded.has(w.id)&&!isTraining(w)&&w.role!=="supervisor"&&currentAssignment(w.id)==null)
    .sort((a,b)=>jobSkill(b,role)-jobSkill(a,role))[0]||null;
}
function supervisorAutoAssign(){
  const sup=assigned("supervisor");
  if(!sup||isTraining(sup)||!state.supervisorAutoAssign)return false;
  let changed=false;
  const reserve=new Set();
  const fill=(role,index=null,enabled=true)=>{
    if(!enabled)return;
    const current=role==="forklift"?hiredWorkerById(state.forklifts[index]?.workerId):assigned(role,index);
    if(current)return;
    const candidate=bestAvailableWorkerFor(role,reserve);
    if(!candidate)return;
    reserve.add(candidate.id);
    removeWorkerFromAssignments(candidate.id);
    if(role==="cutter"||role==="packer"||role==="engineer")state.staffAssignments[role][Number(index)]=candidate.id;
    else if(role==="forklift")state.forklifts[index].workerId=candidate.id;
    else state.staffAssignments[role]=candidate.id;
    addLog(`👔 ${sup.name} asignó a ${candidate.name} a ${JOBS[role].label}${index!=null&&role!=="forklift"?" "+(Number(index)+1):""}.`);
    changed=true;
  };
  state.cuttingLines.forEach((l,i)=>fill("cutter",i,Boolean(l&&!l.autonomous)));
  state.packagingLines.forEach((l,i)=>fill("packer",i,Boolean(l&&!l.robot)));
  Object.keys(state.forklifts).forEach(key=>fill("forklift",key,!state.forklifts[key].autonomous));
  fill("crane",null,!state.craneAutonomous);
  fill("classifier",null,Boolean(state.artisanLine&&!state.artisanLine.autonomous));
  fill("maintenance");
  fill("dispatcher",null,!state.dispatchAutonomous);
  if(state.engineering.built){fill("engineer",0);fill("engineer",1);}
  if(changed)render();
  return changed;
}

const __v42Hire=hire;
hire=function(id){
  __v42Hire(id);
  const w=state.workers[id];
  if(w?.role==="supervisor"&&!assigned("supervisor")){
    removeWorkerFromAssignments(w.id);
    state.staffAssignments.supervisor=w.id;
    addLog(`👔 ${w.name} asumió Supervisión y empezó a cubrir puestos vacíos automáticamente.`);
  }
  supervisorAutoAssign();
};

// Re-run auto-assignment after infrastructure changes.
const __v42BuyCut=buyCuttingLine;buyCuttingLine=function(){__v42BuyCut();supervisorAutoAssign();};
const __v42BuyPack=buyPackagingLine;buyPackagingLine=function(){__v42BuyPack();supervisorAutoAssign();};
const __v42BuyArtisan=buyArtisanLine;buyArtisanLine=function(){__v42BuyArtisan();supervisorAutoAssign();};
const __v42BuyForklift=buyForklift;buyForklift=function(){__v42BuyForklift();supervisorAutoAssign();};
const __v42BuildEngineering=buildEngineering;buildEngineering=function(){__v42BuildEngineering();supervisorAutoAssign();};

const __v42CompleteTrainings=completeTrainings;
completeTrainings=function(){__v42CompleteTrainings();supervisorAutoAssign();};

// Put Engineering infrastructure in the Comprar modal.
function ensureEngineeringPurchaseButton(){
  const grid=document.querySelector("#purchaseDialog .purchase-grid");
  if(!grid||document.querySelector("#buyEngineeringOffice"))return;
  const b=document.createElement("button");
  b.id="buyEngineeringOffice";
  b.innerHTML=state.engineering.built?"💡 Oficina de Ingeniería<br><b>Construida</b>":`💡 Oficina de Ingeniería<br><b>${formatMoney(CONFIG.engineeringOfficeCost)} 🌿</b>`;
  b.disabled=state.engineering.built||state.money<CONFIG.engineeringOfficeCost;
  b.addEventListener("click",()=>buildEngineering());
  grid.appendChild(b);
}

// Hide duplicate construction CTA in the Engineering panel once it is offered in Comprar.
const __v42RenderEngineering=renderEngineering;
renderEngineering=function(){
  const html=__v42RenderEngineering();
  if(state.engineering.built)return html;
  return '<span class="muted">Todavía no construida. Comprá la Oficina de Ingeniería desde 🛒 Comprar.</span>';
};

// Upgrade classic cheat to one million.
let __millionCheatBuffer="";
document.addEventListener("keydown",event=>{
  if(event.ctrlKey||event.altKey||event.metaKey||event.key.length!==1)return;
  __millionCheatBuffer=(__millionCheatBuffer+event.key.toUpperCase()).slice(-10);
  if(__millionCheatBuffer.endsWith("KLAPAUCIUS")){
    // extension-v4's original handler also fires (+100k), so offset it to a net +1M.
    state.money+=900000;
    __millionCheatBuffer="";
    addLog("🪄 KLAPAUCIUS actualizado: total +1.000.000 🌿.");
    render();
  }
});

const __v4Bind=bindDynamicEvents;
bindDynamicEvents=function(){
  __v4Bind();
  document.querySelector(".train-auto-maint")?.addEventListener("click",trainAssignedMaintenanceAutomation);
  ensureDedicatedStaffSlots();
  bindDedicatedStaffDrops();
  ensureEngineeringPurchaseButton();
};

const __v42Render=render;
render=function(){
  __v42Render();
  ensureDedicatedStaffSlots();
  bindDedicatedStaffDrops();
  ensureEngineeringPurchaseButton();
};

setInterval(supervisorAutoAssign,1500);
render();
