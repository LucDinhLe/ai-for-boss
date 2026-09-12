---
name: theo-doi-tien-do
description: "Đọc trạng thái công việc rồi viết báo cáo tiến độ một trang thành hai bản, một cho chính anh chị và một cho khách hàng hoặc sếp, dùng khi tới kỳ báo cáo hoặc bị hỏi tiến độ."
metadata: { "openclaw": { "emoji": "📈" } }
---

# Theo dõi tiến độ

## Khi nào dùng

Dùng khi anh chị đang chạy một dự án hay đơn hàng và tới lúc phải báo cáo, hoặc khách hàng, sếp vừa nhắn hỏi "tới đâu rồi". Kỹ năng này đọc bảng việc hoặc ghi chú trạng thái của anh chị, xếp mức xanh, vàng, đỏ cho từng phần, rồi viết hai bản báo cáo một trang: bản nội bộ cho chính anh chị nhìn thẳng vấn đề, và bản gửi ra ngoài cho khách hàng hoặc sếp. Không dùng khi chưa có kế hoạch hay bảng việc, hãy dùng `ke-hoach-du-an` trước. Không dùng để tổng kết tuần của riêng anh chị, việc đó chuyển sang `ra-soat-tuan`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi làm. Không tự đoán ngày, phần trăm hoàn thành, số tiền hay tên người nhận.

1. Dự án hay đơn hàng này là gì, mốc cuối là ngày nào, và kỳ báo cáo này tính từ ngày nào đến ngày nào?
2. Anh chị dán bảng việc hoặc trạng thái hiện tại được không? Bảng từ `ke-hoach-du-an`, Excel, Google Sheets, hoặc ghi chú Zalo đều được. Cần có tên việc, người làm, trạng thái, ngày dự kiến xong.
3. Bản gửi ra ngoài dành cho ai, khách hàng hay sếp? Người đó quan tâm điều gì nhất, tiền, ngày giao, hay chất lượng? Họ đã biết gì rồi và điều gì chưa được báo?
4. Có số nào để đo tiến độ không, ví dụ phần trăm hoàn thành, số tiền đã chi so với ngân sách, số hạng mục đã bàn giao?
5. Có vấn đề nào anh chị đang lo mà chưa nói với ai không, ví dụ chậm mốc, vượt chi, người nghỉ?
6. Anh chị cần người nhận quyết định hay hỗ trợ điều gì, và cần trước ngày nào?

## Quy trình

1. Đọc bảng việc và đếm: bao nhiêu việc xong, đang làm, chưa bắt đầu, quá hạn. Việc quá hạn là việc có ngày dự kiến xong trước ngày hôm nay mà chưa ghi xong. Nếu bảng thiếu ngày hoặc trạng thái, hỏi anh chị, không tự điền.
2. Xếp mức cho toàn dự án và cho từng nhóm việc theo ba mức. Xanh là đúng kế hoạch, không có việc quá hạn trên đường găng. Vàng là có việc chậm hoặc rủi ro đã xảy ra, còn cách xử lý nhưng chưa chắc kịp mốc. Đỏ là sẽ trễ mốc hoặc vượt ngân sách nếu không có quyết định lớn. Mức được xếp theo thực tế trong bảng chứ không theo mong muốn; nếu anh chị muốn nâng mức, hỏi lại căn cứ là gì. Ghi rõ lý do mỗi khi xếp vàng hoặc đỏ.
3. Viết bản nội bộ trước. Bản này nói thẳng: việc nào trễ, trễ bao nhiêu ngày, do ai hoặc do gì, đã chi bao nhiêu so với ngân sách, và ba việc anh chị phải xử lý tuần này. Có mục "Điều chưa nói với khách hoặc sếp" để anh chị tự thấy khoảng cách giữa hai bản.
4. Viết bản gửi ra ngoài dựa trên bản nội bộ, cùng số liệu, khác cách kể. Mở đầu bằng một câu kết luận về tình trạng chung và mức màu. Kể việc đã xong theo lợi ích người nhận thấy được, không kể theo đầu việc kỹ thuật. Với vấn đề, nêu rõ điều gì xảy ra, ảnh hưởng tới mốc nào, đang xử lý thế nào, và cần người nhận làm gì trước ngày nào. Không giấu tin xấu; nếu bản nội bộ có mức đỏ thì bản gửi ra ngoài cũng phải có mức đỏ, chỉ khác ở độ chi tiết. Không hứa ngày mới khi anh chị chưa xác nhận.
5. Đối chiếu hai bản với nhau: cùng số việc xong, cùng mức màu, cùng ngày mốc. Nếu lệch, sửa cho khớp và báo cho anh chị biết chỗ đã sửa.
6. Đưa cả hai bản cho anh chị duyệt. Hỏi "Bản gửi ra ngoài có chỗ nào anh chị muốn nói khác đi không, và anh chị tự gửi hay muốn tôi soạn thành email hoặc tin nhắn Zalo?". Chỉ soạn nháp, không gửi; nhắc anh chị ghi lại ngày gửi để kỳ sau đối chiếu. Khi người dùng chốt một quyết định trong việc này, gọi công cụ `aifb_record_decision` để ghi vào sổ quyết định.

## Tiêu chuẩn đầu ra

Hai bản, mỗi bản một trang tiếng Việt, ghi rõ tên dự án, kỳ báo cáo và mức màu ở dòng đầu. Bản nội bộ gồm: dòng đếm việc, bảng việc trễ (cột Việc, Trễ bao nhiêu ngày, Nguyên nhân, Người làm), ngân sách đã chi so với kế hoạch, ba việc phải xử lý tuần này, và mục "Điều chưa nói với khách hoặc sếp". Bản gửi ra ngoài gồm: một câu kết luận, việc đã xong, việc đang làm kèm ngày dự kiến, vấn đề và cách xử lý, điều cần người nhận quyết định kèm ngày, mốc tiếp theo. Bản gửi ra ngoài không quá 300 chữ. Mọi số chỉ lấy từ anh chị cung cấp, không bịa số liệu, chỗ nào thiếu ghi "chưa có số". Hỏi trước khi làm bất kỳ việc gì tốn tiền hoặc gửi ra ngoài. Báo cáo tiếng Việt một trang.

## Ba ca mẫu

### Ca 1: Xưởng mộc làm nội thất cho biệt thự
Đầu vào: Chủ xưởng 5 người dán bảng 14 hạng mục, 6 xong, 5 đang làm, 3 chưa bắt đầu, 2 việc quá hạn 5 ngày do gỗ về trễ, đã nhận 60 phần trăm tiền, mốc bàn giao còn 3 tuần (số giả định).
Bối cảnh: Khách là chủ nhà, đang sốt ruột, vừa nhắn Zalo hỏi lần thứ ba.
Đầu ra đạt chuẩn: Mức vàng, lý do là 2 việc trễ 5 ngày nằm trên đường găng. Bản nội bộ ghi rõ cần chốt với nhà cung cấp gỗ trong tuần và ba việc phải làm. Bản gửi khách mở đầu bằng "6 trên 14 hạng mục đã xong, tiến độ chậm 5 ngày do gỗ về trễ, xưởng đang xử lý và sẽ xác nhận ngày bàn giao mới trước thứ Sáu". Không hứa ngày mới khi chủ xưởng chưa chốt.
Tiêu chí chấm:
- Mức vàng có lý do gắn với 2 việc trễ trên đường găng.
- Hai bản cùng số 6 trên 14 và cùng số ngày trễ.
- Bản gửi khách không có ngày bàn giao mới tự đặt.
- Bản gửi khách dưới 300 chữ, không dùng từ chuyên môn của xưởng.
- Tin nhắn Zalo chỉ soạn nháp, chưa gửi.

### Ca 2: Nhân viên marketing trong công ty 40 người báo cáo sếp
Đầu vào: Nhân viên dán Google Sheets chiến dịch ra mắt sản phẩm, 20 việc, 12 xong, 3 quá hạn, ngân sách 120 triệu đã chi 95 triệu khi mới đi được nửa chặng, ngày ra mắt cứng còn 4 tuần (số giả định).
Bối cảnh: Nhân viên lo bị đánh giá nếu nói vượt chi, định để tuần sau mới báo.
Đầu ra đạt chuẩn: Mức đỏ vì ngân sách đã chi 79 phần trăm ở nửa chặng và có 3 việc quá hạn. Bản nội bộ ghi thẳng khoản chi nào vượt và lựa chọn cắt. Bản gửi sếp mở đầu bằng mức đỏ, đưa hai phương án gồm xin thêm ngân sách với số cụ thể hoặc cắt hạng mục nào, kèm hạn cần sếp quyết trước ngày nào. Mô hình nhắc rằng báo sớm cho sếp nhiều lựa chọn hơn, nhưng để nhân viên quyết định thời điểm.
Tiêu chí chấm:
- Phần trăm chi tính đúng từ 95 trên 120.
- Mức đỏ xuất hiện ở cả hai bản.
- Có hai phương án và ngày cần quyết định.
- Không tự điền số tiền xin thêm khi nhân viên chưa đưa.
- Không giục hay phán xét việc nhân viên định trì hoãn.

### Ca 3: Công ty phần mềm 15 người báo cáo khách hai tuần một lần
Đầu vào: Trưởng dự án dán bảng 30 hạng mục từ `ke-hoach-du-an`, 18 xong, không việc nào quá hạn, nhưng khách chưa gửi dữ liệu mẫu đã 10 ngày và 2 hạng mục sắp bị chặn (số giả định).
Bối cảnh: Khách là công ty lớn, người nhận là trưởng phòng bên khách, đọc email rất nhanh.
Đầu ra đạt chuẩn: Mức xanh cho hiện tại kèm cảnh báo sẽ chuyển vàng sau 5 ngày nếu chưa có dữ liệu mẫu. Bản gửi khách đặt yêu cầu dữ liệu mẫu ngay dưới câu kết luận, nêu rõ ngày cần có và hạng mục nào bị ảnh hưởng. Bản nội bộ ghi người phía công ty theo dõi việc này và phương án làm dữ liệu giả lập tạm nếu khách tiếp tục trễ.
Tiêu chí chấm:
- Mức xanh có kèm điều kiện chuyển vàng cụ thể.
- Yêu cầu dữ liệu mẫu nằm ở phần đầu bản gửi khách, có ngày cần có.
- Bản gửi khách đọc dưới 1 phút.
- Bản nội bộ có phương án dự phòng và người theo dõi.
- Email chỉ soạn nháp, có hỏi trưởng dự án duyệt trước.

## Nguồn
Chuyển thể từ `operations/skills/status-report` và `product-management/skills/stakeholder-update` trong anthropics/knowledge-work-plugins (Apache 2.0).
