# Audit Feature 0.4 — App shell và CI đa nền tảng

Ngày kiểm tra: 2026-08-11  
Phạm vi: Feature 0.4  
Trạng thái: **Verified local và cross-platform CI**

## Kết luận

AI for Boss đã có Electron application shell thật, renderer React ba panel theo
hướng Editorial Calm và quy trình đóng gói bundle thử nghiệm. Shell chỉ hiển thị
trạng thái trung thực; OAuth, Gateway, model, Agent Genesis, Advisor runtime và
tool vẫn bị khóa.

Ma trận CI Windows, macOS và Linux đã chạy xanh bằng Node `24.19.0` và pnpm
`11.2.2` trên draft PR #4. Artifact chưa ký, không có installer và không được
phân phối cho người dùng.

## Bằng chứng local

| Hạng mục | Kết quả |
|---|---|
| Dependency | Exact pins; pnpm `11.2.2`; peer dependency sạch |
| Kiểm thử | `30/30` unit/contract/security tests đạt |
| Static gates | ESLint, TypeScript, Vite build và Feature 0.4 validator đạt |
| Dependency audit | Không có lỗ hổng đã biết tại thời điểm kiểm tra |
| Windows package | `win32-x64`, Electron `43.3.0`, 75 file, 364,296,210 byte |
| ASAR | 216,298 byte; SHA-256 `773b901aeefc4d027b217798ce9ad70dcf75da7383a229fc6b3a8a23306a160b` |
| ASAR allowlist | 13 mục; chỉ `dist`, `electron`, `generated`, `package.json` |
| Process smoke | `.exe` tạo bốn tiến trình Electron phản hồi rồi được dừng sạch |
| Visual smoke | 1440×900 và 1024×768; không tràn ngang; Việt/Anh và sáng/tối đạt |
| CI ba OS | Windows 1 phút; macOS 55 giây; Linux 53 giây; cả ba đạt |
| Governance CI | Đạt trong 25 giây; tổng PR 4/4 check |

Máy local dùng Node `24.18.0`, thấp hơn một patch so với release train. Đây là
bằng chứng phát triển phụ; CI Node `24.19.0` mới là bằng chứng chuẩn.

## Rà soát bảo mật

- Renderer bật context isolation, sandbox và web security; tắt Node integration,
  webview, drag navigation và production DevTools.
- Preload chỉ lộ một hàm đọc `getShellStatus()` qua một IPC channel allowlist.
- Main process từ chối popup, điều hướng ngoài entry point, webview attach và
  mọi permission request.
- CSP chặn outbound connection, object và frame; shell không có network client.
- Renderer nhận contract đã rút gọn, không đọc manifest, filesystem hoặc secret.
- Package validator từ chối source, `node_modules` và source map trong ASAR.
- Không dùng credential, dữ liệu người dùng, provider hay Gateway trong test.

## Rà soát riêng tư và phạm vi ảnh hưởng

Feature không thu thập hoặc truyền dữ liệu. Mọi file sinh nằm trong
`node_modules`, `apps/desktop/dist` hoặc `out`; không tạo service, registry key,
profile người dùng hay migration. Rollback là revert commit và xóa output sinh.

## Bằng chứng CI

- Draft PR: `https://github.com/LucDinhLe/ai-for-boss/pull/4`
- Desktop workflow run: `31510826127`
- Governance workflow run: `31510826122`
- Windows đã xác nhận test fixture dùng PowerShell 7 để giữ UTF-8; lỗi thử đầu
  bằng Windows PowerShell 5.1 được ghi nhận và sửa ở commit `974cdc7`.

## Việc còn chặn

- Senior platform/security review vẫn là điều kiện Cổng 0.
- Windows/macOS/Linux chưa có ký số, notarization, installer, update/rollback
  và test trên thiết bị thật; R-007 và R-016 tiếp tục mở.
- Không được dùng kết quả package CI để tuyên bố tương thích thiết bị.

## Quyết định audit

Feature 0.4 đạt tiêu chí kỹ thuật và mở Feature 0.5 trong phiên riêng. Draft PR
tiếp tục không merge cho tới khi có review theo governance. Không cho phép phát
hành hoặc dùng artifact nội bộ làm bằng chứng hỗ trợ thiết bị.
