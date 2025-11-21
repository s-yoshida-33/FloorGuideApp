!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var PageHandle
Var CheckDesktop
Var CheckStartMenu
Var WantDesktop
Var WantStartMenu

; -----------------------------------------
; (Optional) Pre-install initialization
; NOTE:
; The previous version forced installation to:
;   C:\Program Files\FloorGuideDisplay
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

  nsDialogs::Show
FunctionEnd

; -----------------------------------------
; Custom page save values (when Next/Back pressed)
; -----------------------------------------
Function ShortcutSelectPageLeave
  ${NSD_GetState} $CheckDesktop   $WantDesktop
  ${NSD_GetState} $CheckStartMenu $WantStartMenu
FunctionEnd

; -----------------------------------------
; Custom actions during installation
; -----------------------------------------
!macro customInstall

  ; Create desktop shortcut
  ${If} $WantDesktop == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\Display.lnk" "$INSTDIR\FloorGuideDisplay.exe"
  ${EndIf}

  ; Create Start Menu shortcut
  ${If} $WantStartMenu == ${BST_CHECKED}
    CreateDirectory "$SMPROGRAMS\FloorGuideDisplay"
    CreateShortCut "$SMPROGRAMS\FloorGuideDisplay\Display.lnk" "$INSTDIR\FloorGuideDisplay.exe"
  ${EndIf}

  ; Launch the installed application after installation/update
  ExecShell "open" "$INSTDIR\FloorGuideDisplay.exe"

!macroend
