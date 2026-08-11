# AI for Boss — Bộ quy tắc và kế hoạch build cuối cùng

Ngày chốt: 2026-08-11  
Chủ sản phẩm: Lê Đình Lực  
Phiên bản tài liệu: 1.1 sau audit độc lập  
Trạng thái: Nguồn quyết định duy nhất trước khi build

## 0. Hiệu lực

Đây là nguồn sự thật duy nhất cho thiết kế, build, kiểm thử và phát hành AI for Boss. Nếu tài liệu cũ có điểm khác, tài liệu này được ưu tiên. Tài liệu cũ chỉ còn là hồ sơ nghiên cứu.

Mọi thay đổi về luật nghiệp vụ, dữ liệu, quyền, hạ tầng, hành vi khi lỗi, cấp phép hoặc phạm vi phát hành phải được Đại ca phê duyệt và ghi vào Decision Log trước khi code.

Các nhãn dùng trong Decision Log:

- `VERIFIED_UPSTREAM`: đã đối chiếu tài liệu hoặc mã nguồn chính thức của phiên bản OpenClaw được khóa.
- `PRODUCT_DECISION`: luật sản phẩm do Đại ca quyết định.
- `GATED_HYPOTHESIS`: phương án kỹ thuật phải được spike và kiểm thử trước khi chấp nhận.
- `DEFERRED`: quyết định có owner và cổng phải chốt, chưa được dùng như sự thật.

Không dùng từ “an toàn tuyệt đối” trong tài liệu kỹ thuật hoặc quảng cáo. Mọi cam kết bảo mật phải gắn với threat model, biên tin cậy, phiên bản và bằng chứng kiểm thử.

## 1. Tuyên bố sản phẩm

**AI for Boss là phần mềm AI coworker độc lập dành cho chủ doanh nghiệp, được xây dựng trên OpenClaw. Người dùng cài một lần, kết nối tài khoản mô hình của họ và giao việc; không phải tự cài hay vận hành OpenClaw, Gateway, Node, WSL, Git hoặc package manager.**

Thông điệp phát hành bắt buộc:

> **AI for Boss — Built on OpenClaw**

Lợi thế cốt lõi:

1. Đơn giản cho người phổ thông.
2. Đẹp, yên và trực quan theo chuẩn chất lượng trải nghiệm của Hermes.
3. Giữ đầy đủ năng lực tương thích của OpenClaw.
4. Có Advisor kiểm tra công việc ngay trong từng phiên.
5. Có quản trị quyền, phê duyệt, chi phí, dữ liệu và nhật ký dành cho chủ doanh nghiệp.
6. Triển khai cho lớp học và doanh nghiệp bằng cấu hình, không tạo một app riêng cho từng người.
7. An toàn theo kiến trúc, không dựa vào lời nhắc model tự kiềm chế.

## 2. Mười hai luật bất khả nhượng

### Luật 1. Một bộ cài hoàn chỉnh

Mỗi gói phát hành mang theo phiên bản OpenClaw, Node runtime, Supervisor, migration, recovery và dependency đã khóa. Máy khách không tải package kỹ thuật trong lần mở đầu.

AI for Boss dùng profile, tiến trình, cổng, credential và thư mục dữ liệu riêng. Cài, gỡ hoặc cập nhật một bản OpenClaw độc lập trên máy không ảnh hưởng AI for Boss.

### Luật 2. Đa nền tảng theo ma trận phát hành

Sản phẩm phục vụ máy tính để bàn và laptop chạy Windows, macOS hoặc Linux trên các kiến trúc được bản OpenClaw và desktop shell đã khóa hỗ trợ.

Mỗi hệ điều hành và kiến trúc có artifact riêng:

- Windows x64 và ARM64 khi toàn bộ dependency của bản khóa hỗ trợ.
- macOS Apple Silicon và Intel khi toàn bộ dependency của bản khóa hỗ trợ.
- Linux x64 và ARM64 trên các bản phân phối đã được kiểm thử.

Website nhận diện sơ bộ hệ điều hành và kiến trúc để đề xuất đúng bản tải. Danh sách tải thủ công luôn hiện rõ. Bộ cài mới là nơi xác minh cuối cùng.

Không dùng câu quảng cáo “chạy trên mọi thiết bị”. Câu được phép dùng là “hỗ trợ Windows, macOS và Linux theo ma trận của từng bản phát hành”.

### Luật 3. Kế thừa sàn cấu hình của OpenClaw

AI for Boss không tự đặt mức RAM, CPU, GPU hoặc dung lượng tối thiểu thấp hơn hay cao hơn OpenClaw trong bản đầu.

Khả năng cài đặt của mỗi bản được xác định như sau:

```text
Yêu cầu của OpenClaw đã khóa phiên bản
∩ Yêu cầu của desktop shell đã khóa phiên bản
∩ Khả năng của dependency native được đóng gói
= Ma trận tương thích của bản AI for Boss
```

Node được nhúng sẵn theo nhánh OpenClaw hỗ trợ. Người dùng không cần có Node trên máy. Yêu cầu của local model, voice hoặc plugin đặc thù được công bố riêng theo chính thành phần đó; chúng không biến cloud mode thành không tương thích.

Nếu OpenClaw không công bố một ngưỡng phần cứng, AI for Boss cũng không được tự biến một con số ước đoán thành điều kiện chặn cài đặt. Bản phát hành dùng hai lớp thông tin:

- **Điều kiện cứng:** các yêu cầu được upstream hoặc dependency đã khóa công bố, cộng đủ dung lượng thực tế để ghi artifact, dữ liệu tạm và một bản rollback. Số byte dung lượng được tính từ chính artifact của bản phát hành.
- **Mức đã kiểm chứng:** cấu hình đã chạy qua test matrix. Đây là bằng chứng hỗ trợ và khuyến nghị, không âm thầm trở thành một sàn mới.

Mỗi bản phát hành phải có `runtime-manifest` ghi rõ:

- Phiên bản AI for Boss, OpenClaw, Node và desktop shell.
- Hệ điều hành và kiến trúc được hỗ trợ.
- Điều kiện tối thiểu kế thừa từ các thành phần đã khóa.
- Hash, chữ ký và nguồn gốc của từng artifact.
- Capability khả dụng cùng hạn chế đã biết.
- Trạng thái `supported`, `verified-limited`, `experimental` hoặc `unsupported` của từng tổ hợp hệ điều hành và kiến trúc.

Không có chế độ “máy yếu” hay tự giảm tính năng trong bản đầu. Tối ưu dung lượng và hiệu năng chỉ được làm sau khi có số đo, không được cắt capability OpenClaw.

### Luật 4. Đầy đủ năng lực OpenClaw

Mọi capability tương thích của bản OpenClaw nhúng phải được kiểm kê và gán một trạng thái:

1. Hiện trong chế độ Cơ bản.
2. Hiện trong chế độ Nâng cao.
3. Chưa khả dụng trên hệ điều hành này, kèm lý do và kế hoạch xử lý.

Phạm vi capability gồm:

- Provider và model.
- OAuth, API key, endpoint riêng và model cục bộ theo phương thức provider cho phép.
- Phiên, memory, workspace và artifact.
- Agent, sub-agent và workflow.
- Tool, skill, plugin và MCP.
- Browser automation và file operations trong sandbox.
- Channel, schedule, heartbeat và notification.
- Node, diagnostics, backup, restore và cập nhật.
- Permission, approval, audit cùng các khả năng khác trong capability catalog.

`hello-ok.features.methods` chỉ là danh sách khám phá bảo thủ và cố ý không liệt kê mọi RPC. Capability inventory bắt buộc được hợp nhất từ:

1. `protocol.schema.json` và các gói `@openclaw/gateway-protocol`, `@openclaw/gateway-client` cùng release train.
2. Tài liệu RPC, provider, plugin và channel của đúng phiên bản đã khóa.
3. `hello-ok.features.methods/events` ở runtime thực tế.
4. Plugin/channel exports đã nạp.
5. Contract test và smoke test trên từng nền tảng.

Một capability chỉ được ghi “được hỗ trợ” khi có đường gọi công khai, quyền cần thiết, trạng thái giao diện, test thành công và failure behavior. Không đọc hoặc sửa SQLite, transcript, cache hay file nội bộ của OpenClaw để bù cho RPC còn thiếu.

### Ma trận xác thực provider

| Provider | Đường production mặc định | Đường có điều kiện | Luật hiển thị |
|---|---|---|---|
| OpenAI/ChatGPT | OpenAI API key hoặc ChatGPT/Codex OAuth do OpenClaw hỗ trợ | Device-code khi callback cục bộ không phù hợp | Chỉ ghi OAuth sau live test với phiên bản khóa |
| Anthropic/Claude | Anthropic API key | Tái sử dụng Claude CLI/subscription khi điều khoản và OpenClaw còn cho phép | API key mang nhãn Khuyến nghị; CLI mang nhãn Có điều kiện |
| Google/Gemini | Gemini API key | Gemini CLI OAuth hiện là tích hợp không chính thức của OpenClaw | OAuth mang nhãn Thử nghiệm và cảnh báo nguy cơ hạn chế tài khoản |
| Provider khác | Phương thức production được provider và OpenClaw công bố | Plugin-owned flow đã qua provenance review | Không suy diễn OAuth từ việc provider có trang đăng nhập |

Mỗi connector có bản ghi `auth-support` gồm auth mode, mức hỗ trợ, điều khoản đã kiểm tra ngày nào, nền tảng đã test, revoke flow, live probe và link nguồn. Connector bị hạ cấp hoặc tắt nếu điều khoản provider thay đổi.

### Luật 5. Người dùng tự trả chi phí mô hình

Khách hàng tự sở hữu và thanh toán tài khoản model/provider. AI for Boss bán phần mềm và lớp quản trị.

Trong phiên bản đầu:

- Happy Training không giữ tập trung API key, OAuth token, cookie hoặc mật khẩu của khách.
- AI for Boss không bán kèm quota mô hình.
- API key tĩnh ưu tiên SecretRef do Credential Broker lấy từ kho bí mật của hệ điều hành.
- OAuth token đi theo kho auth native của OpenClaw vì OAuth-mode hiện không hỗ trợ SecretRef. Kho này phải nằm trong profile riêng, có ACL chỉ chủ tài khoản, tránh thư mục đồng bộ cloud và dựa trên mã hóa toàn đĩa của hệ điều hành khi có.
- Gỡ kết nối phải thu hồi và xóa credential tương ứng, đồng thời ghi audit không chứa bí mật.

Không tuyên bố mọi credential đều nằm trong Keychain/Credential Manager khi OpenClaw còn lưu OAuth trong auth store native. Muốn chuyển OAuth hoàn toàn vào OS key store cần hỗ trợ upstream hoặc một bản vá được audit, có owner bảo trì và cổng nâng cấp riêng.

### Luật 6. Model được chọn theo từng phiên

Mỗi phiên làm việc cho phép:

- Chọn model làm việc.
- Đổi model có xác nhận về ngữ cảnh, chi phí và ảnh hưởng.
- Đặt ngân sách token, thời gian và tool call.
- Lưu lựa chọn riêng của phiên, không ép toàn bộ app dùng một model.

### Luật 7. Advisor nằm trong phiên

Advisor là lớp kiểm tra tùy chọn của từng phiên. Người dùng có thể:

- Bật hoặc tắt Advisor bất cứ lúc nào.
- Chọn một hoặc nhiều model đã kết nối làm Advisor.
- Chọn rubric, số vòng review, phạm vi kiểm tra và ngân sách.
- Dùng model tiết kiệm làm việc ban đầu rồi dùng model mạnh hơn để bắt lỗi, kiểm chứng và cảnh báo rủi ro.

Advisor mặc định chỉ đọc và bình luận. Advisor không nhận thêm quyền so với worker, không tự thực thi sửa đổi và không được âm thầm biến output chưa đạt thành “đã duyệt”.

Advisor chạy bằng một session/agent review riêng với mutating tool, memory write, message send, exec và browser action bị deny. Nó chỉ nhận gói tối thiểu gồm yêu cầu, output cần kiểm, bằng chứng đã chọn, rubric và giới hạn chi phí. Output của worker được đánh dấu là dữ liệu không tin cậy, không được biến thành instruction của Advisor. Mọi thao tác sửa sau review là một task mới cần quyền riêng.

Kết quả review tối thiểu có cấu trúc:

```text
pass
issues
severity
evidence
recommended_fix
confidence
```

Schema output phải được validate. Parse lỗi, thiếu evidence hoặc Advisor hết ngân sách giữ trạng thái `unreviewed`; không tự coi là pass.

### Luật 8. Nhiều agent, trách nhiệm rõ ràng

Người dùng được tạo, sửa, nhân bản và lưu nhiều agent. Mỗi agent có vai trò, mục tiêu, model mặc định, workspace, tool, domain, ngân sách, cổng duyệt, nguồn template, version và người chịu trách nhiệm.

Model của từng phiên được phép ghi đè model mặc định. Output của agent khác vẫn là dữ liệu cần kiểm tra, không tự trở thành nguồn đáng tin cậy.

#### Nghi thức khai sinh Agent

Lần cài đầu tạo Agent chính và mỗi lần người dùng tạo Agent mới đều phải giữ nghi thức bootstrapping tương thích với release train OpenClaw đã khóa:

1. Tạo workspace và `agentDir` riêng cho Agent bằng contract chính thức.
2. Seed đúng bộ file của phiên bản đã khóa: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md` và `BOOTSTRAP.md`.
3. Lượt tương tác thật đầu tiên hỏi ngắn gọn về tên, vai trò hoặc bản chất, giọng điệu, emoji/avatar, cách xưng hô với người dùng, ưu tiên và ranh giới. Không biến nghi thức thành biểu mẫu kỹ thuật dài.
4. Ghi kết quả vào `IDENTITY.md`, `USER.md` và `SOUL.md`, rồi đồng bộ phần danh tính hiển thị qua RPC/CLI chính thức của OpenClaw, không sửa state nội bộ.
5. Chỉ xóa `BOOTSTRAP.md` sau khi ghi staging, kiểm tra schema/nội dung, đọc lại, đồng bộ danh tính và health check đều đạt. Nếu app hoặc Gateway dừng giữa chừng, giữ `BOOTSTRAP.md` và tiếp tục idempotent ở lần mở sau.
6. Không tạo `memory/` trước khi bootstrap hoàn tất vì OpenClaw có thể coi workspace đã được cấu hình và bỏ qua nghi thức. Sau khi hoàn tất mới khởi tạo daily memory hoặc `MEMORY.md` khi thực sự cần.
7. `HEARTBEAT.md` mặc định để trống hoặc chỉ có comment; người dùng chủ động bật công việc nền sau khi hiểu chi phí và quyền.

Xóa `BOOTSTRAP.md` chỉ kết thúc nghi thức trong workspace đang hoạt động. Chức năng **Khai sinh lại Agent** phải là hành động riêng có xác nhận, snapshot và khả năng quay lui; app không được tự tái tạo `BOOTSTRAP.md` sau restart thông thường.

#### Agent Home và Không gian dự án

AI for Boss phải phân biệt rõ hai khái niệm trong dữ liệu và giao diện:

- **Agent Home:** workspace OpenClaw riêng chứa danh tính, quy tắc, memory và file bootstrap của đúng một Agent. `agentDir`, session store và auth profile của mỗi Agent cũng phải riêng, không dùng chung với Agent khác.
- **Không gian dự án:** thư mục doanh nghiệp do người dùng chọn, ví dụ `D:\Happy Training`, chứa tài liệu và artifact công việc. Đây không mặc nhiên là Agent Home.

Nhiều Agent chỉ được cùng đọc hoặc ghi một Không gian dự án khi người dùng cấp quyền rõ ràng theo `none`, `read-only` hoặc `read-write`. Việc cấp quyền phải đi qua workspace/sandbox contract đã kiểm thử; không dùng symlink, hardlink hoặc đường dẫn tuyệt đối để lách biên. Không đặt nhiều bộ `IDENTITY.md`, `SOUL.md`, `USER.md` hoặc memory vào cùng một workspace OpenClaw.

Tên hiển thị ở panel trái phải dùng nhãn **Dự án** hoặc **Không gian dự án**. Đường dẫn thật, quyền hiện hành và Agent đang được cấp quyền phải xem được trong thông tin dự án. Agent Home chỉ xuất hiện trong Chẩn đoán nâng cao để người dùng phổ thông không phải thao tác file hệ thống.

Không được lưu API key, OAuth token, cookie, mật khẩu hoặc Gateway credential trong file Markdown thuộc Agent Home hay Không gian dự án.

### Luật 9. Hai tầng giao diện, một bộ năng lực

Chế độ Cơ bản dùng ngôn ngữ phổ thông:

- AI Engine.
- Kết nối.
- Model làm việc.
- Advisor.
- Dữ liệu & Phục hồi.
- Sức khỏe hệ thống.

Gateway, port, PID, token, WebSocket và log thô chỉ xuất hiện trong Chẩn đoán nâng cao. Chế độ Nâng cao mở đầy đủ capability tương thích, không biến app thành wrapper dòng lệnh.

Giao diện bắt buộc có tiếng Việt và tiếng Anh, sáng/tối, hỗ trợ bàn phím và accessibility, session-centric layout, artifact preview, file browser, model picker cùng Approval Inbox. Học tinh thần thiết kế của Hermes; không sao chép tên, mã, asset hoặc trade dress.

### Luật 10. Gateway là hạ tầng vô hình

AI for Boss Supervisor là thành phần duy nhất quản lý OpenClaw Gateway:

- Chạy một bản cài OpenClaw đầy đủ trong `node_modules` cùng Node thật do app quản lý; không flatten `dist`, không vendor vài file rời và không dùng Electron binary thay Node.
- Dùng đúng `@openclaw/gateway-client` và `@openclaw/gateway-protocol` của cùng release train với Gateway.
- Dùng loopback cùng một cổng trống do Supervisor chọn; nếu gặp `EADDRINUSE` thì chọn cổng khác và thử lại có giới hạn.
- Windows dùng named pipe cho IPC nội bộ.
- macOS và Linux dùng Unix domain socket chỉ chủ tài khoản được truy cập.
- Renderer không biết Gateway token hoặc cổng.
- Chỉ báo `Sẵn sàng` sau khi hoàn thành `hello-ok`, xác minh protocol/version/scopes, gọi health và kiểm tra `models.list`.
- Tự khởi động lại khi crash.
- Sau ba lần lỗi liên tiếp chuyển Safe Mode, giữ checkpoint và đưa hướng dẫn rõ ràng.
- Update lỗi phải rollback về bundle đã xác minh.
- Không dùng `--force`, không giết tiến trình lạ và không dùng nhầm Gateway của app khác.
- Tắt Bonjour khi app sở hữu discovery; đặt `OPENCLAW_NO_RESPAWN=1` để Supervisor giữ quyền sở hữu tiến trình.
- Đặt `OPENCLAW_EXEC_SHELL_SNAPSHOT=0` cho Gateway child để tránh Electron bị gọi như Node.
- Dùng exit code và error code có cấu trúc, gồm `EX_CONFIG=78`, thay cho việc phân tích câu chữ trong stderr.
- Tiêu thụ stdout/stderr ngay khi spawn để child không bị treo vì đầy pipe.
- Không bật `OPENCLAW_SKIP_CHANNELS=1` ở bản đầy đủ; cờ này chỉ được dùng trong spike tối thiểu hoặc chẩn đoán có ghi nhận.

OAuth phải quay lại app và được runtime commit tự động. Người dùng không được yêu cầu sao chép callback localhost, authorization code, token hoặc lệnh terminal.

### Luật 11. Dữ liệu local-first và quyền tối thiểu

Mặc định, prompt, file, output, memory và secret ở trên máy người dùng, trừ phần người dùng chủ động gửi tới provider hoặc connector đã chọn.

Mỗi phiên phải hiển thị được model nào nhận dữ liệu, dữ liệu nào rời thiết bị, tool nào có thể chạy, hành động nào cần duyệt và chi phí đã dùng. Telemetry tắt mặc định. Support bundle, log và crash report phải làm sạch secret cùng dữ liệu cá nhân trước khi xuất.

### Luật 12. Xây độc lập, ghi nguồn minh bạch

AI for Boss dùng OpenClaw và thành phần có giấy phép cho phép phân phối. Mọi bản phát hành chứa license, copyright notice, third-party notice và SBOM phù hợp.

OpenClaw hiện dùng giấy phép MIT, cho phép sử dụng, sửa đổi và phân phối khi giữ thông báo bản quyền cùng giấy phép. Quyền phần mềm không tự động tạo quyền dùng nhãn hiệu hoặc hàm ý được OpenClaw Foundation chứng nhận. Trademark review là điều kiện trước beta công khai.

AICoworker và Hermes chỉ được dùng để nghiên cứu hành vi, luồng trải nghiệm và khoảng trống thị trường. Không dùng mã, asset, thương hiệu hoặc thành phần có giấy phép cấm tạo sản phẩm cạnh tranh.

## 3. Bộ tính năng dành cho chủ doanh nghiệp

Bản thương mại phải có:

1. **Bảng điều hành:** việc đang chạy, việc chờ duyệt, rủi ro, chi phí, lỗi và kết quả quan trọng.
2. **Giao việc có hợp đồng:** mục tiêu, đầu ra, dữ liệu, model, agent, deadline, ngân sách và tiêu chí hoàn thành.
3. **Approval Inbox:** gom hành động cần duyệt, nêu rõ việc sắp xảy ra và khả năng hoàn tác.
4. **Advisor trong phiên:** review theo rubric, bằng chứng và mức nghiêm trọng.
5. **Nhật ký trách nhiệm:** ai yêu cầu, agent nào làm, model nào dùng, tool nào chạy, ai duyệt và kết quả gì.
6. **Chi phí & giới hạn:** ngân sách theo phiên, agent, ngày hoặc workspace; cảnh báo denial-of-wallet.
7. **Bản tin điều hành:** tóm tắt ngày/tuần từ dữ liệu người dùng đã cấp quyền.
8. **Nút dừng khẩn cấp:** dừng task, connector, schedule hoặc toàn bộ AI Engine mà không làm hỏng dữ liệu.
9. **Gói vai trò và quy trình:** mẫu cho chủ doanh nghiệp dịch vụ, trainer/coach/consultant, marketing, bán hàng, nhân sự và vận hành.

## 4. Cá nhân hóa lớp học và triển khai nhiều người

Mọi học viên dùng một installer chuẩn đã ký. Cá nhân hóa nằm trong dữ liệu cấu hình:

```text
Gói khóa học
+ Gói vai trò hoặc ngành
+ Lớp cấu hình cá nhân
= Môi trường AI for Boss của từng người
```

Gói cấu hình không chứa secret. Học viên tự kết nối model trên máy của họ.

Dashboard lớp học mặc định chỉ thấy trạng thái nhận lời mời, bản app/gói, preflight, trạng thái kết nối tối thiểu, tiến độ smoke test/bài tập và lỗi kỹ thuật đã làm sạch bí mật.

Giảng viên không mặc nhiên thấy prompt, file, output, cookie, browser history, token hoặc dữ liệu doanh nghiệp thật. Bài nộp chỉ được gửi khi học viên chủ động chọn artifact.

OpenClaw dùng mô hình một trusted operator. Vì vậy:

- Mỗi người dùng hoặc nhóm thực sự cùng biên tin cậy có OS account, runtime, Gateway, browser profile và credential riêng.
- Không đặt nhiều khách hàng vào cùng một Gateway.
- Không dùng session ID làm lớp phân quyền multi-tenant.
- Control plane tương lai chỉ giữ identity, license, signed policy, version, health và audit metadata được duyệt; không giữ prompt, file, output hoặc secret theo mặc định.

## 5. Kiến trúc chuẩn

```text
AI for Boss Desktop
  ├── Giao diện Electron/React được sandbox
  ├── Electron Main với IPC allowlist
  └── AI for Boss Supervisor
        ├── Policy Compiler & Verifier
        ├── Credential Broker cho static SecretRef
        ├── Gateway Lifecycle & Recovery
        ├── Audit Ledger
        ├── Backup, Migration & Rollback
        ├── Update Verifier
        └── OpenClaw Gateway riêng, loopback, cổng động
              ├── Worker và Advisor
              ├── Tool trong sandbox
              ├── Browser profile riêng
              └── Workspace được cấp quyền

Control Plane tùy chọn trong tương lai
  ├── Identity, license và enrollment
  ├── Signed policy và connector allowlist
  ├── Version rollout và health metadata
  └── Audit metadata theo policy
```

Electron/React là lựa chọn bản đầu vì tương thích với hệ Node/TypeScript của OpenClaw và thuận lợi cho Windows, macOS, Linux. Quyết định này đi cùng các điều kiện bắt buộc về sandbox, IPC, ký mã và cập nhật.

### Nguồn sự thật

| Dữ liệu | Nguồn sự thật | AI for Boss được làm gì |
|---|---|---|
| Session, transcript, agent runtime, model status, usage và OpenClaw audit | OpenClaw qua Gateway RPC | Giữ projection/cache có thể dựng lại; không sửa state file |
| Product policy, rubric Advisor, gói khóa học, giao diện và approval metadata riêng | Kho dữ liệu AI for Boss có version | Ghi qua transaction và migration có rollback |
| Static API key do AI for Boss quản lý | OS key store qua SecretRef broker | Chỉ trả secret cho đúng runtime; UI chỉ thấy trạng thái |
| OAuth token | OpenClaw native auth store của profile riêng | Khởi tạo, revoke và kiểm tra qua luồng OpenClaw; không copy sang DB khác |
| License, enrollment và signed policy tương lai | Control plane | Chỉ giữ metadata đã định nghĩa; không giữ nội dung người dùng mặc định |

Không duy trì hai bản dữ liệu có quyền ngang nhau. Cache mất phải dựng lại được từ nguồn sự thật.

### Cưỡng chế policy

Policy của AI for Boss phải được biên dịch thành control thật của OpenClaw, Supervisor hoặc sandbox hệ điều hành. Giao diện chỉ phản ánh effective policy và không được coi là lớp bảo vệ.

- Quyền tool, exec, network, workspace và approval ưu tiên dùng config, scope, sandbox và approval contract chính thức của OpenClaw.
- Supervisor cưỡng chế vòng đời, IPC, profile, network boundary và artifact integrity.
- Approval Inbox dùng `operator.approvals`, lắng nghe event ngay sau `hello-ok` và backfill danh sách approval để không mất yêu cầu khi reconnect.
- Tác vụ cấu hình cần `operator.admin` dùng một đường đặc quyền riêng, không cấp scope này thường trực cho renderer hoặc client làm việc hằng ngày.
- Capability nào chưa có control cưỡng chế phù hợp phải bị vô hiệu hóa hoặc cô lập; prompt không được dùng thay policy.

### Cổng khả thi của sandbox

OpenClaw tắt sandbox mặc định. Backend cục bộ mặc định cần Docker; backend OpenShell cần plugin, CLI, tài khoản và môi trường từ xa. Vì vậy “sandbox đầy đủ, không cần người dùng cài thêm gì trên mọi hệ điều hành” là `GATED_HYPOTHESIS`, chưa phải sự thật đã chứng minh.

Trước khi mở tool có khả năng chạy lệnh hoặc sửa máy, Feature 0.6 phải so sánh và spike ba đường:

1. Container runtime do AI for Boss quản lý trên máy, gồm chi phí dung lượng, quyền admin, license và cập nhật.
2. Sandbox từ xa như OpenShell, gồm tài khoản, chi phí, tuyến dữ liệu và mất kết nối.
3. Cơ chế native bị giới hạn theo từng OS, gồm mức cô lập thật và phần không thể bảo vệ.

Luật tạm thời cho tới khi Đại ca chốt:

- Chế độ Cơ bản không cho host exec, elevated, sửa ngoài workspace hoặc browser hành động nhạy cảm.
- Workspace bắt đầu ở `none` hoặc `ro`; tool allowlist tối thiểu và `deny` luôn thắng.
- Capability cần isolation nhưng chưa có backend đạt bị ghi `experimental` hoặc `unsupported`, không âm thầm chạy thẳng trên host.
- Full-feature beta bị chặn nếu chưa có ít nhất một đường sandbox đạt cho từng nền tảng được quảng cáo.

## 6. Hiến pháp bảo mật và đạo đức

### Biên bảo vệ

Threat model phải chứng minh khả năng chống nội dung độc hại, prompt injection, renderer bị khai thác, process lạ không đặc quyền, network peer và người dùng khác trên máy không có quyền vào profile.

Các tình huống nằm ngoài cam kết bảo vệ tuyệt đối gồm administrator/root đã chiếm máy, malware cùng quyền hoặc cao hơn, thiết bị đang mở khóa bị lấy cắp, firmware/OS bị xâm nhập và tài khoản provider bị chiếm bên ngoài AI for Boss. Sản phẩm vẫn phải giảm thiệt hại bằng mã hóa toàn đĩa được khuyến nghị, quyền tối thiểu, revoke, audit và incident playbook.

### Secret và OAuth

- Static secret do AI for Boss quản lý dùng Windows Credential Manager, macOS Keychain hoặc Linux Secret Service qua SecretRef broker đã kiểm thử.
- OAuth token do OpenClaw quản lý nằm trong auth store riêng của agent/profile; thư mục state phải có ACL chặt và được xem là dữ liệu tối mật.
- PKCE, state và callback dùng đúng chuẩn provider.
- Secret không xuất hiện trong renderer, command line, log, crash dump, telemetry hoặc support bundle.
- OAuth chỉ báo thành công sau khi credential được runtime commit và live model check đạt.
- HTTP shared bearer của Gateway được xem là quyền operator rộng. UI thường dùng Gateway client/device token với scope tối thiểu; shared bootstrap token không đi vào renderer.
- Credential Broker qua OS key store là `GATED_HYPOTHESIS` cho tới khi contract test chứng minh OpenClaw resolve được SecretRef trên cả ba hệ điều hành mà không dùng command line, environment dump hoặc file plaintext. Nếu thất bại, dự án dừng để chọn lại storage; không fallback âm thầm.

### Desktop shell

- `nodeIntegration` tắt, `contextIsolation` bật và renderer sandbox bật.
- CSP chặt, IPC có schema, sender validation và capability allowlist.
- Chặn navigation, cửa sổ mới và protocol ngoài danh sách cho phép.
- Production tắt remote debugging và cờ làm yếu web security.

### Tool, browser và file

- Network deny-by-default, mở theo provider, connector và domain.
- File path được chuẩn hóa rồi so với workspace allowlist.
- Browser dùng profile riêng, permission handler và download quarantine.
- File thực thi đổi đuôi, archive bomb, symlink escape và path traversal phải bị chặn.
- Hành động ra ngoài, phá hủy, tài chính, quyền quản trị và thực thi mã thuộc mức đỏ, cần duyệt riêng.
- Channel ngoài ứng dụng tắt mặc định. Nếu nhiều người có thể nhắn cùng một agent, họ được xem là cùng chia sẻ delegated tool authority; agent đó phải có allowlist, tool profile riêng và không được dùng host exec mặc định.

### An toàn tác vụ agent

- Web, email, tài liệu, OCR, tool output và output agent khác đều là dữ liệu không tin cậy.
- Model không được đọc secret, tự cấp quyền, đổi policy hoặc tự duyệt hành động của mình.
- Memory write đi qua phân loại, provenance và kiểm tra prompt injection.
- Mỗi task có giới hạn vòng lặp, token, thời gian, tool call và chi phí.
- Timeout, policy service lỗi hoặc approval hết hạn đều fail closed.

### Chuỗi cung ứng

- Dependency khóa phiên bản; CI tạo SBOM, license inventory và quét CVE/secret.
- Artifact build trong môi trường sạch, ký số và có checksum.
- Updater xác minh chữ ký, hash, channel và rollback manifest.
- Plugin, skill và MCP có provenance, hash, quyền, quarantine và allowlist.
- Không cập nhật OpenClaw trực tiếp trên máy khách ngoài một bản AI for Boss đã kiểm thử và ký.
- OpenClaw, Gateway client, protocol package, Node và lockfile được khóa thành một release train. Mỗi lần nâng OpenClaw phải chạy protocol diff, capability diff, migration, backup/restore và rollback test trước khi promote.

### Đạo đức có thể kiểm thử

- Người dùng biết AI đang làm gì, dùng dữ liệu nào và có quyền gì.
- AI không giả thành công, che lỗi hoặc bịa bằng chứng.
- Hành động khó hoàn tác cần người duyệt.
- Tác vụ nhân sự, đánh giá, tài chính, pháp lý hoặc ảnh hưởng lớn có cảnh báo và review phù hợp.
- Người dùng có quyền xem, xuất, sửa, xóa dữ liệu và rút kết nối.
- Advisor hỗ trợ phát hiện lỗi; quyền quyết định cuối thuộc con người.

## 7. Hành vi chuẩn khi hệ thống hỏng

| Sự cố | Hành vi bắt buộc |
|---|---|
| Mất Internet | Task cloud dừng ở checkpoint; local task có thể tiếp tục; không báo thành công giả |
| Provider lỗi | Giữ bản nháp và hỏi người dùng; không đổi model âm thầm |
| Gateway crash | Supervisor khởi động lại; ba lần lỗi vào Safe Mode và giữ checkpoint |
| Policy lỗi | Không cấp quyền mới; hành động đỏ dừng |
| Update lỗi | Tự rollback về bundle đã xác minh |
| Ghi dữ liệu lỗi | Giao dịch thất bại toàn bộ; giữ bản cũ và báo chưa lưu |
| Advisor lỗi | Output giữ trạng thái chưa review; cho chọn Advisor khác hoặc tắt có ghi nhận |
| OAuth lỗi | Hủy phiên xác thực, xóa state tạm và bắt đầu lại bằng phiên mới |
| Phát hiện secret rò rỉ | Dừng connector, thu hồi credential, khóa task liên quan và tạo incident report sạch secret |

Không có silent fallback đối với model, quyền, provider, workspace hoặc dữ liệu.

## 8. Sao lưu, phục hồi và gỡ cài đặt

- Gỡ app mặc định giữ dữ liệu; xóa dữ liệu là lựa chọn riêng và phải xác nhận rõ.
- Có snapshot tự động trước migration và update quan trọng.
- Có hai artifact khác nhau: gói cấu hình `.aifbp` không chứa secret và bản phục hồi `.aifb` luôn được mã hóa.
- `.aifbp` chứa template, agent/rubric/policy và personal overlay đã làm sạch; không chứa OAuth, API key, cookie, channel session hoặc device identity.
- `.aifb` dùng backup/verify chính thức của OpenClaw cùng dữ liệu AI for Boss. Snapshot tự động mã hóa bằng khóa buộc với thiết bị; bản portable mã hóa bằng passphrase hoặc recovery key do người dùng kiểm soát.
- Restore thực hiện trong staging, chạy migration và health check rồi mới atomic swap.
- Restore lỗi phải rollback về dữ liệu trước đó.
- Full recovery có thể chứa OAuth, API key, channel credential và dữ liệu riêng tư; luôn xem nó là secret ngay cả khi công cụ báo đã redacted.
- Device identity, Gateway identity và remote identity được sinh mới sau restore.
- Schedule, channel và plugin nhạy cảm tạm dừng sau restore cho tới khi owner duyệt.
- Restore drill là điều kiện phát hành, không chỉ kiểm tra nút Export.
- Không sao chép SQLite/WAL/SHM đang chạy. Dùng `openclaw backup create --verify`, SQLite snapshot hoặc API chính thức của đúng bản khóa.

## 9. Quy tắc VIBECODING

AI for Boss là sản phẩm loại C khi dùng với dữ liệu thật hoặc phát hành cho khách vì có OAuth, dữ liệu doanh nghiệp, browser/file tool, tiến trình nền và quyền máy.

Mọi phiên build tuân thủ:

1. Một phiên chỉ làm một tính năng hoặc thay đổi có biên rõ.
2. Trước khi code phải có spec, input, output, giả định, trường hợp biên và tiêu chí nghiệm thu.
3. Mỗi thay đổi có test, tự review, blast-radius review và commit hoàn tác được.
4. Dev, staging và production tách biệt từ đầu.
5. Không dùng credential hoặc dữ liệu production để phát triển.
6. Migration luôn có snapshot và restore test.
7. Quyết định một chiều phải có Product Owner phê duyệt.
8. “AI báo đã xong” không có giá trị nghiệm thu nếu chưa có test và kiểm tra bằng tay.
9. Không phát hành cho học viên hoặc khách bằng artifact chưa ký và chưa qua cổng bảo mật.
10. Codex được phép build prototype và technical spike local với dữ liệu giả. Release cho người dùng thật cần người chịu trách nhiệm kỹ thuật review và ký xác nhận.
11. Phép thử OAuth chỉ dùng tài khoản test chuyên dụng, quyền tối thiểu, không chứa dữ liệu cá nhân và có giới hạn chi phí. Không dùng tài khoản ChatGPT, Claude hoặc Google chính của Đại ca làm fixture CI.
12. Công việc loại C chỉ được chuyển từ spike sang pilot thật khi có người chịu trách nhiệm bằng tên, security review và phương án ứng cứu ngoài cửa sổ chat.

## 10. Phạm vi bản đầu

### Phải có

- Bộ cài độc lập và Gateway vô hình.
- Nghi thức khai sinh Agent ở lần cài đầu và mỗi lần tạo Agent mới; `BOOTSTRAP.md` chỉ bị xóa sau kiểm tra thành công.
- Windows, macOS, Linux theo release matrix.
- Tiếng Việt và tiếng Anh.
- Trung tâm kết nối provider.
- Phiên làm việc chọn model riêng.
- Tạo và quản lý nhiều agent.
- Agent Home, `agentDir`, session và auth profile tách biệt; Không gian dự án được cấp quyền riêng.
- Advisor bật/tắt theo phiên.
- Workspace, artifact, file preview và lịch sử.
- Policy, permission preview và Approval Inbox.
- Tool/browser sandbox.
- Schedule và notification cơ bản.
- Cost tracking và budget.
- Backup/restore, diagnostics an toàn và auto-update có rollback.
- Chế độ Cơ bản và Nâng cao để phủ capability OpenClaw.
- Ba gói công việc đầu dành cho chủ doanh nghiệp.

### Để sau bản đầu

- Thanh toán quota model trong app.
- Marketplace mở cho plugin chưa kiểm duyệt.
- Remote browser công khai ra Internet.
- Mobile app đầy đủ.
- Shared multi-tenant Gateway.
- AI tự gửi tiền, ký hợp đồng, tuyển hoặc sa thải, đổi quyền quản trị hay công bố nội dung khi chưa có người duyệt.

## 11. Kế hoạch build cuối cùng theo cổng

### Cổng 0. Khóa nền móng

Đầu ra:

- Repo và nội quy dự án trỏ về tài liệu này.
- Decision Log, threat model, data-flow diagram và capability inventory OpenClaw.
- License inventory và third-party notice.
- Khóa phiên bản OpenClaw, Node, Electron và package manager.
- `runtime-manifest` schema.
- Dev/staging, CI, test, secret policy và release policy.
- Risk register có owner.

Thứ tự feature trong Cổng 0:

1. `0.1` Repo governance và tài liệu dự án.
2. `0.2` Khóa upstream, license inventory và `runtime-manifest` schema.
3. `0.3` Capability inventory, nguồn sự thật, data flow và threat model.
4. `0.4` App shell trống cùng CI đa nền tảng.
5. `0.5` Security baseline, test policy và release policy.
6. `0.6` Sandbox feasibility ADR và spike tối thiểu trên từng họ hệ điều hành.

Chỉ qua cổng khi build app trống tái lập được trên Windows, macOS và Linux bằng CI, không còn giả định ẩn và security review kiến trúc không còn lỗi nghiêm trọng chưa có phương án.

### Cổng 1. Technical spike lõi trên Windows

Đầu ra:

- App Windows x64 chạy trên máy sạch, không cần Node, WSL, Git hoặc OpenClaw cài trước.
- Supervisor mở OpenClaw nhúng trên loopback và cổng động.
- `hello-ok`, protocol/scopes, health và `models.list` đạt trước khi báo Sẵn sàng.
- OpenAI/ChatGPT OAuth hoàn tất end-to-end bằng tài khoản test chuyên dụng, không copy callback.
- Secret không lộ trong renderer, command line hoặc log.
- Kill Gateway, xung đột cổng, token rotation và update lỗi đều phục hồi hoặc rollback.
- OpenClaw được spawn từ bản cài `node_modules` đầy đủ bằng Node thật; không đọc state file nội bộ.
- Client reconnect dựng lại subscription, history, in-flight run và approval backlog theo contract chính thức.

Chỉ qua cổng khi toàn bộ test Gateway đạt và một người không kỹ thuật chạy được tác vụ mẫu. Technical spike chỉ dùng dữ liệu giả và chưa phát hành công khai.

### Cổng 2. Trải nghiệm cốt lõi

Đầu ra:

- Design system song ngữ, sáng/tối và accessibility.
- Onboarding, Home, Trung tâm kết nối, phiên làm việc, artifact và file browser.
- Model theo phiên, agent, Advisor, ngân sách, permission preview và Approval Inbox.
- Data & Recovery, System Health và ba workflow cho chủ doanh nghiệp.

Chỉ qua cổng khi ít nhất 10 người không kỹ thuật hoàn thành ba luồng cốt lõi, không ai phải mở terminal hay sao chép callback OAuth. Mục tiêu 90% làm tác vụ đầu trong năm phút là chỉ số đề xuất; Đại ca chốt nó trong Pilot Charter trước khi tuyển người test.

### Cổng 3. Phủ capability OpenClaw

Đầu ra:

- Ma trận capability đầy đủ, có test cho Cơ bản, Nâng cao và trường hợp không khả dụng.
- Provider/model, agent, memory, tool, skill, plugin, MCP, channel, schedule, heartbeat, node và diagnostics được ánh xạ.
- Tool/browser sandbox, prompt-injection defense, provenance và network policy.
- Mỗi capability chỉ rõ nguồn trong protocol schema, RPC/documentation, plugin export hoặc platform contract; không coi riêng `hello-ok.features.methods` là danh sách đầy đủ.
- Sandbox backend đã qua Cổng 0.6; capability cần isolation không được chạy thẳng trên host để “đủ tính năng”.

Chỉ qua cổng khi không có capability tương thích biến mất vô lý và các test agentic security, denial-of-wallet đạt.

### Cổng 4. Đóng gói đa nền tảng

Đầu ra:

- Windows x64/ARM64 theo runtime manifest.
- macOS Apple Silicon/Intel theo runtime manifest, ký và notarize.
- Linux x64/ARM64 theo runtime manifest, AppImage/DEB có checksum và chữ ký.
- Website đề xuất bản tải và luôn cho chọn thủ công.
- Installer preflight, first-run smoke test và Compatibility ID sạch dữ liệu cá nhân.
- Staged updater và rollback trên từng nền tảng.
- Website không quét phần cứng sâu, không cài helper và không coi user-agent là bằng chứng. Installer chạy local mới xác minh manifest và dung lượng thực tế.

Chỉ qua cổng khi test matrix đạt, cài mới/update/uninstall/restore đạt và bản sai kiến trúc bị chặn bằng thông báo dễ hiểu.

### Cổng 5. Private alpha

Đầu ra:

- 20 đến 30 người dùng thử với dữ liệu giả hoặc ít nhạy cảm.
- Gói cohort, gói vai trò và personal overlay đã ký.
- Dashboard lớp chỉ thu metadata tối thiểu.
- Support flow, diagnostics sạch secret và incident playbook.
- Restore drill, update rollback và kill switch.

Chỉ qua cổng khi không còn lỗi bảo mật cao hoặc nghiêm trọng và mục tiêu pilot về cài đặt, tác vụ đầu, hỗ trợ cùng mức hiểu quyền dữ liệu đạt.

### Cổng 6. Beta công khai có kiểm soát

Đầu ra:

- Artifact ký cho mọi nền tảng công bố.
- SBOM, license notice, privacy notice và vulnerability disclosure.
- Pentest độc lập và sửa toàn bộ lỗi cao/nghiêm trọng.
- Monitoring, cảnh báo, staged rollout, rollback và quy trình hỗ trợ.
- Legal review về dữ liệu cá nhân và hợp đồng phần mềm.

Chỉ qua cổng khi có kỹ sư chịu trách nhiệm kỹ thuật, owner vận hành release, restore/rollback drill đạt và Product Owner ký chấp nhận.

### Cổng 7. Bản quản trị doanh nghiệp

Đầu ra:

- Control plane tối thiểu dữ liệu.
- License, enrollment, signed policy, version rollout và health metadata.
- SSO/SCIM, role, device inventory, MDM package và audit export khi thị trường cần.
- Mỗi người hoặc biên tin cậy có runtime/Gateway riêng.

Chỉ qua cổng khi tenant isolation, quyền, backup, audit và incident response đạt; không có shared Gateway cho các khách hàng đối kháng.

## 12. Bộ test phát hành bắt buộc

### Tương thích và cài đặt

1. Máy sạch không có Node, Git, WSL hoặc OpenClaw.
2. Máy có OpenClaw, AICoworker hoặc app dùng cổng tương tự đang chạy.
3. Windows, macOS, Linux và từng kiến trúc trong runtime manifest.
4. Tài khoản người dùng thường, không mặc định đòi admin.
5. Mạng chậm, rớt giữa OAuth, proxy và firewall.
6. Cài mới, update, rollback, uninstall giữ dữ liệu và restore.
7. OpenClaw package đầy đủ trong `node_modules`; thiếu self-import hoặc plugin dependency làm build fail.
8. Cổng bị chiếm tạo retry có giới hạn; test xác nhận không dùng `--force` và không giết process lạ.
9. Exit `78`, shutdown event, reconnect gap và stdout/stderr backpressure được xử lý bằng test.

### Dữ liệu và quyền

1. Hai tài khoản hoặc hai runtime không thấy dữ liệu của nhau.
2. Đổi ID hoặc path để đọc dữ liệu khác bị chặn.
3. Logout rồi dùng callback/link cũ bị chặn.
4. Unicode, emoji, tên dài và ký tự đặc biệt không phá dữ liệu.
5. Bấm hai lần không tạo task hoặc hành động trùng.
6. Ngắt mạng, reload, crash hoặc mất điện không tạo trạng thái nửa vời.
7. Thay đổi đồng thời có conflict rule rõ ràng.

### Kiểm thử agentic security

1. Prompt injection trong web, email, PDF, ảnh OCR và tool output.
2. Agent tìm cách đọc ngoài workspace hoặc gửi dữ liệu tới domain lạ.
3. Plugin/MCP đổi mã sau khi được duyệt.
4. Model tìm cách gọi tool đỏ, sửa policy hoặc tự duyệt.
5. Advisor bị output worker thao túng.
6. Memory poisoning tồn tại qua phiên.
7. Vòng lặp đa agent làm tăng token và chi phí.
8. OAuth state sai, code dùng lại, callback cũ và token rotation.
9. Gateway ngoài app cố giả danh AI for Boss.
10. Artifact cập nhật bị sửa, downgrade hoặc dependency bị đầu độc.
11. Renderer hoặc nội dung web cố lấy Gateway token, OAuth token hay IPC đặc quyền.
12. HTTP shared bearer, device token và operator scope bị dùng sai đường.
13. Support bundle được kiểm tra lại vì redaction chỉ là best-effort.

## 13. Định nghĩa “xong”

Một tính năng chỉ được coi là xong khi spec đạt, test tự động và thủ công đạt, security/privacy/blast radius được review, không có secret, tài liệu được cập nhật, có rollback và commit hoàn tác được.

Một bản chỉ được coi là phát hành được khi build tái lập; artifact ký; checksum, SBOM, license notice và ma trận tương thích đầy đủ; restore/update/incident drill đạt; pentest và legal review hoàn tất; không còn lỗi cao/nghiêm trọng; không còn quyết định `DEFERRED` quá hạn cổng; Product Owner duyệt; `AI for Boss — Built on OpenClaw` xuất hiện đúng nơi.

## 14. Quyền quyết định

Đại ca quyết định luật nghiệp vụ, dữ liệu, vai trò, quyền, approval, failure behavior, mô hình kinh doanh, cấp phép, giá, thương hiệu, provider hạ tầng và điều kiện phát hành.

Nhóm kỹ thuật đề xuất cấu trúc mã, thư viện, thuật toán, pipeline, IPC, sandbox, migration và monitoring. Lựa chọn ảnh hưởng bảo mật, chi phí, khóa nhà cung cấp hoặc khả năng hoàn tác phải trình Đại ca bằng ngôn ngữ vận hành trước khi chốt.

## 15. Decision Register còn mở nhưng đã có cổng

Các mục dưới đây không chặn Feature 0.1. Chúng phải được chốt trước cổng ghi bên cạnh:

| Quyết định | Owner | Hạn chốt | Mặc định an toàn trước khi chốt |
|---|---|---|---|
| Mã nguồn mở, source-available hay thương mại đóng | Đại ca | Trước Cổng 4 | Repo private, chỉ dùng dependency có quyền phân phối |
| Cách dùng tên và nhãn hiệu OpenClaw ngoài câu `Built on OpenClaw` | Đại ca sau legal review | Trước Cổng 6 | Chỉ attribution chữ, không dùng logo hoặc tuyên bố endorsement |
| Giá, license thương mại và cơ chế kích hoạt | Đại ca | Trước Cổng 5 | Không có thanh toán hoặc khóa người dùng |
| Nhà cung cấp control plane | Đại ca sau đề xuất kỹ thuật | Trước Cổng 7 | Chưa có control plane |
| Chính sách remote access | Đại ca sau threat model | Trước Cổng 3 | Gateway loopback-only; remote browser tắt |
| Sandbox local, sandbox từ xa hay native OS | Đại ca sau Feature 0.6 | Trước Cổng 1 cho exec; trước Cổng 3 cho full capability | Host exec/elevated và browser nhạy cảm bị tắt |
| Retention, telemetry và support upload | Đại ca cùng legal/security | Trước Cổng 5 | Telemetry và upload tắt; dữ liệu local |
| Cơ chế recovery key cho `.aifb` | Đại ca sau prototype UX | Trước Cổng 3 | Chưa cho xuất full backup portable |
| Danh sách OS/architecture được quảng cáo | Đại ca dựa trên test evidence | Mỗi release ở Cổng 4+ | Chỉ công bố tổ hợp đã kiểm chứng |

Mỗi mục khi chốt phải có hệ quả vận hành, phương án bị loại, người phê duyệt và ngày hiệu lực.

## 16. Chuỗi build đầu tiên

Phiên build đầu chỉ làm **Cổng 0, Feature 0.1 — repo governance**.

Đầu ra:

1. Cấu trúc repo chuẩn.
2. `AGENTS.md` của dự án trỏ về bộ quy tắc này.
3. `DECISIONS.md`, `RISKS.md`, `CHANGELOG.md` và mẫu đặc tả feature.
4. Quy tắc branch, commit, test, secret, môi trường và định nghĩa xong.
5. Kiểm tra tự động xác nhận mọi phiên build đọc tài liệu này và không chứa secret mẫu.

Các phiên tiếp theo:

1. `Feature 0.2` khóa một phiên bản OpenClaw ổn định, Node, Electron, package manager và tạo `runtime-manifest` schema.
2. `Feature 0.3` lập capability inventory, source-of-truth map, data flow và threat model.
3. `Feature 0.4` dựng app shell trống cùng CI Windows/macOS/Linux.
4. `Feature 0.5` dựng security baseline, test policy và release policy.
5. `Feature 0.6` spike sandbox và trình Đại ca quyết định bằng hệ quả cài đặt, bảo mật, dữ liệu và chi phí.

Chỉ sau khi Cổng 0 đạt mới mở `Feature 1.1`, spawn OpenClaw nhúng trên Windows. Không nhảy thẳng vào giao diện hoặc OAuth.

## Nguồn nền tảng

- [OpenClaw Install](https://docs.openclaw.ai/install)
- [OpenClaw Installer Internals](https://docs.openclaw.ai/install/installer)
- [OpenClaw Platforms](https://docs.openclaw.ai/platforms)
- [OpenClaw Windows](https://docs.openclaw.ai/windows)
- [Embedding OpenClaw](https://docs.openclaw.ai/gateway/embedding)
- [Building a Gateway Client](https://docs.openclaw.ai/gateway/clients)
- [OpenClaw Gateway Protocol](https://docs.openclaw.ai/gateway/protocol)
- [OpenClaw OAuth](https://docs.openclaw.ai/oauth)
- [OpenClaw Authentication](https://docs.openclaw.ai/auth-monitoring)
- [OpenClaw Google/Gemini Provider](https://docs.openclaw.ai/providers/google)
- [OpenClaw Backup](https://docs.openclaw.ai/cli/backup)
- [OpenClaw Sandboxing](https://docs.openclaw.ai/sandboxing)
- [OpenClaw Security](https://github.com/openclaw/openclaw/blob/main/SECURITY.md)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
