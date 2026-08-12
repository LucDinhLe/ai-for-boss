# Kiểm thử

Cấu trúc dự kiến:

- `contract`: Gateway protocol và release train.
- `integration`: OpenClaw nhúng, Supervisor và desktop shell.
- `security`: renderer, secret, prompt injection, policy và sandbox.
- `e2e`: cài đặt, onboarding, provider, task, Advisor và recovery.
- `fixtures`: dữ liệu giả, tuyệt đối không dùng credential hoặc dữ liệu production.

Feature 0.2 chạy thêm `scripts/validate-runtime-manifest.mjs` và
`tests/contract/release-train-contract.test.mjs`. Bộ test khóa OpenClaw stable,
hợp đồng WebSocket RPC công khai, protocol version và fingerprint của hai
workspace package private chỉ dùng làm tham chiếu. Beta, private dist import và
trạng thái release train giả đều phải fail closed.

Feature 0.3 chạy `scripts/validate-feature-0.3.mjs` và
`tests/contract/capability-threat-model-contract.test.mjs`. Bộ test kiểm tra
coverage 23 nhóm capability, release-train linkage, auth storage, nguồn sự thật,
tám data flow, Agent Genesis contract, threat traceability và cấm mọi capability
Feature 0.3 tự quảng cáo là đã hỗ trợ.

Feature 0.4 chạy `scripts/validate-feature-0.4.mjs`,
`tests/unit/desktop-contract.test.mjs` và
`tests/contract/desktop-shell-security-contract.test.mjs`. Bộ test khóa safe
summary, release train, Electron web preferences, preload allowlist, CSP và cấm
cờ làm yếu sandbox. Package validation đọc inventory bên trong ASAR và từ chối
source, `node_modules` hoặc source map. Ma trận CI build/package riêng trên
Windows, macOS và Linux nhưng artifact vẫn chỉ là `experimental-internal`.
