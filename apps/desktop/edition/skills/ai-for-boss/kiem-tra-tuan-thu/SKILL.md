---
name: kiem-tra-tuan-thu
description: "Lập danh sách việc cần kiểm về tuân thủ cho một hoạt động như bán hàng online, thu thập dữ liệu khách, quảng cáo, khuyến mãi, lao động, và chỉ ra câu hỏi cần hỏi luật sư hoặc cơ quan quản lý."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "✅"
---

# Kiểm tra tuân thủ

## Khi nào dùng

Dùng trước khi anh chị bắt đầu một hoạt động có thể dính quy định, ví dụ mở bán online, làm form thu số điện thoại khách, chạy quảng cáo cho ngành có quy định riêng, tổ chức chương trình khuyến mãi hay bốc thăm trúng thưởng, tuyển thêm người, dùng ảnh hoặc lời chứng thực của khách. Kỹ năng này lập danh sách việc cần kiểm, đánh dấu mục nào anh chị đã có, mục nào chưa rõ, và soạn sẵn câu hỏi để hỏi luật sư, kế toán hoặc cơ quan quản lý. Trợ lý không thay luật sư. Trợ lý không trích số điều, số nghị định hay mức phạt khi chưa tra được văn bản gốc từ nguồn chính thức. Nếu có tra web, mỗi dẫn chiếu kèm đường dẫn và ngày tra.

Không dùng để rà một bản hợp đồng cụ thể, việc đó chuyển sang `ra-soat-hop-dong`. Không dùng để chuẩn bị chứng từ thuế, việc đó chuyển sang `chuan-bi-chung-tu-cho-ke-toan`. Soạn quy trình nội bộ sau khi đã rõ việc cần làm thì dùng `soan-quy-trinh-chuan`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm.

1. Anh chị định làm hoạt động gì, cụ thể ra sao, bắt đầu khi nào, trên kênh nào?
2. Doanh nghiệp đăng ký theo hình thức nào (hộ kinh doanh, công ty) và ngành nghề gì? Sản phẩm có thuộc nhóm có quy định riêng như thực phẩm, mỹ phẩm, thuốc, giáo dục, tài chính không?
3. Hoạt động có thu thập thông tin cá nhân của khách không, thu gì, lưu ở đâu (Google Sheets, phần mềm bán hàng, Zalo), ai được xem, có chia sẻ cho bên thứ ba như đơn vị quảng cáo không?
4. Có dùng tiền thưởng, quà tặng, giảm giá, bốc thăm hay trò chơi có giải không? Tổng giá trị giải thưởng dự kiến bao nhiêu?
5. Có tuyển người, dùng cộng tác viên, hay thay đổi hợp đồng với nhân viên không?
6. Anh chị đã có sẵn tài liệu nào như chính sách bảo mật, điều khoản bán hàng, giấy phép, hợp đồng mẫu? Dán hoặc đính kèm.

## Quy trình

1. Nói lại hoạt động trong hai câu và xác định các mảng có thể liên quan gồm đăng ký kinh doanh và giấy phép ngành, bảo vệ dữ liệu cá nhân, quảng cáo, khuyến mãi, thương mại điện tử, bảo vệ người tiêu dùng, lao động, sở hữu trí tuệ (ảnh, nhạc, nhãn hiệu), hoá đơn và thuế. Chỉ giữ những mảng thật sự dính tới hoạt động này.
2. Với mỗi mảng, lập danh sách việc cần kiểm bằng câu hỏi có hoặc không, ví dụ "Form có dòng xin đồng ý thu thập và nói rõ mục đích dùng số điện thoại không?", "Chương trình khuyến mãi có ghi rõ thời gian, điều kiện, giá trị giải thưởng không?", "Ảnh khách dùng trong quảng cáo đã có đồng ý bằng văn bản chưa?". Viết bằng lời thường, người không học luật đọc hiểu được.
3. Đối chiếu với thông tin và tài liệu anh chị đưa, đánh dấu từng mục là đã có, chưa có, chưa rõ. Mục nào anh chị chưa trả lời thì để "chưa rõ", không tự giả định là đã làm.
4. Nếu cần dẫn chiếu văn bản, tra web và chỉ dùng nguồn chính thức như cổng thông tin của Chính phủ, cơ sở dữ liệu văn bản pháp luật của cơ quan nhà nước, trang của bộ ngành quản lý. Ghi tên văn bản, đường dẫn, ngày tra, và nhắc văn bản có thể đã được sửa đổi. Không tra được thì ghi "chưa tra được văn bản gốc, cần luật sư xác nhận" và không nêu số điều hay mức phạt.
5. Chấm rủi ro từng mục chưa có hoặc chưa rõ theo ba mức cao, vừa, thấp dựa vào hậu quả nếu sai (bị phạt, bị gỡ bài, khách khiếu nại, mất uy tín) và khả năng xảy ra. Ghi lý do trong một câu. Không nêu mức phạt bằng tiền khi chưa có văn bản gốc.
6. Với mỗi mục rủi ro cao hoặc vừa, đề xuất việc cần làm cụ thể, ví dụ thêm dòng xin đồng ý vào form, soạn thể lệ khuyến mãi, xin giấy đồng ý dùng ảnh, và ai nên làm.
7. Soạn danh sách câu hỏi cho người có chuyên môn, chia theo người cần hỏi gồm luật sư, kế toán, cơ quan quản lý hoặc sở ngành địa phương. Mỗi câu nêu đủ bối cảnh để người được hỏi trả lời ngay.
8. Nếu anh chị muốn theo dõi các mốc như gia hạn giấy phép, hạn nộp báo cáo, lập bảng mốc và đề nghị lịch `cronjob` nhắc trước 14 ngày, chỉ đặt sau khi được đồng ý.
9. Trình bảng kiểm, các việc đề xuất và danh sách câu hỏi cho anh chị duyệt, hỏi "Anh chị xem giúp các mục đánh dấu chưa rõ, mục nào anh chị đã làm rồi?". Không tự gửi câu hỏi cho cơ quan nào. Khi anh chị chốt làm hay hoãn hoạt động, hoặc chốt mục nào xử lý trước, gọi `aifb_record_decision`.

## Tiêu chuẩn đầu ra

Một bảng kiểm tiếng Việt gọn gàng, cẩn trọng, đạt các điểm sau:

- Tóm tắt đầu trang một câu với ba khả năng gồm có thể làm, làm được khi xử lý xong các mục cao, cần hỏi chuyên môn trước.
- Bảng theo mảng gồm việc cần kiểm, trạng thái đã có, chưa có, chưa rõ, mức rủi ro, việc cần làm.
- Mọi dẫn chiếu văn bản có tên, đường dẫn nguồn chính thức và ngày tra, không có số điều hay mức phạt tự nhớ.
- Danh sách câu hỏi chia theo luật sư, kế toán, cơ quan quản lý.
- Câu nhắc rõ ràng rằng đây là bảng kiểm để chuẩn bị, cần luật sư hoặc người có chuyên môn xác nhận.
- Không tự gửi, không tự nộp, không tự sửa tài liệu gốc của anh chị.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh mỹ phẩm handmade mở bán qua Facebook và Shopee
Đầu vào: Chủ shop tự nấu xà phòng và son, định chạy quảng cáo với câu "trị mụn sau 7 ngày", có form Google thu số điện thoại để tặng mẫu thử.
Bối cảnh: Chưa từng hỏi về giấy tờ cho mỹ phẩm.
Đầu ra đạt chuẩn: Bảng kiểm có mảng giấy phép ngành mỹ phẩm, quảng cáo, dữ liệu cá nhân. Câu "trị mụn sau 7 ngày" đánh dấu rủi ro cao vì là cam kết công dụng. Form thiếu dòng xin đồng ý, đề xuất câu mẫu. Câu hỏi cho cơ quan quản lý về thủ tục công bố sản phẩm, ghi rõ chưa tra được văn bản gốc nếu tra không ra.
Tiêu chí chấm:
- Không nêu số nghị định hay mức phạt khi chưa tra được.
- Câu quảng cáo cam kết công dụng được đánh dấu cao.
- Có đề xuất câu xin đồng ý cho form.
- Có câu hỏi cho cơ quan quản lý.

### Ca 2: Công ty giáo dục 50 người tổ chức bốc thăm trúng thưởng
Đầu vào: Giám đốc định cho học viên đăng ký trong tháng 10 bốc thăm một chiếc xe máy, tổng giải thưởng khoảng 40 triệu (số giả định), thu thông tin qua website.
Bối cảnh: Muốn triển khai trong hai tuần.
Đầu ra đạt chuẩn: Bảng kiểm có mảng khuyến mãi, dữ liệu cá nhân, hoá đơn và thuế cho giải thưởng. Đánh dấu thủ tục khuyến mãi có giải là mục cần hỏi chuyên môn trước khi công bố. Dẫn chiếu nào tra được đều có đường dẫn và ngày tra. Câu hỏi riêng cho kế toán về cách ghi nhận giải thưởng.
Tiêu chí chấm:
- Nhắc kiểm thủ tục trước khi công bố chương trình.
- Dẫn chiếu có nguồn chính thức và ngày tra.
- Có câu hỏi riêng cho kế toán.
- Gọi `aifb_record_decision` khi giám đốc chốt làm hay hoãn.

### Ca 3: Chuyên gia coaching tự do thu email qua trang đăng ký
Đầu vào: Chị dùng trang đăng ký thu tên, email, số điện thoại, gửi thông tin sang công cụ gửi thư ở nước ngoài, dùng ảnh học viên cũ trên trang.
Bối cảnh: Làm một mình, chưa có chính sách bảo mật.
Đầu ra đạt chuẩn: Bảng kiểm tập trung vào dữ liệu cá nhân và quyền dùng ảnh. Đánh dấu việc chuyển dữ liệu cho công cụ nước ngoài là mục chưa rõ cần hỏi luật sư. Đề xuất bản nháp chính sách bảo mật một trang bằng lời thường kèm ghi chú cần luật sư rà, và mẫu xin phép dùng ảnh.
Tiêu chí chấm:
- Nêu rõ việc chuyển dữ liệu ra nước ngoài cần hỏi chuyên môn.
- Có mẫu xin phép dùng ảnh.
- Việc đề xuất vừa sức một người.
- Không khẳng định chị đang vi phạm hay không vi phạm.
- Có câu hỏi duyệt trước khi dùng bản nháp chính sách.

## Nguồn
Chuyển thể từ `legal/skills/compliance-check` và `operations/skills/compliance-tracking` trong anthropics/knowledge-work-plugins (Apache 2.0), cùng `skills/legal/compliance-checklists` trong viethahong/business-skills (MIT).
