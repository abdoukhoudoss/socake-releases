; Script NSIS personnalise pour SoCake
; Ajoute des messages en francais

!macro customHeader
  !system "echo Compilation SoCake Installer..."
!macroend

!macro customInstall
  ; Creer le dossier uploads dans AppData
  CreateDirectory "$APPDATA\SoCake\uploads"
!macroend
