# Castorium — Calidad, línea artesanal y mantenimiento

## Cinco calidades

Las pilas y los paquetes conservan una calidad durante todo el flujo productivo:

1. **Chatarra** — no admite mejora. Puede venderse, pero vale muy poco.
2. **Tercera** — puede mejorarse a Segunda.
3. **Segunda** — puede mejorarse a Primera.
4. **Primera** — puede mejorarse a Premium cuando el personal de clasificación haya sido capacitado/mejorado.
5. **Premium** — calidad máxima; no admite mejora.

Todos los niveles tienen distinto precio de venta.

Precios actuales del prototipo (provisorios para balance):

- Chatarra: 120 Ramitas
- Tercera: 420 Ramitas
- Segunda: 700 Ramitas
- Primera: 1.050 Ramitas
- Premium: 1.650 Ramitas

## Cómo nace la calidad

La calidad de una pila producida por una línea de corte depende principalmente de:

- el estado/salud de la línea;
- la capacidad del operador que la está trabajando;
- una pequeña variación aleatoria.

Una máquina deteriorada con un operador poco hábil debe producir peor calidad con más frecuencia.

El jefe-castor también tiene una capacidad base cuando opera manualmente.

## Línea artesanal

La línea artesanal procesa una pila sin embalar mediante 10 acciones, una por cada tronco de la pila.

Flujo de mejoras:

- Tercera → Segunda
- Segunda → Primera
- Primera → Premium (requiere clasificación avanzada)

Chatarra y Premium no pueden entrar para mejorar.

Después de procesarse, las pilas pasan al depósito artesanal y luego regresan al flujo normal de embalaje.

## Castor clasificador

El clasificador es un puesto especializado que automatiza la línea artesanal.

Debe priorizar las pilas de peor calidad entre las mejorables. Su efectividad y el porcentaje de pilas que decide mejorar pueden evolucionar con su habilidad.

La capacitación avanzada del personal desbloquea Primera → Premium.

## Desgaste y roturas

Las líneas pierden salud con el uso.

La salud afecta:

- calidad producida;
- probabilidad de rotura;
- necesidad de intervención de mantenimiento.

En el prototipo actual una línea muy deteriorada puede romperse y dejar de operar.

## Reparación

Sin personal de mantenimiento, el jefe puede reparar manualmente mediante acciones repetidas sobre la línea.

Con guardia de mantenimiento contratado, el trabajador busca automáticamente la máquina más deteriorada y la recupera de forma gradual.

Más adelante este sistema se ampliará con preventivos, distintos tipos de falla y aptitudes del personal de mantenimiento.

## Autoelevadores

El galpón admite como máximo **4 autoelevadoristas**.

Cada uno aporta capacidad real de movimiento interno y permite resolver más tareas logísticas por ciclo de automatización.

## Decisiones validadas de UX

- Las pilas pueden ir directamente de corte a embalaje sin pasar por depósito.
- Los paquetes terminados pueden ir directamente de embalaje al camión de despacho.
- Los depósitos son buffers opcionales, no pasos burocráticos obligatorios.
- Corte manual admite mantener apretado y también clicks rápidos; clickear rápido puede superar el ritmo cómodo del hold.
- La mejora de embalaje se llama **Capacidad de línea** y aumenta entrada y salida conjuntamente.
