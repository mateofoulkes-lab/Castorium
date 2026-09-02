const CONFIG = {
  startingMoney: 50000,
  logTruckCost: 1000,
  logsPerTruck: 5,
  cutsPerStack: 10,
  cutsPerLog: 80,
  cuttingLineCost: 35000,
  packagingLineCost: 8000,
  packageSalePrice: 700,
  cuttingSlots: 3,
  packagingSlots: 2,
  packagingSteps: ["Envolver", "Cantoneras", "Zunchar", "Etiquetar", "Liberar"],
  payrollEveryDays: 30,
  automationMs: 700,
};

const WORKER_CATALOG = [
  { role: "crane", icon: "🏗️", name: "Tito Álamo", title: "Gruero", hire: 3500, salary: 900, desc: "Descarga camiones y alimenta líneas de corte vacías." },
  { role: "cutter", icon: "🪚", name: "Nora Viruta", title: "Operadora de corte", hire: 4500, salary: 1100, desc: "Opera automáticamente las líneas de corte cargadas." },
  { role: "forklift", icon: "🚜", name: "Beto Incisivo", title: "Autoelevadorista", hire: 5000, salary: 1200, desc: "Mueve pilas y paquetes por el galpón según prioridad." },
  { role: "packer", icon: "📦", name: "Marta Serrucho", title: "Embaladora", hire: 4500, salary: 1050, desc: "Hace automáticamente los pasos de embalaje." },
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
  packagingLines: Array.from({ length: CONFIG.packagingSlots }, () => null),
  finishedYard: [],
  order: createOrder(3),
  dispatchTruck: [],
  completedOrders: 0,
  workers: {},
  lastPayrollDay: 1,
  log: [],
};

function createOrder(quantity = randomInt(3, 7)) {
  return { id: uid("order"), quantity, reward: quantity * CONFIG.packageSalePrice };
}
function createLog() { return { id: uid("log"), type: "log", cutsRemaining: CONFIG.cutsPerLog }; }
function createCutStack() { return { id: uid("stack"), type: "stack" }; }
function createFinishedPackage() { return { id: uid("package"), type: "package" }; }
function newCuttingLine(slot) {
  return { id: uid("cutline"), slot, input: null, cutProgress: 0, outputs: [], upgrades: { speed: 0, output: 0 }, upgradeOpen: false };
}
function newPackagingLine(slot) {
  return { id: uid("packline"), slot, queue: [], step: 0, outputs: [], upgrades: { queue: 0, output: 0 }, upgradeOpen: false };
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function formatMoney(value) { return new Intl.NumberFormat("es-AR").format(value); }
function worker(role) { return state.workers[role] ?? null; }
function hasWorker(role) { return Boolean(worker(role)); }
function cutOutputCapacity(line) { return 1 + line.upgrades.output; }
function packQueueCapacity(line) { return 1 + line.upgrades.queue; }
function packOutputCapacity(line) { return 1 + line.upgrades.output; }
function cutInterval(line) { return Math.max(90, 260 - line.upgrades.speed * 55); }

function timeLabel() {
  const hour = Math.floor(state.minute / 60) % 24;
  const minute = Math.floor(state.minute % 60);
  const shift = hour < 14 ? "Mañana" : hour < 22 ? "Tarde" : "Noche";
  return `Día ${state.day} · ${shift} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function addLog(message) {
  const stamp = timeLabel().split(" · ").at(-1);
  state.log.unshift(`${stamp} — ${message}`);
  state.log = state.log.slice(0, 60);
}
function setBoss(text) { state.boss = text; }
function spend(amount) {
  if (state.money < amount) return false;
  state.money -= amount;
  return true;
}

function buyLogs() {
  if (state.incomingTruck) return addLog("⚠ Ya hay un camión esperando en recepción."), render();
  if (!spend(CONFIG.logTruckCost)) return addLog("⚠ No alcanzan las ramitas."), render();
  state.incomingTruck = { id: uid("truck"), logs: Array.from({ length: CONFIG.logsPerTruck }, createLog) };
  addLog("🚚 Llegó un camión con 5 troncos.");
  render();
}
function buyCuttingLine() {
  const slot = state.cuttingLines.findIndex((line) => line === null);
  if (slot < 0) return addLog("⚠ Los 3 espacios de corte ya están ocupados."), render();
  if (!spend(CONFIG.cuttingLineCost)) return addLog("⚠ No alcanzan las ramitas."), render();
  state.cuttingLines[slot] = newCuttingLine(slot);
  addLog(`🪚 Línea de corte instalada en espacio ${slot + 1}.`);
  render();
}
function buyPackagingLine() {
  const slot = state.packagingLines.findIndex((line) => line === null);
  if (slot < 0) return addLog("⚠ Los 2 espacios de embalaje ya están ocupados."), render();
  if (!spend(CONFIG.packagingLineCost)) return addLog("⚠ No alcanzan las ramitas."), render();
  state.packagingLines[slot] = newPackagingLine(slot);
  addLog(`📦 Línea de embalaje instalada en espacio ${slot + 1}.`);
  render();
}

function hire(role) {
  const candidate = WORKER_CATALOG.find((x) => x.role === role);
  if (!candidate || hasWorker(role)) return;
  if (!spend(candidate.hire)) return addLog("⚠ No alcanzan las ramitas para contratar."), render();
  state.workers[role] = { ...candidate, hiredDay: state.day };
  addLog(`${candidate.icon} ${candidate.name} fue contratado como ${candidate.title}.`);
  render();
}

function upgradeCost(kind, level) {
  const table = {
    cutSpeed: [1800, 4200, 9000],
    cutOutput: [2500, 6000],
    packQueue: [1600, 3800, 7500],
    packOutput: [2200, 5200],
  };
  return table[kind]?.[level] ?? null;
}
function buyCutUpgrade(index, kind) {
  const line = state.cuttingLines[index];
  if (!line) return;
  const key = kind === "cutSpeed" ? "speed" : "output";
  const cost = upgradeCost(kind, line.upgrades[key]);
  if (cost == null) return;
  if (!spend(cost)) return addLog("⚠ No alcanzan las ramitas para esa mejora."), render();
  line.upgrades[key] += 1;
  addLog(`⚙️ Línea ${index + 1}: mejora comprada (${kind === "cutSpeed" ? "ritmo de corte" : "salida acumulable"}).`);
  render();
}
function buyPackUpgrade(index, kind) {
  const line = state.packagingLines[index];
  if (!line) return;
  const key = kind === "packQueue" ? "queue" : "output";
  const cost = upgradeCost(kind, line.upgrades[key]);
  if (cost == null) return;
  if (!spend(cost)) return addLog("⚠ No alcanzan las ramitas para esa mejora."), render();
  line.upgrades[key] += 1;
  addLog(`⚙️ Embalaje ${index + 1}: mejora comprada (${kind === "packQueue" ? "cola de entrada" : "salida acumulable"}).`);
  render();
}

function cutOnce(lineIndex, automated = false) {
  const line = state.cuttingLines[lineIndex];
  if (!line?.input || line.outputs.length >= cutOutputCapacity(line)) return false;
  if (!automated) setBoss(`operando corte ${lineIndex + 1}`);
  line.cutProgress += 1;
  line.input.cutsRemaining -= 1;
  if (line.cutProgress >= CONFIG.cutsPerStack) {
    line.cutProgress = 0;
    line.outputs.push(createCutStack());
    addLog(`🟫 Línea ${lineIndex + 1} produjo una pila (${line.outputs.length}/${cutOutputCapacity(line)} en salida).`);
  }
  if (line.input?.cutsRemaining <= 0) {
    addLog(`🪵 Tronco agotado en línea ${lineIndex + 1}.`);
    line.input = null;
  }
  if (!automated) render();
  return true;
}

function packagingStep(lineIndex, automated = false) {
  const line = state.packagingLines[lineIndex];
  if (!line || line.queue.length === 0 || line.outputs.length >= packOutputCapacity(line)) return false;
  if (!automated) setBoss(`embalando en línea ${lineIndex + 1}`);
  const action = CONFIG.packagingSteps[line.step];
  if (!automated) addLog(`📦 ${action} — línea de embalaje ${lineIndex + 1}.`);
  line.step += 1;
  if (line.step >= CONFIG.packagingSteps.length) {
    line.outputs.push(createFinishedPackage());
    line.queue.shift();
    line.step = 0;
    addLog(`✅ Paquete terminado en línea de embalaje ${lineIndex + 1}.`);
  }
  if (!automated) render();
  return true;
}

function dispatchOrder() {
  if (state.dispatchTruck.length < state.order.quantity) {
    addLog(`⚠ El camión necesita ${state.order.quantity - state.dispatchTruck.length} paquete(s) más.`);
    return render();
  }
  state.money += state.order.reward;
  state.dispatchTruck.splice(0, state.order.quantity);
  state.completedOrders += 1;
  addLog(`🚛 Pedido despachado. +${formatMoney(state.order.reward)} 🌿.`);
  state.order = createOrder();
  setBoss("libre");
  render();
}

function findItem(source, id) {
  if (source === "incoming") return state.incomingTruck?.logs.find((x) => x.id === id) ?? null;
  if (source === "rawYard") return state.rawYard.find((x) => x.id === id) ?? null;
  if (source === "cutBuffer") return state.cutBuffer.find((x) => x.id === id) ?? null;
  if (source === "finishedYard") return state.finishedYard.find((x) => x.id === id) ?? null;
  const [kind, indexText, part] = source.split(":");
  const index = Number(indexText);
  if (kind === "cutLine") {
    const line = state.cuttingLines[index];
    return part === "input" ? line?.input : line?.outputs.find((x) => x.id === id) ?? null;
  }
  if (kind === "packLine") {
    const line = state.packagingLines[index];
    if (part === "queue") return line?.queue.find((x) => x.id === id) ?? null;
    return line?.outputs.find((x) => x.id === id) ?? null;
  }
  return null;
}
function removeArrayItem(arr, id) {
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0) return null;
  return arr.splice(i, 1)[0];
}
function removeItem(source, id) {
  if (source === "incoming") {
    const item = removeArrayItem(state.incomingTruck.logs, id);
    if (state.incomingTruck.logs.length === 0) {
      addLog("🚚 Camión de materia prima vacío; se retiró.");
      state.incomingTruck = null;
    }
    return item;
  }
  if (source === "rawYard") return removeArrayItem(state.rawYard, id);
  if (source === "cutBuffer") return removeArrayItem(state.cutBuffer, id);
  if (source === "finishedYard") return removeArrayItem(state.finishedYard, id);
  const [kind, indexText, part] = source.split(":");
  const index = Number(indexText);
  if (kind === "cutLine") {
    const line = state.cuttingLines[index];
    if (part === "input" && line?.input?.id === id) { const item = line.input; line.input = null; return item; }
    return removeArrayItem(line.outputs, id);
  }
  if (kind === "packLine") {
    const line = state.packagingLines[index];
    return part === "queue" ? removeArrayItem(line.queue, id) : removeArrayItem(line.outputs, id);
  }
  return null;
}
function canDrop(item, target) {
  if (!item) return false;
  if (target === "rawYard") return item.type === "log";
  if (target === "cutBuffer") return item.type === "stack";
  if (target === "finishedYard") return item.type === "package";
  if (target === "dispatchTruck") return item.type === "package" && state.dispatchTruck.length < state.order.quantity;
  const [kind, indexText] = target.split(":");
  const index = Number(indexText);
  if (kind === "cutLine") return item.type === "log" && state.cuttingLines[index] && !state.cuttingLines[index].input;
  if (kind === "packLine") {
    const line = state.packagingLines[index];
    return item.type === "stack" && line && line.queue.length < packQueueCapacity(line);
  }
  return false;
}
function placeItem(item, target) {
  if (target === "rawYard") state.rawYard.push(item);
  else if (target === "cutBuffer") state.cutBuffer.push(item);
  else if (target === "finishedYard") state.finishedYard.push(item);
  else if (target === "dispatchTruck") state.dispatchTruck.push(item);
  else {
    const [kind, indexText] = target.split(":");
    const index = Number(indexText);
    if (kind === "cutLine") state.cuttingLines[index].input = item;
    if (kind === "packLine") state.packagingLines[index].queue.push(item);
  }
}
function describeMove(item, target) {
  if (item.type === "log" && target === "rawYard") return "🏗️ Jefe descargó un tronco en la playa.";
  if (item.type === "log" && target.startsWith("cutLine")) return "🏗️ Jefe cargó un tronco en una línea de corte.";
  if (item.type === "stack" && target === "cutBuffer") return "🚜 Jefe llevó una pila a la playa intermedia.";
  if (item.type === "stack" && target.startsWith("packLine")) return "🚜 Jefe llevó una pila a embalaje.";
  if (item.type === "package" && target === "finishedYard") return "🚜 Jefe llevó un paquete a la playa de salida.";
  if (item.type === "package" && target === "dispatchTruck") return "🚜 Jefe cargó un paquete al camión de despacho.";
  return "🦫 Movimiento completado.";
}
function moveItem(source, id, target, automated = false) {
  const item = findItem(source, id);
  if (!canDrop(item, target)) return false;
  const removed = removeItem(source, id);
  placeItem(removed, target);
  if (!automated) {
    setBoss(target === "rawYard" || target.startsWith("cutLine") ? "en grúa" : "en autoelevador");
    addLog(describeMove(removed, target));
    render();
  }
  return true;
}

function runCrane() {
  if (!hasWorker("crane")) return false;
  if (state.incomingTruck?.logs.length) {
    const item = state.incomingTruck.logs[0];
    moveItem("incoming", item.id, "rawYard", true);
    return true;
  }
  const emptyLine = state.cuttingLines.findIndex((line) => line && !line.input);
  if (emptyLine >= 0 && state.rawYard.length) {
    moveItem("rawYard", state.rawYard[0].id, `cutLine:${emptyLine}`, true);
    return true;
  }
  return false;
}
function runCutter() {
  if (!hasWorker("cutter")) return false;
  for (let i = 0; i < state.cuttingLines.length; i++) if (cutOnce(i, true)) return true;
  return false;
}
function runForklift() {
  if (!hasWorker("forklift")) return false;
  for (let i = 0; i < state.cuttingLines.length; i++) {
    const line = state.cuttingLines[i];
    if (line?.outputs.length) {
      moveItem(`cutLine:${i}:output`, line.outputs[0].id, "cutBuffer", true);
      return true;
    }
  }
  for (let i = 0; i < state.packagingLines.length; i++) {
    const line = state.packagingLines[i];
    if (line?.outputs.length) {
      moveItem(`packLine:${i}:output`, line.outputs[0].id, "finishedYard", true);
      return true;
    }
  }
  for (let i = 0; i < state.packagingLines.length; i++) {
    const line = state.packagingLines[i];
    if (line && state.cutBuffer.length && line.queue.length < packQueueCapacity(line)) {
      moveItem("cutBuffer", state.cutBuffer[0].id, `packLine:${i}`, true);
      return true;
    }
  }
  if (state.finishedYard.length && state.dispatchTruck.length < state.order.quantity) {
    moveItem("finishedYard", state.finishedYard[0].id, "dispatchTruck", true);
    return true;
  }
  return false;
}
function runPacker() {
  if (!hasWorker("packer")) return false;
  for (let i = 0; i < state.packagingLines.length; i++) if (packagingStep(i, true)) return true;
  return false;
}

function payroll() {
  const total = Object.values(state.workers).reduce((sum, w) => sum + w.salary, 0);
  if (!total) return;
  state.money -= total;
  addLog(`💸 Sueldos del mes: -${formatMoney(total)} 🌿.`);
}

function draggableItem(item, source, label) {
  return `<span class="item" draggable="true" data-id="${item.id}" data-source="${source}" title="Arrastrar">${label}</span>`;
}
function upgradeButton(label, kind, level, max, cost, index, machine) {
  if (level >= max) return `<button disabled>✅ ${label} · MAX</button>`;
  return `<button class="machine-upgrade" data-machine="${machine}" data-index="${index}" data-kind="${kind}">⚙️ ${label} · ${formatMoney(cost)} 🌿</button>`;
}
function renderCuttingLines() {
  return state.cuttingLines.map((line, index) => {
    if (!line) return `<div class="machine empty">Espacio ${index + 1}<br>vacío</div>`;
    const input = line.input ? draggableItem(line.input, `cutLine:${index}:input`, `🪵 ${line.input.cutsRemaining}/80`) : `<span class="warn">Sin tronco</span>`;
    const outputs = line.outputs.length ? line.outputs.map((x) => draggableItem(x, `cutLine:${index}:output`, "🟫 Pila")).join("") : "Salida libre";
    const blocked = !line.input || line.outputs.length >= cutOutputCapacity(line);
    const speedCost = upgradeCost("cutSpeed", line.upgrades.speed);
    const outCost = upgradeCost("cutOutput", line.upgrades.output);
    return `<div class="machine dropzone" data-drop="cutLine:${index}">
      <b>Línea ${index + 1}</b><br>
      Entrada: ${input}<br>
      <progress max="${CONFIG.cutsPerStack}" value="${line.cutProgress}"></progress>
      <small>${line.cutProgress}/${CONFIG.cutsPerStack} cortes</small><br>
      Salida (${line.outputs.length}/${cutOutputCapacity(line)}): ${outputs}
      <div class="action-row"><button class="hold-cut" data-line="${index}" ${blocked ? "disabled" : ""}>🪚 Mantener para cortar</button><button class="toggle-upgrades" data-machine="cut" data-index="${index}">⚙️ Mejoras</button></div>
      ${line.upgradeOpen ? `<div class="upgrade-menu">${upgradeButton("Ritmo de corte", "cutSpeed", line.upgrades.speed, 3, speedCost, index, "cut")}${upgradeButton("Acumulador de salida", "cutOutput", line.upgrades.output, 2, outCost, index, "cut")}</div>` : ""}
    </div>`;
  }).join("");
}
function renderPackagingLines() {
  return state.packagingLines.map((line, index) => {
    if (!line) return `<div class="machine empty">Espacio ${index + 1}<br>vacío</div>`;
    const queue = line.queue.length ? line.queue.map((x) => draggableItem(x, `packLine:${index}:queue`, "🟫")).join("") : `<span class="warn">Vacía</span>`;
    const outputs = line.outputs.length ? line.outputs.map((x) => draggableItem(x, `packLine:${index}:output`, "✅📦")).join("") : "Salida libre";
    const action = line.queue.length ? CONFIG.packagingSteps[line.step] : "Esperando carga";
    const blocked = !line.queue.length || line.outputs.length >= packOutputCapacity(line);
    const queueCost = upgradeCost("packQueue", line.upgrades.queue);
    const outCost = upgradeCost("packOutput", line.upgrades.output);
    return `<div class="machine dropzone" data-drop="packLine:${index}">
      <b>Embalaje ${index + 1}</b><br>
      Cola (${line.queue.length}/${packQueueCapacity(line)}): ${queue}<br>
      <progress max="5" value="${line.step}"></progress>
      <small>${line.step}/5 · ${action}</small><br>
      Salida (${line.outputs.length}/${packOutputCapacity(line)}): ${outputs}
      <div class="action-row"><button class="pack-step" data-line="${index}" ${blocked ? "disabled" : ""}>📦 ${action}</button><button class="toggle-upgrades" data-machine="pack" data-index="${index}">⚙️ Mejoras</button></div>
      ${line.upgradeOpen ? `<div class="upgrade-menu">${upgradeButton("Cola de entrada +1", "packQueue", line.upgrades.queue, 3, queueCost, index, "pack")}${upgradeButton("Acumulador de salida", "packOutput", line.upgrades.output, 2, outCost, index, "pack")}</div>` : ""}
    </div>`;
  }).join("");
}
function renderWorkers() {
  return WORKER_CATALOG.map((w) => {
    const hired = worker(w.role);
    return `<div class="worker-card ${hired ? "hired" : ""}">
      <b>${w.icon} ${w.name}</b><br><small>${w.title}</small>
      <p>${w.desc}</p>
      ${hired ? `<span class="good">Contratado · ${formatMoney(w.salary)} 🌿/mes</span>` : `<button class="hire-worker" data-role="${w.role}" ${state.money < w.hire ? "disabled" : ""}>Contratar · ${formatMoney(w.hire)} 🌿</button><small>Sueldo: ${formatMoney(w.salary)} 🌿/mes</small>`}
    </div>`;
  }).join("");
}
function tutorialText() {
  if (!state.cuttingLines.some(Boolean)) return "1. Comprá tu primera línea de corte.";
  if (!state.incomingTruck && state.rawYard.length === 0 && !state.cuttingLines.some((l) => l?.input)) return "2. Comprá un camión de troncos.";
  if (state.incomingTruck && state.rawYard.length === 0 && !hasWorker("crane")) return "3. Arrastrá un 🪵 del camión a la Playa de troncos.";
  if (state.rawYard.length > 0 && !state.cuttingLines.some((l) => l?.input) && !hasWorker("crane")) return "4. Arrastrá un 🪵 desde la playa a una línea de corte.";
  if (state.cuttingLines.some((l) => l?.input && l.outputs.length < cutOutputCapacity(l)) && !hasWorker("cutter")) return "5. Mantené apretado ‘cortar’ hasta producir una pila.";
  if (state.cuttingLines.some((l) => l?.outputs.length) && state.cutBuffer.length === 0 && !hasWorker("forklift")) return "6. Arrastrá la 🟫 pila producida a la playa intermedia.";
  if (!state.packagingLines.some(Boolean)) return "7. Comprá una línea de embalaje.";
  if (state.cutBuffer.length > 0 && !state.packagingLines.some((l) => l?.queue.length) && !hasWorker("forklift")) return "8. Arrastrá una 🟫 pila a la línea de embalaje.";
  if (state.packagingLines.some((l) => l?.queue.length) && !hasWorker("packer")) return "9. Hacé manualmente los cinco pasos de embalaje.";
  if (state.packagingLines.some((l) => l?.outputs.length) && state.finishedYard.length === 0 && !hasWorker("forklift")) return "10. Llevá el paquete terminado a la Playa de salida.";
  if (state.finishedYard.length > 0 && state.dispatchTruck.length === 0 && !hasWorker("forklift")) return "11. Arrastrá paquetes al camión hasta completar el pedido.";
  if (state.dispatchTruck.length >= state.order.quantity) return "12. ¡Camión lleno! Despachá el pedido.";
  if (state.completedOrders > 0) return "✅ Loop básico dominado. Ahora probá mejoras y contrataciones para dejar de hacer trabajo manual.";
  return "Seguí produciendo hasta completar el pedido actual.";
}

let activeHold = null;
function stopHold() {
  if (activeHold) clearInterval(activeHold);
  activeHold = null;
}
function render() {
  document.querySelector("#money").textContent = formatMoney(state.money);
  document.querySelector("#clock").textContent = timeLabel();
  document.querySelector("#boss").textContent = `🦫 Jefe: ${state.boss}`;
  document.querySelector("#tutorial").innerHTML = `<b>🎯 Tutorial</b><div class="tutorial-step">${tutorialText()}</div>`;
  document.querySelector("#workers").innerHTML = renderWorkers();

  document.querySelector("#incoming").innerHTML = state.incomingTruck
    ? `<div>Camión: ${state.incomingTruck.logs.length}/5 troncos</div>${state.incomingTruck.logs.map((x) => draggableItem(x, "incoming", "🪵")).join("")}`
    : "Sin camión";
  document.querySelector("#rawYard").innerHTML = state.rawYard.length ? state.rawYard.map((x) => draggableItem(x, "rawYard", `🪵 ${x.cutsRemaining}`)).join("") : "Vacía";
  document.querySelector("#cutLines").innerHTML = renderCuttingLines();
  document.querySelector("#cutBuffer").innerHTML = state.cutBuffer.length ? state.cutBuffer.map((x) => draggableItem(x, "cutBuffer", "🟫")).join("") : "Vacía";
  document.querySelector("#packLines").innerHTML = renderPackagingLines();
  document.querySelector("#finishedYard").innerHTML = state.finishedYard.length ? state.finishedYard.map((x) => draggableItem(x, "finishedYard", "✅📦")).join("") : "Vacía";
  document.querySelector("#dispatchTruck").innerHTML = `Carga: ${state.dispatchTruck.length}/${state.order.quantity}<br>${state.dispatchTruck.map(() => "✅📦").join(" ")}<div class="action-row"><button id="dispatchButton" ${state.dispatchTruck.length < state.order.quantity ? "disabled" : ""}>🚛 Despachar</button></div>`;
  document.querySelector("#order").innerHTML = `<b>Pedido #${state.order.id.split("-")[1]}</b> · ${state.order.quantity} paquetes · recompensa ${formatMoney(state.order.reward)} 🌿`;
  document.querySelector("#log").innerHTML = state.log.map((entry) => `<div class="log-entry">${entry}</div>`).join("");

  document.querySelector("#buyLogs").disabled = Boolean(state.incomingTruck) || state.money < CONFIG.logTruckCost;
  document.querySelector("#buyCutLine").disabled = !state.cuttingLines.includes(null) || state.money < CONFIG.cuttingLineCost;
  document.querySelector("#buyPackLine").disabled = !state.packagingLines.includes(null) || state.money < CONFIG.packagingLineCost;
  bindDynamicEvents();
}

function bindDynamicEvents() {
  document.querySelectorAll("[draggable=true]").forEach((el) => {
    el.addEventListener("dragstart", (event) => event.dataTransfer.setData("application/json", JSON.stringify({ id: el.dataset.id, source: el.dataset.source })));
  });
  document.querySelectorAll(".dropzone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => { event.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault(); zone.classList.remove("dragover");
      try { const data = JSON.parse(event.dataTransfer.getData("application/json")); moveItem(data.source, data.id, zone.dataset.drop); } catch {}
    });
  });
  document.querySelectorAll(".pack-step").forEach((button) => button.addEventListener("click", () => packagingStep(Number(button.dataset.line))));
  document.querySelectorAll(".hold-cut").forEach((button) => {
    button.addEventListener("pointerdown", () => {
      stopHold();
      const index = Number(button.dataset.line);
      cutOnce(index);
      const line = state.cuttingLines[index];
      activeHold = setInterval(() => cutOnce(index), cutInterval(line));
    });
  });
  document.querySelectorAll(".toggle-upgrades").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.index);
    const line = button.dataset.machine === "cut" ? state.cuttingLines[index] : state.packagingLines[index];
    line.upgradeOpen = !line.upgradeOpen;
    render();
  }));
  document.querySelectorAll(".machine-upgrade").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.index);
    if (button.dataset.machine === "cut") buyCutUpgrade(index, button.dataset.kind);
    else buyPackUpgrade(index, button.dataset.kind);
  }));
  document.querySelectorAll(".hire-worker").forEach((button) => button.addEventListener("click", () => hire(button.dataset.role)));
  document.querySelector("#dispatchButton")?.addEventListener("click", dispatchOrder);
}

document.addEventListener("pointerup", stopHold);
document.addEventListener("pointercancel", stopHold);
document.addEventListener("visibilitychange", stopHold);
document.querySelector("#buyLogs").addEventListener("click", buyLogs);
document.querySelector("#buyCutLine").addEventListener("click", buyCuttingLine);
document.querySelector("#buyPackLine").addEventListener("click", buyPackagingLine);
document.querySelectorAll("[data-speed]").forEach((button) => {
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.speed);
    document.querySelectorAll("[data-speed]").forEach((b) => b.classList.toggle("active", b === button));
  });
});

let automationElapsed = 0;
setInterval(() => {
  if (!state.speed) return;
  state.minute += state.speed;
  while (state.minute >= 24 * 60) {
    state.minute -= 24 * 60;
    state.day += 1;
    addLog(`🌅 Comienza el día ${state.day}.`);
    if (state.day - state.lastPayrollDay >= CONFIG.payrollEveryDays) {
      payroll();
      state.lastPayrollDay = state.day;
    }
  }
  automationElapsed += 1000 * state.speed;
  if (automationElapsed >= CONFIG.automationMs) {
    automationElapsed = 0;
    const changed = runCrane() | runCutter() | runForklift() | runPacker();
    if (changed) render();
  } else {
    document.querySelector("#clock").textContent = timeLabel();
  }
}, 1000);

addLog("🦫 Bienvenido a Castorium. El galpón está vacío.");
render();
