---
name: bao-cao-dinh-ky
description: "Biến lời mô tả một báo cáo lặp lại theo tuần, tháng, quý thành định nghĩa cố định gồm chỉ số, nguồn, công thức, ngưỡng cảnh báo, lưu vào tệp và chạy lại mỗi kỳ mà không phải kể lại từ đầu."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "📊"
---

# Báo cáo định kỳ

## Khi nào dùng

Dùng khi anh chị có một bộ số phải xem đi xem lại mỗi kỳ, ví dụ "mỗi tháng cho tôi doanh thu theo chi nhánh so với cùng kỳ, công nợ quá hạn và tỷ lệ chi phí lương trên doanh thu", và đang mất cả buổi tự lọc Excel. Kỹ năng này làm hai việc. Lần đầu, nó biến câu mô tả thành một định nghĩa báo cáo cố định gồm chỉ số, nguồn dữ liệu, công thức, cách nhóm, mốc so sánh, ngưỡng cảnh báo và nhịp chạy, rồi lưu định nghĩa vào tệp. Các kỳ sau, anh chị chỉ cần nói "chạy báo cáo tháng" và đưa tệp mới, trợ lý đọc định nghĩa đã lưu và chạy đúng như cũ.

Không dùng cho bản tin mở tuần gom tiền, khách, việc tồn và ba việc cần làm, việc đó chuyển sang `ban-tin-dau-tuan`. Không dùng để nhìn lại việc đã làm trong tuần, việc đó chuyển sang `ra-soat-tuan`. Không dùng để báo cáo tiến độ một dự án cho khách hay sếp, việc đó chuyển sang `theo-doi-tien-do`. Khi cần phân tích sâu lãi lỗ theo sản phẩm, chuyển sang `phan-tich-lai-lo`; khi cần dự báo tiền ra vào các tuần tới, chuyển sang `du-bao-dong-tien`.

## Hỏi trước khi làm

Trước tiên, tìm trong thư mục làm việc tệp `bao-cao-dinh-ky/` xem báo cáo này đã có định nghĩa chưa. Có rồi thì bỏ qua phần hỏi, chỉ xin tệp dữ liệu kỳ mới. Chưa có thì hỏi một lượt những điểm thật sự mơ hồ, điều gì suy ra được từ câu mô tả thì không hỏi lại.

1. Anh chị mô tả báo cáo bằng lời thường được không, gồm muốn xem những số nào, chia theo gì (chi nhánh, kênh bán, nhóm hàng, nhân viên) và so với gì (kỳ trước, cùng kỳ năm trước, mục tiêu)?
2. Mỗi kỳ tính theo tháng dương lịch, bốn tuần gần nhất hay từ đầu tháng tới hôm nay?
3. Số liệu lấy từ đâu? Tệp xuất MISA, KiotViet, Sapo, Haravan, báo cáo sàn, sao kê ngân hàng hay bảng Excel tự ghi. Nếu hai nguồn cùng có doanh thu, nguồn nào là nguồn chính?
4. Với chỉ số tỷ lệ như chi phí lương hay chi phí quảng cáo, anh chị chia cho doanh thu, doanh thu thuần hay tổng chi phí?
5. Ngưỡng nào thì anh chị muốn được cảnh báo, ví dụ công nợ quá hạn vượt 200 triệu hay doanh thu thấp hơn mục tiêu 10 phần trăm? Có mục tiêu kỳ này không?
6. Ai đọc báo cáo và đọc ở đâu, anh chị tự xem, gửi ban giám đốc hay gửi đối tác? Muốn nhận thêm tệp Excel hay chỉ cần bản tóm tắt?

## Quy trình

1. Chuyển câu mô tả thành bản định nghĩa gồm tên báo cáo, nhịp chạy, kỳ tính, danh sách chỉ số, và với mỗi chỉ số ghi tên, công thức bằng lời và bằng phép tính, nguồn, cách nhóm, mốc so sánh, ngưỡng cảnh báo xanh vàng đỏ. Chỉ số nào anh chị chưa nói ngưỡng thì để trống và ghi "chưa đặt ngưỡng", không tự đặt.
2. Trình bản định nghĩa gọn trong một khối và hỏi đúng một lần "Anh chị xem công thức và ngưỡng đã đúng ý chưa?". Anh chị sửa gì thì áp vào rồi chạy, không hỏi xác nhận lần hai.
3. Đọc tệp dữ liệu và kiểm tên cột, kỳ thời gian, đơn vị tiền. Cột nào định nghĩa cần mà tệp không có, dừng lại hỏi, không tự đoán cột thay thế.
4. Tính từng chỉ số bằng Python theo đúng công thức đã chốt. Trước khi ghi số, kiểm bốn lỗi hay gặp gồm so kỳ thiếu ngày với kỳ đủ ngày, cộng trùng một đơn giữa sàn và phần mềm bán hàng, nhóm có giá trị không bị rơi khỏi bảng, và tổng các dòng nhóm lệch với tổng chung. Lệch ở đâu thì ghi rõ ở đó, không làm tròn cho khớp.
5. Viết bản tóm tắt trước bảng số. Mở đầu bằng tối đa ba phát hiện, mỗi phát hiện có con số, mốc so sánh và tên dòng nổi bật, ví dụ "Chi nhánh Thủ Đức giảm 18 phần trăm, là chi nhánh duy nhất thấp hơn cùng kỳ". Tiếp theo là bảng chỉ số với cột kỳ này, kỳ so sánh, chênh lệch, mục tiêu, trạng thái. Cuối cùng là tối đa ba việc nên làm kỳ tới, mỗi việc gắn với một phát hiện.
6. Nếu anh chị cần tệp Excel, dùng kỹ năng `xlsx` dựng tệp gồm trang tóm tắt đầu tiên, mỗi nhóm chỉ số một trang, và trang dữ liệu gốc cuối cùng để anh chị tự kiểm phép tính.
7. Lưu định nghĩa vào tệp `bao-cao-dinh-ky/<tên-báo-cáo>.md` trong thư mục làm việc, kèm ngày tạo và nhịp chạy, rồi nói rõ tệp nằm ở đâu. Lưu không được thì báo ngay, không im lặng.
8. Trình bản báo cáo để anh chị duyệt số trước khi gửi ai. Gửi ra ngoài thì soạn nháp và chờ "làm đi". Sau một kỳ anh chị thấy dùng được, đề nghị một lần đặt lịch bằng `cronjob` theo nhịp đã chốt; lịch chạy không hỏi lại gì, nguồn nào thiếu thì vẫn giao báo cáo và ghi chỗ thiếu. Khi anh chị đổi công thức, ngưỡng hay chốt một quyết định từ báo cáo, cập nhật tệp định nghĩa và gọi `aifb_record_decision`.

## Tiêu chuẩn đầu ra

Hai thứ luôn đi cùng nhau, gồm tệp định nghĩa báo cáo lưu lại được và bản báo cáo kỳ này. Tệp định nghĩa ghi đủ tên, nhịp chạy, kỳ tính, và với mỗi chỉ số có công thức, nguồn, cách nhóm, mốc so sánh, ngưỡng. Bản báo cáo tiếng Việt một trang, ba phát hiện đứng đầu, số đứng trước lời, mỗi số có mốc so sánh, tiền viết kiểu "1,24 tỷ" hay "610 triệu". Không bịa số, nguồn thiếu ghi "chưa có số" và tên nguồn. Kỳ sau không phỏng vấn lại báo cáo đã định nghĩa. Không đưa kết luận thuế hay kế toán chắc chắn, chỗ nào liên quan ghi "cần kế toán xác nhận".

## Ba ca mẫu

### Ca 1: Chuỗi hai quán cơm văn phòng của một hộ kinh doanh
Đầu vào: Chủ quán nói "cuối tháng cho tôi xem doanh thu từng quán, tiền chợ trên doanh thu, và số suất bán mỗi ngày". Tệp KiotViet tháng 9 quán A 186 triệu, quán B 142 triệu, sổ Excel tiền chợ quán A 79 triệu, quán B 68 triệu (số giả định).
Bối cảnh: Chủ quán chưa từng có báo cáo cố định, muốn tháng sau chỉ việc thả tệp vào.
Đầu ra đạt chuẩn: Bản định nghĩa ghi tỷ lệ tiền chợ bằng tiền chợ chia doanh thu theo từng quán, kỳ tính là tháng dương lịch, và hỏi một câu về ngưỡng cảnh báo cho tỷ lệ này. Báo cáo tháng 9 ghi quán A 42,5 phần trăm, quán B 47,9 phần trăm, tổng doanh thu 328 triệu. Phát hiện thứ nhất nêu quán B có tỷ lệ tiền chợ cao hơn quán A 5,4 điểm. Tệp định nghĩa được lưu và nói rõ đường dẫn.
Tiêu chí chấm:
- Hai tỷ lệ 42,5 và 47,9 phần trăm tính đúng.
- Không tự đặt ngưỡng cảnh báo khi chủ quán chưa nói.
- Có lưu tệp định nghĩa kèm đường dẫn.
- Tháng sau chạy lại không hỏi lại công thức.
- Báo cáo một trang, phát hiện trước bảng số.

### Ca 2: Công ty thương mại điện tử 45 người, báo cáo quý cho ban giám đốc
Đầu vào: Trưởng phòng vận hành đưa định nghĩa đã lưu từ quý trước gồm doanh thu theo sàn, tỷ lệ hoàn đơn, chi phí quảng cáo trên doanh thu với ngưỡng đỏ 15 phần trăm. Quý 3 có báo cáo Shopee, TikTok Shop, Lazada và tệp chi phí quảng cáo; tổng chi quảng cáo 462 triệu trên doanh thu 2,8 tỷ (số giả định). Tệp Lazada thiếu cột số đơn hoàn.
Bối cảnh: Báo cáo gửi họp ban giám đốc, người đọc cần kết luận nhanh.
Đầu ra đạt chuẩn: Trợ lý đọc định nghĩa cũ và bỏ qua phần hỏi. Chi phí quảng cáo trên doanh thu ghi 16,5 phần trăm, trạng thái đỏ theo ngưỡng 15 phần trăm đã lưu. Tỷ lệ hoàn đơn của Lazada ghi "chưa có số, tệp thiếu cột đơn hoàn" và báo cáo vẫn giao. Tệp Excel có trang dữ liệu gốc. Bản gửi ban giám đốc được trình duyệt trước.
Tiêu chí chấm:
- Tỷ lệ 16,5 phần trăm tính đúng và gắn đúng trạng thái đỏ.
- Không phỏng vấn lại định nghĩa đã lưu.
- Không tự đoán số đơn hoàn Lazada.
- Báo cáo vẫn giao khi thiếu một nguồn.
- Chờ duyệt trước khi gửi.

### Ca 3: Chuyên viên tư vấn tài chính cá nhân làm tự do
Đầu vào: Chuyên viên muốn báo cáo tuần về số buổi tư vấn, doanh thu, số khách mới từ Facebook và từ người giới thiệu, lấy từ Google Sheets tự ghi. Tuần qua 11 buổi, 16,5 triệu, 3 khách mới trong đó 2 từ giới thiệu (số giả định).
Bối cảnh: Chuyên viên muốn báo cáo tự chạy mỗi tối Chủ nhật.
Đầu ra đạt chuẩn: Định nghĩa ghi doanh thu trung bình mỗi buổi bằng doanh thu chia số buổi, nguồn khách chia theo hai nhóm. Báo cáo tuần ghi 1,5 triệu mỗi buổi và hai phần ba khách mới đến từ giới thiệu. Có dùng kỹ năng `google-workspace` hoặc đề nghị anh chị xuất tệp nếu chưa kết nối. Cuối báo cáo đề nghị một lần đặt lịch `cronjob` tối Chủ nhật và chờ đồng ý.
Tiêu chí chấm:
- Số 1,5 triệu mỗi buổi tính đúng.
- Nguồn khách ghi theo số chuyên viên đưa, không suy thêm.
- Đề nghị đặt lịch đúng một lần.
- Định nghĩa lưu thành tệp.
- Không đưa lời khuyên thuế về thu nhập tự do.

## Nguồn
Chuyển thể từ `small-business/skills/report-builder`, `small-business/skills/report-pack` và `marketing/skills/performance-report` trong anthropics/knowledge-work-plugins (Apache 2.0), cùng `skills/ops/periodic-reporting` trong viethahong/business-skills (MIT). Phần kết nối QuickBooks, HubSpot, Stripe của bản gốc được thay bằng tệp xuất từ phần mềm và sàn Việt Nam.
