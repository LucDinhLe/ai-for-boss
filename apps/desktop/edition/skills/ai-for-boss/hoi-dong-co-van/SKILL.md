---
name: hoi-dong-co-van
description: "Lấy năm góc nhìn độc lập về tài chính, khách hàng, vận hành, rủi ro và phản biện cho một quyết định lớn rồi tổng hợp thành bảng đồng thuận, bất đồng, điều cần kiểm và lựa chọn đề xuất; tốn nhiều token."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "🏛️"
---

# Hội đồng cố vấn

## Khi nào dùng

Dùng khi anh chị đứng trước một quyết định lớn, khó đảo ngược, chạm tới nhiều mảng cùng lúc, ví dụ có nên mở chi nhánh ở tỉnh khác, tăng giá 20 phần trăm, nhận vốn góp của một đối tác, cắt một dòng sản phẩm đang lỗ, tuyển giám đốc vận hành. Kỹ năng này mời năm góc nhìn độc lập ngồi vào một hội đồng, gồm tài chính, khách hàng, vận hành, rủi ro và một người phản biện, cho mỗi góc nhìn nói ý của mình trước khi nghe các góc khác, rồi tổng hợp thành một bảng để anh chị quyết. Giá trị nằm ở chỗ các góc nhìn bất đồng với nhau, một hội đồng đồng ý hết chỉ là tấm gương.

Cách làm này tốn gấp năm đến bảy lần token so với một câu trả lời thường, vì mỗi góc nhìn là một lượt suy nghĩ riêng, cộng thêm lượt tổng hợp. Chỉ dùng cho quyết định quan trọng. Câu hỏi thường ngày hay việc thuộc một mảng rõ ràng thì trả lời thẳng hoặc dùng kỹ năng chuyên môn tương ứng.

Không dùng để soi kỹ một kế hoạch đã chọn xem nó có thể hỏng ở đâu, việc đó chuyển sang `tien-kiem-that-bai`. Không dùng để đặt mục tiêu quý, việc đó chuyển sang `muc-tieu-quy`. Muốn giao một việc cụ thể cho trợ lý phụ làm song song, chuyển sang `giao-viec-cho-tro-ly-phu`; muốn trợ lý đóng một vai cố định lâu dài, chuyển sang `doi-tro-ly-theo-vai`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Nói trước với anh chị rằng việc này tốn nhiều token và hỏi anh chị có muốn đi tiếp không.

1. Quyết định cần chốt là gì, viết trong một câu có hoặc không, hay chọn A, B, C?
2. Vì sao phải quyết lúc này, hạn chót là khi nào, và nếu không quyết thì chuyện gì xảy ra?
3. Anh chị dán các số liệu liên quan được không, như doanh thu, chi phí, dòng tiền, số khách, báo giá, bảng tính của đối tác? Tệp Excel, ảnh chụp hay gõ tay đều được.
4. Có ràng buộc nào không đổi được như số vốn tối đa, cam kết với nhân sự, hợp đồng đang ký?
5. Anh chị đang nghiêng về phương án nào và vì sao? Câu này giúp chọn người phản biện đúng hướng.
6. Ngoài năm góc nhìn mặc định, anh chị muốn thêm hay thay góc nào, ví dụ nhân sự, thương hiệu, gia đình?

## Quy trình

1. Kiểm sổ quyết định để xem những điều anh chị đã chốt trước đây có liên quan, đưa vào làm bối cảnh chung. Viết một bản tóm tắt bối cảnh dùng chung cho mọi góc nhìn, gồm câu hỏi quyết định, số liệu anh chị đưa, ràng buộc, hạn chót. Chỉ dùng số anh chị đưa hoặc đã tra có nguồn.
2. Chọn hội đồng. Năm ghế mặc định là tài chính (tiền, lãi lỗ, dòng tiền, thời gian hoàn vốn), khách hàng (khách sẽ phản ứng ra sao, mất hay được khách nào), vận hành (người, quy trình, năng lực thực thi), rủi ro (điều gì có thể hỏng, pháp lý, uy tín, phụ thuộc bên ngoài) và người phản biện. Người phản biện được giao nhiệm vụ chống lại phương án anh chị đang nghiêng về, bằng lập luận mạnh nhất có thể.
3. Lấy ý kiến độc lập. Nếu công cụ `delegate_task` có trong phiên, giao mỗi góc nhìn cho một trợ lý phụ chạy riêng với cùng bản bối cảnh, để các ý không ám nhau. Nếu không có công cụ đó, tự đóng từng vai lần lượt, viết xong ý của vai này rồi mới sang vai sau, không sửa ý vai trước sau khi đọc vai sau. Mỗi góc nhìn trả về tối đa năm ý chính, mỗi ý ghi rõ là dựa trên số liệu hay là giả định, kèm một khuyến nghị rõ ràng, mức tự tin cao, vừa hoặc thấp, và điều gì sẽ khiến góc nhìn này đổi ý.
4. Soát lại toàn bộ ý kiến như một người phản biện thứ hai. Chỗ nào các góc nhìn đồng ý quá dễ dàng, giả định nào tất cả cùng tin mà chưa ai kiểm, tiếng nói nào đang vắng mặt như nhân viên tuyến đầu hay khách cũ, rủi ro nào chưa ai nhắc.
5. Tổng hợp thành một bảng gồm bốn phần. Đồng thuận là những điểm mọi góc nhìn cùng thấy. Bất đồng là hai đến bốn chỗ các góc nhìn va nhau, mỗi chỗ gọi tên sự đánh đổi bên dưới, ví dụ "tài chính và khách hàng ở đây thật ra là lãi ngắn hạn đổi lấy lòng trung thành". Điều cần kiểm thêm là những giả định phải xác minh trước khi quyết, mỗi điều có cách kiểm. Lựa chọn đề xuất là phương án hội đồng nghiêng về, điều kiện để nó đúng, và phương án dự phòng nếu anh chị không đồng ý.
6. Trình bảng tổng hợp và dừng hẳn chờ anh chị. Hỏi "Anh chị chọn phương án nào, sửa gì, hay cần hỏi thêm góc nhìn nào?". Quyết định cuối thuộc về anh chị; ý anh chị sửa là ý được ghi, trợ lý không cãi lại bằng lời của một góc nhìn.
7. Khi anh chị chốt, gọi `aifb_record_decision` với nội dung quyết định, căn cứ chính, phương án đã loại, các rủi ro đã chấp nhận, người chịu trách nhiệm và ngày rà lại. Chỉ ghi điều anh chị đã chốt, không ghi ý kiến của các góc nhìn như thể đó là quyết định. Việc tiếp theo nào tốn tiền hay gửi ra ngoài thì soạn nháp và chờ "làm đi".

## Tiêu chuẩn đầu ra

Một bản tiếng Việt khoảng hai trang, theo thứ tự "Câu hỏi quyết định", "Hội đồng và lý do chọn", năm khối ý kiến ngắn mỗi khối tối đa năm ý có ghi số liệu hay giả định, "Soát lại của người phản biện", rồi bảng tổng hợp "Đồng thuận", "Bất đồng", "Điều cần kiểm thêm", "Lựa chọn đề xuất", và một câu hỏi chốt. Đầu bản ghi rõ các góc nhìn là vai do trợ lý đóng, chưa có chuyên gia thật nào xem. Không bịa số, không bịa lời chuyên gia hay người nổi tiếng. Phần thuế, pháp lý, lao động chỉ nêu là rủi ro cần kế toán hoặc luật sư xác nhận. Trợ lý không chốt thay anh chị. Giọng thẳng thắn, cụ thể, chắc chắn ở chỗ có số liệu và dè dặt ở chỗ chỉ là giả định.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh spa định vay 500 triệu để mở cơ sở hai
Đầu vào: Chủ spa có doanh thu trung bình 180 triệu một tháng, lãi ròng khoảng 35 triệu, định vay ngân hàng 500 triệu, lãi suất chủ spa tự đưa là 10 phần trăm một năm, trả trong ba năm (số giả định). Chủ spa nghiêng về làm ngay trước Tết.
Bối cảnh: Phiên không có `delegate_task`, trợ lý tự đóng từng vai.
Đầu ra đạt chuẩn: Đầu bản nói rõ việc này tốn nhiều token và các vai được viết lần lượt, mỗi vai viết xong mới sang vai sau. Góc tài chính tính riêng tiền gốc phải trả khoảng 13,9 triệu mỗi tháng chưa kể lãi và so với lãi ròng 35 triệu. Người phản biện lập luận chống việc mở trước Tết vì mùa cao điểm cần chủ spa ở cơ sở một. Bảng bất đồng gọi tên đánh đổi giữa bắt kịp mùa Tết và rủi ro cơ sở một đuối. Điều cần kiểm thêm gồm lượng khách thực tế ở khu vực mới.
Tiêu chí chấm:
- Tiền gốc khoảng 13,9 triệu mỗi tháng tính đúng từ 500 triệu chia 36 tháng.
- Dùng đúng lãi suất chủ spa đưa, không tự thay số khác.
- Người phản biện chống lại đúng phương án chủ spa đang nghiêng.
- Các vai viết tuần tự, không sửa ý vai trước.
- Dừng chờ chủ spa chốt, không kết luận thay.

### Ca 2: Công ty logistics 50 người cân nhắc nhận hợp đồng độc quyền với một sàn thương mại điện tử
Đầu vào: Giám đốc dán bản đề nghị của sàn, cam kết sản lượng 3.000 đơn mỗi ngày, đổi lại công ty không nhận khách sàn khác trong hai năm; hiện khách từ sàn khác chiếm 40 phần trăm doanh thu (số giả định).
Bối cảnh: Phiên có công cụ `delegate_task`.
Đầu ra đạt chuẩn: Năm góc nhìn được giao cho năm trợ lý phụ với cùng bản bối cảnh. Góc khách hàng nêu việc mất 40 phần trăm doanh thu từ sàn khác. Góc rủi ro nêu phụ thuộc một khách lớn và điều khoản độc quyền cần luật sư xem. Phần soát lại chỉ ra các góc nhìn đều giả định sàn giữ đúng cam kết sản lượng mà chưa ai hỏi điều khoản phạt nếu sàn không đạt. Lựa chọn đề xuất kèm điều kiện và phương án dự phòng. Khi giám đốc chốt, gọi `aifb_record_decision`.
Tiêu chí chấm:
- Dùng `delegate_task` khi công cụ có trong phiên.
- Nêu được rủi ro phụ thuộc một khách lớn.
- Không đưa kết luận pháp lý về điều khoản độc quyền.
- Có ít nhất hai chỗ bất đồng được gọi tên đánh đổi.
- Ghi quyết định đúng lời giám đốc.

### Ca 3: Chuyên gia đào tạo tự do phân vân nhận làm nhân viên toàn thời gian cho một khách hàng lớn
Đầu vào: Người dùng hiện có thu nhập dao động 25 đến 45 triệu một tháng từ nhiều khách, được mời làm toàn thời gian lương 38 triệu, phải bỏ các khách khác (số giả định). Người dùng muốn thêm góc nhìn gia đình.
Bối cảnh: Quyết định cá nhân, khó quay lại tệp khách cũ sau một năm.
Đầu ra đạt chuẩn: Hội đồng có sáu ghế với góc gia đình được thêm theo yêu cầu. Góc tài chính so thu nhập ổn định 38 triệu với khoảng dao động cũ và không đưa lời khuyên thuế thu nhập. Người phản biện chống lại phương án người dùng đang nghiêng. Điều cần kiểm thêm gồm hỏi khách lớn về thời hạn thử việc và khả năng làm bán thời gian. Bảng tổng hợp để người dùng tự chốt.
Tiêu chí chấm:
- Thêm góc nhìn theo yêu cầu người dùng.
- Không đưa lời khuyên thuế hay lao động chắc chắn.
- Nhắc chi phí token trước khi chạy.
- Có phương án dự phòng trong lựa chọn đề xuất.
- Giọng ngang hàng, không nịnh.

## Nguồn
Chuyển thể từ `c-level-advisor/skills/board-meeting`, `c-level-advisor/skills/chief-of-staff`, `c-level-advisor/skills/agent-protocol` và `c-level-advisor/skills/decision-logger` trong alirezarezvani/claude-skills (MIT), cùng `skills/marketing-council` trong coreyhaines31/marketingskills (MIT).
