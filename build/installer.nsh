!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var PageHandle
Var CheckDesktop
Var CheckStartMenu
Var WantDesktop
Var WantStartMenu

;-----------------------------------------
; インストール先のデフォルト指定
;-----------------------------------------
!macro preInit
  StrCmp "$INSTDIR" "" 0 done
  StrCpy $INSTDIR "C:\Program Files\FloorGuideDisplay"
done:
!macroend

;-----------------------------------------
; ディレクトリ選択の後にカスタムページを挟む
;-----------------------------------------
!macro customPageAfterChangeDir
  ; Directory ページの「後」にカスタムページを1つ追加
  Page custom ShortcutSelectPageCreate ShortcutSelectPageLeave
!macroend

;-----------------------------------------
; カスタムページ（表示時）
;-----------------------------------------
Function ShortcutSelectPageCreate
  ; ヘッダー部分
  !insertmacro MUI_HEADER_TEXT "ショートカットの作成" "作成するショートカットを選択してください。"

  nsDialogs::Create 1018
  Pop $PageHandle

  ${If} $PageHandle == error
    Abort
  ${EndIf}

  ; ラベル
  ${NSD_CreateLabel} 0 0 100% 20u "ショートカットの作成先を選択してください："
  Pop $0

  ; デスクトップ用チェックボックス
  ${NSD_CreateCheckbox} 0 30u 100% 12u "デスクトップにショートカットを作成"
  Pop $CheckDesktop
  ${NSD_Check} $CheckDesktop  ; デフォルト ON

  ; スタートメニュー用チェックボックス
  ${NSD_CreateCheckbox} 0 50u 100% 12u "スタートメニューにショートカットを作成"
  Pop $CheckStartMenu
  ${NSD_Check} $CheckStartMenu ; デフォルト ON

  nsDialogs::Show
FunctionEnd

;-----------------------------------------
; カスタムページ（Next/Back 押下時の値保存）
;-----------------------------------------
Function ShortcutSelectPageLeave
  ${NSD_GetState} $CheckDesktop   $WantDesktop
  ${NSD_GetState} $CheckStartMenu $WantStartMenu
FunctionEnd

;-----------------------------------------
; インストール直前（ショートカット作成）
;-----------------------------------------
!macro customInstall
  ${If} $WantDesktop == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\Display.lnk" "$INSTDIR\FloorGuideDisplay.exe"
  ${EndIf}

  ${If} $WantStartMenu == ${BST_CHECKED}
    CreateDirectory "$SMPROGRAMS\Display"
    CreateShortCut "$SMPROGRAMS\Display\Display.lnk" "$INSTDIR\FloorGuideDisplay.exe"
  ${EndIf}
!macroend
