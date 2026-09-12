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

## D-0019. Dùng gói Gateway công khai của OpenClaw thay vì tự viết client

- Ngày: 2026-09-05
- Owner: Fable đề xuất kỹ thuật; Lê Đình Lực chấp nhận cho beta 0; senior platform/security reviewer vẫn cần trước Cổng 1
- Nhãn: `TECHNICAL_DECISION`
- Trạng thái: Chấp nhận cho beta 0; thay thế D-0013 ở phần nguồn client
- Bối cảnh: D-0013 ngày 2026-08-11 ghi rằng `@openclaw/gateway-client` và `@openclaw/gateway-protocol` là package private `0.0.0-private`, nên AI for Boss phải tự dựng client WebSocket trên tài liệu công khai. Từ release train `2026.8.1`, hai package này đã được phát hành công khai trên npm kèm schema, validator, kiểu TypeScript, registry định danh client, lớp device auth, reconnect và projection cho transcript. Gói `openclaw` còn kèm `docs/gateway/embedding.md`, hợp đồng chính thức cho việc nuôi Gateway như tiến trình con.
- Quyết định: Beta 0 phụ thuộc trực tiếp vào hai package công khai đã ghim và tuân theo `embedding.md`. Không tự viết lại handshake, chữ ký thiết bị, reconnect hay projection.
- Hệ quả: Lớp Adapter mỏng đi đáng kể và bám đúng phiên bản wire. Đổi lại, hai package trở thành thành phần được ghim trong candidate train, phải nâng cùng nhịp với `openclaw`, và mọi lần nâng phải chạy lại smoke ba nền tảng. Bề mặt IPC mở rộng từ một lệnh đọc lên ba kênh gọi vào và một kênh nhận, vẫn đóng theo danh sách cho phép có test.
- Phạm vi không đổi: Không vendor package private, không import dist chunk băm, không dàn phẳng gói `openclaw`, không đọc state riêng của OpenClaw.
- Phương án bị loại: Giữ nguyên D-0013 và tự viết client trên một release train đã cũ hai kỳ; hoặc bám bản `2026.7.1-2` vốn chưa có package công khai nên không thể hưởng hợp đồng nhúng.
- Bằng chứng: `manifests/runtime/beta-0-candidate.lock.json`, `artifacts/beta-0/`, `tests/contract/beta-0-runtime-contract.test.mjs`.

## D-0020. Train 2026.9.1 là candidate, không phải locked

- Ngày: 2026-09-05
- Owner: Fable đề xuất; Lê Đình Lực quyết định thời điểm promote
- Nhãn: `GATED_HYPOTHESIS`
- Trạng thái: Chấp nhận cho beta 0
- Quyết định: Beta 0 chạy trên `oc-2026.9.1-candidate.1` được ghi trong một tài liệu riêng, tách hẳn khỏi `runtime-manifest.lock.json`. Locked train vẫn là `oc-2026.7.1-2-locked.1` cho tới khi đủ điều kiện promote.
- Hệ quả: Capability manifest, SBOM, license inventory và bằng chứng lab Feature 0.2 giữ nguyên bản đã kiểm, không bị viết lại theo phiên bản mới. Candidate mang sẵn danh sách điều kiện chưa đạt, và validator từ chối mọi mục bằng chứng tự nhận `spike-tested` mà không có tệp bằng chứng đúng nền tảng.
- Điều kiện promote: capability diff giữa hai train, SBOM và license inventory mới, smoke đạt trên Windows x64 và macOS arm64, chọn được agent runtime cùng đường xác thực nhà cung cấp, và senior platform/security review.
- Phương án bị loại: Sửa thẳng locked manifest lên `2026.9.1` và cập nhật các hợp đồng theo phiên bản mới mà chưa chạy lại capability diff; cách đó biến tài liệu thành lời khai thay vì bằng chứng.

## Repository consolidation — 2026-09-09
Owner explicitly approves one public ai-for-boss repository after privacy audit and deletion of ai-for-boss-preview after preserving source and releases. Existing installed legacy update URLs cannot be changed by a Git merge; document manual transition. Future source uses the main repository endpoint.

## Màn hình Kết nối AI ba bậc — 2026-09-11
Chủ sở hữu yêu cầu màn hình kết nối rõ ràng theo ưu tiên OAuth → ứng dụng CLI đã đăng nhập → API key, ưu tiên tài khoản phổ biến. Thứ tự và nhãn thương hiệu là trình bày trong vỏ; tuyến kết nối vẫn chỉ đến từ `openclaw.setup.detect` (giữ D-0022). Bỏ danh mục phương thức và bộ lọc thương hiệu khỏi màn hình. Sửa hai lỗi luồng: bỏ hạn 90 giây khi chờ đăng nhập trình duyệt, và giữ biên nhận kích hoạt qua lượt Gateway khởi động lại. Chi tiết: `docs/feature-specs/0051-connect-screen-three-tiers.md`.

## Gỡ cài đặt chạy trong .NET — 2026-09-11
Phần gỡ là chỗ duy nhất còn duyệt toàn bộ payload tuần tự trong PowerShell, trong khi phần cài đã chạy trong .NET bốn luồng. Đưa `Inspect`/`Apply` vào `InstallRemover`, gộp lượt kiểm tra khoá và lượt tính mã băm thành một lượt mở tệp. Mọi luật sở hữu giữ nguyên: không ra ngoài thư mục phiên bản, không theo reparse point, không xoá tệp sai mã băm, kiểm hết rồi mới xoá. Chi tiết: `docs/feature-specs/0053-uninstall-speed.md`.

## Phát hành bộ cài bằng máy chủ GitHub — 2026-09-11
Bộ cài trước nay dựng tay trên một máy Windows có NSIS, nên mã đã gộp vào main mà trang chủ vẫn trỏ về bản cũ. Thêm `.github/workflows/release-windows.yml` chạy đúng các script sẵn có trên runner Windows và đăng bản thử nghiệm bằng `gh`. Quy trình từ chối chạy khi phiên bản nhập vào không khớp `apps/desktop/package.json` và README, để ba nguồn không lệch nhau nữa. Kênh cập nhật ký Ed25519 trong `releases/preview.json` KHÔNG nằm trong quy trình này: đưa khoá ký vào CI là quyết định riêng của Product Owner. Chi tiết: `docs/feature-specs/0054-release-workflow.md`.

## AI for Boss là harness cho SME, solo và người đi làm — 2026-09-12
Product Owner duyệt bản đánh giá và kế hoạch `KE-HOACH-AI-FOR-BOSS-HARNESS-SME.md` với tám quyết định: (1) đối tượng đợt một là cả ba nhóm; (2) kỹ năng doanh nghiệp chuyển thể từ kho mã nguồn mở nhiều sao, cụ thể `anthropics/knowledge-work-plugins` (Apache 2.0); (3) kỹ năng cài chung cho lõi và giới hạn theo agent bằng danh sách cho phép, thực hiện bằng thư mục `skills` của plugin `aifb-harness`; (4) trần ngân sách đo bằng bước và token, không đo bằng tiền, vì người dùng ưu tiên gói thuê bao đã trả và nút hợp đồng không được đổi mô hình hay tài khoản; (5) bộ tối ưu prompt giữ nguyên, tắt và ẩn cho tới khi có eval; (6) giữ cả bốn plugin kênh nhắn tin, chấp nhận chi phí ghim lại; (7) khoá ký Ed25519 đưa vào secret GitHub theo hướng thuận tiện và nhanh nhất, làm ở đợt sau cùng với kênh cập nhật; (8) kho eval tách riêng khỏi kho ứng dụng. Đợt một gồm spec 0055, 0056, 0057, 0058.

## Bộ xuất tài liệu chưa từng được đăng ký trong bản chạy thật — 2026-09-12
Khi rà để thêm plugin `aifb-harness`, phát hiện `prepareDocumentTools` chỉ được gọi trong fixture, không được gọi từ `main.mjs`, nên `aifb_export_document` không tồn tại với mô hình từ beta33 tới beta36 dù README nói ngược lại. Sửa bằng một đường đăng ký chung cho plugin của vỏ (`host-plugin-setup.mjs`, danh sách cố định hai plugin), chạy khi kênh thiết lập kết nối, tối đa hai lượt mỗi lần mở ứng dụng. Bài học ghi vào R-004: fixture đạt không thay được một dòng gọi trong tiến trình chính; test hợp đồng giờ đọc `main.mjs` để khoá lời gọi đó.
