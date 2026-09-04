# Castorium: Fork & Forest

Un juego corto de crecimiento y automatización sobre castores, autoelevadores y bosques hexagonales. Está pensado para funcionar directamente desde `Hexgame/index.html` servido por HTTP.

## Fantasía y ritmo

El jugador conduce el Yale con un castor animado, tala árboles al acercarse, atrae los troncos a las horquillas y vuelve al aserradero para convertir la carga en madera. La madera abre nuevos territorios y compra mejoras. Cada turno dura poco más de un minuto y termina en una pausa deliberada de taller: acción breve, decisión clara, otra vuelta.

No hay enemigos. La tensión viene de optimizar rutas, sostener la racha, elegir qué mejorar y decidir entre gastar en el vehículo o expandir el mapa. El tono es alegre y satisfactorio, pero sin castigos ni urgencia agresiva.

## Cómo jugar

- Click o toque sobre un árbol: el autoelevador conduce hasta él y lo tala.
- Click o toque sobre el terreno: fija un destino libre.
- `WASD` o flechas: conducción manual.
- Volvé al círculo del aserradero con carga para vender automáticamente.
- Click sobre un hexágono translúcido vecino para comprarlo.
- Al terminar el turno, elegí mejoras en el taller y continuá.
- El botón `AUTO` se habilita al comprar **Capataz Castor**.

## Sistemas incluidos

- Seis biomas escalonados, cada uno con valor y tiempo de regeneración propios.
- Territorios hexagonales extruidos, biselados y de distintos colores.
- Árboles normales y dorados, troncos físicos, combo de entregas y progresión de rango.
- Doce líneas de mejora: capacidad, velocidad, valor, imán, regeneración, rareza dorada, combo, piloto automático, sierra doble, duración de power-ups, flota y producción al volver.
- Cuatro power-ups: Turbo Miel, Imán de Río, Doble Corte y Lluvia Verde.
- Misiones rotativas, recompensas de madera y estrellas, ayudantes automáticos y crecimiento fuera de línea.
- Sombras suaves, bloom, agua animada por shader, nubes, luces, partículas, textos flotantes y audio procedural sin archivos pesados.
- Guardado automático en `localStorage`.
- Interfaz adaptable a escritorio y pantallas táctiles.

## Modelos del repositorio

El montaje del conductor usa exactamente la configuración `CASTORIUM_CASTOR_DRIVER_FIT_V1` entregada para:

- `../models/yale.glb`
- `../models/castorv2.glb`
- `../anim/Driving.fbx`

La normalización del castor es `feet-center`; la posición es `[0, 1.5912, -2.0504]`, la rotación en grados es `[-89.505, -1.143, 4.341]` y la escala es `[30, 30, 30]`.

## Ejecución local

Por las restricciones normales del navegador al cargar modelos, no conviene abrir el HTML con doble click. Serví la raíz del repositorio con cualquier servidor HTTP estático y visitá `/Hexgame/`.

Three.js se carga como módulo ES desde jsDelivr. El resto de los archivos del juego y los modelos quedan en el repositorio.

## Estructura

- `index.html`: interfaz y punto de entrada.
- `styles.css`: sistema visual y adaptación responsive.
- `game.js`: render, lógica, progresión, audio y guardado.
- `assets/`: utilería 3D liviana CC0.
- `ASSETS.md`: procedencia y licencia de la utilería externa.

