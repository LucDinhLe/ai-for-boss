# Feature Spec — 0.4 App shell và CI đa nền tảng

## 1. Trạng thái

- Cổng: 0
- Owner kỹ thuật: Codex; chờ senior platform/security reviewer trước khi qua Cổng 0
- Product Owner: Lê Đình Lực
- Trạng thái: Local verified; chờ CI ba hệ điều hành
- Ngày mở: 2026-08-11

## 2. Mục tiêu vận hành

Đội phát triển có một Electron application shell thật, chạy và đóng gói được
trên release train đã khóa. Người xem nhận ra AI for Boss, ba chặng hành trình
và trạng thái hệ thống thử nghiệm mà không bị dẫn tới OAuth, Gateway, tool hoặc
capability chưa triển khai.

CI tạo artifact thử nghiệm riêng trên Windows, macOS và Linux. Artifact cùng
giao diện phải ghi rõ đây là internal shell, chưa phải bản cài cho người dùng.

## 3. Trong phạm vi

- Root workspace dùng pnpm `11.2.2` và dependency khóa phiên bản chính xác.
- Electron `43.3.0`, React `19.2.8`, Vite `8.2.1` và TypeScript `6.0.3`.
- Electron main, preload allowlist tối thiểu và renderer React.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webSecurity: true`; production package tắt DevTools.
- UI shell Editorial Calm ba vùng, Việt/Anh ở mức placeholder, sáng/tối và
  ba bước hiển thị trạng thái chưa kết nối trung thực.
- Tóm tắt an toàn được sinh từ runtime/capability/auth/source/threat contract
  của Feature 0.2–0.3; renderer không được đọc trực tiếp repo hoặc filesystem.
- Script build, package bằng `@electron/packager`, sinh artifact inventory và
  kiểm tra output theo OS/architecture của runner.
- Lint, typecheck, unit/contract/security tests, governance/secret scan,
  dependency audit và CI matrix Windows/macOS/Linux.

## 4. Ngoài phạm vi

- OpenClaw process, Supervisor, Gateway Adapter hoặc readiness thật.
- OAuth, API key, provider connection, model call hoặc credential.
- Agent Genesis writer, session, Advisor orchestration hoặc dữ liệu người dùng.
- Host exec, Browser thật, tool, channel, plugin, MCP hoặc sandbox backend.
- Installer, updater, signing, notarization, auto-update hoặc public download.
- Tuyên bố hỗ trợ thiết bị; CI build chỉ là bằng chứng compile/package.
- Logo/icon production. Shell dùng wordmark và hình học trung tính.

## 5. Đầu vào và đầu ra

| Loại | Mô tả |
|---|---|
| Đầu vào | Rulebook 1.3, Master Plan 1.2, release train `oc-2026.7.1-2-locked.1`, Feature 0.3 manifests, Editorial Calm direction |
| Đầu ra | Electron/React source, preload boundary, safe contract summary, lockfile, build/package scripts, tests, CI workflow và artifact inventory |
| Dữ liệu đọc | Chỉ manifest/schema đã commit; renderer chỉ nhận bản tóm tắt đã allowlist |
| Dữ liệu ghi | Source repo, `node_modules`, `dist`, `out` và ảnh smoke cục bộ; không có user data |

## 6. Giả định

- Electron/React tiếp tục là lựa chọn đã chốt trong Rulebook.
- `@electron/packager` chỉ tạo app bundle thử nghiệm; định dạng installer thuộc
  Cổng 4 và cần ADR riêng.
- Vite bundle React vào renderer; packaged shell không có production npm
  dependency ngoài mã đã bundle và Electron runtime.
- Node local `24.18.0` được phép chạy development checks; CI dùng đúng Node
  `24.19.0` của release train và là bằng chứng chuẩn.
- macOS/Windows/Linux artifact chỉ được gọi `experimental-internal`.

## 7. Trường hợp biên và hành vi khi lỗi

| Trường hợp | Hành vi mong đợi |
|---|---|
| Manifest rỗng, thiếu hoặc sai schema/version | Generator/validator dừng build; renderer không nhận dữ liệu giả |
| Capability hoặc threat count lệch contract | Contract test và CI thất bại |
| Renderer gọi API ngoài allowlist | Không có bridge method; test preload thất bại nếu API mở rộng âm thầm |
| Điều hướng hoặc cửa sổ mới | Main chặn; không mở URL ngoài |
| Permission được yêu cầu | Từ chối mặc định |
| Build bị gọi hai lần | Output build được tái tạo; package script tạo thư mục run riêng hoặc xóa đúng output `out/desktop` đã xác định |
| Mạng rớt khi cài dependency | Install thất bại; lockfile và source không đổi; retry sau |
| Runner thiếu đúng Node/pnpm | CI thất bại trước build |
| Package sai OS/architecture | Artifact validator từ chối inventory |
| UI bridge lỗi | Hiện trạng thái “Shell chưa sẵn sàng”, không giả Gateway/model đã kết nối |

## 8. Quyền và dữ liệu

- Scope cần dùng: đọc/ghi repo, chạy Node/Electron và package artifact thử nghiệm.
- Secret cần dùng: không có.
- Workspace/network cần dùng: npm registry để tải dependency đã khóa; GitHub Actions để build runner.
- Approval cần dùng: Product Owner đã cho tiếp tục Feature 0.4; push/PR dùng quyền repo hiện có.
- Dữ liệu cá nhân hoặc nhạy cảm: không có; UI dùng nội dung giả và metadata release train.

## 9. Quyết định có hệ quả

- D-0001, D-0009, D-0010, D-0011, D-0013 và D-0014 tiếp tục chi phối.
- D-0015 sẽ ghi lựa chọn React/Vite cùng packager thử nghiệm, không chốt
  installer/updater production.
- Không thay đổi nguồn sự thật, quyền, hành vi lỗi nghiệp vụ hoặc sandbox.

## 10. Tiêu chí nghiệm thu

- [x] App Electron local mở được shell từ build output.
- [x] Renderer có `contextIsolation`, tắt Node integration, bật sandbox và
  không nhận API IPC tùy ý.
- [x] Navigation, popup và permission bị deny theo mặc định.
- [x] Renderer chỉ nhận safe summary từ contract Feature 0.2–0.3.
- [x] Shell có ba vùng, wordmark riêng, ba chặng rõ, Việt/Anh và sáng/tối.
- [x] Mọi model/Gateway/Advisor/tool state đều ghi là preview hoặc chưa kết nối.
- [x] Lint, typecheck, build, unit/contract/security tests và secret scan đạt local.
- [x] Package local tạo app bundle cùng inventory `experimental-internal`.
- [ ] CI tạo artifact thử nghiệm trên Windows, macOS và Linux bằng Node
  `24.19.0`, pnpm `11.2.2`.
- [x] CI không gọi provider, không dùng credential và không phát hành release.
- [x] README, AGENTS, CHANGELOG, DECISIONS, RISKS và audit được cập nhật.
- [x] Rollback bằng revert commit, không để service/process/data ngoài repo.

## 11. Kế hoạch kiểm thử

- Unit: safe-summary builder, locale/theme state và artifact inventory helper.
- Contract: dependency pins, release train, capability/auth/source/threat count,
  preload API allowlist và Electron window policy.
- Integration: Vite build, Electron package và artifact validation.
- Security/privacy: deny navigation/popup/permission, no Node in renderer,
  secret scan, dependency audit và grep cờ remote-debugging/web-security yếu.
- Kiểm tra bằng tay: mở shell Windows local, xem Việt/Anh, sáng/tối, responsive
  cơ bản và xác nhận không có control giả chạy thật.
- Recovery/rollback: xóa `node_modules`, `dist`, `out`; checkout/revert commit
  Feature 0.4; không có migration hoặc state người dùng.

## 12. Phạm vi ảnh hưởng

- Thành phần bị chạm: root workspace, `apps/desktop`, build scripts, tests,
  GitHub Actions, governance index và tài liệu release.
- Tính năng có thể bị ảnh hưởng: governance CI thời gian chạy dài hơn; không
  chạm OpenClaw lab, Gateway contract hoặc user runtime.
- Dữ liệu hoặc migration: không có.

## 13. Rollback

Revert commit Feature 0.4 rồi xóa build output bị ignore. Không có installer,
service, credential, registry entry, database hoặc user profile cần phục hồi.

## 14. Bằng chứng hoàn thành

- Commit: chờ checkpoint sau self-review.
- Kết quả test: local `pnpm verify` đạt; 30/30 test; package Windows x64 và
  ASAR allowlist đạt; npm audit không có lỗ hổng đã biết. CI ba OS chờ push.
- Reviewer: Codex self-review; senior platform/security review còn là Cổng 0.
- Product Owner acceptance: chờ nghiệm thu Feature 0.4.
