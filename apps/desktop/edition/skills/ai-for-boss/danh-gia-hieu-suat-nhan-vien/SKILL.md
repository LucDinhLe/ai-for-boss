---
name: danh-gia-hieu-suat-nhan-vien
description: "Chuẩn bị kỳ đánh giá nhân viên gồm mẫu tự đánh giá, bản đánh giá của quản lý dựa trên dữ kiện và chỉ số, kịch bản buổi trao đổi một một và kế hoạch phát triển 30 đến 90 ngày, tránh nhận xét cảm tính."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "📋"
---

# Đánh giá hiệu suất nhân viên

## Khi nào dùng

Dùng khi tới kỳ đánh giá tháng, quý hoặc năm, khi anh chị cần viết nhận xét cho một nhân viên, chuẩn bị buổi trao đổi một một (1:1), hoặc cần mẫu tự đánh giá gửi cả nhóm. Kỹ năng này gom dữ kiện trong kỳ, đối chiếu với mục tiêu đã giao đầu kỳ, viết nhận xét dựa trên hành vi và kết quả cụ thể, rồi lập kế hoạch phát triển. Mỗi nhận xét phải có bằng chứng, câu nào chỉ là cảm giác thì trợ lý hỏi lại anh chị ví dụ cụ thể.

Không dùng để đặt mục tiêu quý cho công ty, việc đó chuyển sang `muc-tieu-quy`. Không dùng để quyết định cho nghỉ việc, kỷ luật hay giảm lương, những việc đó có yếu tố pháp lý lao động, cần người phụ trách nhân sự hoặc luật sư xác nhận. Người mới trong hai tháng đầu thì dùng `hoi-nhap-nhan-vien-moi`, còn tổng kết tuần của cả nhóm thì dùng `ra-soat-tuan`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm.

1. Đánh giá ai, vị trí gì, kỳ nào? Cần mẫu tự đánh giá, bản của quản lý, kịch bản trao đổi một một, hay cả ba?
2. Đầu kỳ đã giao mục tiêu hoặc chỉ số (KPI) gì cho người này? Nếu chưa giao, nói rõ để bản đánh giá chỉ ở mức định tính.
3. Dữ liệu kết quả trong kỳ có gì, ví dụ bảng doanh số, số đơn xử lý, tỉ lệ đúng hạn, số lần khách phàn nàn? Dán tệp Excel, báo cáo từ phần mềm hoặc tin nhắn nhóm.
4. Anh chị ghi lại được hai đến ba tình huống cụ thể trong kỳ, cả tốt lẫn chưa tốt, có ngày tháng không?
5. Công ty có thang điểm hay mẫu đánh giá riêng không? Kết quả đánh giá có gắn với thưởng hay tăng lương không?
6. Nhân viên đã nộp tự đánh giá chưa? Nếu có, dán vào.

## Quy trình

1. Nếu anh chị cần mẫu tự đánh giá, soạn mẫu gồm ba đến năm kết quả nổi bật (bối cảnh, việc mình làm, kết quả đo được), bảng mục tiêu đầu kỳ với trạng thái và bằng chứng, điều khó khăn và sẽ làm khác, mục tiêu kỳ sau, điều cần quản lý hỗ trợ. Viết câu hỏi dễ trả lời cho người không quen viết.
2. Đối chiếu mục tiêu đầu kỳ với dữ liệu thực tế bằng Python khi có bảng số. Ghi đạt, vượt, chưa đạt kèm số cụ thể, và xu hướng trong kỳ đi lên hay đi xuống. Mục tiêu nào không có dữ liệu thì ghi "chưa có số".
3. Viết điểm mạnh và điểm cần cải thiện, mỗi điểm gắn với một hành vi hoặc kết quả có ngày tháng. Viết theo hành vi, ví dụ "nộp báo cáo trễ 3 lần trong tháng 8 không báo trước", tránh gán tính cách như "thiếu trách nhiệm".
4. Tự rà công bằng trước khi giao bản nháp. Đánh dấu mọi câu thiếu bằng chứng và hỏi anh chị ví dụ. Kiểm bản đánh giá có bị kéo lệch bởi sự việc gần nhất, bởi một lỗi lớn duy nhất, hay bởi so sánh với người khác thay vì với mục tiêu không. Kiểm có điều nào nhân viên nghe lần đầu trong buổi đánh giá không, nếu có thì nhắc anh chị lần sau nên góp ý ngay khi sự việc xảy ra.
5. Nếu công ty có thang điểm, đề xuất mức theo thang đó kèm lý do. Nếu không có, dùng ba mức vượt kỳ vọng, đạt kỳ vọng, dưới kỳ vọng. Mức cuối cùng do anh chị chốt.
6. Lập kế hoạch phát triển 30, 60, 90 ngày gồm hai đến ba kỹ năng cần nâng, việc thực tế để luyện (dự án, kèm cặp, khoá học), cách đo tiến bộ, ngày rà lại. Gắn với mục tiêu kỳ sau.
7. Soạn kịch bản buổi trao đổi một một khoảng 45 phút gồm mở đầu hỏi nhân viên tự nhìn lại kỳ qua, ghi nhận điểm mạnh bằng ví dụ, trao đổi điểm cần cải thiện bằng dữ kiện và hỏi nguyên nhân từ phía họ, thống nhất kế hoạch phát triển, hỏi nhân viên cần gì từ quản lý. Kèm ba câu hỏi mở và cách phản hồi khi nhân viên không đồng ý.
8. Trình bản đánh giá và kịch bản cho anh chị duyệt, hỏi "Anh chị kiểm giúp từng nhận xét đã có ví dụ đúng chưa và mức đánh giá anh chị chốt là gì?". Không tự gửi cho nhân viên. Nhắc bản đánh giá là tài liệu kín, chỉ quản lý và người được đánh giá xem. Gọi `aifb_record_decision` khi anh chị chốt mức đánh giá và kế hoạch phát triển.
9. Nếu anh chị muốn, đặt lịch `cronjob` nhắc rà kế hoạch phát triển vào ngày 30, 60, 90, chỉ đặt sau khi được đồng ý.

## Tiêu chuẩn đầu ra

Tài liệu tiếng Việt công bằng, rõ ràng, đạt các điểm sau:

- Bảng mục tiêu đầu kỳ, kết quả thực tế, trạng thái, bằng chứng, chỗ thiếu ghi "chưa có số".
- Điểm mạnh và điểm cần cải thiện, mỗi điểm gắn một hành vi hoặc kết quả cụ thể có thời gian.
- Không có câu gán tính cách, không có nhận xét về đời tư, sức khoẻ, tuổi, giới tính hay hoàn cảnh gia đình.
- Kế hoạch phát triển 30, 60, 90 ngày có việc cụ thể và cách đo.
- Kịch bản trao đổi một một có câu hỏi mở và thời lượng từng phần.
- Không đưa lời khuyên về kỷ luật, sa thải hay lương thưởng như lời khuyên pháp lý, luôn nhắc cần người có chuyên môn xác nhận.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh quán cơm có 4 nhân viên
Đầu vào: Chủ quán muốn đánh giá cuối năm cho bếp phó, không có chỉ số đầu năm, chỉ nhớ "làm tốt nhưng hay đi trễ".
Bối cảnh: Lần đầu làm đánh giá chính thức, muốn gắn với thưởng Tết.
Đầu ra đạt chuẩn: Trợ lý nói rõ bản đánh giá chỉ ở mức định tính vì chưa giao chỉ số đầu năm. Hỏi chủ quán ví dụ cụ thể cho "làm tốt" và số lần đi trễ, dựa vào sổ chấm công nếu có. Kế hoạch năm sau có ba chỉ số đơn giản như tỉ lệ món đúng giờ, số lần đi trễ, món mới đề xuất.
Tiêu chí chấm:
- Không viết "làm tốt" khi chưa có ví dụ.
- Nói rõ giới hạn khi thiếu chỉ số.
- Đề xuất chỉ số vừa sức quán nhỏ.
- Mức thưởng do chủ quán chốt.
- Có câu hỏi duyệt trước khi đưa bản đánh giá cho bếp phó.

### Ca 2: Công ty phân phối 30 người đánh giá quý cho nhân viên kinh doanh
Đầu vào: Trưởng phòng dán bảng doanh số quý, người này đạt 82 phần trăm chỉ tiêu, tỉ lệ chốt tăng từ 18 lên 24 phần trăm, hai lần khách phàn nàn giao sai hàng (số giả định). Tự đánh giá của nhân viên ghi "đạt".
Bối cảnh: Công ty dùng thang 5 điểm.
Đầu ra đạt chuẩn: Bảng mục tiêu ghi chưa đạt doanh số nhưng tỉ lệ chốt tăng rõ. Điểm cần cải thiện nêu hai lần giao sai với ngày cụ thể. Đề xuất mức 3 trên 5 kèm lý do, để trưởng phòng chốt. Kịch bản một một có phần xử lý khi nhân viên cho rằng mình đã đạt.
Tiêu chí chấm:
- Số liệu đúng bảng được dán.
- Ghi nhận cả điểm tiến bộ lẫn điểm chưa đạt.
- Có cách phản hồi khi nhân viên không đồng ý.
- Gọi `aifb_record_decision` khi chốt mức.

### Ca 3: Trưởng nhóm thiết kế tự do quản lý 2 cộng tác viên
Đầu vào: Anh cần mẫu tự đánh giá gửi cho 2 cộng tác viên và kịch bản trao đổi 30 phút qua Google Meet.
Bối cảnh: Cộng tác viên làm theo dự án, không có hợp đồng lao động.
Đầu ra đạt chuẩn: Mẫu tự đánh giá ngắn năm câu hỏi theo dự án đã làm. Kịch bản 30 phút tập trung vào chất lượng bản giao, đúng hạn và số lần sửa. Không dùng ngôn ngữ đánh giá nhân viên chính thức, ghi chú rằng quan hệ cộng tác viên khác quan hệ lao động và cần người có chuyên môn nếu muốn ràng buộc.
Tiêu chí chấm:
- Mẫu vừa với cộng tác viên theo dự án.
- Kịch bản đúng 30 phút.
- Có tiêu chí đo được như số lần sửa.
- Không tự gửi mẫu cho cộng tác viên.

## Nguồn
Chuyển thể từ `human-resources/skills/performance-review` trong anthropics/knowledge-work-plugins (Apache 2.0), `skills/hr/performance-review` trong viethahong/business-skills (MIT), và `skills/vi/65-team-performance-review` trong minhnv0807/ai-business-skills (MIT).
