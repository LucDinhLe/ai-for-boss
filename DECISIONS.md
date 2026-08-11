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
- Sandbox local, remote hoặc native ở Feature 0.6.
- Giấy phép sản phẩm trước Cổng 4.
- Telemetry và support upload trước Cổng 5.
- Giá và license thương mại trước Cổng 5.
- Control plane provider trước Cổng 7.

## D-0006. Release train stable bị chặn một phần

- Ngày: 2026-08-11
- Owner: Codex kỹ thuật; cần Product Owner và senior/security reviewer trước khi promote
- Nhãn: `GATED_HYPOTHESIS`
- Trạng thái: Chấp nhận làm candidate, chưa promote
- Quyết định: Khóa OpenClaw `2026.7.1-2`, Node `24.19.0`, Electron `43.3.0` và pnpm `11.2.2` trong candidate manifest. OpenClaw, Node và pnpm đã qua smoke test trong lab WSL2 không credential; Electron hiện mới khóa metadata.
- Hệ quả: Candidate không được gọi là release train hoàn chỉnh vì `@openclaw/gateway-client@2026.7.1-2` và `@openclaw/gateway-protocol@2026.7.1-2` trả npm E404. Không ghép beta `2026.8.1-beta.1` vào stable và không mở Feature 0.3.
- Phương án bị loại: Dùng dist-tag động; dùng snapshot nghiên cứu `2026.8.1`; ghép OpenClaw stable với Gateway packages beta; coi gói `0.0.0` placeholder là production.

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
