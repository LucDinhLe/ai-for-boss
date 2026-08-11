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
