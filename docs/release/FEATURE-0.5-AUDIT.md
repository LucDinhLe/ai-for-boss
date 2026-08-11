# Feature 0.5 Audit — First-run journey ba bước

Ngày: 2026-08-11  
Trạng thái: **Verified local và cross-platform CI; human usability pending**
Phân loại: `experimental-internal`, Type C prototype, dữ liệu giả

## Phạm vi

Audit chỉ bao phủ vertical slice renderer của hành trình ba bước. Không có
installer, Gateway, OAuth, provider thật, model call, Agent Home writer,
persistence, tool, Browser, workspace grant hoặc public release.

## Security và privacy review

- CSP tiếp tục `connect-src 'none'`; renderer không có transport đi ra ngoài.
- Preload chỉ giữ một API đọc safe shell summary.
- Ba fixture provider đều khóa `live: false`; fixture lạ bị từ chối.
- State first-run chỉ nằm trong bộ nhớ và mất khi reload.
- Genesis lỗi giữ `PENDING_RESUME`, `bootstrapRetained=true` và
  `reportReady=false`; thao tác xóa bootstrap luôn đứng cuối chuỗi preview.
- Advisor plan/final giữ `pending-runtime`; task chỉ ở `draft-only`, quyền thật
  bằng không và ngân sách preview bằng 0 token.
- Không secret, credential hoặc dữ liệu thật được dùng.

## Blast radius

- Chạm renderer, state machine, test, validator và governance docs.
- Không chạm OpenClaw lab, Gateway contract, manifest nguồn sự thật hoặc runtime.
- Rủi ro chính là người xem tưởng prototype đã kết nối thật; R-026 theo dõi việc này.

## Bằng chứng

| Hạng mục | Kết quả |
|---|---|
| Governance | Đạt; 91 file bắt buộc, 111 file text và 47 Markdown |
| Test | 47/47 đạt; trong đó 17 test trực tiếp cho first-run/security |
| Static/build | ESLint, TypeScript, Vite và validator Feature 0.4/0.5 đạt |
| Cross-platform CI | Đạt trên Windows, macOS và Linux; governance/secret hygiene đạt |
| Windows package | 75 file, 364.308.236 byte; `experimental-internal` |
| ASAR | 13 mục allowlist; 228.324 byte; SHA-256 `051dbcda16e9b9c589aed6fc61c67648ae3237bd10ba2d43d3f9189187a8825a` |
| Dependency audit | Không có lỗ hổng đã biết ở mức high trở lên tại thời điểm kiểm tra |
| Visual QA | 1440×900 và 1024×768; không tràn ngang; sửa lỗi tách dấu tiếng Việt ở vòng ảnh đầu |
| Secret/network | Secret scan đạt; CSP `connect-src 'none'`; không persistence hoặc transport mới |

Ảnh QA:

- `artifacts/feature-0.5/first-run-1440x900.png`
- `artifacts/feature-0.5/first-run-1024x768.png`

Computer-use runtime bị môi trường chặn `EPERM` trước khi điều khiển Windows app,
nên QA hình dùng Chrome headless trên build cục bộ. Ảnh chứng minh layout màn
đầu; 17 test state machine chứng minh transition Bước 1–3. Chưa có human
usability test, screen-reader run hoặc independent visual review.

Máy local dùng Node `24.18.0`, thấp hơn release train một patch. CI Node
`24.19.0` là bằng chứng chuẩn đa nền tảng và đã đạt cho commit Feature 0.5.

## Phần chưa kết nối và cổng còn mở

- Chưa có installer, Gateway, OAuth, live model probe hoặc OpenClaw runtime.
- Chưa ghi Agent Home, chưa xóa `BOOTSTRAP.md` thật và chưa tạo `memory/`.
- Chưa có session execution, tool, artifact hoặc Advisor plan/final verdict thật.
- Artifact vẫn unsigned, `distributable:false` và không được phát hành.
- Senior platform/security review vẫn là điều kiện Gate 0; Codex self-review
  không thay thế reviewer chịu trách nhiệm bằng tên.

## Rollback

Revert commit Feature 0.5 và xóa output build bị ignore. Không có migration,
credential, dịch vụ nền hoặc dữ liệu người dùng cần phục hồi.
