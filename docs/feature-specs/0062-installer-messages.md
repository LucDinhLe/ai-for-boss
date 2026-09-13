# 0062 — Bộ cài nói tiếng Việt đọc được, và nói đúng cách tắt ứng dụng

## Chuyện đã xảy ra

Product Owner gỡ beta38 và nhận hộp thoại:

```
Chưa hoàn tất: B???n n??y ??ang ???????c d??ng.
??ng AI for Boss r??i g?? c??i ???t l??i
. Bản trước và dữ liệu được giữ nguyên.
```

Hai lỗi nằm trong một màn hình.

**Một, chữ hỏng.** Câu bao ngoài do NSIS biên dịch sẵn hiện đúng; phần lõi do `install-support.ps1` gửi ra thì nát. PowerShell ghi stdout theo bảng mã console, còn `nsExec::ExecToStack` đọc lại theo ANSI, nên mọi dấu tiếng Việt chết trên đường đi. Tệp `.ps1` vốn là UTF-8 có BOM và test đã khoá điều đó, nhưng BOM chỉ bảo đảm PowerShell **đọc** đúng, không bảo đảm gì cho lượt **ghi** ra. Dòng tiến trình "Đang kiểm tra tệp: 24518/24518 — 85 giây" hiện đúng vì nó đi bằng `SendMessage` trong tiến trình, không qua stdout. Đúng chỗ đó chứng minh nguyên nhân.

**Hai, lời khuyên đã sai từ beta38.** Câu gốc là "Đóng AI for Boss rồi gỡ cài đặt lại". Từ spec 0059, đóng cửa sổ chỉ thu ứng dụng vào khay và giữ bộ chạy sống. Người dùng làm đúng lời hướng dẫn vẫn gặp lại đúng lỗi cũ.

## Quyết định

- **Script hỗ trợ chỉ nói bằng mã ASCII.** Mọi câu do `install-support.ps1` tự viết trở thành một mã như `IN_USE`, `NO_SPACE`, `PATH_TOO_LONG`. Không dấu tiếng Việt nào đi qua stdout nữa, nên không còn phụ thuộc vào bảng mã của máy người dùng.
- **Lời tiếng Việt nằm trong bộ cài.** `!macro Explain` trong `ai-for-boss.nsi` ánh xạ mã sang câu, và những câu này được biên dịch thẳng vào tệp cài nên hiện đúng như tiêu đề hộp thoại vẫn luôn đúng.
- **Mã lạ vẫn được hiện nguyên văn.** Lỗi hệ thống ngoài dự kiến từ .NET hay Windows là tiếng Anh ASCII; `${CaseElse}` in ra nguyên văn thay vì nuốt mất. Chẩn đoán quan trọng hơn thẩm mỹ.
- **Cắt xuống dòng trước khi so.** `Write-Output` để lại CRLF; không cắt thì không mã nào khớp và mọi lỗi đều rơi xuống nhánh mặc định.
- **Câu "đang được dùng" nói đúng chỗ bấm.** Nay là: bản này vẫn chạy kể cả khi cửa sổ đã đóng, bấm chuột phải biểu tượng ở khay hệ thống rồi chọn Thoát hẳn, sau đó gỡ lại.
- **Dòng tiến trình giữ nguyên tiếng Việt.** Chúng đi bằng `SendMessage` chứ không qua stdout, và test khoá điều đó để đợt sau không "sửa" nhầm luôn cả chỗ đang đúng.

## Cố ý không làm

Không để bộ cài tự tắt ứng dụng. `taskkill` đã bị test cấm từ đầu, và giết một tiến trình đang ghi dữ liệu để tiết kiệm cho người dùng một cú bấm là đổi chác tồi.

Không cố ép PowerShell ghi ra đúng bảng mã. `nsExec` không đọc UTF-8, còn bảng mã ANSI của máy Việt Nam thì tuỳ máy. Bỏ hẳn tiếng Việt khỏi đường ống là cách duy nhất không phụ thuộc cấu hình.

## Bằng chứng

- `tests/unit/internal-installer.test.mjs`: mọi câu `throw` và mọi giá trị trong bảng `$completed` đều là mã ASCII hợp lệ và đều có lời trong bộ cài; câu `IN_USE` phải nhắc khay hệ thống và Thoát hẳn; lượt cắt xuống dòng phải đứng trước lượt ánh xạ; `FileFunc.nsh` phải được nạp; nhánh mặc định phải in nguyên văn; và dòng tiến trình phải giữ tiếng Việt.
- Chưa chạy thử trên máy thật. Phải xác nhận bằng chính lần gỡ tiếp theo của Product Owner.
