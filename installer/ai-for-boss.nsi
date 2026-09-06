; Installer for the AI for Boss experimental build.
;
; Deliberately small: it copies the packaged app into the user's own
; application-data folder, makes a Start-menu and desktop shortcut, and writes
; an uninstaller. It asks for no administrator rights, touches no system
; location, registers no file types, and starts no service. Anything beyond that
; belongs to a signed release, not to an internal test build.

Unicode true
ManifestDPIAware true
RequestExecutionLevel user

!define PRODUCT "AI for Boss"
!define PUBLISHER "Le Dinh Luc"
!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef SOURCE_DIR
  !define SOURCE_DIR "..\out\desktop\AI for Boss-win32-x64"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "..\out\AI-for-Boss-Setup.exe"
!endif

Name "${PRODUCT} ${VERSION}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\AI for Boss"
ShowInstDetails show
ShowUninstDetails show
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\AI-for-Boss.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Mở AI for Boss"

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  ; A reinstall over a previous version leaves no orphaned files behind.
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  File /r "${SOURCE_DIR}\*.*"

  CreateDirectory "$SMPROGRAMS\AI for Boss"
  CreateShortcut "$SMPROGRAMS\AI for Boss\AI for Boss.lnk" "$INSTDIR\AI-for-Boss.exe"
  CreateShortcut "$DESKTOP\AI for Boss.lnk" "$INSTDIR\AI-for-Boss.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBoss" "DisplayName" "${PRODUCT}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBoss" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBoss" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBoss" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBoss" "InstallLocation" "$\"$INSTDIR$\""
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBoss" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBoss" "NoRepair" 1
SectionEnd

Section "Uninstall"
  ; Chat history and settings live in the user's own data folder and are left
  ; alone, so an uninstall never destroys the person's work.
  Delete "$DESKTOP\AI for Boss.lnk"
  Delete "$SMPROGRAMS\AI for Boss\AI for Boss.lnk"
  RMDir "$SMPROGRAMS\AI for Boss"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBoss"
SectionEnd
