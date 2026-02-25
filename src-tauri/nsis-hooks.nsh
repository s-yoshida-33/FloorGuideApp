; Grain Link - NSIS Installer Hooks for Tauri v2
; タスクスケジューラへの登録・削除を行う

!macro NSIS_HOOK_POSTINSTALL
  ; --- Windows起動時に自動で起動（ログオン後10秒遅延） ---
  ExecWait 'schtasks /create /tn "Grain Link Auto Start" /tr "\"$INSTDIR\grain-link.exe\"" /sc onlogon /delay 0000:10 /f'

!macro NSIS_HOOK_POSTUNINSTALL
  ; --- アンインストール時にタスクを削除 ---
  ExecWait 'schtasks /delete /tn "Grain Link Auto Start" /f'
!macroend
