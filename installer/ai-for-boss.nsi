; Each internal version is immutable and independently removable.
; Build only with scripts/build-internal-installer.mjs.
Unicode true
ManifestDPIAware true
RequestExecutionLevel user
CRCCheck force
!include "MUI2.nsh"
!include "LogicLib.nsh"
!ifndef VERSION
  !error "VERSION is required"
!endif
!ifndef PAYLOAD_INCLUDE
  !error "Build through scripts/build-internal-installer.mjs"
!endif
Name "AI for Boss ${VERSION} (Preview)"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\AI for Boss Internal"
ShowInstDetails nevershow
ShowUninstDetails nevershow
!ifdef FAST_BUILD
  SetCompressor zlib
  ; Avoid scanning the growing data block for duplicates across 36,000 files.
  ; This trades a small payload-size saving for predictable build throughput.
  SetDatablockOptimize off
!else
  SetCompressor /SOLID lzma
!endif
!define MUI_ICON "${BRAND_ICON}"
!define MUI_UNICON "${BRAND_ICON}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_TEXT "Đã cài bản thử nghiệm ${VERSION}. Lõi OpenClaw nằm riêng ngoài giao diện. Bản trước và dữ liệu của bạn được giữ nguyên. Đóng cửa sổ AI for Boss cũ trước khi mở lối tắt mới."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Vietnamese"

Var Result
Var Detail
Var Stage
; Keep file names and command output out of the installer progress page.
!macro Status TEXT
  SetDetailsPrint textonly
  DetailPrint "${TEXT}"
  SetDetailsPrint none
!macroend
!macro SupportFiles
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=install-support.ps1 "${SUPPORT_SCRIPT}"
  File /oname=payload-manifest.json "${PAYLOAD_MANIFEST}"
!macroend
!macro Support ACTION
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\install-support.ps1" -Action ${ACTION} -Root "$INSTDIR" -Version "${VERSION}" -Manifest "$PLUGINSDIR\payload-manifest.json" -Desktop "$DESKTOP" -StartMenu "$SMPROGRAMS" -StatusWindow $HWNDPARENT'
  Pop $Result
  Pop $Detail
  ${If} $Result != 0
    SetErrorLevel 1
    MessageBox MB_OK|MB_ICONSTOP "Chưa hoàn tất: $Detail. Bản trước và dữ liệu được giữ nguyên." /SD IDOK
    Abort
  ${EndIf}
!macroend
Section "Install"
  SetDetailsPrint none
  SetShellVarContext current
  !insertmacro Status "Đang chuẩn bị cài đặt..."
  !insertmacro SupportFiles
  !insertmacro Status "Đang kiểm tra thư mục và dung lượng cài đặt..."
  !insertmacro Support Prepare
  StrCpy $Stage "$INSTDIR\staging\${VERSION}"
  IfFileExists "$INSTDIR\versions\${VERSION}\AI-for-Boss.exe" already_installed
  !insertmacro Status "Đang cài đặt AI for Boss..."
  SetOutPath "$Stage"
  ClearErrors
  !include "${PAYLOAD_INCLUDE}"
  ${If} ${Errors}
    SetErrorLevel 1
    MessageBox MB_OK|MB_ICONSTOP "Không ghi đủ tệp. Bản trước được giữ. Chạy lại bộ cài để thử tiếp." /SD IDOK
    Abort
  ${EndIf}
  SetOutPath "$PLUGINSDIR"
  !insertmacro Status "Đang kiểm tra bản cài đặt. Vui lòng chờ hoàn tất..."
  !insertmacro Support Commit
  Goto verified_install
already_installed:
  !insertmacro Status "Đang kiểm tra phiên bản đã cài. Vui lòng chờ hoàn tất..."
  !insertmacro Support Verify
verified_install:
  ClearErrors
  WriteUninstaller "$INSTDIR\Uninstall-${VERSION}.exe"
  ${If} ${Errors}
    SetErrorLevel 1
    MessageBox MB_OK|MB_ICONSTOP "Chưa tạo được mục gỡ cài đặt. Đã giữ nguyên bản trước. Chạy lại bộ cài để thử tiếp." /SD IDOK
    Abort
  ${EndIf}
  !insertmacro Status "Đang hoàn tất cài đặt..."
  !insertmacro Support Activate
  !insertmacro Status "Đã cài đặt AI for Boss."
SectionEnd
Section "Uninstall"
  SetDetailsPrint none
  SetShellVarContext current
  !insertmacro Status "Đang gỡ AI for Boss. Vui lòng chờ..."
  ; NSIS supplies the original install directory after its temporary self-copy.
  !insertmacro SupportFiles
  !insertmacro Support Remove
  SetOutPath "$TEMP"
  Delete "$INSTDIR\Uninstall-${VERSION}.exe"
  ; Nonrecursive: foreign files, other builds and all profiles remain.
  RMDir "$INSTDIR\versions\${VERSION}"
  RMDir "$INSTDIR\versions"
  RMDir "$INSTDIR\staging"
  !insertmacro Status "Đã gỡ phiên bản này. Dữ liệu của bạn được giữ lại."
SectionEnd
