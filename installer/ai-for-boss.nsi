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
Var Reason
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
; The support script speaks in ASCII codes, never in Vietnamese.
;
; PowerShell writes stdout in the console code page and nsExec reads it back as
; ANSI, so any diacritic sent that way arrives as question marks — which is what
; a Product Owner saw when a locked file stopped an uninstall. The wording lives
; here instead, compiled into the installer, where it renders correctly.
;
; Only the If/ElseIf construct is used, the one LogicLib form this file already
; compiled with before. An earlier attempt reached for TrimNewLines and Select
; and the build died on "Invalid command"; NSIS cannot be compiled in the
; environment this repo is edited from, so the rule now is to add no construct
; that is not already proven here. The support script drops its trailing
; newline rather than making the installer trim one.
;
; $Reason starts as the raw code, so an unexpected system error from .NET or
; Windows is still shown verbatim instead of being swallowed.
!macro Support ACTION
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\install-support.ps1" -Action ${ACTION} -Root "$INSTDIR" -Version "${VERSION}" -Manifest "$PLUGINSDIR\payload-manifest.json" -Desktop "$DESKTOP" -StartMenu "$SMPROGRAMS" -StatusWindow $HWNDPARENT'
  Pop $Result
  Pop $Detail
  ${If} $Result != 0
    SetErrorLevel 1
    StrCpy $Reason $Detail
    ${If} $Detail == "IN_USE"
      StrCpy $Reason "Bản này vẫn đang chạy, kể cả khi cửa sổ đã đóng. Bấm chuột phải biểu tượng AI for Boss ở khay hệ thống rồi chọn Thoát hẳn, sau đó gỡ lại"
    ${ElseIf} $Detail == "LOCAL_FOLDER"
      StrCpy $Reason "Chọn một thư mục cục bộ riêng cho ứng dụng"
    ${ElseIf} $Detail == "NO_REPARSE"
      StrCpy $Reason "Chọn thư mục cài đặt ngoài liên kết hoặc thư mục đồng bộ"
    ${ElseIf} $Detail == "BAD_PAYLOAD_PATH"
      StrCpy $Reason "Đường dẫn trong gói không hợp lệ"
    ${ElseIf} $Detail == "OUTSIDE_VERSION"
      StrCpy $Reason "Tệp nằm ngoài thư mục phiên bản"
    ${ElseIf} $Detail == "MANIFEST_MISMATCH"
      StrCpy $Reason "Thông tin bộ cài không khớp"
    ${ElseIf} $Detail == "BAD_FILE_LIST"
      StrCpy $Reason "Danh sách tệp không hợp lệ"
    ${ElseIf} $Detail == "PATH_TOO_LONG"
      StrCpy $Reason "Đường dẫn cài đặt quá dài. Hãy dùng thư mục mặc định hoặc chọn thư mục ngắn hơn"
    ${ElseIf} $Detail == "PAYLOAD_INCOMPLETE"
      StrCpy $Reason "Gói thiếu giao diện hoặc lõi"
    ${ElseIf} $Detail == "SHORTCUT_FOREIGN"
      StrCpy $Reason "Lối tắt cùng tên thuộc bản khác; đã giữ nguyên"
    ${ElseIf} $Detail == "SHORTCUT_UNVERIFIED"
      StrCpy $Reason "Chưa xác nhận được lối tắt mới"
    ${ElseIf} $Detail == "ROOT_FOREIGN"
      StrCpy $Reason "Thư mục không thuộc bộ cài AI for Boss"
    ${ElseIf} $Detail == "ROOT_NOT_EMPTY"
      StrCpy $Reason "Chọn thư mục trống; không chọn thư mục tài liệu hoặc bản cài khác"
    ${ElseIf} $Detail == "ROOT_UNOWNED"
      StrCpy $Reason "Không tìm thấy thông tin sở hữu bộ cài"
    ${ElseIf} $Detail == "VERSION_UNOWNED"
      StrCpy $Reason "Thông tin sở hữu phiên bản không khớp; đã giữ nguyên"
    ${ElseIf} $Detail == "VERSION_UNOWNED_REMOVE"
      StrCpy $Reason "Thiếu thông tin sở hữu phiên bản; không xóa"
    ${ElseIf} $Detail == "STAGE_MISMATCH"
      StrCpy $Reason "Thông tin bản cài dở không khớp; đã giữ nguyên"
    ${ElseIf} $Detail == "STAGE_UNOWNED"
      StrCpy $Reason "Thư mục cài dở chưa có thông tin sở hữu; đã giữ nguyên để kiểm tra"
    ${ElseIf} $Detail == "STAGE_FOREIGN"
      StrCpy $Reason "Thư mục cài dở có tệp khác; đã giữ lại để kiểm tra"
    ${ElseIf} $Detail == "STAGE_UNVERIFIED"
      StrCpy $Reason "Chưa xác nhận được thư mục cài dở; đã giữ nguyên"
    ${ElseIf} $Detail == "NO_SPACE"
      StrCpy $Reason "Chưa đủ dung lượng trống cho phiên bản mới"
    ${ElseIf} $Detail == "VERSION_EXISTS"
      StrCpy $Reason "Phiên bản đã tồn tại; không ghi đè lõi"
    ${ElseIf} $Detail == "INSTALL_UNVERIFIED"
      StrCpy $Reason "Chưa xác nhận bản đã cài"
    ${ElseIf} $Detail == "OK_PREPARE"
      StrCpy $Reason "Đã kiểm tra thư mục"
    ${ElseIf} $Detail == "OK_COMMIT"
      StrCpy $Reason "Đã xác minh đầy đủ tệp"
    ${ElseIf} $Detail == "OK_VERIFY"
      StrCpy $Reason "Bản đã cài còn nguyên vẹn"
    ${ElseIf} $Detail == "OK_ACTIVATE"
      StrCpy $Reason "Đã tạo lối tắt và mục gỡ cài đặt"
    ${ElseIf} $Detail == "OK_REMOVE"
      StrCpy $Reason "Đã gỡ bản này, giữ dữ liệu và các bản khác"
    ${EndIf}
    MessageBox MB_OK|MB_ICONSTOP "Chưa hoàn tất: $Reason. Bản trước và dữ liệu được giữ nguyên." /SD IDOK
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
