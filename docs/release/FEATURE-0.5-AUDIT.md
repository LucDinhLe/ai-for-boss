# Feature 0.5 Audit — First-run journey ba bước

Ngày mở: 2026-08-11

Correction audit: 2026-08-12

Trạng thái: **Correction đạt local và cross-platform CI; human usability còn chờ**

Phân loại: `experimental-internal`, Type C prototype, chỉ dữ liệu giả

## Kết luận

Feature 0.5 đã có vertical slice ba bước trong desktop shell và correction pass
đã đóng các lỗi invariant/UI phát hiện ở self-review. Preview Genesis chỉ dừng
ở `STAGING`; không có đường nào từ renderer tự khai `ACTIVE`, xóa bootstrap hay
báo Agent sẵn sàng. Feature vẫn chưa phải onboarding/runtime thật và chưa được
phép merge hoặc phát hành.

## Phạm vi và biên an toàn

- Chỉ renderer state trong bộ nhớ; reload trở về trạng thái sạch.
- Ba provider/model fixture đều `live:false`; selector khóa theo fixture đã chọn.
- CSP giữ `connect-src 'none'`; preload chỉ có một request đọc safe shell status.
- Không credential, persistence, filesystem write, process execution, Gateway,
  OAuth, model call, tool hoặc chi phí thật.
- Task ở `draft-only`, quyền/data egress bằng `none`, ngân sách 0 token.
- Advisor plan/final đều `pending-runtime`; sample plan ba bước không thực thi.

## Correction pass

Các lỗi được sửa:

1. Snapshot trước đây chỉ kiểm một phần và có thể tạo tổ hợp `ACTIVE` bất khả
   thi. Schema `0.5.1-preview` nay dùng exact shape cùng invariant matrix cho
   install, connection, stage, Genesis, task, Advisor và promotion operations.
2. Renderer không còn hard-code promotion checks. Chỉ nguồn
   `trusted-supervisor-runtime` cùng đủ sáu check mới có thể tạo `ACTIVE` ở
   state machine; nguồn này không được import hoặc truyền từ `App.tsx`.
3. Cả bảy trường Genesis — tên, vai trò, giọng điệu, emoji, cách xưng hô, ưu
   tiên và ranh giới — đều bắt buộc, trim/giới hạn và có lỗi tại trường.
4. Preview approval giữ bootstrap, `reportReady=false` và `STAGING`; màn cuối
   hiển thị sample plan xác định thay vì một kết quả AI giả.
5. Readiness chỉ báo shell đã nạp khi preload bridge sẵn sàng; model selector
   không thể hiển thị khác state sau khi kết nối.
6. Màu chữ light theme đạt ngưỡng tương phản AA; breakpoint 1000 px bảo đảm app
   min-width 980 px không tràn ngang.

Snapshot thiếu/thừa field, identity rỗng/quá dài, fixture lạ, safety drift,
promotion sequence rút gọn hoặc state mâu thuẫn đều bị từ chối toàn bộ và quay
về `UNSEEDED`. Snapshot `PENDING_RESUME` hợp lệ chỉ resume với bằng chứng runtime
tin cậy; failure tiếp tục giữ bootstrap và không báo sẵn sàng.

## Bằng chứng local

| Hạng mục | Kết quả correction |
|---|---|
| Governance/secret hygiene | Đạt; 93 file bắt buộc, 113 file text, 48 Markdown |
| Test | 55/55 đạt; gồm regression cho các tổ hợp snapshot đã khai thác, exact promotion sequence, bảy trường identity và completed-draft guard |
| Static/build | ESLint, TypeScript, Vite, validator Feature 0.4/0.5 và `git diff --check` đạt |
| Windows package | 75 file, 364.315.730 byte; `experimental-internal`, unsigned, non-distributable |
| ASAR | 13 mục allowlist; 235.818 byte; SHA-256 `48b536c239ee3cce3758529fabc7c130780fcf771e4f8b481f9b13fa496c2f7c` |
| Dependency audit | `pnpm audit --audit-level high`: không có lỗ hổng đã biết |
| Network/storage | CSP offline; static scan không thấy transport, persistence, process execution hoặc secret |
| Cross-platform CI | Commit `3ab90e1` đạt Windows, macOS, Linux và governance/secret hygiene |

Máy local dùng Node `24.18.0`, thấp hơn release train một patch. CI dùng đúng
Node `24.19.0`/pnpm `11.2.2` là bằng chứng chuẩn đa nền tảng và đã đạt trên
commit `3ab90e1`:

- Desktop shell run `31519600558`: Windows, macOS và Linux đạt.
- Governance run `31519600494`: governance và secret hygiene đạt.

## QA tương tác và trực quan

QA harness được sinh từ production renderer bundle, không dùng Vite source trực
tiếp. Browser automation đã đi xuyên bước 1–3, thử input chỉ khoảng trắng, đổi
fixture, Việt/Anh, sáng/tối và trạng thái hoàn tất. Kết quả xác nhận Genesis vẫn
`STAGING`, `reportReady=No`, sample plan có ba bước và Advisor chưa chạy.

- `artifacts/feature-0.5/first-run-1440x900.png`
- `artifacts/feature-0.5/first-run-1024x768.png`
- `artifacts/feature-0.5/first-run-step-3-980x680.png`
- `artifacts/feature-0.5/first-run-complete-1440x900-dark-en.png`

Viewport 1024 và 980 không tràn ngang; ở 980 safety panel ẩn theo responsive
contract. Heading nhận focus sau chuyển bước và control có `:focus-visible`.
Chưa có human keyboard traversal, screen-reader run, zoom audit hoặc test với
người phổ thông; không được suy diễn các hạng mục đó đã đạt.

## Blast radius và rollback

Correction chỉ chạm first-run state/UI/type, test, validator, QA harness và tài
liệu. Không đổi Gateway contract, auth/source-of-truth, OpenClaw lab, runtime,
IPC ghi, signing hoặc dữ liệu người dùng.

Rollback bằng cách revert correction commit rồi sinh lại `dist`/`out`. Không có
migration, credential, dịch vụ nền hoặc dữ liệu người dùng cần phục hồi.

## Cổng còn mở

- Draft PR #5 phải giữ Draft và không merge; CI đạt không thay thế review.
- Chưa có installer, Gateway Adapter, OAuth, live model probe, OpenClaw runtime,
  Agent Home writer, session execution, tool hoặc Advisor verdict thật.
- Chưa ghi identity file, chưa xóa `BOOTSTRAP.md` thật và chưa tạo `memory/`.
- Artifact chưa ký, `distributable:false`; tuyệt đối không public release.
- Senior platform/security review bằng người chịu trách nhiệm vẫn là điều kiện
  Gate 0; Codex self-review không thay thế điều kiện đó.
