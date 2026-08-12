# Decision Log

Mỗi quyết định có hệ quả phải ghi owner, ngày, trạng thái, lý do vận hành, phương án bị loại và cổng hiệu lực.

## D-0001. OpenClaw là lõi runtime

- Ngày: 2026-08-11
- Owner: Lê Đình Lực
- Nhãn: `PRODUCT_DECISION`
- Trạng thái: Chấp nhận
- Quyết định: AI for Boss dùng OpenClaw làm lõi runtime và ghi rõ `AI for Boss — Built on OpenClaw`.
- Hệ quả: Dự án ưu tiên Gateway RPC, config/CLI contract và Plugin SDK; tránh xây lại capability upstream.
- Phương án bị loại: Viết một AI runtime mới từ đầu.

## D-0002. Khách tự trả provider

- Ngày: 2026-08-11
- Owner: Lê Đình Lực
- Nhãn: `PRODUCT_DECISION`
- Trạng thái: Chấp nhận
- Quyết định: Khách dùng tài khoản provider của họ; AI for Boss bán phần mềm và hệ quản trị.
- Hệ quả: Không có shared credential vault tập trung và chưa bán quota model.

## D-0003. Repo private trong giai đoạn đầu

- Ngày: 2026-08-11
- Owner: Lê Đình Lực theo mặc định an toàn của Rulebook
- Nhãn: `DEFERRED`
- Trạng thái: Tạm áp dụng
- Quyết định: Repo để private cho tới khi mô hình cấp phép được chốt trước Cổng 4.
- Hệ quả: Chưa cấp quyền sao chép, phân phối hoặc dùng thương mại cho bên ngoài.

## D-0004. Feature đầu tiên chỉ là governance

- Ngày: 2026-08-11
- Owner: Lê Đình Lực
- Nhãn: `PRODUCT_DECISION`
- Trạng thái: Chấp nhận
- Quyết định: Phiên triển khai đầu chỉ hoàn thành Cổng 0, Feature 0.1.
- Hệ quả: Chưa chọn runtime, framework package, OAuth, installer hoặc sandbox trong commit này.

## D-0005. Quyết định còn hoãn

Các quyết định sau tiếp tục theo Decision Register của Rulebook:

- Phiên bản OpenClaw, Node, Electron và package manager ở Feature 0.2.
- Sandbox local, remote hoặc native: Feature 0.6 đã tạo khuyến nghị D-0018; Product Owner và senior platform/security review chưa chấp nhận backend production.
- Giấy phép sản phẩm trước Cổng 4.
- Telemetry và support upload trước Cổng 5.
- Giá và license thương mại trước Cổng 5.
- Control plane provider trước Cổng 7.

## D-0006. Release train stable bị chặn một phần — superseded bởi D-0013

- Ngày: 2026-08-11
- Owner: Codex kỹ thuật; cần Product Owner và senior/security reviewer trước khi promote
- Nhãn: `GATED_HYPOTHESIS`
- Trạng thái: Superseded ngày 2026-08-11 sau khi đọc integration guidance của đúng tag stable
- Quyết định: Khóa OpenClaw `2026.7.1-2`, Node `24.19.0`, Electron `43.3.0` và pnpm `11.2.2` trong candidate manifest. OpenClaw, Node và pnpm đã qua smoke test trong lab WSL2 không credential; Electron hiện mới khóa metadata.
- Hệ quả: Candidate không được gọi là release train hoàn chỉnh vì `@openclaw/gateway-client@2026.7.1-2` và `@openclaw/gateway-protocol@2026.7.1-2` trả npm E404. Không ghép beta `2026.8.1-beta.1` vào stable và không mở Feature 0.3.
- Phương án bị loại: Dùng dist-tag động; dùng snapshot nghiên cứu `2026.8.1`; ghép OpenClaw stable với Gateway packages beta; coi gói `0.0.0` placeholder là production.

Giả định “phải có public package stable” trong quyết định này bị sửa bởi D-0013.
Các lệnh cấm trộn beta và coi placeholder là production vẫn giữ nguyên.

## D-0007. WSL2 chỉ là phòng thử nghiệm Feature 0.2

- Ngày: 2026-08-11
- Owner: Lê Đình Lực cho phép cài thử; Codex thiết kế containment
- Nhãn: `TECHNICAL_DECISION`
- Trạng thái: Chấp nhận cho lab, không áp dụng làm sandbox sản phẩm
- Quyết định: Trên Windows Home, dùng distro WSL2 riêng `AIForBossLab`, tắt Windows drive automount và interop, không dùng credential, chạy smoke trong network namespace không mạng rồi terminate distro.
- Hệ quả: Giảm khả năng package thử nghiệm chạm dữ liệu host nhưng không chứng minh sandbox đa nền tảng. Quyết định sản phẩm vẫn thuộc Feature 0.6.
- Phương án bị loại: Windows Sandbox vì Windows Home không hỗ trợ; cài OpenClaw trực tiếp vào profile host; dùng profile OpenClaw/AI Coworker hiện có.

## D-0008. Nghi thức khai sinh và biên workspace của mỗi Agent

- Ngày: 2026-08-11
- Owner: Lê Đình Lực
- Nhãn: `PRODUCT_DECISION`
- Trạng thái: Chấp nhận
- Quyết định: Lần cài đầu và mỗi lần tạo Agent mới phải chạy bootstrap một lần để chốt tên, vai trò/bản chất, giọng điệu, emoji/avatar, cách xưng hô, ưu tiên và ranh giới. Mỗi Agent có Agent Home, `agentDir`, session và auth profile riêng; thư mục doanh nghiệp do người dùng chọn là Không gian dự án được cấp quyền riêng.
- Hệ quả: AI for Boss phải seed file đúng release train, ghi staging, validate/readback, đồng bộ identity qua contract chính thức rồi mới xóa `BOOTSTRAP.md`. Crash giữa chừng giữ bootstrap để resume; không tạo `memory/` trước khi hoàn tất; heartbeat mặc định tắt. UI đổi nhãn thư mục doanh nghiệp thành Dự án/Không gian dự án và chỉ hiện Agent Home ở Chẩn đoán nâng cao.
- Phương án bị loại: Dùng chung workspace cho nhiều Agent; đặt identity file trong thư mục dự án chung; xóa bootstrap ngay khi người dùng trả lời; tạo memory sớm; yêu cầu người dùng tự sửa Markdown.

## D-0009. Hướng thiết kế Editorial Calm và ba panel theo ngữ cảnh

- Ngày: 2026-08-11
- Owner: Lê Đình Lực
- Nhãn: `PRODUCT_DECISION`
- Trạng thái: Chấp nhận
- Quyết định: AI for Boss dùng hướng Editorial Calm với nền giấy ấm, tương phản serif/sans, copper làm màu nhấn và đường phân vùng mảnh. Giữ ba panel; panel phải chỉ hiển thị tiến trình thực tế, Browser hoặc tệp theo ngữ cảnh. Agent Loop chạy nền và không hiện thành checklist cố định.
- Hệ quả: Model theo phiên, Advisor, Gateway health, pause và force stop nằm trong header/composer của phiên; capability còn lại được phân bổ vào Trung tâm điều khiển. Welcome state tập trung vào thương hiệu và composer. Implementation phải đạt Việt/Anh, light/dark, responsive và accessibility.
- Rào chắn: Chỉ học nguyên lý từ Hermes Agent; không sao chép logo, icon riêng, asset, mã nguồn, câu chữ, bố cục pixel hoặc nhận diện thương mại.

## D-0010. Concept mark La bàn quyết định

- Ngày: 2026-08-11
- Owner: Lê Đình Lực
- Nhãn: `PRODUCT_DECISION`
- Trạng thái: Rejected
- Quyết định: Product Owner từ chối concept ghép `B` với khoảng âm `A`; icon cuối được tách sang feature thương hiệu sau.
- Hệ quả: Hai SVG chỉ giữ làm hồ sơ concept bị loại, không được dùng cho app, installer, website hoặc public release. Prototype phải dùng placeholder trung tính cho tới khi icon mới được duyệt.
- Phương án bị loại: Tiếp tục tinh chỉnh cùng cấu trúc monogram A/B.

## D-0011. Cổng Worth-Building và hành trình ba bước

- Ngày: 2026-08-11
- Owner: Lê Đình Lực
- Nhãn: `PRODUCT_DECISION`
- Trạng thái: Chấp nhận
- Quyết định: AI for Boss phải đưa người phổ thông từ tải/cài, qua kết nối/khai sinh, tới giao việc đầu tiên trong ba bước; chỉ tiếp tục public release khi đạt parity cốt lõi, visual/usability benchmark và khác biệt Advisor hai checkpoint.
- Hệ quả: 90% người thử mục tiêu bắt đầu tác vụ đầu trong năm phút; 80% tìm đúng nơi giao việc trong năm giây và hiểu model/Advisor/data egress/approval. Sau hai vòng prototype/test không đạt, dừng mở rộng feature để Product Owner chọn lại hướng.
- Phương án bị loại: Dùng prototype đẹp hoặc danh sách feature làm bằng chứng sản phẩm đã cạnh tranh.

## D-0012. Always-on dùng instance riêng theo biên tin cậy

- Ngày: 2026-08-11
- Owner: Lê Đình Lực chốt nhu cầu; provider cụ thể tiếp tục `DEFERRED`
- Nhãn: `PRODUCT_DECISION`
- Trạng thái: Chấp nhận kiến trúc mục tiêu, chưa triển khai
- Quyết định: Bổ sung mode Always-on chạy trên host Linux riêng do khách sở hữu/thuê. Mỗi khách hoặc nhóm thật sự cùng biên tin cậy dùng một runtime/Gateway hoàn chỉnh; không shared Gateway hoặc session-ID tenancy.
- Hệ quả: Gateway loopback-only; Tailscale/SSH là default trước khi HTTPS remote được audit. Cần non-root service, one-time claim, device pairing/revoke, health, auto-restart, backup/restore, signed update và remote security tests.
- Phương án bị loại: Shared multi-tenant Gateway; công khai Gateway ra Internet; khóa provider cloud trước ADR; bắt đầu bằng Kubernetes/Fleet experimental.

## D-0013. Khóa Gateway bằng external-app contract công khai

- Ngày: 2026-08-11
- Owner: Lê Đình Lực yêu cầu giải blocker; Codex xác minh kỹ thuật
- Nhãn: `VERIFIED_UPSTREAM`
- Trạng thái: Chấp nhận
- Quyết định: Với OpenClaw `2026.7.1-2`, AI for Boss dùng WebSocket text/JSON và Gateway RPC được tài liệu `external-apps.md` của đúng tag công bố. `@openclaw/gateway-client` và `@openclaw/gateway-protocol` ở tag stable là workspace package `0.0.0-private`, chỉ được ghi tree fingerprint làm tham chiếu; không bundle, vendor hoặc import.
- Hệ quả: Release train được khóa bằng npm integrity, git tag/commit, protocol v4, doc blob và private-package tree fingerprint. Adapter thuộc AI for Boss, phải validate contract và test với Gateway thật. Feature 0.2 hết blocker nhưng chưa tạo desktop app hoặc installer.
- Phương án bị loại: Chờ package public không được upstream hứa ngày; ghép beta; sao chép private package; import hashed `dist`; đọc private state; tự chế giao thức khác tài liệu.

## D-0014. Capability contract dựa trên bằng chứng và một nguồn sự thật

- Ngày: 2026-08-11
- Owner: Codex kỹ thuật theo Rulebook; cần senior platform/security reviewer trước khi qua Cổng 0
- Nhãn: `TECHNICAL_DECISION`
- Trạng thái: Chấp nhận cho Feature 0.3
- Quyết định: Capability manifest v1 ánh xạ 23 nhóm năng lực bằng nguồn công khai của release train đã khóa, tách `WRAPPED`, `RESTRICTED` và `BLOCKED`, đồng thời khóa `advertisable: false` cho tới khi có product test. Mỗi miền dữ liệu chỉ có một nguồn có quyền ghi; mọi trust boundary, auth mode, Agent Genesis state và threat Critical/High phải truy vết được tới control, failure behavior, test gate và Risk Register.
- Hệ quả: `hello-ok.features.methods/events` không được dùng như inventory đầy đủ; private Gateway package, hashed `dist`, beta và dynamic tag bị validator cấm. Feature 0.4/0.5 phải tiêu thụ các contract này thay vì tự đoán IPC, storage hoặc quyền.
- Phương án bị loại: Bảng Markdown không kiểm thử; gắn nhãn toàn bộ là planned; tuyên bố hỗ trợ dựa trên tài liệu upstream trước khi AI for Boss có test thực thi.

## D-0015. React/Vite shell và bundle thử nghiệm không đồng nghĩa installer

- Ngày: 2026-08-11
- Owner: Codex kỹ thuật theo release train; Product Owner chốt hướng trải nghiệm
- Nhãn: `TECHNICAL_DECISION`
- Trạng thái: Chấp nhận cho Feature 0.4
- Quyết định: Desktop shell dùng Electron `43.3.0`, React `19.2.8`, Vite `8.2.1` và TypeScript `6.0.3`; renderer nhận một safe summary qua preload read-only. `@electron/packager` chỉ tạo bundle `experimental-internal` theo OS/architecture runner.
- Hệ quả: CI ba OS chứng minh build/package contract, không chứng minh thiết bị được hỗ trợ. Artifact phải có inventory, ASAR allowlist, `signed: false`, `distributable: false`; installer, updater, signing và support matrix vẫn thuộc Cổng 4.
- Phương án bị loại: Cho renderer đọc manifest/filesystem; preload IPC tổng quát; gọi CI artifact là bản cài; dùng pnpm hoặc dependency động trên từng máy.

## D-0016. Feature 0.5 kiểm chứng first-run sớm bằng dữ liệu giả

- Ngày: 2026-08-11
- Owner: Lê Đình Lực
- Nhãn: `PRODUCT_DECISION`
- Trạng thái: Chấp nhận cho Feature 0.5
- Quyết định: Feature 0.5 triển khai vertical slice hành trình ba bước trong app shell để kiểm chứng Worth-Building sớm. Security baseline tiếp tục là acceptance gate của cùng feature; kết nối/runtime thật vẫn theo Cổng 1–2.
- Hệ quả: Người dùng thử có thể đi qua ba bước bằng fixture được gắn nhãn rõ. State machine giữ contract Agent Genesis, resume idempotent và fail closed, nhưng không ghi Agent Home, không xóa `BOOTSTRAP.md` thật, không gọi Gateway/OAuth/model và không được tính là implementation production của Feature 2.2/2.6.
- Phương án bị loại: Chờ xong Gateway/OAuth mới kiểm chứng UX; hoặc tạo kết nối giả nhưng trình bày như đã hoạt động thật.

## D-0017. Renderer preview không được tự promote Agent Genesis

- Ngày: 2026-08-12
- Owner: Codex kỹ thuật; cần senior platform/security reviewer phê duyệt contract runtime
- Nhãn: `TECHNICAL_DECISION`
- Trạng thái: Chấp nhận cho Feature 0.5 preview
- Quyết định: Hành trình first-run bằng fixture chỉ duyệt hồ sơ Genesis tới `STAGING`. `ACTIVE`, `bootstrapRetained=false` và `reportReady=true` chỉ hợp lệ khi state machine nhận đủ sáu promotion check từ nguồn `trusted-supervisor-runtime`; renderer không sở hữu hoặc truyền nguồn bằng chứng này.
- Hệ quả: Snapshot dùng exact schema và invariant matrix; dữ liệu thiếu, thừa, sai giới hạn hoặc tổ hợp state bất khả thi bị từ chối toàn bộ. Preview vẫn cho phép tạo task `draft-only` cùng kế hoạch mẫu để test UX, nhưng không được diễn giải thành Agent/runtime đã hoạt động.
- Phương án bị loại: Hard-code toàn bộ check là đạt trong UI; coi preview approval là runtime promotion; hoặc phục hồi một phần snapshot không đáng tin.

## D-0018. Khuyến nghị sandbox local managed container có điều kiện

- Ngày: 2026-08-12
- Owner: Hermes/Codex đề xuất kỹ thuật; Lê Đình Lực và senior platform/security reviewer cần chấp nhận trước khi triển khai
- Nhãn: `GATED_HYPOTHESIS`
- Trạng thái: Đề xuất, chưa chấp nhận làm backend production
- Quyết định đề xuất: Ưu tiên nghiên cứu container runtime cục bộ do AI for Boss quản lý. OpenShell/SSH chỉ là hướng opt-in sau khi có production-readiness; native restrictions chỉ làm defense-in-depth. Product default vẫn `execution=blocked`, `sandboxMode=off`, workspace/network `none`.
- Hệ quả: Không mở host exec, elevated, Browser nhạy cảm, network, credential injection, Docker socket, host namespace hoặc bind mount ngoài project grant. Cần test sandbox thật trên Windows/macOS/Linux, installer/usability, recovery/update và adversarial escape trước khi promote.
- Phương án bị loại: OpenShell alpha làm default; native restrictions riêng lẻ làm backend đa nền tảng; fallback âm thầm về host khi backend vắng hoặc lỗi.
- Bằng chứng: `docs/architecture/SANDBOX-FEASIBILITY-ADR.md`, manifest/schema, exact reviewed-source và semantic-direction digests, fixture-only probe cùng contract tests Feature 0.6. Bằng chứng này không chứng minh isolation thực tế.
