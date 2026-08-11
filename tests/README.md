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
