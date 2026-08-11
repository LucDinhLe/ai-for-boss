# Feature 0.2 — Windows x64 WSL2 smoke evidence

## Kết luận

OpenClaw stable `2026.7.1-2` cài và chạy được bằng Node LTS `24.19.0` cùng pnpm `11.2.2` trong distro WSL2 riêng `AIForBossLab`. Lệnh version, help và Gateway help đạt mà không dùng OAuth, API key, provider account, model call hoặc dữ liệu người dùng.

Kết quả này chứng minh candidate OpenClaw có thể chạy trong lab. Nó chưa chứng minh AI for Boss installer, Gateway RPC adapter, provider auth, desktop shell hoặc sandbox sản phẩm.

## Môi trường

- Host: ASUS Zenbook 14 UX3405MA, Windows Home Single Language x64, build `26200.8973`.
- WSL: `2.7.8.0`, WSL2, Ubuntu `24.04.4 LTS`.
- Distro: `AIForBossLab`.
- Vị trí: `%LOCALAPPDATA%\AIForBoss\Lab\WSL\AIForBossLab`.
- Dữ liệu thử: trạng thái rỗng; không credential.

## Biên cô lập đã kiểm tra

- `/mnt/c` không phải mount point trước khi cài npm packages.
- Windows interop bị tắt; `cmd.exe` không khả dụng trong distro.
- Smoke commands chạy trong Linux network namespace không có network interface.
- Distro được terminate sau cài đặt và sau lượt test độc lập.
- Không dùng `wsl --shutdown`, không dừng tiến trình AI Coworker và không dùng profile OpenClaw trên host.

WSL2 chia sẻ kernel với host và có mạng trong giai đoạn tải package. Đây là containment lab cho Feature 0.2; Feature 0.6 vẫn phải quyết định sandbox sản phẩm.

## Phiên bản và kết quả

| Thành phần | Phiên bản | Kết quả |
|---|---:|---|
| OpenClaw package | `2026.7.1-2` | Pass |
| OpenClaw CLI | `OpenClaw 2026.7.1-2 (0790d9f)` | Pass |
| Node.js | `24.19.0` | Pass |
| pnpm | `11.2.2` | Pass |
| `openclaw --help` | N/A | Pass |
| `openclaw gateway --help` | N/A | Pass |
| Provider auth/model call | N/A | Không chạy theo phạm vi |
| Gateway RPC readiness | N/A | Chưa chạy theo phạm vi |

## Chuỗi cung ứng

- Node Linux x64 archive khớp SHA-256 `14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647` từ Node.js.
- OpenClaw và pnpm được cài bằng phiên bản exact; lượt xác minh cuối chạy `--frozen-lockfile` với `pnpm-lock.yaml` đã smoke-test và không dùng dist-tag động.
- pnpm chỉ cho chạy build script của `@google/genai@2.10.0`, `openclaw@2026.7.1-2`, `protobufjs@7.6.5` và `tree-sitter-bash@0.25.1`.
- Repo có baseline CycloneDX SBOM. Lab xuất thêm full pnpm dependency tree và transitive license inventory.
- `npm sbom` không được dùng làm bằng chứng full tree vì npm báo sai dependency khi đọc layout pnpm; không biến báo cáo lỗi thành pass.

## Blocker upstream

Truy vấn npm chính thức ngày 2026-08-11 trả `E404` cho:

- `@openclaw/gateway-client@2026.7.1-2`
- `@openclaw/gateway-protocol@2026.7.1-2`

Hai package chỉ có các bản beta cùng nhịp mới hơn. Candidate manifest vì thế mang trạng thái `blocked`; không ghép beta với OpenClaw stable và không tuyên bố Gateway sản phẩm sẵn sàng.

## Evidence và rollback

- Báo cáo máy: `artifacts/feature-0.2/lab/smoke-report.json`.
- Cây dependency: `artifacts/feature-0.2/lab/dependency-tree.full.json`.
- License transitive: `artifacts/feature-0.2/lab/licenses.full.json`.
- Script kiểm tra luôn terminate đúng distro sau khi chạy.
- Bộ cài xác minh registry `BasePath` và WSL version trước khi dùng lại distro; test cố tình truyền BasePath sai đã bị từ chối trước mutation.
- Script gỡ yêu cầu nhập chính xác `AIForBossLab` và xác nhận PowerShell; chưa chạy vì unregister sẽ xóa vĩnh viễn filesystem lab.
- Chế độ gỡ `-WhatIf` đã xác nhận thao tác unregister chỉ được mô phỏng và lab vẫn tồn tại.
