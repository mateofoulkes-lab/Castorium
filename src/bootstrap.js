const [mainResponse, extensionResponse, hotfixResponse] = await Promise.all([
  fetch("./src/main-v2.js"),
  fetch("./src/extension-v4.js"),
  fetch("./src/extension-v4-hotfix.js"),
]);
if (!mainResponse.ok) throw new Error(`No se pudo cargar Castorium: ${mainResponse.status}`);
if (!extensionResponse.ok) throw new Error(`No se pudo cargar la extensión de Castorium: ${extensionResponse.status}`);
if (!hotfixResponse.ok) throw new Error(`No se pudo cargar el hotfix de Castorium: ${hotfixResponse.status}`);

let source = await mainResponse.text();
const extension = await extensionResponse.text();
const hotfix = await hotfixResponse.text();

// x1/x16/x64 accelerate the SAME simulation clock and the SAME automatic production.
// Keep x1 at ~1 in-game minute per real second, and process every accumulated automation cycle.
source = source.replace(
  "automationElapsed=0;const changed=Boolean(runMaintenance()|runCrane()|runCutters()|runClassifier()|runForklifts()|runPackers()|runDispatcher());if(changed)render();",
  "let __changed=false;while(automationElapsed>=CONFIG.automationMs){automationElapsed-=CONFIG.automationMs;__changed=Boolean(runMaintenance()|runCrane()|runCutters()|runClassifier()|runForklifts()|runPackers()|runDispatcher())||__changed;}if(__changed)render();"
);

source = source.replace(
  "const WORKER_CATALOG = [",
  'const WORKER_CATALOG = [\n  { id:"supervisor-1", role:"supervisor", icon:"👔", name:"Ramiro Roble", title:"Supervisor de turno", hire:8000, salary:1900, skill:78, max:1, desc:"Coordina puestos y puede presionar el ritmo de trabajo." },'
);

eval(source + "\n" + extension + "\n" + hotfix);
