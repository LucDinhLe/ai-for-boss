# 0053 — Gỡ cài đặt chạy trong .NET thay vì PowerShell

## Vì sao gỡ lâu

`Remove` đi qua toàn bộ payload hai lượt, cả hai đều tuần tự trong PowerShell.

Lượt một là bước kiểm tra khoá: với mỗi tệp, `Owned-Path`, `Test-Path -PathType Leaf`, rồi `[IO.File]::Open` với `FileShare::None` và đóng lại. Lượt hai là `Clear-OwnedFiles`: lại `Owned-Path`, lại `Test-Path`, rồi `Hash-File` đọc trọn tệp để tính SHA256, so với manifest, khớp thì `Remove-Item -Force`.

Ở mức 36.668 tệp, đó là hai lượt mở tệp cộng một lượt đọc hết cây (khoảng 1,5 GB), mỗi thao tác đi qua provider của PowerShell, cộng thêm Defender quét mỗi lượt mở. Phần cài đã được đưa vào .NET chạy bốn luồng từ trước (`InstallVerifier`, `InstallLinks`); phần gỡ thì chưa.

## Quyết định

- Thêm `InstallRemover` với hai bước tách bạch. `Inspect` chạy `Parallel.For` bốn luồng: kiểm tra đường dẫn nằm trong thư mục phiên bản, từ chối reparse point, mở tệp bằng `FileShare.None` và tính SHA256 **ngay trên chính luồng mở đó**, rồi ghi lại danh sách tệp được phép xoá. `Apply` xoá đúng danh sách ấy, cũng bốn luồng, sau đó dọn các thư mục đã rỗng theo thứ tự sâu trước.
- Một lượt mở tệp phục vụ cả hai mục đích cũ: nó thất bại khi ứng dụng còn chạy, và nó chính là lượt đọc sinh ra mã băm. Tệp được đọc nhiều nhất một lần thay vì mở hai lần và đọc một lần.
- `Remove` gọi `Inspect` trước, gặp tệp đang bị khoá thì dừng ngay với thông báo tiếng Việt cũ, chưa xoá gì. Lối tắt được gỡ sau đó, rồi `Clear-OwnedFiles` dùng lại đúng kế hoạch đã kiểm. Thứ tự "kiểm hết rồi mới xoá" giữ nguyên như trước.
- `File.Delete` từ chối tệp có cờ chỉ đọc, trong khi `Remove-Item -Force` thì xoá được. npm ghi các tệp cache theo nội dung ở chế độ chỉ đọc, nên `Apply` xoá cờ đó trước khi xoá tệp.
- Một tệp có thể bị mở trong khoảng giữa `Inspect` và `Apply`. Trường hợp đó báo đúng thông báo "đang được dùng" thay vì lỗi .NET nguyên văn.

## Giữ nguyên

Không xoá gì ngoài thư mục phiên bản, không đi theo reparse point, không xoá tệp có mã băm khác manifest, không `Directory.Delete` đệ quy, không đụng bản khác hay dữ liệu người dùng.

## Bằng chứng

- `tests/unit/internal-installer.test.mjs`, phép thử Windows "Windows install engine preserves prior, foreign and modified files and rejects tamper" đã có sẵn và phủ đúng phần này: tệp đang mở thì `Remove` phải thất bại và tệp còn nguyên; tệp lạ và tệp đã sửa phải sống sót; bản khác phải nguyên vẹn; tệp đúng mã băm phải biến mất. Bổ sung một tệp chỉ đọc vào phép thử đó.
- Thêm phép thử chạy trên mọi nền tảng, khoá lại các bất biến trên bằng cách đọc mã nguồn: không còn vòng lặp payload nào trong PowerShell, thứ tự kiểm trước xoá sau, và từng luật an toàn vẫn có mặt trong `InstallRemover`.
- Chưa bấm giờ trên máy thật. Số liệu phải đo bằng lượt gỡ beta37 rồi mới ghi vào release notes.

## Chưa làm

Bỏ lượt băm khi gỡ (chỉ so kích thước và thời gian sửa) sẽ nhanh hơn nữa nhưng làm yếu luật "chỉ xoá tệp đúng của bản này", nên không làm.
