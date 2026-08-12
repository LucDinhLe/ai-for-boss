# AI for Boss — Biên bản audit cuối trước build

Ngày audit: 2026-08-11  
Đối tượng: `AI-FOR-BOSS-BUILD-RULES.md` phiên bản 1.1  
SHA-256 bản được audit: `06C0E7458A1B0C0229175814FDDB556C9FC88C0617C9BF34E2ED852F2F4FA1CE`  
Kết luận: Đủ điều kiện bắt đầu Cổng 0, Feature 0.1. Chưa đủ điều kiện xử lý credential thật, pilot người dùng thật hoặc phát hành.

## 1. Phạm vi audit

Vòng audit kiểm tra:

1. Mâu thuẫn giữa yêu cầu kinh doanh, trải nghiệm và bảo mật.
2. Tuyên bố kỹ thuật so với tài liệu chính thức của OpenClaw và Electron.
3. Khả năng nhúng Gateway, protocol, process lifecycle và cập nhật.
4. Đường xác thực OpenAI, Anthropic, Google và provider khác.
5. Nguồn sự thật, secret storage, backup/restore và quyền dữ liệu.
6. Tính khả thi đa nền tảng cùng phát hiện thiết bị.
7. Sandbox, tool policy, browser và prompt injection.
8. Giấy phép, attribution và ranh giới học từ AICoworker/Hermes.
9. Tuân thủ `D:\BeMo\VIBECODING.md`.
10. Kích thước feature, thứ tự cổng và tiêu chí phát hành.

## 2. Ma trận truy vết yêu cầu

| Yêu cầu của Đại ca | Vị trí trong Rulebook | Trạng thái |
|---|---|---|
| App độc lập, người dùng không cài OpenClaw/Node/WSL | Luật 1, Luật 10 | Đã thành rule; cần Gate 1 chứng minh |
| Windows, macOS, Linux và đúng kiến trúc | Luật 2, Luật 3, Cổng 4 | Đã thành release matrix |
| Kế thừa sàn OpenClaw, không tự đặt cấu hình thấp/cao | Luật 3 | Đã khóa |
| Website nhận diện thiết bị và đưa đúng bản tải | Luật 2, Cổng 4 | Best-effort web; installer authoritative |
| Đầy đủ năng lực OpenClaw | Luật 4, Cổng 3 | Có parity contract; chưa kiểm kê phiên bản cụ thể |
| ChatGPT, Claude, Gemini và provider khác | Luật 4, auth-support matrix | Đã tách official/conditional/experimental |
| Khách tự trả model | Luật 5 | Đã khóa |
| Chọn model theo từng phiên | Luật 6 | Đã khóa; cần RPC contract test |
| Nhiều agent | Luật 8 | Đã khóa; OpenClaw là runtime source of truth |
| Advisor bật/tắt trong phiên, chọn model review | Luật 7 | Đã khóa cùng read-only enforcement |
| Giao diện Việt/Anh, đẹp và dễ dùng như chuẩn Hermes | Luật 9, Cổng 2 | Design target, không sao chép |
| Gateway vô hình, tự chạy và phục hồi | Luật 10, Cổng 1 | Kiến trúc đúng upstream; cần spike |
| Backup/restore như khả năng đã thấy ở AICoworker | Mục 8 | Đã tách pack sạch secret và recovery mã hóa |
| Cấu hình riêng cho nhiều học viên | Mục 4, Cổng 5 | Một installer, ba lớp pack |
| Quản trị cho chủ doanh nghiệp | Mục 3 | Chín nhóm tính năng đã định nghĩa |
| Bảo mật, quản trị và đạo đức | Mục 5–9 | Rule + gate + threat model |
| Ghi rõ Built on OpenClaw | Tuyên bố sản phẩm, Luật 12 | Đã khóa |
| Tuân thủ VIBECODING | Mục 9, Cổng 0–7 | Type C boundary đã giữ |

## 3. Verdict

### Được phép làm ngay

- Tạo repo private.
- Tạo `AGENTS.md`, Decision Log, Risk Register, Changelog và feature-spec template.
- Thiết lập quy tắc secret, branch, commit, test và môi trường.
- Không dùng credential, không spawn Gateway và không đụng dữ liệu thật trong Feature 0.1.

### Bị chặn cho tới khi qua cổng tương ứng

- OAuth thật ngoài tài khoản test chuyên dụng.
- Host exec, elevated và browser hành động nhạy cảm.
- Phát hành installer cho học viên.
- Thu telemetry hoặc upload support bundle.
- Remote Gateway/browser.
- Full backup portable.
- Beta công khai và khách hàng doanh nghiệp.

## 4. Các phát hiện và cách xử lý

| ID | Mức | Phát hiện trước sửa | Cách đã sửa trong Rulebook 1.1 | Trạng thái |
|---|---|---|---|---|
| F01 | Critical | Tài liệu ngầm hiểu mọi credential nằm trong OS key store | Tách static API key qua SecretRef và OAuth trong OpenClaw native auth store; cấm tuyên bố sai | Resolved by design |
| F02 | Critical | Hứa sandbox chặt trên mọi OS nhưng OpenClaw mặc định tắt sandbox; local backend cần Docker | Thêm Feature 0.6 sandbox ADR/spike; khóa host exec cho tới khi chứng minh | Gated blocker |
| F03 | High | Dùng `hello-ok.features.methods` như danh sách capability đầy đủ | Hợp nhất protocol schema, docs, runtime features, plugin exports và contract tests | Resolved |
| F04 | High | Câu chữ provider có thể bị hiểu thành tất cả đều OAuth | Thêm auth-support matrix; Gemini CLI OAuth là experimental; Anthropic API key là production default | Resolved |
| F05 | High | “Bundled OpenClaw” chưa ngăn flatten `dist` | Bắt buộc cài package đầy đủ trong `node_modules`, dùng Node thật và spawn executable | Resolved |
| F06 | High | Policy Engine có thể chỉ là UI hoặc prompt, chưa chứng minh cưỡng chế | Đổi thành Policy Compiler & Verifier; policy phải map vào OpenClaw/Supervisor/OS control thật | Resolved by architecture |
| F07 | High | Backup không secret mâu thuẫn với OpenClaw full backup vốn có thể chứa auth | Tách `.aifbp` sạch secret và `.aifb` luôn mã hóa; dùng backup/verify chính thức | Resolved by design |
| F08 | High | Feature 0.1 chứa repo, runtime pin, CI, manifest và app shell, vi phạm một feature mỗi phiên | Chia Cổng 0 thành Feature 0.1 đến 0.6 | Resolved |
| F09 | High | App chưa xác định nguồn sự thật, có nguy cơ copy session/token vào DB riêng | Thêm source-of-truth table; OpenClaw state chỉ truy cập qua RPC | Resolved |
| F10 | High | Protocol client và Gateway có thể lệch phiên bản | Khóa OpenClaw, public WebSocket RPC contract, protocol version/doc blob/source fingerprint, Node và lockfile cùng release train | Resolved; package assumption corrected by D-0013 |
| F11 | Medium | Cổng động có thể dẫn tới dùng `--force` và giết listener khác | Cấm `--force`; retry `EADDRINUSE` có giới hạn; không giết process lạ | Resolved |
| F12 | Medium | Electron có thể bị dùng như Node khi spawn OpenClaw | Bắt buộc Node binary thật và `OPENCLAW_EXEC_SHELL_SNAPSHOT=0` | Resolved |
| F13 | Medium | Child process có nguy cơ treo vì stdout/stderr đầy | Bắt buộc tiêu thụ stream ngay khi spawn và test backpressure | Resolved |
| F14 | Medium | Reconnect có thể mất run state hoặc approval | Bắt buộc resubscribe, history projection, in-flight adoption và approval backfill | Resolved |
| F15 | Medium | “Sàn OpenClaw” không xử lý trường hợp upstream không công bố RAM/disk | Tách hard floor và verified matrix; disk được tính từ artifact thật | Resolved |
| F16 | Medium | Website “scan thiết bị” có thể tạo hiểu nhầm về quyền riêng tư và độ chính xác | Website chỉ đề xuất; installer local xác minh; user-agent không là bằng chứng | Resolved |
| F17 | Medium | Type C technical spike có thể dùng tài khoản thật của Đại ca | Chỉ cho tài khoản test chuyên dụng, quyền tối thiểu và giới hạn chi phí | Resolved |
| F18 | Medium | Security claim có nguy cơ tuyệt đối hóa | Cấm dùng “an toàn tuyệt đối”; ghi rõ threat model và out-of-scope | Resolved |
| F19 | Medium | “MIT” có thể bị hiểu là có quyền dùng nhãn hiệu/endorsement | Tách quyền phần mềm và trademark; legal review trước beta | Resolved |
| F20 | Medium | Các quyết định còn mở khiến “plan cuối” mang giả định ẩn | Thêm Decision Register có owner, deadline gate và safe default | Resolved |
| F21 | Low | Chỉ số 90% trong năm phút chưa có Product Owner approval rõ | Đổi thành chỉ số đề xuất, chốt trong Pilot Charter | Resolved |
| F22 | Low | Diagnostics redaction có thể bị tin là hoàn hảo | Bắt buộc xem support bundle là secret và review trước chia sẻ | Resolved |

## 5. Bốn blocker kỹ thuật phải đóng trước khi có người dùng thật

### B1. Sandbox đa nền tảng

Phải chọn và chứng minh một đường cho mỗi nền tảng công bố:

- Runtime container local do app quản lý.
- Sandbox từ xa có điều khoản và tuyến dữ liệu rõ.
- Cơ chế native theo OS có bằng chứng cô lập tương đương cho phạm vi được phép.

Nếu chưa đạt, host exec, elevated, sửa ngoài workspace và browser nhạy cảm tiếp tục bị khóa.

### B2. Credential Broker

Contract test phải chứng minh static SecretRef đi từ OS key store tới OpenClaw mà không xuất hiện trong renderer, CLI args, environment dump, file plaintext, log hoặc support bundle.

OAuth tiếp tục dùng OpenClaw auth store native cùng ACL và full-disk encryption. Việc chuyển OAuth sang OS keychain cần upstream support hoặc audited maintained patch.

### B3. Provider terms và live auth

Mỗi provider phải có bản ghi auth-support theo đúng version:

- Nguồn điều khoản và ngày kiểm tra.
- Auth mode.
- Support level.
- Platform coverage.
- Callback/device-code behavior.
- Revoke behavior.
- Live probe và failure behavior.

Gemini CLI OAuth chưa được phép mang nhãn production khi OpenClaw còn cảnh báo đây là integration không chính thức.

### B4. Người chịu trách nhiệm ngoài AI

Trước pilot có credential hoặc dữ liệu thật phải có:

- Kỹ sư chịu trách nhiệm kỹ thuật bằng tên.
- Security reviewer.
- Owner xử lý incident.
- Code-signing identity.
- Manual fallback và rollback drill.

## 6. Các quyết định được phép hoãn

Các quyết định sau không chặn Feature 0.1:

- Mô hình giấy phép AI for Boss.
- Giá và cơ chế kích hoạt.
- Control-plane provider.
- Remote access.
- Recovery-key UX.
- OS matrix được quảng cáo.

Chúng đã có safe default và deadline gate trong Rulebook. Không được để quá hạn cổng.

## 7. Checklist dành cho Claude Code

Claude Code có thể audit lại bằng các câu hỏi sau:

1. Có tuyên bố upstream nào không kèm nguồn hoặc version không?
2. Có chỗ nào dùng `hello-ok.features.methods` như full API inventory không?
3. Gateway client/protocol có được pin cùng release train không?
4. Có code nào đọc/sửa trực tiếp OpenClaw state, SQLite hoặc transcript file không?
5. OpenClaw có được cài đầy đủ trong `node_modules` không?
6. Child có dùng Node thật thay vì Electron `process.execPath` không?
7. Child stdout/stderr có consumer ngay khi spawn không?
8. Có dùng `--force` hoặc kill process theo port không?
9. Retry `EADDRINUSE` có giới hạn và có test không?
10. Readiness có kiểm tra protocol, scope, health và `models.list` không?
11. Reconnect có dựng lại subscription, history, in-flight run và approvals không?
12. Renderer có thể lấy Gateway/shared token hoặc operator.admin không?
13. Effective policy có được runtime cưỡng chế hay chỉ hiện trên UI?
14. Capability thiếu sandbox có bị khóa không?
15. Sandbox backend có bằng chứng chạy trên từng OS được quảng cáo không?
16. Static secret có rơi vào args, env dump, file hoặc log không?
17. OAuth token có bị copy sang DB của AI for Boss không?
18. Provider auth label có đúng điều khoản hiện hành không?
19. Backup có copy live SQLite/WAL/SHM không?
20. `.aifb` có luôn mã hóa và restore staging không?
21. Support bundle có được review trước upload không?
22. Website có hứa sai về OS/architecture từ user-agent không?
23. Artifact có signature, checksum, SBOM và license notice không?
24. Có quyết định `DEFERRED` nào đã quá cổng không?
25. Feature hiện tại có đúng một biên thay đổi và rollback được không?

Nếu Claude tìm được một câu trả lời “có” ở nhóm rủi ro hoặc “không” ở nhóm kiểm soát, feature chưa được merge.

## 8. Bằng chứng upstream chính

- [Embedding OpenClaw](https://docs.openclaw.ai/gateway/embedding): supervise child, dùng Node thật, không flatten, không đọc state file.
- [Gateway Protocol](https://docs.openclaw.ai/gateway/protocol): `hello-ok`, version/scopes, `models.list`, conservative discovery list.
- [Building a Gateway Client](https://docs.openclaw.ai/gateway/clients): device identity, scopes, reconnect và approval backfill.
- [OpenClaw OAuth](https://docs.openclaw.ai/oauth): PKCE, auth store, multi-profile và per-session override.
- [OpenClaw Authentication](https://docs.openclaw.ai/auth-monitoring): OAuth-mode profile không hỗ trợ SecretRef.
- [Google/Gemini Provider](https://docs.openclaw.ai/providers/google): API key là đường chính; Gemini CLI OAuth có cảnh báo unofficial.
- [OpenClaw Security](https://docs.openclaw.ai/security): một trusted operator boundary trên mỗi Gateway.
- [OpenClaw Sandboxing](https://docs.openclaw.ai/sandboxing): sandbox optional, Docker/SSH/OpenShell backends và escape hatch.
- [OpenClaw Backup](https://docs.openclaw.ai/cli/backup): verified backup và cảnh báo dữ liệu nhạy cảm.
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security): sandbox, context isolation, CSP và sender validation.
- [OpenClaw MIT License](https://github.com/openclaw/openclaw/blob/main/LICENSE): quyền phân phối cùng nghĩa vụ giữ notice.

## 9. Kết luận cuối

Rulebook 1.1 đủ chặt để bắt đầu phần quản trị repo. Nó chưa giả vờ rằng sandbox, OAuth mọi provider, keychain toàn bộ credential hoặc cross-platform release đã được giải quyết.

Điểm mạnh của kế hoạch sau audit là mọi lời hứa khó đều đã chuyển thành contract test, release gate hoặc quyết định có owner. Claude Code có thể phản biện tiếp trên cùng một mặt phẳng bằng chứng, không phải đoán ý sản phẩm.
