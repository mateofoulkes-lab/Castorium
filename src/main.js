const CONFIG = {
  startingMoney: 50000,
  logTruckCost: 1000,
  logsPerTruck: 5,
  cutsPerStack: 10,
  cutsPerLog: 80,
  cuttingLineCost: 12000,
  packagingLineCost: 8000,
  packageSalePrice: 700,
  cuttingSlots: 3,
  packagingSlots: 2,
  packagingSteps: ["Envolver", "Cantoneras", "Zunchar", "Etiquetar", "Liberar"],
};

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
  log: [],
};

function createOrder(quantity = randomInt(3, 7)) {
  return {
    id: uid("order"),
    quantity,
    reward: quantity * CONFIG.packageSalePrice,
  };
}

function createLog() {
  return { id: uid("log"), type: "log", cutsRemaining: CONFIG.cutsPerLog };
}

function createCutStack() {
  return { id: uid("stack"), type: "stack" };
}

function createFinishedPackage() {
  return { id: uid("package"), type: "package" };
}

function newCuttingLine(slot) {
  return {
    id: uid("cutline"),
    slot,
    input: null,
    cutProgress: 0,
    output: null,
  };
}

function newPackagingLine(slot) {
  return {
    id: uid("packline"),
    slot,
    input: null,
    step: 0,
    output: null,
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function timeLabel() {
  const hour = Math.floor(state.minute / 60) % 24;
  const minute = Math.floor(state.minute % 60);
  const shift = hour < 14 ? "Mañana" : hour < 22 ? "Tarde" : "Noche";
  return `Día ${state.day} · ${shift} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addLog(message) {
  const stamp = timeLabel().split(" · ").at(-1);
  state.log.unshift(`${stamp} — ${message}`);
  state.log = state.log.slice(0, 50);
}

function setBoss(text) {
  state.boss = text;
}

function spend(amount) {
  if (state.money < amount) return false;
  state.money -= amount;
  return true;
}

function buyLogs() {
  if (state.incomingTruck) return addLog("⚠ Ya hay un camión esperando en recepción."), render();
  if (!spend(CONFIG.logTruckCost)) return addLog("⚠ No alcanzan las ramitas."), render();
  state.incomingTruck = {
    id: uid("truck"),
    logs: Array.from({ length: CONFIG.logsPerTruck }, createLog),
  };
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

function cutOnce(lineIndex) {
  const line = state.cuttingLines[lineIndex];
  if (!line?.input || line.output) return;

  setBoss(`operando corte ${lineIndex + 1}`);
  line.cutProgress += 1;
  line.input.cutsRemaining -= 1;

  if (line.cutProgress >= CONFIG.cutsPerStack) {
    line.cutProgress = 0;
    line.output = createCutStack();
    addLog(`🟫 Línea ${lineIndex + 1} produjo una pila. Salida bloqueada hasta retirarla.`);
  }

  if (line.input && line.input.cutsRemaining <= 0) {
    addLog(`🪵 Tronco agotado en línea ${lineIndex + 1}.`);
    line.input = null;
  }

  render();
}

function packagingStep(lineIndex) {
  const line = state.packagingLines[lineIndex];
  if (!line?.input || line.output) return;

  setBoss(`embalando en línea ${lineIndex + 1}`);
  const action = CONFIG.packagingSteps[line.step];
  addLog(`📦 ${action} — línea de embalaje ${lineIndex + 1}.`);
  line.step += 1;

  if (line.step >= CONFIG.packagingSteps.length) {
    line.output = createFinishedPackage();
    line.input = null;
    line.step = 0;
    addLog(`✅ Paquete terminado en línea de embalaje ${lineIndex + 1}.`);
  }
  render();
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
  if (kind === "cutLine") return state.cuttingLines[index]?.[part] ?? null;
  if (kind === "packLine") return state.packagingLines[index]?.[part] ?? null;
  return null;
}

function removeItem(source, id) {
  const removeFrom = (arr) => {
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return null;
    return arr.splice(i, 1)[0];
  };

  if (source === "incoming") {
    const item = removeFrom(state.incomingTruck.logs);
    if (state.incomingTruck.logs.length === 0) {
      addLog("🚚 Camión de materia prima vacío; se retiró.");
      state.incomingTruck = null;
    }
    return item;
  }
  if (source === "rawYard") return removeFrom(state.rawYard);
  if (source === "cutBuffer") return removeFrom(state.cutBuffer);
  if (source === "finishedYard") return removeFrom(state.finishedYard);

  const [kind, indexText, part] = source.split(":");
  const index = Number(indexText);
  if (kind === "cutLine") {
    const line = state.cuttingLines[index];
    if (line?.[part]?.id === id) {
      const item = line[part];
      line[part] = null;
      return item;
    }
  }
  if (kind === "packLine") {
    const line = state.packagingLines[index];
    if (line?.[part]?.id === id) {
      const item = line[part];
      line[part] = null;
      return item;
    }
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
  if (kind === "packLine") return item.type === "stack" && state.packagingLines[index] && !state.packagingLines[index].input;
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
    if (kind === "packLine") state.packagingLines[index].input = item;
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

function moveItem(source, id, target) {
  const item = findItem(source, id);
  if (!canDrop(item, target)) return false;
  const removed = removeItem(source, id);
  placeItem(removed, target);
  setBoss(target === "rawYard" || target.startsWith("cutLine") ? "en grúa" : "en autoelevador");
  addLog(describeMove(removed, target));
  render();
  return true;
}

function draggableItem(item, source, label) {
  return `<span class="item" draggable="true" data-id="${item.id}" data-source="${source}" title="Arrastrar">${label}</span>`;
}

function renderCuttingLines() {
  return state.cuttingLines.map((line, index) => {
    if (!line) return `<div class="machine empty">Espacio ${index + 1}<br>vacío</div>`;
    const input = line.input
      ? draggableItem(line.input, `cutLine:${index}:input`, `🪵 ${line.input.cutsRemaining}/80`)
      : `<span class="warn">Sin tronco</span>`;
    const output = line.output
      ? draggableItem(line.output, `cutLine:${index}:output`, "🟫 Pila lista")
      : "Salida libre";
    const disabled = !line.input || line.output ? "disabled" : "";
    return `<div class="machine dropzone" data-drop="cutLine:${index}">
      <b>Línea ${index + 1}</b><br>
      Entrada: ${input}<br>
      <progress max="${CONFIG.cutsPerStack}" value="${line.cutProgress}"></progress>
      <small>${line.cutProgress}/${CONFIG.cutsPerStack} cortes</small><br>
      Salida: ${output}
      <div class="action-row"><button class="hold-cut" data-line="${index}" ${disabled}>🪚 Mantener para cortar</button></div>
    </div>`;
  }).join("");
}

function renderPackagingLines() {
  return state.packagingLines.map((line, index) => {
    if (!line) return `<div class="machine empty">Espacio ${index + 1}<br>vacío</div>`;
    const input = line.input
      ? draggableItem(line.input, `packLine:${index}:input`, "🟫 Pila")
      : `<span class="warn">Sin pila</span>`;
    const output = line.output
      ? draggableItem(line.output, `packLine:${index}:output`, "✅ Paquete")
      : "Salida libre";
    const action = line.input ? CONFIG.packagingSteps[line.step] : "Esperando carga";
    const disabled = !line.input || line.output ? "disabled" : "";
    return `<div class="machine dropzone" data-drop="packLine:${index}">
      <b>Embalaje ${index + 1}</b><br>
      Entrada: ${input}<br>
      <progress max="5" value="${line.step}"></progress>
      <small>${line.step}/5 · ${action}</small><br>
      Salida: ${output}
      <div class="action-row"><button class="pack-step" data-line="${index}" ${disabled}>📦 ${action}</button></div>
    </div>`;
  }).join("");
}

function tutorialText() {
  if (!state.cuttingLines.some(Boolean)) return "1. Comprá tu primera línea de corte.";
  if (!state.incomingTruck && state.rawYard.length === 0 && !state.cuttingLines.some((l) => l?.input)) return "2. Comprá un camión de troncos.";
  if (state.incomingTruck && state.rawYard.length === 0) return "3. Arrastrá un 🪵 del camión a la Playa de troncos.";
  if (state.rawYard.length > 0 && !state.cuttingLines.some((l) => l?.input)) return "4. Arrastrá un 🪵 desde la playa a una línea de corte.";
  if (state.cuttingLines.some((l) => l?.input && !l.output)) return "5. Mantené apretado ‘cortar’ hasta producir una pila.";
  if (state.cuttingLines.some((l) => l?.output) && state.cutBuffer.length === 0) return "6. Arrastrá la 🟫 pila producida a la playa intermedia.";
  if (!state.packagingLines.some(Boolean)) return "7. Comprá una línea de embalaje.";
  if (state.cutBuffer.length > 0 && !state.packagingLines.some((l) => l?.input)) return "8. Arrastrá una 🟫 pila a la línea de embalaje.";
  if (state.packagingLines.some((l) => l?.input)) return "9. Hacé manualmente los cinco pasos de embalaje.";
  if (state.packagingLines.some((l) => l?.output) && state.finishedYard.length === 0) return "10. Llevá el paquete terminado a la Playa de salida.";
  if (state.finishedYard.length > 0 && state.dispatchTruck.length === 0) return "11. Arrastrá paquetes al camión hasta completar el pedido.";
  if (state.dispatchTruck.length >= state.order.quantity) return "12. ¡Camión lleno! Despachá el pedido.";
  if (state.completedOrders > 0) return "✅ Tutorial básico completado. Seguí produciendo y optimizando el galpón.";
  return "Seguí produciendo hasta completar el pedido actual.";
}

function render() {
  document.querySelector("#money").textContent = formatMoney(state.money);
  document.querySelector("#clock").textContent = timeLabel();
  document.querySelector("#boss").textContent = `🦫 Jefe: ${state.boss}`;
  document.querySelector("#tutorial").innerHTML = `<b>🎯 Tutorial</b><div class="tutorial-step">${tutorialText()}</div>`;

  document.querySelector("#incoming").innerHTML = state.incomingTruck
    ? `<div>Camión: ${state.incomingTruck.logs.length}/5 troncos</div>${state.incomingTruck.logs.map((x) => draggableItem(x, "incoming", "🪵")).join("")}`
    : "Sin camión";

  document.querySelector("#rawYard").innerHTML = state.rawYard.length
    ? state.rawYard.map((x) => draggableItem(x, "rawYard", `🪵 ${x.cutsRemaining}`)).join("")
    : "Vacía";

  document.querySelector("#cutLines").innerHTML = renderCuttingLines();
  document.querySelector("#cutBuffer").innerHTML = state.cutBuffer.length
    ? state.cutBuffer.map((x) => draggableItem(x, "cutBuffer", "🟫")).join("")
    : "Vacía";

  document.querySelector("#packLines").innerHTML = renderPackagingLines();
  document.querySelector("#finishedYard").innerHTML = state.finishedYard.length
    ? state.finishedYard.map((x) => draggableItem(x, "finishedYard", "✅📦")).join("")
    : "Vacía";

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
    el.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/json", JSON.stringify({
        id: el.dataset.id,
        source: el.dataset.source,
      }));
    });
  });

  document.querySelectorAll(".dropzone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("dragover");
      try {
        const data = JSON.parse(event.dataTransfer.getData("application/json"));
        moveItem(data.source, data.id, zone.dataset.drop);
      } catch {
        // Ignore malformed drags.
      }
    });
  });

  document.querySelectorAll(".pack-step").forEach((button) => {
    button.addEventListener("click", () => packagingStep(Number(button.dataset.line)));
  });

  let holdTimer = null;
  const stopHold = () => {
    if (holdTimer) clearInterval(holdTimer);
    holdTimer = null;
  };
  document.querySelectorAll(".hold-cut").forEach((button) => {
    button.addEventListener("pointerdown", () => {
      const index = Number(button.dataset.line);
      cutOnce(index);
      holdTimer = setInterval(() => cutOnce(index), 180);
    });
    button.addEventListener("pointerup", stopHold);
    button.addEventListener("pointerleave", stopHold);
    button.addEventListener("pointercancel", stopHold);
  });

  document.querySelector("#dispatchButton")?.addEventListener("click", dispatchOrder);
}

document.querySelector("#buyLogs").addEventListener("click", buyLogs);
document.querySelector("#buyCutLine").addEventListener("click", buyCuttingLine);
document.querySelector("#buyPackLine").addEventListener("click", buyPackagingLine);

document.querySelectorAll("[data-speed]").forEach((button) => {
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.speed);
    document.querySelectorAll("[data-speed]").forEach((b) => b.classList.toggle("active", b === button));
  });
});

setInterval(() => {
  if (!state.speed) return;
  state.minute += state.speed;
  while (state.minute >= 24 * 60) {
    state.minute -= 24 * 60;
    state.day += 1;
    addLog(`🌅 Comienza el día ${state.day}.`);
  }
  document.querySelector("#clock").textContent = timeLabel();
}, 1000);

addLog("🦫 Bienvenido a Castorium. El galpón está vacío.");
render();
