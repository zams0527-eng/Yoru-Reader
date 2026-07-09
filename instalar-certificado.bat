@echo off
:: Check if the certificate exists
if not exist "build\yoru-reader.cer" (
    echo [ERROR] No se encuentra el archivo 'build\yoru-reader.cer'.
    echo Por favor, compila la aplicacion primero usando 'npm run electron:build' para generar el certificado.
    pause
    exit /b 1
)

echo Instalando certificado de Yoru-Reader en las Entidades de Certificacion de Raiz de Confianza...
echo Esto eliminara la advertencia de SmartScreen "Editor desconocido" para este certificado.
echo.

:: Execute PowerShell to import the certificate into the CurrentUser's Root store
powershell -Command "Import-Certificate -FilePath 'build\yoru-reader.cer' -CertStoreLocation 'Cert:\CurrentUser\Root'"

if %ERRORLEVEL% equ 0 (
    echo.
    echo [EXITO] El certificado se ha instalado correctamente en el almacen del usuario actual.
    echo Ahora puedes ejecutar el instalador de Yoru-Reader sin advertencias de SmartScreen.
) else (
    echo.
    echo [ERROR] No se pudo instalar el certificado.
)
echo.
pause
