const response = await fetch("./src/main-v2.js");
if (!response.ok) throw new Error(`No se pudo cargar Castorium: ${response.status}`);

let source = await response.text();

// Time compression is intentionally decoupled from machine speed.
// x1 = 3 in-game minutes per real second; x16/x64 only accelerate the clock/events.
source = source.replace("state.minute+=state.speed;", "state.minute+=state.speed*3;");
source = source.replace("automationElapsed+=1000*state.speed;", "automationElapsed+=1000;");

// Add the supervisor to the personnel catalog before the game evaluates/render its first frame.
source = source.replace(
  "const WORKER_CATALOG = [",
  'const WORKER_CATALOG = [\n  { id:"supervisor-1", role:"supervisor", icon:"👔", name:"Ramiro Roble", title:"Supervisor de turno", hire:8000, salary:1900, skill:78, max:1, desc:"Reasigna personal y puede presionar el ritmo de trabajo." },'
);

source += String.raw`

// --- Bootstrap systems: supervisor, union relations, reassignment, training and cheats ---
state.union = {
  heat: 12,
  demand: null,
  lastDemandDay: 1,
  strikeUntilDay: null,
  supervisorPush: false,
};
state.assignments = {
  cutter: [null, null, null],
  packer: [null, null],
};
state.craneAutonomous = false;
state.dispatchAutonomous = false;

function unionWorkers(){
  return hiredWorkers().filter(function(w){ return w.role !== "engineer" && w.role !== "supervisor"; });
}
function unionHeatLabel(){
  var h = state.union.heat;
  if(h < 25) return "🧊 fría";
  if(h < 50) return "🙂 tranquila";
  if(h < 75) return "🌡️ caliente";
  return "🔥 al rojo";
}
function addUnionHeat(amount, reason){
  state.union.heat = clamp(state.union.heat + amount, 0, 100);
  if(reason) addLog("🐿️ Temperatura gremial +" + amount + ": " + reason + ".");
}
function unionOnStrike(){
  return state.union.strikeUntilDay != null && state.day < state.union.strikeUntilDay;
}
function isTraining(worker){ return Boolean(worker && worker.trainingUntilDay && state.day < worker.trainingUntilDay); }
function availableWorkersByRole(role){ return workersByRole(role).filter(function(w){ return !isTraining(w); }); }

function syncAssignments(){
  ["cutter","packer"].forEach(function(role){
    var slots = state.assignments[role];
    var validIds = workersByRole(role).map(function(w){ return w.id; });
    for(var i=0;i<slots.length;i++) if(slots[i] && validIds.indexOf(slots[i]) < 0) slots[i] = null;
    validIds.forEach(function(id){
      if(slots.indexOf(id) >= 0) return;
      var empty = slots.indexOf(null);
      if(empty >= 0) slots[empty] = id;
    });
  });
}

var __baseWorkerForSlot = workerForSlot;
workerForSlot = function(role,index){
  if(role !== "cutter" && role !== "packer") return __baseWorkerForSlot(role,index);
  syncAssignments();
  var id = state.assignments[role][index];
  var w = id ? state.workers[id] : null;
  return w && !isTraining(w) ? w : null;
};

var __baseHire = hire;
hire = function(id){
  var before = isHired(id);
  __baseHire(id);
  if(!before && isHired(id)) syncAssignments();
};

function rotateAssignment(role){
  if(!hasWorker("supervisor")) return;
  syncAssignments();
  var slots = state.assignments[role];
  if(!slots || !slots.some(Boolean)) return;
  slots.unshift(slots.pop());
  addUnionHeat(5, "reasignación de personal");
  addLog("👔 " + (role === "cutter" ? "Operadores de corte" : "Embaladores") + " fueron reasignados.");
  render();
}

function trainingCost(worker){ return 3000 + Math.floor(worker.skill / 10) * 500; }
function trainWorker(id){
  var w = state.workers[id];
  if(!w || isTraining(w) || w.skill >= 100) return;
  var cost = trainingCost(w);
  if(!spend(cost)) return addLog("⚠ No alcanzan las ramitas para capacitar a " + w.name + "."), render();
  w.trainingUntilDay = state.day + 3;
  w.pendingSkill = 4;
  addLog("🎓 " + w.name + " fue enviado a capacitación por 3 días.");
  render();
}

function completeTrainings(){
  hiredWorkers().forEach(function(w){
    if(w.trainingUntilDay && state.day >= w.trainingUntilDay){
      w.skill = clamp(w.skill + (w.pendingSkill || 0), 0, 100);
      w.trainingUntilDay = null;
      w.pendingSkill = 0;
      addLog("🎓 " + w.name + " volvió de capacitación. Habilidad: " + Math.round(w.skill) + ".");
    }
  });
}

function applyRaise(percent){
  unionWorkers().forEach(function(w){ w.salary = Math.round(w.salary * (1 + percent / 100)); });
}
function clearDemand(){ state.union.demand = null; state.union.lastDemandDay = state.day; }
function acceptUnionDemand(){
  if(!state.union.demand) return;
  var pct = state.union.demand.raisePct;
  applyRaise(pct);
  state.union.heat = clamp(state.union.heat - 20, 0, 100);
  addLog("🤝 Se aceptó un aumento del " + pct + "% para el personal sindicalizado.");
  clearDemand(); render();
}
function startStrike(reason){
  state.union.strikeUntilDay = state.day + 1;
  state.union.heat = clamp(state.union.heat + 12, 0, 100);
  state.union.supervisorPush = false;
  addLog("🪧 HUELGA por 1 día: " + reason + ". La planta queda a cargo del jefe y de los equipos autónomos.");
}
function negotiateUnionDemand(){
  if(!state.union.demand) return;
  var supervisor = workersByRole("supervisor")[0];
  var skillBonus = supervisor ? supervisor.skill / 500 : 0;
  var chance = clamp(0.48 + skillBonus - state.union.heat / 600, 0.20, 0.78);
  var requested = state.union.demand.raisePct;
  if(Math.random() < chance){
    var agreed = Math.max(2, Math.ceil(requested / 2));
    applyRaise(agreed);
    state.union.heat = clamp(state.union.heat - 12, 0, 100);
    addLog("🤝 Negociación exitosa: acuerdo salarial del " + agreed + "%.");
  } else {
    startStrike("fracasó la negociación salarial");
  }
  clearDemand(); render();
}
function refuseUnionDemand(){
  if(!state.union.demand) return;
  var chance = clamp(0.20 + (100 - state.union.heat) / 500, 0.20, 0.38);
  if(Math.random() < chance){
    state.union.heat = clamp(state.union.heat + 8, 0, 100);
    addLog("🐿️ El gremio reculó por ahora, pero quedó bastante caliente.");
  } else {
    startStrike("la empresa rechazó el reclamo salarial");
  }
  clearDemand(); render();
}

function maybeCreateUnionDemand(){
  if(state.union.demand || !unionWorkers().length) return;
  if(state.day - state.union.lastDemandDay < 18) return;
  var chance = clamp(0.12 + state.union.heat / 220, 0.12, 0.58);
  if(Math.random() < chance){
    var pct = randomInt(5, 12);
    state.union.demand = { raisePct:pct, day:state.day };
    state.union.lastDemandDay = state.day;
    addLog("🐿️ El Gremio de Ardillas pidió un aumento salarial del " + pct + "%.");
  }
}

function unionDailyUpdate(){
  completeTrainings();
  if(state.union.strikeUntilDay != null && state.day >= state.union.strikeUntilDay){
    state.union.strikeUntilDay = null;
    addLog("🪧 Terminó la huelga. El personal vuelve a sus puestos.");
  }
  state.union.heat = clamp(state.union.heat - 0.7 + (state.union.supervisorPush ? 3.2 : 0), 0, 100);
  maybeCreateUnionDemand();
  render();
}

var __unionObservedDay = state.day;
setInterval(function(){
  while(__unionObservedDay < state.day){ __unionObservedDay++; unionDailyUpdate(); }
}, 250);

function humanSupervisorPushActive(){ return hasWorker("supervisor") && state.union.supervisorPush && !unionOnStrike(); }
function toggleSupervisorPush(){
  if(!hasWorker("supervisor")) return;
  state.union.supervisorPush = !state.union.supervisorPush;
  if(state.union.supervisorPush){
    addUnionHeat(6, "el supervisor empezó a apretar el ritmo");
    addLog("👔 Ritmo forzado activado: más producción, más desgaste y más tensión gremial.");
  } else addLog("👔 El supervisor volvió el ritmo a normal.");
  render();
}

function runCraneAutonomous(){
  if(state.incomingTruck && state.incomingTruck.logs.length) return moveItem("incoming",state.incomingTruck.logs[0].id,"rawYard",true);
  var idx = state.cuttingLines.findIndex(function(l){ return l && !l.input && !l.broken; });
  if(idx >= 0 && state.rawYard.length) return moveItem("rawYard",state.rawYard[0].id,"cutLine:"+idx,true);
  return false;
}

var __baseRunCrane = runCrane;
runCrane = function(){
  if(state.craneAutonomous) return runCraneAutonomous();
  if(unionOnStrike() || !availableWorkersByRole("crane").length) return false;
  var changed = __baseRunCrane();
  if(humanSupervisorPushActive()) changed = __baseRunCrane() || changed;
  return changed;
};

runCutters = function(){
  var changed = false;
  state.cuttingLines.forEach(function(line,i){
    if(!line) return;
    var op = workerForSlot("cutter",i);
    if(line.autonomous) changed = cutOnce(i,true,null) || changed;
    else if(!unionOnStrike() && op) changed = cutOnce(i,true,op) || changed;
  });
  if(humanSupervisorPushActive()){
    state.cuttingLines.forEach(function(line,i){
      if(!line || line.autonomous) return;
      var op = workerForSlot("cutter",i);
      if(op) changed = cutOnce(i,true,op) || changed;
    });
  }
  return changed;
};

runPackers = function(){
  var changed = false;
  state.packagingLines.forEach(function(line,i){
    if(!line) return;
    var op = workerForSlot("packer",i);
    if(line.robot) changed = packagingStep(i,true,null) || changed;
    else if(!unionOnStrike() && op) changed = packagingStep(i,true,op) || changed;
  });
  if(humanSupervisorPushActive()){
    state.packagingLines.forEach(function(line,i){
      if(!line || line.robot) return;
      var op = workerForSlot("packer",i);
      if(op) changed = packagingStep(i,true,op) || changed;
    });
  }
  return changed;
};

var __baseRunClassifier = runClassifier;
runClassifier = function(){
  if(state.artisanLine && state.artisanLine.autonomous) return __baseRunClassifier();
  if(unionOnStrike() || !availableWorkersByRole("classifier").length) return false;
  var changed = __baseRunClassifier();
  if(humanSupervisorPushActive()) changed = __baseRunClassifier() || changed;
  return changed;
};

function runOneForklift(f){
  if(f.broken) return false;
  var driver = state.workers[f.workerId];
  if(!f.autonomous && (!driver || isTraining(driver) || unionOnStrike())) return false;
  if(f.cooldown > 0){ f.cooldown--; return false; }
  var changed = false;
  for(var n=0;n<forkliftCapacity(f);n++){
    var task = forkliftTask(); if(!task) break;
    var id = firstTaskItemId(task);
    if(id && moveItem(task.source,id,task.target,true)){
      changed = true; f.trips++; degradeMachine(f,CONFIG.forkliftWearPerTrip,"Un autoelevador");
    }
  }
  f.cooldown = Math.max(0,2-f.upgrades.speed);
  return changed;
}
runForklifts = function(){
  var changed = false;
  Object.values(state.forklifts).forEach(function(f){ changed = runOneForklift(f) || changed; });
  if(humanSupervisorPushActive()) Object.values(state.forklifts).forEach(function(f){ if(!f.autonomous) changed = runOneForklift(f) || changed; });
  return changed;
};

var __baseRunMaintenance = runMaintenance;
runMaintenance = function(){
  if(unionOnStrike() || !availableWorkersByRole("maintenance").length) return false;
  return __baseRunMaintenance();
};
runDispatcher = function(){
  if(state.dispatchTruck.length < state.order.quantity) return false;
  if(state.dispatchAutonomous) return dispatchOrder(true);
  if(unionOnStrike() || !availableWorkersByRole("dispatcher").length) return false;
  return dispatchOrder(true);
};

function automateCrane(){
  if(state.craneAutonomous || !tech("fullAutomation")) return;
  if(!spend(55000)) return addLog("⚠ Automatizar la grúa cuesta 55.000 🌿."), render();
  state.craneAutonomous = true;
  addUnionHeat(13,"automatización total de la grúa");
  addLog("🤖 Grúa autónoma instalada. Ya no necesita gruero."); render();
}
function automateDispatch(){
  if(state.dispatchAutonomous || !tech("fullAutomation")) return;
  if(!spend(32000)) return addLog("⚠ Automatizar despacho cuesta 32.000 🌿."), render();
  state.dispatchAutonomous = true;
  addUnionHeat(9,"automatización total de despacho");
  addLog("🤖 Despacho autónomo instalado. Ya no necesita despachante."); render();
}

var __baseAutomateCut = automateCut;
automateCut = function(i){ var before=state.cuttingLines[i] && state.cuttingLines[i].autonomous; __baseAutomateCut(i); if(!before && state.cuttingLines[i] && state.cuttingLines[i].autonomous) addUnionHeat(14,"una línea de corte reemplazó un puesto"); };
var __baseAutomatePack = automatePack;
automatePack = function(i){ var before=state.packagingLines[i] && state.packagingLines[i].robot; __baseAutomatePack(i); if(!before && state.packagingLines[i] && state.packagingLines[i].robot) addUnionHeat(12,"un robot de embalaje reemplazó un puesto"); };
var __baseAutomateForklift = automateForklift;
automateForklift = function(id){ var before=state.forklifts[id] && state.forklifts[id].autonomous; __baseAutomateForklift(id); if(!before && state.forklifts[id] && state.forklifts[id].autonomous) addUnionHeat(10,"un autoelevador pasó a ser autónomo"); };
var __baseAutomateArtisan = automateArtisan;
automateArtisan = function(){ var before=state.artisanLine && state.artisanLine.autonomous; var assist=state.artisanLine && state.artisanLine.aiAssist; __baseAutomateArtisan(); if(!assist && state.artisanLine && state.artisanLine.aiAssist) addUnionHeat(3,"se incorporó IA a clasificación"); if(!before && state.artisanLine && state.artisanLine.autonomous) addUnionHeat(11,"la línea artesanal pasó a ser autónoma"); };

function renderSupervisor(){
  var supervisor = workersByRole("supervisor")[0];
  if(!supervisor) return '<span class="muted">Sin supervisor. Podés contratar a Ramiro Roble desde Personal.</span>';
  syncAssignments();
  function slotText(role,labels){
    return state.assignments[role].map(function(id,i){
      var w=id?state.workers[id]:null;
      var machine=role==="cutter"?state.cuttingLines[i]:state.packagingLines[i];
      var fam=w&&machine?Math.round((w.familiarity&&w.familiarity[machine.id])||0):0;
      return labels[i]+": "+(w?w.name+" · fam. "+fam+"%":"sin asignar");
    }).join("<br>");
  }
  return '<b>👔 '+supervisor.name+'</b> · habilidad '+Math.round(supervisor.skill)+'<br>'+slotText("cutter",["Corte 1","Corte 2","Corte 3"])+'<br>'+slotText("packer",["Embalaje 1","Embalaje 2"])+'<div class="action-row"><button class="reassign-cut">🔄 Rotar corte</button><button class="reassign-pack">🔄 Rotar embalaje</button><button class="supervisor-push">'+(state.union.supervisorPush?'🛑 Ritmo normal':'⚡ Presionar producción')+'</button></div><small>Reasignar seguido y forzar el ritmo aumenta la temperatura gremial.</small>';
}
function renderUnion(){
  var h=Math.round(state.union.heat);
  var strike=unionOnStrike();
  var html='<b>'+unionHeatLabel()+' · '+h+'/100</b><br><progress max="100" value="'+h+'"></progress><br>';
  if(strike) html+='<span class="warn">🪧 HUELGA ACTIVA hasta el día '+state.union.strikeUntilDay+'. Sólo trabajan el jefe y los equipos autónomos.</span><br>';
  if(state.union.demand){
    var p=state.union.demand.raisePct;
    html+='<b>🐿️ Reclamo salarial: +'+p+'%</b><div class="action-row"><button class="union-accept">🤝 Aceptar</button><button class="union-negotiate">🗣️ Negociar</button><button class="union-refuse">🚫 Rechazar</button></div>';
  } else html+='<small>Sin reclamo salarial activo.</small>';
  return html;
}

var __baseRenderEngineering = renderEngineering;
renderEngineering = function(){
  var html=__baseRenderEngineering();
  if(tech("fullAutomation")) html += '<div class="upgrade-menu"><b>Automatización final</b><br><button class="auto-crane" '+(state.craneAutonomous?'disabled':'')+'>'+(state.craneAutonomous?'✅ Grúa autónoma':'🤖 Grúa autónoma · 55.000 🌿')+'</button><button class="auto-dispatch" '+(state.dispatchAutonomous?'disabled':'')+'>'+(state.dispatchAutonomous?'✅ Despacho autónomo':'🤖 Despacho autónomo · 32.000 🌿')+'</button></div>';
  return html;
};

var __baseRender = render;
render = function(){
  __baseRender();
  var s=document.querySelector("#supervisor"); if(s) s.innerHTML=renderSupervisor();
  var u=document.querySelector("#union"); if(u) u.innerHTML=renderUnion();
};

var __baseBindDynamicEvents = bindDynamicEvents;
bindDynamicEvents = function(){
  __baseBindDynamicEvents();
  document.querySelector(".reassign-cut")?.addEventListener("click",function(){rotateAssignment("cutter")});
  document.querySelector(".reassign-pack")?.addEventListener("click",function(){rotateAssignment("packer")});
  document.querySelector(".supervisor-push")?.addEventListener("click",toggleSupervisorPush);
  document.querySelector(".union-accept")?.addEventListener("click",acceptUnionDemand);
  document.querySelector(".union-negotiate")?.addEventListener("click",negotiateUnionDemand);
  document.querySelector(".union-refuse")?.addEventListener("click",refuseUnionDemand);
  document.querySelector(".auto-crane")?.addEventListener("click",automateCrane);
  document.querySelector(".auto-dispatch")?.addEventListener("click",automateDispatch);
};

window.__castoriumState = state;
window.__castoriumRender = render;

let __castoriumCheatBuffer = "";
document.addEventListener("keydown", function(event){
  if(event.ctrlKey || event.altKey || event.metaKey || event.key.length !== 1) return;
  __castoriumCheatBuffer = (__castoriumCheatBuffer + event.key.toUpperCase()).slice(-10);
  if(__castoriumCheatBuffer.endsWith("KLAPAUCIUS")){
    state.money += 100000;
    __castoriumCheatBuffer = "";
    addLog("🪄 KLAPAUCIUS: +100.000 🌿. El Banco Central del Castor no hará preguntas.");
    render();
  }
});

syncAssignments();
render();
`;

// main-v2 has no imports/exports; evaluating it here keeps all state in one lexical scope.
eval(source);
