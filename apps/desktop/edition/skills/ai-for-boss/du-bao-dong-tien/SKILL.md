---
name: du-bao-dong-tien
description: "Dự báo dòng tiền 13 tuần từ số dư, công nợ phải thu, phải trả và chi cố định, chỉ ra tuần có nguy cơ thiếu tiền, chạy kịch bản doanh thu giảm 20 và 50 phần trăm, đề xuất cách xoay trước khi tiền cạn."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "💧"
---

# Dự báo dòng tiền 13 tuần

## Khi nào dùng

Dùng khi anh chị lo "tháng sau có đủ tiền trả lương không", sắp có khoản chi lớn, vừa mất một khách lớn, hoặc muốn nhìn trước ba tháng tới theo từng tuần. Kỹ năng này lập bảng dòng tiền 13 tuần từ số dư thật, lịch thu theo thói quen trả tiền thật của từng khách và lịch chi cố định, rồi chỉ ra tuần nào tiền xuống dưới mức an toàn. Không dùng để đòi nợ, khi đã biết khoản nào cần thu gấp thì chuyển sang `nhac-cong-no` để soạn tin nhắc. Không dùng để tính lãi lỗ hay so kế hoạch với thực tế, việc đó thuộc `phan-tich-lai-lo`, vì có lãi trên sổ vẫn có thể thiếu tiền mặt. Không dùng để quyết định vay ngân hàng hay cắt người, kỹ năng chỉ đưa bức tranh và phương án, anh chị chốt.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự giả định số dư, không tự đoán khách sẽ trả ngày nào.

1. Hôm nay trong tài khoản ngân hàng và tiền mặt tại quỹ có bao nhiêu, tính đến ngày nào? Có tài khoản nào không được đụng tới (tiền ký quỹ, tiền cọc của khách) không?
2. Anh chị gửi danh sách công nợ phải thu gồm tên khách, số tiền, ngày đến hạn được không? Tệp xuất MISA, KiotViet, Sapo, bảng Excel hay ảnh chụp sổ đều được.
3. Có sao kê ngân hàng hoặc lịch sử thu tiền 6 đến 12 tháng không, để em tính mỗi khách thường trả sớm hay trễ bao nhiêu ngày?
4. Các khoản phải trả nhà cung cấp sắp tới là gì, số tiền và hạn trả, khoản nào có thể thương lượng lùi?
5. Chi cố định hằng tháng gồm những gì và rơi vào ngày nào, ví dụ lương (ngày trả, tổng quỹ), thuê mặt bằng, lãi và gốc vay, phần mềm, điện nước?
6. Doanh thu bán hàng thu tiền ngay mỗi tuần trung bình bao nhiêu, có mùa cao điểm hay thấp điểm nào trong 13 tuần tới không? Chi nhập hàng có đi theo doanh thu không?
7. Mức tiền tối thiểu anh chị muốn luôn giữ trong tài khoản là bao nhiêu? Nếu chưa có con số, em đề xuất lấy bằng một kỳ lương cộng tiền thuê để anh chị chọn.

## Quy trình

1. Chốt số dư đầu kỳ và ngày tính. Nếu anh chị chưa có số dư, dừng lại và hỏi, không tự điền. Tách riêng tiền không được dùng khỏi số dư khả dụng.
2. Tính thói quen trả tiền (độ trễ thanh toán) của từng khách bằng mã Python từ lịch sử thu, gồm số ngày trễ trung bình và mức dao động. Khách có dưới ba lần thanh toán thì dùng mức trễ trung bình của cả nhóm khách và ghi rõ "ít dữ liệu". Dời từng khoản phải thu sang tuần dự kiến thực nhận, ví dụ khách hạn tuần 2 nhưng thường trễ ba tuần thì ghi vào tuần 5.
3. Lập bảng 13 tuần bằng mã Python, mỗi tuần gồm số dư đầu tuần, tiền vào (bán hàng thu ngay, công nợ thu được), tiền ra (nhập hàng, trả nhà cung cấp, lương, thuê, lãi vay, chi khác), số dư cuối tuần. Số dư cuối tuần này là số dư đầu tuần sau. Mọi con số trong bảng đều do mã tính, không tính nhẩm.
4. Đánh dấu từng tuần theo ba mức "an toàn", "dưới mức tối thiểu" và "âm tiền". Với mỗi tuần có vấn đề, viết một dòng nêu tên khoản gây ra, ví dụ "tuần 2 trả nhà cung cấp 90 triệu trong khi khoản 60 triệu của thầu A dự kiến tới tuần 5 mới về".
5. Chạy kiểm tra sức chịu đựng (stress test) với hai kịch bản doanh thu mới giảm 20 phần trăm và 50 phần trăm. Công nợ đã xuất hoá đơn giữ nguyên, chi nhập hàng giảm theo doanh thu chỉ khi anh chị xác nhận nhập theo lượng bán, chi cố định giữ nguyên. Nêu tuần đầu tiên tiền xuống dưới mức tối thiểu và tuần đầu tiên âm của mỗi kịch bản.
6. Soạn các cách xoay, xếp theo thứ tự ít tốn kém nhất trước. Gồm đẩy thu (nhắc khách đến hạn, xin khách trả theo mốc sớm hơn, giảm giá nhỏ cho khách trả sớm nếu anh chị đồng ý), hoãn chi (thương lượng chia đợt trả nhà cung cấp, lùi khoản chi không bắt buộc), và cuối cùng là nguồn bên ngoài (vay, góp thêm vốn). Mỗi cách chạy lại bảng bằng mã và ghi số dư thấp nhất sau khi áp dụng. Lương và bảo hiểm của nhân viên xếp vào nhóm không hoãn.
7. Trình anh chị bản tóm tắt một trang và bảng chi tiết. Hỏi "Anh chị kiểm tra giúp số dư đầu kỳ, lịch lương và các khoản phải trả, có đúng không?". Chưa gửi tin cho khách hay nhà cung cấp nào. Khi anh chị chọn cách xoay, việc soạn tin nhắc khách chuyển sang `nhac-cong-no`, tin thương lượng với nhà cung cấp soạn nháp và chờ "làm đi". Khi anh chị chốt một quyết định, gọi `aifb_record_decision`.
8. Nếu anh chị muốn cập nhật hằng tuần, đề xuất lịch định kỳ bằng `cronjob` vào sáng thứ Hai và chỉ tạo sau khi anh chị đồng ý. Bảng Excel xuất qua kỹ năng `xlsx`.

## Tiêu chuẩn đầu ra

Một trang tóm tắt tiếng Việt mở đầu bằng kết luận rõ ràng theo một trong ba dạng "đủ tiền", "sát nút" hoặc "thiếu X triệu vào tuần Y". Tiếp theo là bảng 13 tuần gọn gàng với số dư cuối mỗi tuần, bảng ba kịch bản (hiện tại, giảm 20 phần trăm, giảm 50 phần trăm) nêu số dư thấp nhất và tuần xảy ra, tối đa năm cảnh báo có tên khoản cụ thể, và danh sách cách xoay kèm số dư thấp nhất sau khi áp dụng. Tiền ghi theo kiểu "27,9 triệu". Mọi số do mã Python tính từ dữ liệu anh chị đưa, chỗ thiếu ghi "chưa có số". Nêu rõ các giả định, ví dụ độ trễ của khách ít dữ liệu. Không khuyên vay bao nhiêu hay cắt ai, chỉ nêu phương án và điều kiện. Không gửi gì ra ngoài khi chưa duyệt.

## Ba ca mẫu

### Ca 1: Hộ kinh doanh vật tư điện nước, sợ không trả nổi nhà cung cấp
Đầu vào: Chủ cửa hàng báo số dư 85 triệu, bán lẻ thu ngay khoảng 38 triệu một tuần, nhập hàng bằng 58 phần trăm doanh thu, thầu A nợ 60 triệu hạn tuần 2 nhưng lịch sử thường trễ ba tuần, thầu B nợ 40 triệu hạn tuần 4 luôn trả đúng, phải trả nhà cung cấp 90 triệu tuần 2 và 70 triệu tuần 6, lương 24 triệu và thuê 15 triệu đầu mỗi tháng, lãi vay 6 triệu giữa tháng, mức tối thiểu 30 triệu (số giả định).
Bối cảnh: Chủ cửa hàng ghi sổ tay, gửi ảnh chụp và tệp KiotViet.
Đầu ra đạt chuẩn: Kết luận "thiếu 12,1 triệu vào tuần 2" vì khoản thầu A dời sang tuần 5. Kịch bản giảm 20 phần trăm thấp nhất âm 18,5 triệu ở tuần 2, kịch bản giảm 50 phần trăm cuối kỳ âm 45,3 triệu. Cách xoay thứ nhất là xin nhà cung cấp chia 90 triệu thành 50 triệu tuần 2 và 40 triệu tuần 4, số dư thấp nhất còn 27,9 triệu ở tuần 2, vẫn dưới mức 30 triệu. Thêm cách thứ hai là nhắc thầu A trả đúng hạn tuần 2, số dư thấp nhất lên 36,8 triệu ở tuần 6. Việc nhắc thầu A chuyển sang `nhac-cong-no`.
Tiêu chí chấm:
- Khoản 60 triệu được dời theo độ trễ thật, không ghi đúng hạn.
- Số âm 12,1 triệu và các số kịch bản do mã tính.
- Cách xoay có số dư sau khi áp dụng.
- Không tự gửi tin cho nhà cung cấp hay thầu.
- Nói rõ cách xoay thứ nhất vẫn chưa đủ mức 30 triệu.

### Ca 2: Công ty sự kiện 30 người, quỹ lương lớn
Đầu vào: Kế toán gửi tệp MISA, số dư 520 triệu, doanh thu mới thu được khoảng 95 triệu một tuần với chi biến đổi 35 phần trăm, lương 360 triệu và thuê 40 triệu vào tuần 1, 5, 9, 13, lãi vay 15 triệu, khách X nợ 300 triệu dự kiến về tuần 5, khách Y 180 triệu tuần 7, khách Z 250 triệu hạn tuần 9 nhưng thường trễ bốn tuần nên dự kiến tuần 13, phải trả 150 triệu tuần 4 và 120 triệu tuần 10, mức tối thiểu 150 triệu (số giả định).
Bối cảnh: Giám đốc cần trình hội đồng thành viên xem có cần hạn mức vay không.
Đầu ra đạt chuẩn: Kịch bản hiện tại thấp nhất 117,5 triệu ở tuần 10, dưới mức tối thiểu. Kịch bản giảm 20 phần trăm âm 6 triệu ở tuần 10 và âm 22,8 triệu ở tuần 13. Kịch bản giảm 50 phần trăm âm 102,1 triệu ngay tuần 9. Cách xoay là thương lượng để khách Z trả đúng hạn tuần 9, khi đó tuần 10 lên 367,5 triệu nhưng tuần 13 vẫn còn 137,8 triệu vì chỉ dời thời điểm thu. Báo cáo nêu rõ quyết định vay thuộc về giám đốc và cần hỏi ngân hàng về điều kiện cụ thể.
Tiêu chí chấm:
- Lương xếp vào nhóm không hoãn.
- Chỉ ra cách xoay khách Z chỉ dời thời điểm, không thêm tiền.
- Không tự khuyên mức vay.
- Tuần 9 của kịch bản giảm 50 phần trăm được gọi tên là tuần âm đầu tiên.
- Có gọi `aifb_record_decision` khi giám đốc chốt phương án.

### Ca 3: Nhà thiết kế tự do thu theo mốc dự án
Đầu vào: Số dư 20 triệu, việc lặt vặt thu khoảng 3 triệu một tuần, dự án 1 còn mốc 25 triệu tuần 2 do khách trả đúng, dự án 2 mốc 40 triệu hạn tuần 6 nhưng khách hay trễ hai tuần, dự án 3 cọc 15 triệu tuần 10, chi cố định sinh hoạt và chỗ ngồi làm việc chung 16 triệu, phần mềm 1,2 triệu đầu tháng, trả góp máy tính 2,5 triệu giữa tháng, mức tối thiểu 16 triệu (số giả định).
Bối cảnh: Người dùng làm một mình, tài khoản cá nhân dùng chung cho công việc.
Đầu ra đạt chuẩn: Tuần 1 chỉ còn 5,7 triệu, dưới mức tối thiểu. Nếu dự án 2 trễ thêm bốn tuần, tuần 9 xuống 14,1 triệu. Kịch bản giảm 20 và 50 phần trăm ảnh hưởng ít vì thu chính theo mốc dự án, báo cáo nói rõ điều này. Cách xoay là xin khách dự án 1 chuyển mốc 25 triệu về tuần 1, số dư thấp nhất lên 22,4 triệu ở tuần 5.
Tiêu chí chấm:
- Nhận ra rủi ro chính là độ trễ của dự án 2.
- Giải thích vì sao kịch bản giảm doanh thu ít tác động.
- Số liệu kịch bản và cách xoay do mã tính.
- Giọng ngang hàng, không hô hào.
- Không trộn chi tiêu cá nhân vào chi cố định khi người dùng chưa xác nhận.

## Nguồn
Chuyển thể từ `small-business/skills/cash-flow-snapshot` và `small-business/skills/plan-payroll` trong anthropics/knowledge-work-plugins (Apache 2.0), `skills/finance/cashflow-forecasting` trong viethahong/business-skills (MIT), `business/cash-flow-forecast` và `business/runway-calculator` trong openaccountant/skills (MIT).
