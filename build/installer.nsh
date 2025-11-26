!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var PageHandle
Var FinishPageHandle
Var CheckDesktop
Var CheckStartMenu
Var CheckAutoStart
Var CheckRunAfterFinish
Var WantDesktop
Var WantStartMenu
Var WantAutoStart
Var WantRunAfterFinish
Var DesktopShortcutExists
Var StartMenuShortcutExists

; -----------------------------------------
; (Optional) Pre-install initialization
; NOTE:
; The previous version forced installation to:
;   C:\Program Files\Gido
; This caused UAC prompts and silent-updater failures.
; The forced path has been removed to allow Electron's default
; per-user installation under %LOCALAPPDATA%, which avoids UAC.
; -----------------------------------------
!macro preInit
  ; No forced installation directory
!macroend

; -----------------------------------------
; Custom page inserted AFTER the directory selection page
; -----------------------------------------
!macro customPageAfterChangeDir
  ; Insert one custom page after directory page
  Page custom ShortcutSelectPageCreate ShortcutSelectPageLeave
!macroend

; -----------------------------------------
; Custom Shortcut Selection Page (display)
; -----------------------------------------
Function ShortcutSelectPageCreate
  ; Header text
  !insertmacro MUI_HEADER_TEXT "ショートカットの作成" "作成するショートカットを選択してください。"

  nsDialogs::Create 1018
  Pop $PageHandle

  ${If} $PageHandle == error
    Abort
  ${EndIf}

  ; Label
  ${NSD_CreateLabel} 0 0 100% 20u "ショートカットを作成する場所を選択してください:"
  Pop $0

  ; Desktop checkbox
  ${NSD_CreateCheckbox} 0 30u 100% 12u "デスクトップショートカットを作成する"
  Pop $CheckDesktop
  ${NSD_Check} $CheckDesktop   ; Default: checked

  ; Start Menu checkbox
  ${NSD_CreateCheckbox} 0 50u 100% 12u "スタートメニューのショートカットを作成する"
  Pop $CheckStartMenu
  ${NSD_Check} $CheckStartMenu ; Default: checked

  ; Auto-start checkbox
  ${NSD_CreateCheckbox} 0 70u 100% 12u "Windows起動時に自動で起動する"
  Pop $CheckAutoStart
  ${NSD_Check} $CheckAutoStart ; Default: checked

  nsDialogs::Show
FunctionEnd

; -----------------------------------------
; Custom page save values (when Next/Back pressed)
; -----------------------------------------
Function ShortcutSelectPageLeave
  ${NSD_GetState} $CheckDesktop   $WantDesktop
  ${NSD_GetState} $CheckStartMenu $WantStartMenu
  ${NSD_GetState} $CheckAutoStart  $WantAutoStart
FunctionEnd

; -----------------------------------------
; Custom actions during installation
; -----------------------------------------
!macro customInstall

  ; Icon file should already be in $INSTDIR from electron-builder files configuration
  ; No need to copy explicitly - it's included in the installation package

  ; Check if desktop shortcut exists before deletion
  ${If} ${FileExists} "$DESKTOP\Gido.lnk"
    StrCpy $DesktopShortcutExists "1"
    ; Force update existing desktop shortcut by deleting first
    Delete "$DESKTOP\Gido.lnk"
    ; Small delay to ensure deletion is complete
    Sleep 100
  ${Else}
    StrCpy $DesktopShortcutExists "0"
  ${EndIf}
  
  ; Create desktop shortcut if it existed (update) or user selected (new install)
  ; Use explicit icon file path instead of extracting from exe
  ${If} $DesktopShortcutExists == "1"
    ; Recreate for update - always update existing shortcuts
    CreateShortCut "$DESKTOP\Gido.lnk" "$INSTDIR\Gido.exe" "" "$INSTDIR\icon.ico" 0
  ${ElseIf} $WantDesktop == ${BST_CHECKED}
    ; New installation: create if user selected
    CreateShortCut "$DESKTOP\Gido.lnk" "$INSTDIR\Gido.exe" "" "$INSTDIR\icon.ico" 0
  ${EndIf}

  ; Check if Start Menu shortcut exists before deletion
  ${If} ${FileExists} "$SMPROGRAMS\Gido\Gido.lnk"
    StrCpy $StartMenuShortcutExists "1"
    ; Force update existing Start Menu shortcut by deleting first
    Delete "$SMPROGRAMS\Gido\Gido.lnk"
    ; Small delay to ensure deletion is complete
    Sleep 100
  ${Else}
    StrCpy $StartMenuShortcutExists "0"
  ${EndIf}
  
  ; Create Start Menu shortcut if it existed (update) or user selected (new install)
  ; Use explicit icon file path instead of extracting from exe
  ${If} $StartMenuShortcutExists == "1"
    ; Recreate for update - always update existing shortcuts
    CreateDirectory "$SMPROGRAMS\Gido"
    CreateShortCut "$SMPROGRAMS\Gido\Gido.lnk" "$INSTDIR\Gido.exe" "" "$INSTDIR\icon.ico" 0
  ${ElseIf} $WantStartMenu == ${BST_CHECKED}
    ; New installation: create if user selected
    CreateDirectory "$SMPROGRAMS\Gido"
    CreateShortCut "$SMPROGRAMS\Gido\Gido.lnk" "$INSTDIR\Gido.exe" "" "$INSTDIR\icon.ico" 0
  ${EndIf}

  ; Set Windows auto-start (registry)
  ${If} $WantAutoStart == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Gido" "$INSTDIR\Gido.exe"
  ${Else}
    ; Remove auto-start if unchecked
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Gido"
  ${EndIf}

!macroend

; -----------------------------------------
; Custom finish page (after installation completes)
; -----------------------------------------
!macro customFinishPage
  Page custom FinishPageCreate FinishPageLeave
!macroend

Function FinishPageCreate
  ; Header text
  !insertmacro MUI_HEADER_TEXT "インストール完了" "インストールが正常に完了しました。"

  nsDialogs::Create 1018
  Pop $FinishPageHandle

  ${If} $FinishPageHandle == error
    Abort
  ${EndIf}

  ; Completion message
  ${NSD_CreateLabel} 0 0 100% 40u "Gido のインストールが完了しました。$\r$\n$\r$\n以下のオプションを選択してください:"
  Pop $0

  ; Run after finish checkbox
  ${NSD_CreateCheckbox} 0 60u 100% 12u "インストール完了後にアプリを起動する"
  Pop $CheckRunAfterFinish
  ${NSD_Check} $CheckRunAfterFinish ; Default: checked

  nsDialogs::Show
FunctionEnd

Function FinishPageLeave
  ; Read checkbox state
  ${NSD_GetState} $CheckRunAfterFinish $WantRunAfterFinish
  
  ; Launch the installed application if checked
  ${If} $WantRunAfterFinish == ${BST_CHECKED}
    ExecShell "open" "$INSTDIR\Gido.exe"
  ${EndIf}
FunctionEnd

; -----------------------------------------
; Custom actions during uninstallation
; -----------------------------------------
!macro customUnInstall
  ; Remove Windows auto-start registry entry on uninstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Gido"
!macroend
