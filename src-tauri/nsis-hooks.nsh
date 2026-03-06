; Gido - NSIS Installer Hooks for Tauri v2

!macro NSIS_HOOK_POSTINSTALL
  ; --- Windows auto-start on logon (90 second delay) ---
  ExecWait 'schtasks /create /tn "Gido Auto Start" /tr "\"$INSTDIR\gido.exe\"" /sc onlogon /delay 0001:30 /f'

  ; --- Scheduled task for daily reboot at 03:00 ---
  ExecWait 'schtasks /create /tn "Gido Daily Reboot" /tr "shutdown /r /t 0" /sc daily /st 03:00 /f'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; --- Remove auto-start task on uninstall ---
  ExecWait 'schtasks /delete /tn "Gido Auto Start" /f'
  ExecWait 'schtasks /delete /tn "Gido Daily Reboot" /f'
!macroend
