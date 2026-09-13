; Each internal version is immutable and independently removable.
; Build only with scripts/build-internal-installer.mjs.
Unicode true
ManifestDPIAware true
RequestExecutionLevel user
CRCCheck force
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
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
; here instead, compiled into the installer, where it renders correctly. An
; unrecognised code is shown as-is so an unexpected system error is still legible.
!macro Explain CODE OUT
  StrCpy ${OUT} ""
  ${Select} ${CODE}
    ${Case} "IN_USE"
      StrCpy ${OUT} "Bản này vẫn đang chạy, kể cả khi cửa sổ đã đóng. Bấm chuột phải biểu tượng AI for Boss ở khay hệ thống rồi chọn Thoát hẳn, sau đó gỡ lại"
    ${Case} "LOCAL_FOLDER"
      StrCpy ${OUT} "Chọn một thư mục cục bộ riêng cho ứng dụng"
    ${Case} "NO_REPARSE"
      StrCpy ${OUT} "Chọn thư mục cài đặt ngoài liên kết hoặc thư mục đồng bộ"
    ${Case} "BAD_PAYLOAD_PATH"
      StrCpy ${OUT} "Đường dẫn trong gói không hợp lệ"
    ${Case} "OUTSIDE_VERSION"
      StrCpy ${OUT} "Tệp nằm ngoài thư mục phiên bản"
    ${Case} "MANIFEST_MISMATCH"
      StrCpy ${OUT} "Thông tin bộ cài không khớp"
    ${Case} "BAD_FILE_LIST"
      StrCpy ${OUT} "Danh sách tệp không hợp lệ"
    ${Case} "PATH_TOO_LONG"
      StrCpy ${OUT} "Đường dẫn cài đặt quá dài. Hãy dùng thư mục mặc định hoặc chọn thư mục ngắn hơn"
    ${Case} "PAYLOAD_INCOMPLETE"
      StrCpy ${OUT} "Gói thiếu giao diện hoặc lõi"
    ${Case} "SHORTCUT_FOREIGN"
      StrCpy ${OUT} "Lối tắt cùng tên thuộc bản khác; đã giữ nguyên"
    ${Case} "SHORTCUT_UNVERIFIED"
      StrCpy ${OUT} "Chưa xác nhận được lối tắt mới"
    ${Case} "ROOT_FOREIGN"
      StrCpy ${OUT} "Thư mục không thuộc bộ cài AI for Boss"
    ${Case} "ROOT_NOT_EMPTY"
      StrCpy ${OUT} "Chọn thư mục trống; không chọn thư mục tài liệu hoặc bản cài khác"
    ${Case} "ROOT_UNOWNED"
      StrCpy ${OUT} "Không tìm thấy thông tin sở hữu bộ cài"
    ${Case} "VERSION_UNOWNED"
      StrCpy ${OUT} "Thông tin sở hữu phiên bản không khớp; đã giữ nguyên"
    ${Case} "VERSION_UNOWNED_REMOVE"
      StrCpy ${OUT} "Thiếu thông tin sở hữu phiên bản; không xóa"
    ${Case} "STAGE_MISMATCH"
      StrCpy ${OUT} "Thông tin bản cài dở không khớp; đã giữ nguyên"
    ${Case} "STAGE_UNOWNED"
      StrCpy ${OUT} "Thư mục cài dở chưa có thông tin sở hữu; đã giữ nguyên để kiểm tra"
    ${Case} "STAGE_FOREIGN"
      StrCpy ${OUT} "Thư mục cài dở có tệp khác; đã giữ lại để kiểm tra"
    ${Case} "STAGE_UNVERIFIED"
      StrCpy ${OUT} "Chưa xác nhận được thư mục cài dở; đã giữ nguyên"
    ${Case} "NO_SPACE"
      StrCpy ${OUT} "Chưa đủ dung lượng trống cho phiên bản mới"
    ${Case} "VERSION_EXISTS"
      StrCpy ${OUT} "Phiên bản đã tồn tại; không ghi đè lõi"
    ${Case} "INSTALL_UNVERIFIED"
      StrCpy ${OUT} "Chưa xác nhận bản đã cài"
    ${Case} "OK_PREPARE"
      StrCpy ${OUT} "Đã kiểm tra thư mục"
    ${Case} "OK_COMMIT"
      StrCpy ${OUT} "Đã xác minh đầy đủ tệp"
    ${Case} "OK_VERIFY"
      StrCpy ${OUT} "Bản đã cài còn nguyên vẹn"
    ${Case} "OK_ACTIVATE"
      StrCpy ${OUT} "Đã tạo lối tắt và mục gỡ cài đặt"
    ${Case} "OK_REMOVE"
      StrCpy ${OUT} "Đã gỡ bản này, giữ dữ liệu và các bản khác"
    ${CaseElse}
      StrCpy ${OUT} ${CODE}
  ${EndSelect}
!macroend
!macro Support ACTION
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\install-support.ps1" -Action ${ACTION} -Root "$INSTDIR" -Version "${VERSION}" -Manifest "$PLUGINSDIR\payload-manifest.json" -Desktop "$DESKTOP" -StartMenu "$SMPROGRAMS" -StatusWindow $HWNDPARENT'
  Pop $Result
  Pop $Detail
  ${If} $Result != 0
    SetErrorLevel 1
    ${TrimNewLines} "$Detail" $Detail
    !insertmacro Explain "$Detail" $Reason
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
