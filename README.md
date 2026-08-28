# Yoru Reader 🌙 📖

Lector de novelas ligeras en japonés con integración de diccionarios (Yomitan / Kuromoji), análisis de frecuencia, audio TTS y sincronización de tarjetas SRS / AnkiConnect.

---

## 📥 Descargas oficiales (v1.1.4)

| Plataforma | Paquete | Enlace de descarga |
| :--- | :--- | :--- |
| **🪟 Windows** | Portable (`.zip`) / Instalador | [⬇️ Descargar Windows (x64)](https://github.com/zams0527-eng/Yoru-Reader/releases/download/yorureader/Yoru-Reader-1.1.4-win-x64.zip) |
| **🍎 macOS (Apple Silicon)** | App Bundle (`.zip`) | [⬇️ Descargar macOS (M1/M2/M3/M4 - arm64)](https://github.com/zams0527-eng/Yoru-Reader/releases/download/yorureader/Yoru-Reader-1.1.4-mac-arm64.zip) |
| **🍎 macOS (Intel)** | App Bundle (`.zip`) | [⬇️ Descargar macOS (Intel - x64)](https://github.com/zams0527-eng/Yoru-Reader/releases/download/yorureader/Yoru-Reader-1.1.4-mac-x64.zip) |
| **🐧 Linux** | Flatpak (`.flatpak`) | [⬇️ Descargar Flatpak (x86_64)](https://github.com/zams0527-eng/Yoru-Reader/releases/download/yorureader/Yoru-Reader-1.1.4-x86_64.flatpak) |
| **📱 Android** | APK | [⬇️ Descargar Android APK](https://github.com/zams0527-eng/Yoru-Reader/releases/download/yorureader/Yoru-Reader-1.1.0.apk) |

---

## 🐧 Guía de instalación en Linux (Flatpak)

Si no tienes **Flatpak** instalado en tu distribución Linux, instálalo primero siguiendo estos pasos:

### 1️⃣ Instalar Flatpak en tu distribución

* **Ubuntu / Debian / Linux Mint:**
  ```bash
  sudo apt update
  sudo apt install -y flatpak
  ```

* **Fedora / RHEL:**
  ```bash
  sudo dnf install flatpak
  ```

* **Arch Linux / Manjaro:**
  ```bash
  sudo pacman -S flatpak
  ```

* **openSUSE:**
  ```bash
  sudo zypper install flatpak
  ```

---

### 2️⃣ Agregar el repositorio Flathub (Recomendado)
```bash
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

---

### 3️⃣ Instalar y ejecutar Yoru Reader

Una vez descargado el archivo `Yoru-Reader-1.1.4-x86_64.flatpak`:

```bash
# Instalar el paquete descargado
flatpak install --user Yoru-Reader-1.1.4-x86_64.flatpak

# Ejecutar la aplicación
flatpak run com.yorureader.app
```
*(También aparecerá directamente en el menú de aplicaciones de tu escritorio).*

---

## ✨ Características principales
- 📚 **Lector EPUB/TXT**: Soporte completo para texto en vertical y horizontal.
- 🔍 **Diccionario integrado**: Búsqueda instantánea con pitch accent, definiciones y conjugaciones.
- 🎴 **Integración SRS & Anki**: Creación y sincronización de tarjetas con audio y contexto en un clic.
- 📊 **Estadísticas de lectura**: Registro de caracteres leídos, velocidad y vocabulario aprendido.
- ☁️ **Sincronización en la nube**: Respaldo automático con Google Drive.
