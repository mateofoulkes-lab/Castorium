const response = await fetch("./src/main-v2.js");
if (!response.ok) throw new Error(`No se pudo cargar Castorium: ${response.status}`);

let source = await response.text();

// Time and production share the SAME speed multiplier.
// At x1 the base game advances ~1 in-game minute per real second.
// The normal production chain therefore consumes roughly 15 in-game minutes per package.
// At x16/x64 both calendar time and simulation cycles are accelerated proportionally.
source = source.replace(
  "automationElapsed=0;const changed=Boolean(runMaintenance()|runCrane()|runCutters()|runClassifier()|runForklifts()|runPackers()|runDispatcher());if(changed)render();",
  "let __changed=false;while(automationElapsed>=CONFIG.automationMs){automationElapsed-=CONFIG.automationMs;__changed=Boolean(runMaintenance()|runCrane()|runCutters()|runClassifier()|runForklifts()|runPackers()|runDispatcher())||__changed;}if(__changed)render();"
);

source += `

// Debug hook + classic cheat code.
window.__castoriumState = state;
window.__castoriumRender = render;

let __castoriumCheatBuffer = "";
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.key.length !== 1) return;
  __castoriumCheatBuffer = (__castoriumCheatBuffer + event.key.toUpperCase()).slice(-10);
  if (__castoriumCheatBuffer.endsWith("KLAPAUCIUS")) {
    state.money += 100000;
    __castoriumCheatBuffer = "";
    addLog("🪄 KLAPAUCIUS: +100.000 🌿. El Banco Central del Castor no hará preguntas.");
    render();
  }
});
`;

eval(source);
