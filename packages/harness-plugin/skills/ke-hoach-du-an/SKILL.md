---
name: ke-hoach-du-an
description: "Phân rã một mục tiêu thành bảng công việc có phụ thuộc, người làm, mốc và rủi ro, dán thẳng vào Excel hoặc Google Sheets, dùng khi anh chị bắt đầu một dự án hay đơn hàng lớn."
metadata: { "openclaw": { "emoji": "🗂️" } }
---

# Kế hoạch dự án

## Khi nào dùng

Dùng khi anh chị đã có một mục tiêu hoặc một việc lớn cần làm xong trong vài tuần tới vài tháng, ví dụ mở chi nhánh mới, ra mắt sản phẩm, làm một đơn hàng lớn, tổ chức sự kiện, và cần biết ai làm gì, việc nào phải xong trước, mốc nào không được trễ. Kết quả là một bảng việc dán được vào Excel hoặc Google Sheets. Không dùng khi anh chị chưa rõ muốn đạt gì, hãy dùng `muc-tieu-quy` trước. Không dùng để theo dõi tiến độ sau khi đã chạy, việc đó chuyển sang `theo-doi-tien-do`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi làm. Không tự đoán ngày, số người, ngân sách hay tên ai.

1. Mục tiêu của dự án là gì, và làm xong thì trông thế nào? Một câu là đủ.
2. Hạn cuối là ngày nào, và hạn đó cứng (khách đã hẹn, sự kiện đã đặt) hay mềm (anh chị tự đặt)?
3. Ai tham gia, mỗi người mỗi tuần dành được bao nhiêu giờ cho dự án này ngoài việc thường ngày? Có ai nghỉ phép hay bận việc khác trong giai đoạn này không?
4. Ngân sách tối đa là bao nhiêu, và có khoản nào phải chi trước khi bắt đầu không?
5. Có việc nào phụ thuộc bên ngoài không, ví dụ chờ nhà cung cấp, giấy phép, khách duyệt mẫu, thợ bên ngoài?
6. Anh chị đã từng làm việc tương tự chưa? Lần đó trễ ở đâu hoặc tốn hơn dự tính ở khoản nào?

## Quy trình

1. Viết lại mục tiêu thành một câu có điều kiện hoàn thành rõ ràng và xác nhận với anh chị. Ví dụ "Khai trương chi nhánh Thủ Đức ngày 15/11 với đủ 4 nhân viên đã đào tạo và 30 khách đặt trước". Nếu câu của anh chị chưa có điều kiện đo được, hỏi thêm.
2. Phân rã ngược từ ngày hoàn thành. Liệt kê các nhóm việc lớn, rồi trong mỗi nhóm liệt kê việc nhỏ đủ để một người làm trong 1 đến 5 ngày. Việc nào dài hơn một tuần thì tách tiếp. Với mỗi việc hỏi anh chị ước lượng số ngày; nếu anh chị không biết, ghi "chưa có số" và đánh dấu là việc cần ước lượng lại sau khi hỏi người làm.
3. Xác định phụ thuộc. Với mỗi việc, hỏi "việc này cần việc nào xong trước?" và "việc này chờ ai bên ngoài?". Đánh dấu chuỗi việc dài nhất từ đầu đến cuối, đó là đường găng (critical path); bất kỳ việc nào trên chuỗi đó trễ một ngày thì cả dự án trễ một ngày. Phụ thuộc bên ngoài luôn được ghi kèm người theo dõi và ngày cần có.
4. Gán người làm theo số giờ thật mà anh chị đã cho. Cộng giờ của từng người theo tuần; nếu ai vượt quá khoảng 80 phần trăm thời gian rảnh, báo cho anh chị và đề xuất ba lựa chọn: lùi mốc, bớt việc, hoặc thêm người. Không giả định ai có thể làm hai việc cùng lúc. Mỗi việc chỉ có một người chịu trách nhiệm chính.
5. Đặt mốc (milestone). Tối đa 5 mốc, mỗi mốc là một kết quả kiểm tra được, có ngày cụ thể. Mốc đầu tiên nên rơi trong 2 tuần đầu để anh chị sớm biết kế hoạch có sát thực tế không. Kiểm tra mốc cuối có trùng hạn cứng không; nếu kế hoạch vượt hạn, nói thẳng và hỏi anh chị chọn cắt gì.
6. Liệt kê rủi ro. Với mỗi phụ thuộc bên ngoài, mỗi người bị dồn việc, mỗi việc ghi "chưa có số", viết một dòng rủi ro gồm điều gì có thể xảy ra, ảnh hưởng tới mốc nào, và cách xử lý trước. Tối đa 6 rủi ro, xếp theo mức ảnh hưởng tới đường găng. Có thể hỏi lại kinh nghiệm lần trước của anh chị để bổ sung.
7. Xuất bảng việc và đưa anh chị duyệt trước khi lưu ra tệp hay chia sẻ cho đội. Hỏi rõ anh chị muốn dán vào Excel hay Google Sheets để chọn định dạng phân cách. Không tự gửi cho ai, không tự đặt lịch, không tự đặt hàng. Nhắc anh chị dùng `theo-doi-tien-do` hàng tuần trên chính bảng này. Khi người dùng chốt một quyết định trong việc này, gọi công cụ `aifb_record_decision` để ghi vào sổ quyết định.

## Tiêu chuẩn đầu ra

Một trang tiếng Việt gồm ba phần. Phần một là dòng mục tiêu và bảng mốc (cột Mốc, Ngày, Điều kiện đạt). Phần hai là bảng việc dạng văn bản phân cách bằng tab, dán thẳng vào Excel hoặc Google Sheets thành đúng cột, với các cột theo thứ tự: Mã việc, Nhóm việc, Tên việc, Người làm, Số ngày, Ngày bắt đầu, Ngày xong, Phụ thuộc vào mã việc nào, Thuộc đường găng (Có hoặc Không), Ghi chú. Phần ba là bảng rủi ro (cột Rủi ro, Ảnh hưởng mốc nào, Cách xử lý trước, Người theo dõi). Mọi số ngày, giờ, tiền chỉ lấy từ anh chị cung cấp, không bịa số liệu, chỗ nào thiếu ghi "chưa có số". Hỏi trước khi làm bất kỳ việc gì tốn tiền hoặc gửi ra ngoài. Báo cáo tiếng Việt một trang.

## Ba ca mẫu

### Ca 1: Tiệm bánh mở chi nhánh thứ hai
Đầu vào: Chủ tiệm bánh có 1 tiệm, 7 nhân viên, muốn mở chi nhánh thứ hai, đã ký thuê mặt bằng, khai trương mong muốn sau 8 tuần, ngân sách 350 triệu, chủ dành 15 giờ mỗi tuần, quản lý tiệm cũ dành 10 giờ (số giả định).
Bối cảnh: Lần trước sửa tiệm đầu trễ 3 tuần vì thợ điện.
Đầu ra đạt chuẩn: Bảng việc khoảng 20 đến 30 dòng, nhóm thành sửa chữa, thiết bị, nhân sự, giấy phép, truyền thông khai trương. Chuỗi sửa chữa được đánh dấu đường găng. Rủi ro số một là thợ điện trễ, cách xử lý là chốt hợp đồng có ngày phạt và đặt lịch thợ dự phòng. Mốc đầu là "hoàn tất bản vẽ và báo giá sửa chữa" trong tuần 2.
Tiêu chí chấm:
- Bảng dán vào Google Sheets thành đúng 10 cột.
- Đường găng được đánh dấu và đi qua nhóm sửa chữa.
- Rủi ro thợ điện lấy từ kinh nghiệm chủ tiệm kể, có cách xử lý trước.
- Giờ của chủ và quản lý không vượt 15 và 10 giờ mỗi tuần.
- Không tự điền giá thiết bị, ghi "chưa có số".

### Ca 2: Công ty phần mềm 15 người triển khai cho khách
Đầu vào: Trưởng dự án dán danh sách 18 hạng mục từ hợp đồng, hạn bàn giao cứng ngày 30/11, có 3 lập trình viên mỗi người 30 giờ mỗi tuần cho dự án này, 1 người nghỉ phép 1 tuần giữa tháng 11, khách cần duyệt giao diện trước khi làm tiếp (số giả định).
Bối cảnh: Hai hạng mục chờ khách cung cấp dữ liệu mẫu.
Đầu ra đạt chuẩn: Bảng việc gắn mã, phụ thuộc "chờ khách duyệt giao diện" và "chờ dữ liệu mẫu" ghi rõ người theo dõi phía công ty và ngày cần có. Tuần nghỉ phép được trừ khỏi giờ của người đó. Nếu tổng giờ vượt hạn 30/11, mô hình nêu rõ số ngày thiếu và ba lựa chọn cắt phạm vi, thêm người, hoặc thương lượng lùi hạn với khách.
Tiêu chí chấm:
- Hai phụ thuộc bên ngoài đều có người theo dõi và ngày cần có.
- Tuần nghỉ phép được trừ đúng.
- Nếu vượt hạn, có nói thẳng kèm số ngày thiếu.
- Mỗi việc chỉ có một người chịu trách nhiệm chính.
- Bảng duyệt xong mới hỏi lưu, không tự gửi khách.

### Ca 3: Giảng viên tự do tổ chức khoá học trực tiếp 2 ngày
Đầu vào: Một người làm một mình, tổ chức lớp 30 người sau 6 tuần, đã đặt cọc phòng, ngân sách còn 40 triệu, rảnh 12 giờ mỗi tuần, chưa có tài liệu in, chưa mở đăng ký (số giả định).
Bối cảnh: Muốn có ít nhất 20 người đăng ký trước 2 tuần để không lỗ.
Đầu ra đạt chuẩn: Mốc "20 người đăng ký" đặt ở tuần 4 kèm điều kiện đạt rõ. Bảng việc gọn khoảng 12 đến 15 dòng, mọi việc gán cho chính giảng viên và tổng giờ mỗi tuần không vượt 12 giờ. Rủi ro số một là không đủ 20 người, cách xử lý là đặt điểm quyết định ở tuần 4 để huỷ hoặc dời, tránh mất thêm chi phí in ấn.
Tiêu chí chấm:
- Tổng giờ mỗi tuần không vượt 12 giờ.
- Có điểm quyết định huỷ hoặc dời trước khi chi thêm tiền.
- Chi phí in ấn ghi "chưa có số" nếu giảng viên chưa báo giá.
- Mở đăng ký được xếp trước việc làm tài liệu in.
- Có gọi `aifb_record_decision` khi chốt ngày điểm quyết định.

## Nguồn
Chuyển thể từ `product-management/skills/sprint-planning` và `operations/skills/capacity-plan` trong anthropics/knowledge-work-plugins (Apache 2.0).
