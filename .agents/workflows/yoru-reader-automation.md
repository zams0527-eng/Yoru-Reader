---
description: yoru-reader-automation
---

# Contexto del Proyecto: Yoru Reader (Electron + React + Vite)
  Sí, y permitir siempre
- Este es un proyecto de escritorio empaquetado con Electron.
- Backend/Node.js nativo se encuentra en la carpeta `electron/` (ej: `edgeTts.cjs`, `electron-main.cjs`, `preload.cjs`).
- Frontend/React se encuentra en la carpeta `src/`.

# Directivas de Automatización y Autonomía:
1. Flujo IPC Completo: Cada vez que modifiques, crees o me pidas implementar una función nativa de Node.js (como el TTS en `edgeTts.cjs` o consultas en la DB), debes actualizar AUTOMÁTICAMENTE el archivo `electron/preload.cjs` para exponer el puente y registrar el listener correspondiente en `electron-main.cjs`. No me preguntes ni pidas permiso para editar esos archivos dependientes; hazlo directamente.
2. Código Completo sin Marcadores de Posición: Está estrictamente prohibido usar comentarios como "// ... resto del código" o omitir partes de un archivo. Reescribe las funciones modificadas completas para evitar errores de sintaxis al guardar.
3. Modularidad Estricta: Mantén la lógica de renderizado separada de la lógica de servicios. Las funciones complejas de comunicación con el WebSocket de Edge TTS deben封装se por completo dentro de `electron/edgeTts.cjs`.
4. Manejo de Errores Robustos: Todo canal IPC o comunicación por WebSocket debe incluir bloques try/catch y retornar mensajes de error claros al frontend en lugar de congelar el proceso principal.