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
  { id: "cutter-1", role: "cutter", icon: "🪚", name: "Nora Viruta", title: "Operadora de corte", hire: 4500, salary: 1100, skill: 70, max: 1, desc: "Opera automáticamente las líneas de corte. Su capacidad influye en la calidad." },
  { id: "forklift-1", role: "forklift", icon: "🚜", name: "Beto Incisivo", title: "Autoelevadorista", hire: 5000, salary: 1200, skill: 68, max: 4, desc: "Mueve pilas y paquetes por el galpón según prioridad." },
  { id: "forklift-2", role: "forklift", icon: "🚜", name: "Lidia Paleta", title: "Autoelevadorista", hire: 5300, salary: 1250, skill: 72, max: 4, desc: "Segundo autoelevadorista para aumentar el movimiento interno." },
  { id: "forklift-3", role: "forklift", icon: "🚜", name: "René Roedor", title: "Autoelevadorista", hire: 5600, salary: 1300, skill: 76, max: 4, desc: "Tercer autoelevadorista para una planta más cargada." },
  { id: "forklift-4", role: "forklift", icon: "🚜", name: "Cacho Quebracho", title: "Autoelevadorista", hire: 6000, salary: 1400, skill: 82, max: 4, desc: "Cuarto y último autoelevadorista permitido en el galpón." },
  { id: "packer-1", role: "packer", icon: "📦", name: "Marta Serrucho", title: "Embaladora", hire: 4500, salary: 1050, skill: 72, max: 1, desc: "Hace automáticamente los pasos de embalaje." },
  { id: "maintenance-1", role: "maintenance", icon: "🔧", name: "Rubén Rodamiento", title: "Guardia de mantenimiento", hire: 6500, salary: 1500, skill: 76, max: 1, desc: "Repara líneas dañadas y evita que trabajen demasiado tiempo en mal estado." },
  { id: "classifier-1", role: "classifier", icon: "🧐", name: "Elsa Nogal", title: "Clasificadora artesanal", hire: 7500, salary: 1600, skill: 68, max: 1, desc: "Prioriza pilas de peor calidad y las mejora en la línea artesanal." },
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
  classifierLevel: 1,
  lastPayrollDay: 1,
  log: [],
};

function createOrder(quantity = randomInt(3, 7)) {
  return { id: uid("order"), quantity };
}
function createLog() { return { id: uid("log"), type: "log", cutsRemaining: CONFIG.cutsPerLog }; }
function createCutStack(quality) { return { id: uid("stack"), type: "stack", quality }; }
function createFinishedPackage(quality) { return { id: uid("package"), type: "package", quality }; }
function newCuttingLine(slot) {
  return { id: uid("cutline"), slot, input: null, cutProgress: 0, outputs: [], health: 100, broken: false, upgrades: { speed: 0, output: 0 }, upgradeOpen: false };
}
function newPackagingLine(slot) {
  return { id: uid("packline"), slot, queue: [], step: 0, outputs: [], health: 100, broken: false, upgrades: { capacity: 0 }, upgradeOpen: false };
}
function newArtisanLine() {
  return { id: uid("artisan"), input: null, progress: 0, output: null };
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function formatMoney(value) { return new Intl.NumberFormat("es-AR").format(Math.round(value)); }
function hiredWorkers() { return Object.values(state.workers); }
function workerCount(role) { return hiredWorkers().filter((w) => w.role === role).length; }
function hasWorker(role) { return workerCount(role) > 0; }
function bestWorker(role) { return hiredWorkers().filter((w) => w.role === role).sort((a, b) => b.skill - a.skill)[0] ?? null; }
function isHired(id) { return Boolean(state.workers[id]); }
function cutOutputCapacity(line) { return 1 + line.upgrades.output; }
function packCapacity(line) { return 1 + line.upgrades.capacity; }
function cutInterval(line) { return Math.max(90, 260 - line.upgrades.speed * 55); }
function qMeta(key) { return QUALITY[key] ?? QUALITY.third; }
function qLabel(key) { const q = qMeta(key); return `${q.icon} ${q.name}`; }
function itemValue(item) { return qMeta(item.quality).price; }

function timeLabel() {
  const hour = Math.floor(state.minute / 60) % 24;
  const minute = Math.floor(state.minute % 60);
  const shift = hour < 14 ? "Mañana" : hour < 22 ? "Tarde" : "Noche";
  return `Día ${state.day} · ${shift} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function addLog(message) {
  const stamp = timeLabel().split(" · ").at(-1);
  state.log.unshift(`${stamp} — ${message}`);
  state.log = state.log.slice(0, 80);
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
function buyArtisanLine() {
  if (state.artisanLine) return;
  if (!spend(CONFIG.artisanLineCost)) return addLog("⚠ No alcanzan las ramitas."), render();
  state.artisanLine = newArtisanLine();
  addLog("🧰 Línea de troncos artesanales instalada.");
  render();
}

function hire(id) {
  const candidate = WORKER_CATALOG.find((x) => x.id === id);
  if (!candidate || isHired(id)) return;
  if (workerCount(candidate.role) >= candidate.max) return addLog("⚠ Ya alcanzaste el máximo para ese puesto."), render();
  if (!spend(candidate.hire)) return addLog("⚠ No alcanzan las ramitas para contratar."), render();
  state.workers[id] = { ...candidate, hiredDay: state.day };
  addLog(`${candidate.icon} ${candidate.name} fue contratado como ${candidate.title}.`);
  render();
}
function trainClassifier() {
  if (!hasWorker("classifier") || state.classifierLevel >= 2) return;
  const cost = 9000;
  if (!spend(cost)) return addLog("⚠ No alcanzan las ramitas para capacitar al personal."), render();
  state.classifierLevel = 2;
  const w = bestWorker("classifier");
  if (w) w.skill += 12;
  addLog("🎓 Clasificación avanzada desbloqueada: Primera → Premium.");
  render();
}

function upgradeCost(kind, level) {
  const table = {
    cutSpeed: [1800, 4200, 9000],
    cutOutput: [2500, 6000],
    packCapacity: [2600, 6200, 12500],
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
function buyPackUpgrade(index) {
  const line = state.packagingLines[index];
  if (!line) return;
  const cost = upgradeCost("packCapacity", line.upgrades.capacity);
  if (cost == null) return;
  if (!spend(cost)) return addLog("⚠ No alcanzan las ramitas para esa mejora."), render();
  line.upgrades.capacity += 1;
  addLog(`⚙️ Embalaje ${index + 1}: capacidad de línea aumentada a ${packCapacity(line)} entrada / ${packCapacity(line)} salida.`);
  render();
}

function qualityFromCut(line, skill) {
  const score = line.health * 0.62 + skill * 0.38 + randomInt(-18, 18);
  if (score < 35) return "scrap";
  if (score < 55) return "third";
  if (score < 73) return "second";
  return "first";
}
function degradeLine(line, amount) {
  line.health = clamp(line.health - amount, 0, 100);
  if (!line.broken && line.health < 38) {
    const chance = (38 - line.health) / 300;
    if (Math.random() < chance) {
      line.broken = true;
      addLog("💥 Una línea se rompió y quedó fuera de servicio.");
    }
  }
}
function cutOnce(lineIndex, automated = false) {
  const line = state.cuttingLines[lineIndex];
  if (!line?.input || line.broken || line.outputs.length >= cutOutputCapacity(line)) return false;
  if (!automated) setBoss(`operando corte ${lineIndex + 1}`);
  line.cutProgress += 1;
  line.input.cutsRemaining -= 1;
  degradeLine(line, CONFIG.wearPerCut);
  if (line.cutProgress >= CONFIG.cutsPerStack) {
    line.cutProgress = 0;
    const operatorSkill = automated && bestWorker("cutter") ? bestWorker("cutter").skill : 58;
    const quality = qualityFromCut(line, operatorSkill);
    line.outputs.push(createCutStack(quality));
    addLog(`🟫 Línea ${lineIndex + 1} produjo una pila ${qLabel(quality)}.`);
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
  if (!line || line.broken || line.queue.length === 0 || line.outputs.length >= packCapacity(line)) return false;
  if (!automated) setBoss(`embalando en línea ${lineIndex + 1}`);
  const action = CONFIG.packagingSteps[line.step];
  if (!automated) addLog(`📦 ${action} — línea de embalaje ${lineIndex + 1}.`);
  line.step += 1;
  degradeLine(line, CONFIG.wearPerPackStep);
  if (line.step >= CONFIG.packagingSteps.length) {
    const stack = line.queue.shift();
    line.outputs.push(createFinishedPackage(stack.quality));
    line.step = 0;
    addLog(`✅ Paquete ${qLabel(stack.quality)} terminado en embalaje ${lineIndex + 1}.`);
  }
  if (!automated) render();
  return true;
}

function nextQuality(quality) {
  if (quality === "third") return "second";
  if (quality === "second") return "first";
  if (quality === "first" && state.classifierLevel >= 2) return "premium";
  return null;
}
function artisanStep(automated = false) {
  const line = state.artisanLine;
  if (!line?.input || line.output) return false;
  const next = nextQuality(line.input.quality);
  if (!next) return false;
  if (!automated) setBoss("reapilando en línea artesanal");
  line.progress += 1;
  if (line.progress >= 10) {
    const item = line.input;
    item.quality = next;
    line.input = null;
    line.progress = 0;
    line.output = item;
    addLog(`✨ Línea artesanal mejoró una pila a ${qLabel(next)}.`);
  }
  if (!automated) render();
  return true;
}

function repairLine(kind, index, automated = false) {
  const line = kind === "cut" ? state.cuttingLines[index] : state.packagingLines[index];
  if (!line || line.health >= 100) return false;
  const amount = automated ? CONFIG.maintenanceRepair : CONFIG.manualRepair;
  line.health = clamp(line.health + amount, 0, 100);
  if (line.health >= 45 && line.broken) {
    line.broken = false;
    addLog(`🔧 ${kind === "cut" ? "Línea de corte" : "Embalaje"} ${index + 1} volvió a servicio.`);
  }
  if (!automated) {
    setBoss(`reparando ${kind === "cut" ? "línea" : "embalaje"} ${index + 1}`);
    render();
  }
  return true;
}

function dispatchOrder() {
  if (state.dispatchTruck.length < state.order.quantity) {
    addLog(`⚠ El camión necesita ${state.order.quantity - state.dispatchTruck.length} paquete(s) más.`);
    return render();
  }
  const sold = state.dispatchTruck.splice(0, state.order.quantity);
  const revenue = sold.reduce((sum, item) => sum + itemValue(item), 0);
  state.money += revenue;
  state.completedOrders += 1;
  addLog(`🚛 Pedido despachado. +${formatMoney(revenue)} 🌿 según calidad.`);
  state.order = createOrder();
  setBoss("libre");
  render();
}

function findItem(source, id) {
  if (source === "incoming") return state.incomingTruck?.logs.find((x) => x.id === id) ?? null;
  if (source === "rawYard") return state.rawYard.find((x) => x.id === id) ?? null;
  if (source === "cutBuffer") return state.cutBuffer.find((x) => x.id === id) ?? null;
  if (source === "artisanYard") return state.artisanYard.find((x) => x.id === id) ?? null;
  if (source === "finishedYard") return state.finishedYard.find((x) => x.id === id) ?? null;
  if (source === "artisanLine:input") return state.artisanLine?.input?.id === id ? state.artisanLine.input : null;
  if (source === "artisanLine:output") return state.artisanLine?.output?.id === id ? state.artisanLine.output : null;
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
  if (source === "artisanYard") return removeArrayItem(state.artisanYard, id);
  if (source === "finishedYard") return removeArrayItem(state.finishedYard, id);
  if (source === "artisanLine:input") { const x = state.artisanLine.input; state.artisanLine.input = null; state.artisanLine.progress = 0; return x; }
  if (source === "artisanLine:output") { const x = state.artisanLine.output; state.artisanLine.output = null; return x; }
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
function canImproveQuality(q) {
  if (q === "third" || q === "second") return true;
  if (q === "first" && state.classifierLevel >= 2) return true;
  return false;
}
function canDrop(item, target) {
  if (!item) return false;
  if (target === "rawYard") return item.type === "log";
  if (target === "cutBuffer") return item.type === "stack";
  if (target === "artisanYard") return item.type === "stack";
  if (target === "finishedYard") return item.type === "package";
  if (target === "dispatchTruck") return item.type === "package" && state.dispatchTruck.length < state.order.quantity;
  if (target === "artisanLine") return item.type === "stack" && state.artisanLine && !state.artisanLine.input && canImproveQuality(item.quality);
  const [kind, indexText] = target.split(":");
  const index = Number(indexText);
  if (kind === "cutLine") return item.type === "log" && state.cuttingLines[index] && !state.cuttingLines[index].input;
  if (kind === "packLine") {
    const line = state.packagingLines[index];
    return item.type === "stack" && line && line.queue.length < packCapacity(line);
  }
  return false;
}
function placeItem(item, target) {
  if (target === "rawYard") state.rawYard.push(item);
  else if (target === "cutBuffer") state.cutBuffer.push(item);
  else if (target === "artisanYard") state.artisanYard.push(item);
  else if (target === "finishedYard") state.finishedYard.push(item);
  else if (target === "dispatchTruck") state.dispatchTruck.push(item);
  else if (target === "artisanLine") state.artisanLine.input = item;
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
  if (item.type === "stack" && target === "artisanLine") return "🚜 Jefe llevó una pila a la línea artesanal.";
  if (item.type === "stack" && target.startsWith("packLine")) return "🚜 Jefe llevó una pila directamente a embalaje.";
  if (item.type === "package" && target === "finishedYard") return "🚜 Jefe llevó un paquete a la playa de salida.";
  if (item.type === "package" && target === "dispatchTruck") return "🚜 Jefe llevó un paquete directamente al camión.";
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
  if (state.incomingTruck?.logs.length) return moveItem("incoming", state.incomingTruck.logs[0].id, "rawYard", true);
  const emptyLine = state.cuttingLines.findIndex((line) => line && !line.input && !line.broken);
  if (emptyLine >= 0 && state.rawYard.length) return moveItem("rawYard", state.rawYard[0].id, `cutLine:${emptyLine}`, true);
  return false;
}
function runCutter() {
  if (!hasWorker("cutter")) return false;
  for (let i = 0; i < state.cuttingLines.length; i++) if (cutOnce(i, true)) return true;
  return false;
}
function eligibleForArtisan(stack) { return canImproveQuality(stack.quality); }
function runClassifier() {
  if (!hasWorker("classifier") || !state.artisanLine) return false;
  if (state.artisanLine.input) return artisanStep(true);
  if (state.artisanLine.output) return moveItem("artisanLine:output", state.artisanLine.output.id, "artisanYard", true);
  const candidates = [];
  state.cuttingLines.forEach((line, index) => line?.outputs.forEach((stack) => { if (eligibleForArtisan(stack)) candidates.push({ stack, source: `cutLine:${index}:output` }); }));
  state.cutBuffer.forEach((stack) => { if (eligibleForArtisan(stack)) candidates.push({ stack, source: "cutBuffer" }); });
  candidates.sort((a, b) => qMeta(a.stack.quality).rank - qMeta(b.stack.quality).rank);
  if (!candidates.length) return false;
  const chance = state.classifierLevel >= 2 ? 0.8 : 0.6;
  if (Math.random() > chance) return false;
  return moveItem(candidates[0].source, candidates[0].stack.id, "artisanLine", true);
}
function performForkliftTask() {
  for (let i = 0; i < state.packagingLines.length; i++) {
    const line = state.packagingLines[i];
    if (line?.outputs.length && state.dispatchTruck.length < state.order.quantity) return moveItem(`packLine:${i}:output`, line.outputs[0].id, "dispatchTruck", true);
  }
  if (state.finishedYard.length && state.dispatchTruck.length < state.order.quantity) return moveItem("finishedYard", state.finishedYard[0].id, "dispatchTruck", true);
  for (let i = 0; i < state.packagingLines.length; i++) {
    const line = state.packagingLines[i];
    if (!line || line.queue.length >= packCapacity(line)) continue;
    if (state.artisanYard.length) return moveItem("artisanYard", state.artisanYard[0].id, `packLine:${i}`, true);
    if (state.cutBuffer.length) return moveItem("cutBuffer", state.cutBuffer[0].id, `packLine:${i}`, true);
    for (let c = 0; c < state.cuttingLines.length; c++) {
      const cut = state.cuttingLines[c];
      if (cut?.outputs.length && !eligibleForArtisan(cut.outputs[0])) return moveItem(`cutLine:${c}:output`, cut.outputs[0].id, `packLine:${i}`, true);
    }
  }
  for (let i = 0; i < state.cuttingLines.length; i++) {
    const line = state.cuttingLines[i];
    if (line?.outputs.length) return moveItem(`cutLine:${i}:output`, line.outputs[0].id, "cutBuffer", true);
  }
  for (let i = 0; i < state.packagingLines.length; i++) {
    const line = state.packagingLines[i];
    if (line?.outputs.length) return moveItem(`packLine:${i}:output`, line.outputs[0].id, "finishedYard", true);
  }
  return false;
}
function runForklifts() {
  const count = workerCount("forklift");
  if (!count) return false;
  let changed = false;
  for (let i = 0; i < count; i++) changed = performForkliftTask() || changed;
  return changed;
}
function runPacker() {
  if (!hasWorker("packer")) return false;
  for (let i = 0; i < state.packagingLines.length; i++) if (packagingStep(i, true)) return true;
  return false;
}
function runMaintenance() {
  if (!hasWorker("maintenance")) return false;
  const candidates = [];
  state.cuttingLines.forEach((line, index) => { if (line && line.health < 82) candidates.push({ kind: "cut", index, health: line.health }); });
  state.packagingLines.forEach((line, index) => { if (line && line.health < 82) candidates.push({ kind: "pack", index, health: line.health }); });
  candidates.sort((a, b) => a.health - b.health);
  if (!candidates.length) return false;
  return repairLine(candidates[0].kind, candidates[0].index, true);
}

function payroll() {
  const total = hiredWorkers().reduce((sum, w) => sum + w.salary, 0);
  if (!total) return;
  state.money -= total;
  addLog(`💸 Sueldos del mes: -${formatMoney(total)} 🌿.`);
}

function draggableItem(item, source, label) {
  return `<span class="item" draggable="true" data-id="${item.id}" data-source="${source}" title="Arrastrar">${label}</span>`;
}
function stackChip(stack, source) { return draggableItem(stack, source, `🟫 ${qLabel(stack.quality)}`); }
function packageChip(pkg, source) { return draggableItem(pkg, source, `📦 ${qLabel(pkg.quality)}`); }
function upgradeButton(label, kind, level, max, cost, index, machine) {
  if (level >= max) return `<button disabled>✅ ${label} · MAX</button>`;
  return `<button class="machine-upgrade" data-machine="${machine}" data-index="${index}" data-kind="${kind}">⚙️ ${label} · ${formatMoney(cost)} 🌿</button>`;
}
function healthText(line) {
  const stateText = line.broken ? "💥 ROTA" : line.health < 45 ? "🔴 crítica" : line.health < 70 ? "🟠 gastada" : "🟢 operativa";
  return `${stateText} · ${Math.round(line.health)}%`;
}
function renderCuttingLines() {
  return state.cuttingLines.map((line, index) => {
    if (!line) return `<div class="machine empty">Espacio ${index + 1}<br>vacío</div>`;
    const input = line.input ? draggableItem(line.input, `cutLine:${index}:input`, `🪵 ${line.input.cutsRemaining}/80`) : `<span class="warn">Sin tronco</span>`;
    const outputs = line.outputs.length ? line.outputs.map((x) => stackChip(x, `cutLine:${index}:output`)).join("") : "Salida libre";
    const blocked = !line.input || line.broken || line.outputs.length >= cutOutputCapacity(line);
    const speedCost = upgradeCost("cutSpeed", line.upgrades.speed);
    const outCost = upgradeCost("cutOutput", line.upgrades.output);
    return `<div class="machine dropzone" data-drop="cutLine:${index}">
      <b>Línea ${index + 1}</b><br>
      Estado: ${healthText(line)}<br>
      Entrada: ${input}<br>
      <progress max="${CONFIG.cutsPerStack}" value="${line.cutProgress}"></progress>
      <small>${line.cutProgress}/${CONFIG.cutsPerStack} cortes</small><br>
      Salida (${line.outputs.length}/${cutOutputCapacity(line)}): ${outputs}
      <div class="action-row"><button class="hold-cut" data-line="${index}" ${blocked ? "disabled" : ""}>🪚 Mantener / clickear para cortar</button><button class="repair-line" data-kind="cut" data-index="${index}" ${line.health >= 100 ? "disabled" : ""}>🔧 Reparar</button><button class="toggle-upgrades" data-machine="cut" data-index="${index}">⚙️ Mejoras</button></div>
      ${line.upgradeOpen ? `<div class="upgrade-menu">${upgradeButton("Ritmo de corte", "cutSpeed", line.upgrades.speed, 3, speedCost, index, "cut")}${upgradeButton("Acumulador de salida", "cutOutput", line.upgrades.output, 2, outCost, index, "cut")}</div>` : ""}
    </div>`;
  }).join("");
}
function renderPackagingLines() {
  return state.packagingLines.map((line, index) => {
    if (!line) return `<div class="machine empty">Espacio ${index + 1}<br>vacío</div>`;
    const queue = line.queue.length ? line.queue.map((x) => stackChip(x, `packLine:${index}:queue`)).join("") : `<span class="warn">Vacía</span>`;
    const outputs = line.outputs.length ? line.outputs.map((x) => packageChip(x, `packLine:${index}:output`)).join("") : "Salida libre";
    const action = line.queue.length ? CONFIG.packagingSteps[line.step] : "Esperando carga";
    const blocked = !line.queue.length || line.broken || line.outputs.length >= packCapacity(line);
    const capCost = upgradeCost("packCapacity", line.upgrades.capacity);
    return `<div class="machine dropzone" data-drop="packLine:${index}">
      <b>Embalaje ${index + 1}</b><br>
      Estado: ${healthText(line)}<br>
      Entrada (${line.queue.length}/${packCapacity(line)}): ${queue}<br>
      <progress max="5" value="${line.step}"></progress>
      <small>${line.step}/5 · ${action}</small><br>
      Salida (${line.outputs.length}/${packCapacity(line)}): ${outputs}
      <div class="action-row"><button class="pack-step" data-line="${index}" ${blocked ? "disabled" : ""}>📦 ${action}</button><button class="repair-line" data-kind="pack" data-index="${index}" ${line.health >= 100 ? "disabled" : ""}>🔧 Reparar</button><button class="toggle-upgrades" data-machine="pack" data-index="${index}">⚙️ Mejoras</button></div>
      ${line.upgradeOpen ? `<div class="upgrade-menu">${upgradeButton(`Capacidad de línea +1 entrada/salida`, "packCapacity", line.upgrades.capacity, 3, capCost, index, "pack")}</div>` : ""}
    </div>`;
  }).join("");
}
function renderArtisanLine() {
  if (!state.artisanLine) return `<span class="muted">Todavía no instalada.</span>`;
  const line = state.artisanLine;
  const input = line.input ? stackChip(line.input, "artisanLine:input") : `<span class="warn">Sin pila</span>`;
  const output = line.output ? stackChip(line.output, "artisanLine:output") : "Salida libre";
  const next = line.input ? nextQuality(line.input.quality) : null;
  const blocked = !line.input || !next || line.output;
  return `<div class="machine dropzone" data-drop="artisanLine">
    <b>Línea artesanal</b><br>
    Entrada: ${input}<br>
    Objetivo: ${next ? qLabel(next) : line.input ? "No admite mejora" : "Esperando pila"}<br>
    <progress max="10" value="${line.progress}"></progress><small>${line.progress}/10 troncos reapilados</small><br>
    Salida: ${output}
    <div class="action-row"><button id="artisanStep" ${blocked ? "disabled" : ""}>🪵 Reapilar 1 tronco</button></div>
  </div>`;
}
function renderWorkers() {
  return WORKER_CATALOG.map((w) => {
    const hired = isHired(w.id);
    const roleCount = workerCount(w.role);
    const maxed = roleCount >= w.max;
    const extra = w.role === "classifier" && hired
      ? `<div class="action-row">${state.classifierLevel >= 2 ? `<button disabled>🎓 Clasificación avanzada · desbloqueada</button>` : `<button id="trainClassifier" ${state.money < 9000 ? "disabled" : ""}>🎓 Capacitar: Primera → Premium · 9.000 🌿</button>`}</div>`
      : "";
    return `<div class="worker-card ${hired ? "hired" : ""}">
      <b>${w.icon} ${w.name}</b><br><small>${w.title} · habilidad ${w.skill}</small>
      <p>${w.desc}</p>
      ${hired ? `<span class="good">Contratado · ${formatMoney(w.salary)} 🌿/mes</span>${extra}` : `<button class="hire-worker" data-id="${w.id}" ${state.money < w.hire || maxed ? "disabled" : ""}>Contratar · ${formatMoney(w.hire)} 🌿</button><small>Sueldo: ${formatMoney(w.salary)} 🌿/mes</small>`}
    </div>`;
  }).join("");
}
function renderMaintenance() {
  const rows = [];
  state.cuttingLines.forEach((line, index) => { if (line) rows.push(`🪚 Corte ${index + 1}: ${healthText(line)}`); });
  state.packagingLines.forEach((line, index) => { if (line) rows.push(`📦 Embalaje ${index + 1}: ${healthText(line)}`); });
  const guard = bestWorker("maintenance");
  return `<div>${guard ? `🔧 Guardia: <b>${guard.name}</b> · repara automáticamente la línea más deteriorada.` : `Sin guardia contratada: las reparaciones son manuales.`}</div><div>${rows.length ? rows.join("<br>") : "Todavía no hay máquinas instaladas."}</div>`;
}
function tutorialText() {
  if (!state.cuttingLines.some(Boolean)) return "1. Comprá tu primera línea de corte.";
  if (!state.incomingTruck && state.rawYard.length === 0 && !state.cuttingLines.some((l) => l?.input)) return "2. Comprá un camión de troncos.";
  if (state.incomingTruck && state.rawYard.length === 0 && !hasWorker("crane")) return "3. Arrastrá un 🪵 del camión a la Playa de troncos.";
  if (state.rawYard.length > 0 && !state.cuttingLines.some((l) => l?.input) && !hasWorker("crane")) return "4. Arrastrá un 🪵 desde la playa a una línea de corte.";
  if (state.cuttingLines.some((l) => l?.input && !l.broken) && !hasWorker("cutter")) return "5. Mantené apretado o hacé clicks rápidos para cortar.";
  if (!state.packagingLines.some(Boolean)) return "6. Comprá una línea de embalaje.";
  if (state.completedOrders > 0) return "✅ Loop básico dominado. Ahora jugá con calidad, desgaste, mantenimiento y artesanal.";
  return "Seguí produciendo y completá el pedido actual.";
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

  document.querySelector("#incoming").innerHTML = state.incomingTruck ? `<div>Camión: ${state.incomingTruck.logs.length}/5 troncos</div>${state.incomingTruck.logs.map((x) => draggableItem(x, "incoming", "🪵")).join("")}` : "Sin camión";
  document.querySelector("#rawYard").innerHTML = state.rawYard.length ? state.rawYard.map((x) => draggableItem(x, "rawYard", `🪵 ${x.cutsRemaining}`)).join("") : "Vacía";
  document.querySelector("#cutLines").innerHTML = renderCuttingLines();
  document.querySelector("#cutBuffer").innerHTML = state.cutBuffer.length ? state.cutBuffer.map((x) => stackChip(x, "cutBuffer")).join("") : "Vacía";
  document.querySelector("#artisanLine").innerHTML = renderArtisanLine();
  document.querySelector("#artisanYard").innerHTML = state.artisanYard.length ? state.artisanYard.map((x) => stackChip(x, "artisanYard")).join("") : "Vacío";
  document.querySelector("#packLines").innerHTML = renderPackagingLines();
  document.querySelector("#finishedYard").innerHTML = state.finishedYard.length ? state.finishedYard.map((x) => packageChip(x, "finishedYard")).join("") : "Vacía";
  const truckValue = state.dispatchTruck.reduce((sum, item) => sum + itemValue(item), 0);
  document.querySelector("#dispatchTruck").innerHTML = `Carga: ${state.dispatchTruck.length}/${state.order.quantity} · valor actual ${formatMoney(truckValue)} 🌿<br>${state.dispatchTruck.map((x) => `${qMeta(x.quality).icon}📦`).join(" ")}<div class="action-row"><button id="dispatchButton" ${state.dispatchTruck.length < state.order.quantity ? "disabled" : ""}>🚛 Despachar</button></div>`;
  document.querySelector("#order").innerHTML = `<b>Pedido #${state.order.id.split("-")[1]}</b> · ${state.order.quantity} paquetes · paga según calidad real cargada`;
  document.querySelector("#qualityPrices").innerHTML = Object.entries(QUALITY).map(([key, q]) => `${q.icon} ${q.name}: <b>${formatMoney(q.price)} 🌿</b>`).join(" · ");
  document.querySelector("#maintenance").innerHTML = renderMaintenance();
  document.querySelector("#log").innerHTML = state.log.map((entry) => `<div class="log-entry">${entry}</div>`).join("");

  document.querySelector("#buyLogs").disabled = Boolean(state.incomingTruck) || state.money < CONFIG.logTruckCost;
  document.querySelector("#buyCutLine").disabled = !state.cuttingLines.includes(null) || state.money < CONFIG.cuttingLineCost;
  document.querySelector("#buyPackLine").disabled = !state.packagingLines.includes(null) || state.money < CONFIG.packagingLineCost;
  document.querySelector("#buyArtisanLine").disabled = Boolean(state.artisanLine) || state.money < CONFIG.artisanLineCost;
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
    button.addEventListener("click", () => cutOnce(Number(button.dataset.line)));
    button.addEventListener("pointerdown", () => {
      stopHold();
      const index = Number(button.dataset.line);
      const line = state.cuttingLines[index];
      activeHold = setInterval(() => cutOnce(index), cutInterval(line));
    });
  });
  document.querySelectorAll(".repair-line").forEach((button) => button.addEventListener("click", () => repairLine(button.dataset.kind, Number(button.dataset.index))));
  document.querySelector("#artisanStep")?.addEventListener("click", () => artisanStep(false));
  document.querySelectorAll(".toggle-upgrades").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.index);
    const line = button.dataset.machine === "cut" ? state.cuttingLines[index] : state.packagingLines[index];
    line.upgradeOpen = !line.upgradeOpen;
    render();
  }));
  document.querySelectorAll(".machine-upgrade").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.index);
    if (button.dataset.machine === "cut") buyCutUpgrade(index, button.dataset.kind);
    else buyPackUpgrade(index);
  }));
  document.querySelectorAll(".hire-worker").forEach((button) => button.addEventListener("click", () => hire(button.dataset.id)));
  document.querySelector("#trainClassifier")?.addEventListener("click", trainClassifier);
  document.querySelector("#dispatchButton")?.addEventListener("click", dispatchOrder);
}

document.addEventListener("pointerup", stopHold);
document.addEventListener("pointercancel", stopHold);
document.addEventListener("visibilitychange", stopHold);
document.querySelector("#buyLogs").addEventListener("click", buyLogs);
document.querySelector("#buyCutLine").addEventListener("click", buyCuttingLine);
document.querySelector("#buyPackLine").addEventListener("click", buyPackagingLine);
document.querySelector("#buyArtisanLine").addEventListener("click", buyArtisanLine);
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
    const changed = Boolean(runMaintenance() | runCrane() | runCutter() | runClassifier() | runForklifts() | runPacker());
    if (changed) render();
  } else {
    document.querySelector("#clock").textContent = timeLabel();
  }
}, 1000);

addLog("🦫 Bienvenido a Castorium. El galpón está vacío.");
render();