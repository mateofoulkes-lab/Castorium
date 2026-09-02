const response = await fetch("./src/main-v2.js");
if (!response.ok) throw new Error(`No se pudo cargar Castorium: ${response.status}`);

let source = await response.text();

source += `

// Bootstrap additions: debug hook + classic cheat code.
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

// main-v2 has no imports/exports; evaluating it here keeps all state private to this
// bootstrap while allowing the injected cheat/debug hooks to share its lexical scope.
eval(source);
