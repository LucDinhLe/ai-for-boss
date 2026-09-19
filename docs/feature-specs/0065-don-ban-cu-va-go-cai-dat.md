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

**2. Khoá đăng ký giữ nguyên cách đặt tên. Không làm khoá cố định.** Bản nháp
đề xuất một khoá tên cố định, một bộ gỡ xoá mọi bản. Bỏ đề xuất đó sau khi đọc
mã, vì ba lý do:

- `Reuse-Core` cố ý dựa vào mô hình nhiều bản cạnh nhau: nó hardlink tệp lõi từ
  bản trước để nâng cấp nhanh. Một bộ gỡ "xoá mọi bản" đi ngược mô hình ấy.
- Khi mục 1 giữ đúng hai bản, Add/Remove Programs nhiều nhất có hai mục, cả hai
  đều trỏ đúng. Mục mồ côi biến mất mà không phải đổi cách đặt tên khoá.
- `installer/ai-for-boss.nsi` ghi rõ NSIS **không biên dịch được** từ máy đang
  phát triển, và luật là không thêm cấu trúc chưa từng chạy. Đổi cách đặt khoá
  buộc phải sửa `.nsi`, tức là đẩy rủi ro vào thứ không kiểm chứng tại chỗ được.

Mục 1 dọn cả thư mục bản, tệp `Uninstall-*.exe` và khoá đăng ký của bản đó cùng
lúc, nên vẫn hết mồ côi mà không đụng NSIS.

**3. Bộ gỡ dừng lại khi ứng dụng đang chạy. Đã có sẵn, không làm lại.** Kiểm mã
ngày 19/09: `Inspect-OwnedFiles` đã trả `Locked` và `Remove` đã `throw 'IN_USE'`,
còn `ai-for-boss.nsi` đã có nguyên văn tiếng Việt: *"Bản này vẫn đang chạy, kể cả
khi cửa sổ đã đóng. Bấm chuột phải biểu tượng AI for Boss ở khay hệ thống rồi
chọn Thoát hẳn, sau đó gỡ lại."* Yêu cầu này coi như đã đạt từ trước.

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

## Đã làm trong đợt này, và chưa làm

**Đã làm.** Mục 1 và mục 6: `Prune-OldVersions` trong `installer/install-support.ps1`,
gọi ở cuối `Activate`, sau khi bản mới đã cài và đăng ký xong. Giữ bản đang chạy
và bản khác mới nhất; mọi bản cũ hơn bị xoá cùng `Uninstall-<ver>.exe` và khoá
đăng ký của chính nó. Một thư mục không có `.aifb-payload.json` thì không bao giờ
bị đụng. Lỗi khi dọn không làm hỏng lượt cài: `try { Prune-OldVersions } catch { }`,
vì lúc đó bản mới đã cài xong rồi. Mục 6 không cần mã riêng — máy đã lỡ tích sẽ
được dọn ở lượt nâng cấp kế tiếp.

Không sửa `ai-for-boss.nsi` một dòng nào.

**Chưa làm, còn để lại:** mục 4 (gỡ xong thư mục biến mất hẳn) và mục 5 (hỏi một
câu về dữ liệu). Hiện `Section "Uninstall"` vẫn chỉ xoá bản sinh ra nó, cố ý và
có chú thích. Sau khi mục 1 chạy, số bản còn lại nhiều nhất là hai, nên thiệt hại
đã nhỏ đi rất nhiều; nhưng gỡ xong vẫn còn một bản và thư mục vẫn tồn tại. Hai
mục này cần sửa `.nsi`, tức là cần một máy biên dịch được NSIS.

## Bằng chứng hoàn thành

- `pnpm verify` exit code 0: 798 phép, 797 xanh, 0 hỏng, 1 bỏ qua (19/09).
- Phép mới `tests/unit/internal-installer.test.mjs`, "Windows activate keeps the
  running build and one rollback, and spares what it does not own": dựng bốn thư
  mục bản, chạy thật `install-support.ps1`, khẳng định bản đang chạy và bản lùi
  còn, bản cũ hơn mất cùng uninstaller của nó, và thư mục không có bằng chứng sở
  hữu vẫn nguyên.
- Dọn tay trên máy Product Owner ngày 19/09: xoá 12 thư mục bản và 12 tệp
  uninstaller mồ côi, **thu lại 10,48 GB**, ổ C: từ 154,5 lên 164,9 GB trống.
  Còn lại `0.0.5-beta.34` và `0.0.5-beta.41`. Ứng dụng đang chạy không bị ảnh
  hưởng.
- Còn thiếu để đóng: xác nhận rằng sau một lượt nâng cấp thật, bản cũ tự biến
  mất mà không cần tay.

## Việc dọn tay trên máy Product Owner

Product Owner đã đồng ý dọn 13 bản cũ **sau khi bản đang dùng chạy ổn định**,
chưa phải bây giờ. Khi làm: thoát ứng dụng từ khay hệ thống trước, giữ lại
`versions/0.0.5-beta.41` và `Uninstall-0.0.5-beta.41.exe`, chuyển phần còn lại đi
thay vì xoá thẳng nếu còn chỗ trống trên ổ.
