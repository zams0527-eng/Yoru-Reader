; --- Custom Yoru Reader Dark Theme Colors ---
!pragma warning disable 6010
!pragma warning disable 6020
!define MUI_BGCOLOR "0D0D0F" ; Negro profundo Yoru Cafe background
!define MUI_TEXTCOLOR "E8E8F0" ; Blanco grisáceo text
!define MUI_LICENSEPAGE_BGCOLOR "131316" ; Card background
!define MUI_DIRECTORYPAGE_BGCOLOR "131316"
!define MUI_INSTFILESPAGE_COLORS "E8E8F0 131316"
!define MUI_CUSTOMFUNCTION_GUIINIT GuiInit
!define MUI_CUSTOMFUNCTION_UNGUIINIT un.GuiInit

Function GuiInit
  ; Activar la barra de título oscura inmersiva (Windows 10 build 17763+ y Windows 11)
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 19, *i 1, i 4)'

  ; Aplicar color de fondo oscuro al contenedor de la ventana principal
  SetCtlColors $HWNDPARENT 0xE8E8F0 0x0D0D0F
  
  ; Referencias dummy para evitar advertencias de funciones no usadas (warning 6010)
  GetFunctionAddress $0 PageShow
  GetFunctionAddress $0 InstallModePre
  GetFunctionAddress $0 InstallModeShow
FunctionEnd

Function un.GuiInit
  ; Activar la barra de título oscura inmersiva en el desinstalador
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 19, *i 1, i 4)'

  ; Aplicar color de fondo oscuro al contenedor de la ventana principal
  SetCtlColors $HWNDPARENT 0xE8E8F0 0x0D0D0F
FunctionEnd

; --- Installer Functions ---

Function PageShow
  Call ColorizeActivePage
FunctionEnd

Function InstallModePre
  ; No-op
FunctionEnd

Function InstallModeShow
  Call ColorizeActivePage
FunctionEnd

Function ColorizeActivePage
  ; Colorear el diálogo activo (#32770) y sus controles internos (labels, radio buttons, checkboxes)
  FindWindow $0 "#32770" "" $HWNDPARENT
  IntCmp $0 0 done
    SetCtlColors $0 0xE8E8F0 0x0D0D0F
    System::Call "user32::GetWindow(p r0, i 5) p.r1" ; GW_CHILD = 5
    loop:
      IntCmp $1 0 done
      ; Quitar temas a los controles internos del diálogo para que sí respeten los colores oscuros
      System::Call "uxtheme::SetWindowTheme(p $1, w ' ', w ' ')"
      SetCtlColors $1 0xE8E8F0 0x0D0D0F
      System::Call "user32::GetWindow(p r1, i 2) p.r1" ; GW_HWNDNEXT = 2
      Goto loop
  done:
FunctionEnd

; --- Uninstaller Functions (Prefix 'un.') ---

Function un.PageShow
  Call un.ColorizeActivePage
FunctionEnd

Function un.InstallModePre
  ; No-op
FunctionEnd

Function un.InstallModeShow
  Call un.ColorizeActivePage
FunctionEnd

Function un.ColorizeActivePage
  ; Colorear el diálogo activo (#32770) y sus controles internos (labels, radio buttons, checkboxes)
  FindWindow $0 "#32770" "" $HWNDPARENT
  IntCmp $0 0 done
    SetCtlColors $0 0xE8E8F0 0x0D0D0F
    System::Call "user32::GetWindow(p r0, i 5) p.r1" ; GW_CHILD = 5
    loop:
      IntCmp $1 0 done
      ; Quitar temas a los controles internos del diálogo para que sí respeten los colores oscuros
      System::Call "uxtheme::SetWindowTheme(p $1, w ' ', w ' ')"
      SetCtlColors $1 0xE8E8F0 0x0D0D0F
      System::Call "user32::GetWindow(p r1, i 2) p.r1" ; GW_HWNDNEXT = 2
      Goto loop
  done:
FunctionEnd
