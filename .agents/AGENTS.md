# Reglas del proyecto Yoru Reader

- **Flujo de pruebas rápidas (Pruebas antes de compilar/subir a Git):**
  Antes de realizar una compilación de producción completa (`npm run electron:build`), actualizar descargables en `downloads/` o subir cambios a Git, siempre ejecuta `npm run electron:package` para actualizar la carpeta empaquetada temporal `dist-electron/Yoru-Reader-win32-x64`. Esto permite al usuario ejecutar y verificar rápidamente los cambios locales en Windows para resolver cualquier error de manera ágil.
