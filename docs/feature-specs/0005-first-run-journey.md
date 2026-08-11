# Feature Spec — 0.5 First-run journey ba bước

## 1. Trạng thái

- Cổng: 0, prototype trải nghiệm nội bộ bằng dữ liệu giả
- Owner kỹ thuật: Codex; chờ senior platform/security reviewer trước khi qua Cổng 0
- Product Owner: Lê Đình Lực
- Trạng thái: Active
- Ngày mở: 2026-08-11

## 2. Mục tiêu vận hành

Người dùng thử đi trọn ba chặng nhìn thấy của AI for Boss ngay trong app:

1. Xác nhận bản cài nội bộ và biên an toàn.
2. Chọn model giả rồi khai sinh Agent bằng hồ sơ tối thiểu.
3. Giao việc đầu tiên, xem trước dữ liệu/quyền/ngân sách và nhận kế hoạch mẫu.

Hành trình dùng dữ liệu giả, không tạo cảm giác đã kết nối runtime thật và không
được mở bất kỳ đường ghi dữ liệu, credential, Gateway hoặc tool nào.

## 3. Trong phạm vi

- State machine first-run trong renderer với bốn trạng thái: kiểm tra bản cài,
  kết nối/khai sinh, giao việc và hoàn tất mẫu.
- Giao diện Việt/Anh, sáng/tối, bàn phím, focus rõ và responsive theo shell 0.4.
- Model/provider chỉ là lựa chọn mô phỏng có nhãn rõ ràng.
- Hồ sơ Genesis tối thiểu gồm tên Agent, vai trò, giọng điệu, emoji, cách xưng
  hô, ưu tiên và ranh giới.
- Permission preview cho biết không dữ liệu nào rời máy, không tool nào chạy và
  không chi phí thật phát sinh.
- Validation fail-closed cho rỗng, chỉ khoảng trắng, Unicode/emoji, chuỗi dài,
  bấm hai lần, state sai và reload giữa chừng.
- Unit/contract tests, visual/manual QA, audit, changelog và rollback.

## 4. Ngoài phạm vi

- Installer, preflight máy thật hoặc xác minh artifact đã ký.
- OpenClaw process, Supervisor, Gateway, OAuth, API key hoặc model call.
- Ghi `IDENTITY.md`, `USER.md`, `SOUL.md`, xóa `BOOTSTRAP.md` hoặc tạo memory.
- Persistence qua reload, database, filesystem hoặc kho secret.
- Tool, Browser, workspace grant, Advisor runtime, action approval hoặc chi phí thật.
- Baseline bảo mật/phát hành đầy đủ; đây vẫn là cổng riêng chưa hoàn thành.
- Phát hành cho học viên, khách hoặc công chúng.

## 5. Đầu vào và đầu ra

| Loại | Mô tả |
|---|---|
| Đầu vào | Shell 0.4, D-0008 Genesis, D-0011 hành trình ba bước, contract Feature 0.2–0.3 |
| Đầu ra | First-run state machine, UI ba bước, kế hoạch mẫu, tests và audit |
| Dữ liệu đọc | Safe shell summary cùng copy và fixture đã commit |
| Dữ liệu ghi | Chỉ React state trong bộ nhớ; source/test/docs trong repo |

## 6. Giả định

- Chỉ thị hiện tại của Product Owner đổi Feature 0.5 từ baseline bảo mật/phát
  hành thành prototype First-run journey; D-0016 ghi lại thay đổi này.
- Baseline bảo mật/phát hành vẫn bắt buộc trước khi qua Cổng 0; các phần chưa
  thuộc first-run tiếp tục ở đúng cổng và không được coi là hoàn thành nhờ shell 0.4.
- Reload chủ động xóa toàn bộ dữ liệu first-run vì chưa có storage contract.
- Danh sách model giả chỉ phục vụ usability; không đại diện mức hỗ trợ provider.
- Task draft là kết quả xác định cứng từ input người dùng, không phải output AI.

## 7. Trường hợp biên và hành vi khi lỗi

| Trường hợp | Hành vi mong đợi |
|---|---|
| Safe shell contract chưa sẵn sàng | Không cho rời bước 1; báo thử lại, không giả đã cài xong |
| Trường bắt buộc rỗng hoặc chỉ khoảng trắng | Giữ đúng bước, chỉ lỗi tại trường, không tạo hồ sơ |
| Unicode, emoji, dấu nháy đơn | Chấp nhận khi trong giới hạn |
| Tên/đầu việc quá dài | Từ chối tại client theo giới hạn công bố, không cắt âm thầm |
| Bấm nút tiếp tục hoặc tạo kế hoạch hai lần | Chỉ tạo một state/result, nút khóa sau lần hợp lệ |
| Reload/crash giữa chừng | Quay về bước 1; không có hồ sơ nửa vời hoặc `BOOTSTRAP.md` bị xóa |
| State/event sai thứ tự | Reducer giữ state cũ và trả lỗi fail-closed |
| Đổi ngôn ngữ/giao diện | Giữ nguyên bước và dữ liệu đang nhập trong bộ nhớ |
| Mất mạng | Không ảnh hưởng vì feature không có network; không đổi sang provider khác |

## 8. Quyền và dữ liệu

- Scope cần dùng: renderer local, read-only safe summary hiện có.
- Secret: không có.
- Network: CSP tiếp tục `connect-src 'none'`.
- Dữ liệu cá nhân: không dùng fixture thật; dữ liệu nhập chỉ sống trong bộ nhớ.
- Quyền nguy hiểm: không có; mọi tool, host exec, Browser và workspace vẫn khóa.

## 9. Quyết định có hệ quả

- D-0016 ghi Product Owner ưu tiên prototype hành trình ba bước ở Feature 0.5.
- Không đổi nguồn sự thật, data model, permission model, provider hạ tầng hoặc
  failure behavior của runtime.
- Persistence bị loại có chủ đích để tránh tự chọn cấu trúc lưu trữ trước cổng.

## 10. Tiêu chí nghiệm thu

- [x] Có đúng ba chặng người dùng nhận biết, progress và CTA rõ ràng.
- [x] Bước 1 chỉ qua khi safe shell contract sẵn sàng.
- [x] Bước 2 thu đủ trường Genesis đã chốt và gắn nhãn model mô phỏng.
- [x] Bước 3 hiển thị dữ liệu/quyền/ngân sách trước khi tạo task draft.
- [x] Hoàn tất không ghi file, không network, không credential và không model call.
- [x] Validation rỗng, Unicode, chuỗi dài, double submit, event sai và snapshot resume đạt.
- [x] Việt/Anh, sáng/tối, keyboard focus và viewport 1440×900/1024×768 đạt static/local QA; human usability vẫn chưa thực hiện.
- [x] Test, build, package, secret scan, dependency audit và governance đạt local.
- [x] Audit ghi security/privacy/blast radius cùng rollback.
- [x] Commit `fd8857d`, push và Draft PR #5; không merge, không public release.

## 11. Kế hoạch kiểm thử

- Unit: state transition, validation, idempotency và deterministic task draft.
- Contract: renderer vẫn chỉ dùng preload read-only, CSP không đổi, copy phải
  ghi rõ demo/internal và capability thật tiếp tục bị khóa.
- Integration: Vite build, Electron package, ASAR allowlist và smoke process.
- Manual/visual: kiểm tra layout màn đầu ở hai kích thước; transition ba bước,
  Việt/Anh và sáng/tối được kiểm bằng source/contract state. Human usability chưa chạy.
- Security/privacy: secret scan, dependency audit, xác nhận không storage/network.
- Recovery: reload trở về state sạch; revert commit và xóa output ignored.

## 12. Phạm vi ảnh hưởng

- Thành phần bị chạm: renderer, state machine, tests, validator, governance và docs.
- Có thể ảnh hưởng: bố cục shell 0.4 và thời gian verify; không chạm runtime/Gateway.
- Dữ liệu/migration: không có.

## 13. Rollback

Revert commit Feature 0.5 rồi xóa `dist`/`out` bị ignore. Không có dữ liệu người
dùng, migration, credential, process nền hoặc artifact phát hành cần phục hồi.

## 14. Bằng chứng hoàn thành

- Commit triển khai: `fd8857d`; commit bằng chứng CI theo sau trên cùng Draft PR.
- Test/QA: 47/47 test; governance, build/package/ASAR và dependency audit local
  đạt; ảnh 1440×900 và 1024×768 đạt sau sửa font tiếng Việt; CI Windows,
  macOS, Linux và governance/secret hygiene đều đạt.
- Reviewer: Codex self-review; senior platform/security review vẫn còn mở.
- Product Owner acceptance: chỉ thị ngày 2026-08-11; không bao gồm phép phát hành.
