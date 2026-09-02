// v4.1: cross-trained maintenance can work even if Maintenance was not their original specialty.
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

const __v4Bind=bindDynamicEvents;
bindDynamicEvents=function(){
  __v4Bind();
  document.querySelector(".train-auto-maint")?.addEventListener("click",trainAssignedMaintenanceAutomation);
};
render();
