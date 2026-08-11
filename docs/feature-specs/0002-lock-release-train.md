# Feature Spec — 0.2 Khóa release train

## 1. Trạng thái

- Cổng: 0
- Owner kỹ thuật: Codex, chờ senior/security reviewer trước pilot
- Product Owner: Lê Đình Lực
- Trạng thái: In progress — blocked upstream
- Ngày mở: 2026-08-11

## 2. Mục tiêu vận hành

Đội phát triển có một bộ phiên bản upstream xác định, nguồn tải và mã kiểm tra có thể kiểm chứng, cùng một phòng thử nghiệm cục bộ không dùng dữ liệu thật. Kết quả phải phân biệt rõ thành phần đã khóa, thành phần chỉ là ứng viên và thành phần chưa có bản stable tương thích.

## 3. Trong phạm vi

- Xác minh các dist-tag và metadata từ nguồn chính thức.
- Chọn một OpenClaw stable sau smoke test không xác thực provider.
- Khóa ứng viên Node LTS, Electron và package manager theo ràng buộc upstream.
- Ghi trạng thái Gateway client/protocol cùng release train; không giả lập phiên bản stable chưa tồn tại.
- Tạo `runtime-manifest` schema và manifest nền cho các OS/architecture mục tiêu.
- Tạo SBOM nền, license inventory và third-party notice ở mức dependency trực tiếp đã chọn.
- Tạo script dựng, kiểm tra và hướng dẫn gỡ phòng thử nghiệm WSL2 riêng trên Windows Home.
- Cài OpenClaw vào phòng thử nghiệm và chạy smoke test CLI bằng trạng thái rỗng.

## 4. Ngoài phạm vi

- Desktop shell, UI, Supervisor sản phẩm, installer/updater và release artifact.
- OAuth, API key, provider connector, model call, dữ liệu người dùng hoặc tài khoản thật.
- Gateway RPC adapter và tuyên bố Gateway sản phẩm đã sẵn sàng.
- Chọn sandbox sản phẩm cho Windows, macOS và Linux; việc này thuộc Feature 0.6.
- Host exec, elevated tool, browser automation, channel và plugin bên thứ ba.

## 5. Đầu vào và đầu ra

| Loại | Mô tả |
|---|---|
| Đầu vào | NPM registry, Node.js release index, metadata Electron, WSL2/Ubuntu 24.04 LTS |
| Đầu ra | Release candidate record, runtime manifest schema, manifest nền, SBOM/license inventory và bằng chứng smoke test |
| Dữ liệu đọc | Metadata công khai; trạng thái OS/WSL; tài liệu governance trong repo |
| Dữ liệu ghi | File trong repo; một WSL2 distro riêng tại vùng ứng dụng cục bộ; package cache và trạng thái thử nghiệm chỉ trong distro đó |

## 6. Giả định

- Máy thử nghiệm là Windows x64 Home Single Language, có WSL2 và virtualization nhưng chưa có distro.
- Windows Sandbox không khả dụng trên Windows Home.
- OpenClaw `latest` là stable công khai; beta không được promote thành product release train.
- Smoke test không cần credential và không được dùng tài khoản chính của Product Owner.
- WSL2 lab là biện pháp giảm phạm vi ảnh hưởng cho thử nghiệm này, không phải bằng chứng sandbox sản phẩm đã đạt.

## 7. Trường hợp biên và hành vi khi lỗi

| Trường hợp | Hành vi mong đợi |
|---|---|
| Dist-tag thay đổi giữa lúc làm | Dùng phiên bản và integrity đã chụp; không cài bằng tag động |
| Gateway client/protocol không có stable cùng nhịp | Ghi `unavailable-upstream`, không ghép beta với stable và không hoàn tất release train giả |
| Tên WSL distro đã tồn tại | Dừng; không ghi đè hoặc unregister tự động |
| Tải distro/package lỗi | Dừng, giữ log sạch secret và cho phép chạy lại idempotent |
| Mạng rớt giữa chừng | Không đánh dấu smoke test đạt; package install phải xác minh integrity |
| Quyền không đủ | Dừng trước thay đổi hệ thống; không tự bật Windows feature hoặc reboot |
| `/mnt/c` vẫn tồn tại sau hardening | Smoke test bảo mật fail; không cài OpenClaw cho tới khi drive mount bị tắt |
| Windows interop vẫn hoạt động | Smoke test bảo mật fail; không chạy runtime |
| OpenClaw yêu cầu cấu hình/provider | Chỉ chạy lệnh read-only không cần auth; không điền credential để vượt qua |
| Schema hoặc manifest sai | Validation fail và không commit |

## 8. Quyền và dữ liệu

- Scope cần dùng: tải artifact công khai, tạo một WSL2 distro tên `AIForBossLab`, ghi vào thư mục lab riêng.
- Secret cần dùng: không có.
- Workspace/network cần dùng: npm, Node.js/Microsoft/Ubuntu official distribution endpoints; repo private.
- Approval cần dùng: yêu cầu hiện tại của Product Owner cho phép tải, cài thử và tạo sandbox; mọi UAC/reboot hoặc gỡ phá hủy vẫn phải xin riêng.
- Dữ liệu cá nhân hoặc nhạy cảm: không có; không mount ổ Windows vào lab và không dùng workspace thật làm test fixture.

## 9. Quyết định có hệ quả

- D-0006 sẽ ghi release candidate chỉ sau khi smoke test đạt.
- Gateway client/protocol stable cùng nhịp hiện là blocker upstream cần lưu bằng chứng, không được lách bằng beta.
- Phòng thử nghiệm WSL2 không thay đổi quyết định sandbox đang hoãn tới Feature 0.6.

## 10. Tiêu chí nghiệm thu

- [x] Metadata phiên bản, nguồn và integrity được chụp từ nguồn chính thức.
- [x] OpenClaw stable cụ thể chạy smoke test trong lab bằng trạng thái rỗng, không credential.
- [x] Lab không tự mount ổ Windows và tắt Windows interop trước khi cài runtime.
- [x] Không ảnh hưởng AI Coworker hoặc profile OpenClaw đã có trên host.
- [x] Node, Electron và package manager có phiên bản cụ thể, nguồn và hash/integrity.
- [x] Gateway client/protocol được khóa cùng release train hoặc ghi rõ `unavailable-upstream` có bằng chứng.
- [x] Runtime manifest schema validate manifest nền.
- [x] SBOM nền, license inventory và third-party notice tồn tại.
- [x] Script kiểm tra có test idempotency và fail-closed phù hợp.
- [x] Governance, secret scan, whitespace và manual review đạt.
- [x] Rollback được mô tả nhưng không tự chạy thao tác xóa distro.

## 11. Kế hoạch kiểm thử

- Unit: kiểm tra helper và điều kiện fail-closed của script lab.
- Contract: validate runtime manifest bằng JSON Schema; đối chiếu version/integrity với metadata chụp.
- Integration: dựng distro riêng, harden, cài runtime và chạy `openclaw --version`/help/doctor phù hợp mà không auth.
- Security/privacy: xác minh `/mnt/c` vắng mặt, Windows executable không gọi được, không credential/secret trong file hoặc log commit.
- Kiểm tra bằng tay: xác minh AI Coworker vẫn chạy; distro có tên/đường dẫn riêng; báo cáo không tuyên bố vượt bằng chứng.
- Recovery/rollback: hướng dẫn terminate rồi `wsl --unregister AIForBossLab`; lệnh xóa chỉ chạy khi Product Owner yêu cầu rõ.

## 12. Phạm vi ảnh hưởng

- Thành phần bị chạm: tài liệu Feature 0.2, manifest/license/test scripts; WSL registration và VHD riêng ngoài repo.
- Tính năng có thể bị ảnh hưởng: không có product runtime; WSL service có thêm một distro.
- Dữ liệu hoặc migration: không có dữ liệu người dùng; lab có thể xóa trọn gói.

## 13. Rollback

Repo quay về commit Feature 0.1. Với lab, dừng đúng distro, xác minh tên và vị trí, sau đó Product Owner có thể cho phép unregister để xóa root filesystem/VHD. Không dùng `wsl --shutdown` vì có thể ảnh hưởng tiến trình WSL khác; không unregister tự động.

## 14. Bằng chứng hoàn thành

- Commit: chờ tạo sau khi kiểm tra cuối đạt.
- Kết quả test: OpenClaw package/CLI `2026.7.1-2`, Node `24.19.0` và pnpm `11.2.2` đạt bằng frozen lockfile; host drive mount và Windows interop bị tắt; smoke chạy trong network namespace không mạng; lab dừng sau test. Test BasePath sai bị từ chối trước mutation; removal `-WhatIf` không xóa distro.
- Blocker: npm E404 cho `@openclaw/gateway-client@2026.7.1-2` và `@openclaw/gateway-protocol@2026.7.1-2`; không promote manifest thành `locked` và không mở Feature 0.3.
- Reviewer: Codex self-review; cần senior/security review trước pilot thật.
- Product Owner acceptance: Product Owner yêu cầu tải, cài thử nghiệm và cô lập rủi ro ngày 2026-08-11.
