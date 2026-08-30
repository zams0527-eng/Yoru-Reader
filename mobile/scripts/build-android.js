const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 [Mobile] Iniciando compilación de Yoru Reader para Android...');

try {
  // 1. Build frontend
  console.log('📦 [Mobile] Paso 1: Compilando assets del frontend (Vite)...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. Sync with Capacitor
  console.log('🔄 [Mobile] Paso 2: Sincronizando con Capacitor Android...');
  execSync('npx cap sync android', { stdio: 'inherit' });

  // 3. Copy APK if exists
  const apkSrc = path.join(__dirname, '../../android/app/build/outputs/apk/release/app-release-unsigned.apk');
  const apkDebugSrc = path.join(__dirname, '../../android/app/build/outputs/apk/debug/app-debug.apk');
  const destDir = path.join(__dirname, '../releases');

  if (fs.existsSync(apkSrc)) {
    fs.copyFileSync(apkSrc, path.join(destDir, 'Yoru-Reader-v1.1.5-release.apk'));
    console.log('✅ [Mobile] APK de release copiado a mobile/releases/Yoru-Reader-v1.1.5-release.apk');
  } else if (fs.existsSync(apkDebugSrc)) {
    fs.copyFileSync(apkDebugSrc, path.join(destDir, 'Yoru-Reader-v1.1.5-debug.apk'));
    console.log('✅ [Mobile] APK de depuración copiado a mobile/releases/Yoru-Reader-v1.1.5-debug.apk');
  }

  console.log('🎉 [Mobile] ¡Proceso completado con éxito!');
} catch (error) {
  console.error('❌ [Mobile] Error durante la compilación:', error.message);
  process.exit(1);
}
