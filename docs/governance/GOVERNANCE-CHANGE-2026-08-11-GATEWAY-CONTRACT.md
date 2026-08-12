# Governance change — Gateway contract được upstream hỗ trợ

Ngày: 2026-08-11  
Owner: Lê Đình Lực phê duyệt giải blocker; Codex xác minh kỹ thuật  
Phạm vi: Rulebook 1.3, Master Execution Plan 1.2 và Feature 0.2

## Phát hiện

Giả định cũ yêu cầu `@openclaw/gateway-client` và
`@openclaw/gateway-protocol` phải có package npm stable cùng nhịp mới được khóa
release train. Mã nguồn chính thức tại tag `v2026.7.1-2` cho thấy cả hai package
có version `0.0.0-private` và `private: true`.

Tài liệu `docs/gateway/external-apps.md` của chính tag này ghi rõ chưa có npm
client package công khai, yêu cầu external app kết nối bằng WebSocket transport
và Gateway RPC được công bố. Vì vậy việc chờ package stable là điều kiện do dự
án tự đặt sai, không phải blocker của OpenClaw.

## Quyết định

- Khóa OpenClaw npm `2026.7.1-2`, tag `v2026.7.1-2`, commit
  `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c` và protocol v4.
- Khóa WebSocket text/JSON cùng RPC công bố làm integration surface.
- Ghi tree fingerprint của hai workspace package private để phát hiện drift,
  nhưng không bundle, vendor hoặc import chúng.
- AI for Boss tự sở hữu Adapter theo tài liệu công khai và phải contract-test
  với Gateway thật của từng release train.
- Cấm ghép beta package, import hashed `dist` chunk hoặc đọc private state.

## Bằng chứng

- npm `openclaw@2026.7.1-2` integrity
  `sha512-ycF3yPcbjN6bUPeaUx6Mh6vze1hQWoD3CT/wWcmD7a8xaHHHRUaAlaq+lFxMHf1ssEgODVAwjlzYqp2twkYZ7g==`.
- Git tag object `be8b8a9e8838f832e4fa47cde8bea0a33aec71ba`, peeled commit
  `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c`.
- Gateway client tree `aa1cfc32a01dc8171037585cad6b2d93aace41be`.
- Gateway protocol tree `0f8c8156d5352ee1c83fbed331c2082030bf0ac3`.
- Gateway khởi động và authenticated `health` RPC đạt trong WSL2 network
  namespace chỉ có loopback. Token test sinh tạm trong memory, không vào file,
  command line, log hoặc repo.

## Hệ quả

Feature 0.2 hết blocker và release train chuyển sang `locked`. Điều này chỉ mở
đường cho feature kế tiếp; chưa có desktop app, Adapter sản phẩm, OAuth,
installer, updater, sandbox hoặc artifact phát hành.

Khi upstream phát hành public package stable và thêm hướng dẫn cài chính thức,
dự án mới được đánh giá chuyển Adapter. Việc chuyển phải qua protocol diff,
migration test và rollback, không tự động thay dependency.
