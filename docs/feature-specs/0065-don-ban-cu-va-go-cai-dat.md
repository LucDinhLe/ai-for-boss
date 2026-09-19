# 0065 — Dọn bản cũ, và gỡ cài đặt thật sự gỡ

Trạng thái: Draft, chờ Product Owner duyệt. Mở ngày 2026-09-19.

Ưu tiên cao hơn 0063 và 0064. Đây là lỗi đang xảy ra trên máy Product Owner, đã
đo được, không phải việc cải thiện.

## Vấn đề

Đo trên máy Product Owner ngày 19/09, bản đang cài là beta41:

```
C:\Users\AUS-PRO\AppData\Local\Programs\AI for Boss Internal\
  staging\
  versions\
    0.0.5-beta.21  22  23  24  25  26  27  28  29  30  32  33  34  41
  Uninstall-0.0.5-beta.21.exe  …  Uninstall-0.0.5-beta.41.exe   (14 tệp)
```

- **14 bản đầy đủ** nằm trên ổ. Mỗi bản **871 MB, 24.519 tệp**.
- Tổng ước tính **khoảng 11,9 GB**, trong đó **11 GB là xác**.
- Bản cũ nhất, beta21, ghi ngày 08/09. Tức là **mười một ngày** sinh ra 13 bản
  chết, chưa bản nào bị dọn.

Trong Windows chỉ có **một** mục đăng ký gỡ cài đặt:

```
HKCU\...\Uninstall\AIforBossInternal-0.0.5-beta.41
  UninstallString = "…\Uninstall-0.0.5-beta.41.exe"
```

Mười ba tệp `Uninstall-*.exe` còn lại **mồ côi**: không mục đăng ký nào trỏ tới
chúng, nên không nút nào trong Windows gọi được chúng.

### Hai hệ quả

**Người dùng bấm gỡ thì gỡ không sạch.** Mục đăng ký duy nhất chỉ biết beta41.
Gỡ xong, 13 thư mục bản cũ và 13 tệp uninstaller vẫn nằm nguyên, chiếm gần 11 GB.
Với người dùng, đó là "bấm gỡ mà không được".

**Ứng dụng đang chạy nên tệp bị giữ.** Spec 0059 giữ bộ chạy ấm trong khay hệ
thống. Lúc đo có bốn tiến trình `AI-for-Boss.exe` của beta41 đang chạy. Đóng cửa
sổ không phải là thoát, nên bộ gỡ không xoá được tệp đang bị giữ, và người dùng
không có cách nào biết mình cần thoát từ khay trước.

### Vì sao các spec trước không bắt được

Spec 0052 đếm số tệp của bộ cài, 0053 đo tốc độ gỡ, 0061 tỉa đường dẫn plugin của
bản đã gỡ. Cả ba đều nhìn **một** bản. Không spec nào hỏi "sau mười lần nâng cấp
thì ổ đĩa còn lại gì". 0061 đặc biệt đáng chú ý: nó đã biết có đường dẫn của bản
đã gỡ còn sót và đi tỉa đường dẫn, nhưng không đi tỉa **thư mục bản** sinh ra
đường dẫn đó.

## Quyết định

**1. Nâng cấp xong thì dọn bản cũ ngay trong lượt đó.** Giữ lại đúng hai bản:
bản đang chạy và bản liền trước nó, để còn đường lùi. Mọi bản cũ hơn bị xoá cùng
tệp `Uninstall-*.exe` của chính nó. Dọn sau khi bản mới đã khởi động thành công
một lần, không phải trước.

**2. Một mục đăng ký duy nhất, tên cố định.** Khoá đăng ký không mang số hiệu
bản. `UninstallString` trỏ vào một bộ gỡ ổn định, bộ gỡ đó tự tìm mọi bản trong
`versions/` mà xoá, chứ không chỉ xoá bản sinh ra nó. Đây là chỗ gốc của lỗi: số
hiệu bản nằm trong tên khoá nên mỗi lần nâng cấp lại đẻ một danh tính mới.

**3. Bộ gỡ phải tự thoát ứng dụng trước khi xoá.** Nếu còn tiến trình đang chạy,
bộ gỡ dừng lại, nói rõ bằng tiếng Việt rằng ứng dụng đang chạy trong khay hệ
thống, và cho một nút thoát rồi gỡ tiếp. Không im lặng thất bại, không xoá được
một nửa.

**4. Gỡ xong thì không còn gì.** Sau khi gỡ, `AI for Boss Internal/` không còn
tồn tại: không `versions/`, không `staging/`, không tệp uninstaller nào. Dữ liệu
người dùng và tài khoản đã kết nối là chuyện khác, hỏi riêng theo mục 5.

**5. Hỏi một câu về dữ liệu, mặc định là giữ.** Khi gỡ, hỏi đúng một câu: xoá
luôn dữ liệu và tài khoản đã kết nối, hay giữ lại để cài lại sau. Mặc định giữ.
Không tự xoá dữ liệu người dùng.

**6. Một lượt dọn cho máy đã lỡ tích.** Bản tiếp theo, khi khởi động lần đầu,
phát hiện có hơn hai thư mục trong `versions/` thì dọn phần dư và báo bằng một
dòng: đã thu lại bao nhiêu GB. Máy của Product Owner sẽ thu lại khoảng 11 GB.

## Ràng buộc

- Xoá thư mục là thao tác phá. Mọi đường xoá phải kiểm rằng đường dẫn nằm đúng
  trong `versions/` của thư mục cài, không đi theo symlink, và không bao giờ nhận
  đường dẫn từ cấu hình hay từ lõi.
- Không xoá bản đang chạy, kể cả khi người dùng ép.
- Dữ liệu người dùng không nằm trong phạm vi xoá tự động ở mục 1 và 6.

## Kế hoạch kiểm thử

- Dựng một thư mục cài giả có sáu bản, chạy lượt dọn, còn đúng hai bản và đúng
  hai tệp uninstaller.
- Dọn trong khi một tiến trình đang giữ tệp của bản cũ: dừng sạch, báo lỗi, không
  xoá dở.
- Gỡ khi ứng dụng đang chạy trong khay: dừng, báo, cho thoát rồi gỡ tiếp.
- Gỡ xong kiểm thư mục cài không còn tồn tại và mục đăng ký đã mất.
- Đường dẫn dị dạng, symlink trỏ ra ngoài: từ chối.
- Kiểm tay trên máy Product Owner, đo dung lượng trước và sau.

## Bằng chứng hoàn thành

Điền khi xong: commit, `pnpm verify`, dung lượng đo được trước và sau trên máy
Product Owner, và xác nhận rằng gỡ cài đặt để lại thư mục rỗng.

## Việc dọn tay trên máy Product Owner

Product Owner đã đồng ý dọn 13 bản cũ **sau khi bản đang dùng chạy ổn định**,
chưa phải bây giờ. Khi làm: thoát ứng dụng từ khay hệ thống trước, giữ lại
`versions/0.0.5-beta.41` và `Uninstall-0.0.5-beta.41.exe`, chuyển phần còn lại đi
thay vì xoá thẳng nếu còn chỗ trống trên ổ.
