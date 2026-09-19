# 0063 — Một trang Nhà cung cấp, và cú khởi động lại có tên

Trạng thái: Draft, chờ Product Owner duyệt. Mở ngày 2026-09-19.

Bản này kế thừa bản nháp `0062-trang-tai-khoan-nha-cung-cap.md` mở cùng ngày.
Đổi số sang 0063 vì 0062 đã thuộc về `0062-installer-messages.md` đã gộp vào
`main` (PR #21). Phần "Vấn đề" được viết lại theo cây mã sau khi 0060 về `main`:
ba trong bốn nguyên nhân của bản nháp đã được 0060 giải, nên phạm vi đợt này thu
hẹp lại thành **dỡ phần thừa còn sót**, không thiết kế thêm màn hình mới.

Bản mẫu bấm được (hai khung Trước/Sau) do Product Owner duyệt trực quan:
`https://claude.ai/artifact/Ybgsu4Uo9tYLHjtrVKqWoC`. Bản mẫu là hình dạng đã
chốt; spec này là thứ ràng buộc khi viết mã.

## Vấn đề

Spec 0051 dọn màn hình Kết nối từ sáu khối xuống ba bậc. Spec 0060 dựng trang
Nhà cung cấp theo mô hình thẻ-nhà-cung-cấp cộng dòng-tài-khoản. Cả hai đều làm
đúng phần của mình. Việc chưa làm là **dỡ cái cũ sau khi dựng cái mới**, nên
người dùng beta41 đang đứng trước bốn lối vào cho cùng một việc.

**Thứ nhất, bốn lối vào cùng một việc.** Đếm trên beta41 đang chạy:

1. Màn hình Kết nối AI — `ConnectScreen.tsx`, 712 dòng, ba bậc đánh số.
2. Cài đặt → Nhà cung cấp, khối "Tài khoản AI của anh chị" — phần 0060 làm đúng.
3. Cùng trang đó, khối "Nhà cung cấp lõi có hỗ trợ" — danh sách thứ hai.
4. Cùng trang đó, khối "Danh mục nhà cung cấp của OpenClaw" — `CapabilityCatalog`
   với **84 mục**, mỗi mục một nút "Thiết lập" riêng, cộng một ô tìm kiếm, một
   nút "Tải lại" và một nút "Kết nối AI" đẩy ngược về lối vào số 1.

Spec 0051 ghi là đã bỏ danh mục, ô tìm kiếm và thanh lọc "khỏi màn hình này".
Đúng chữ nhưng không đúng ý: chúng chỉ chuyển sang trang Nhà cung cấp. Tổng số
lựa chọn bày ra trước mặt người dùng không giảm.

**Thứ hai, bậc 3 không phải ba lựa chọn, mà là cả danh mục đội lốt.**
`ConnectScreen.tsx:667` dựng bậc "Dán API key" bằng một `<select>` chứa nguyên
`manualProviders` do lõi trả về, nhãn ghép `groupLabel · label`. Danh sách dài
bằng danh mục, chỉ khác là bị gập sau một cú bấm.

**Thứ ba, nắp "Thêm chi tiết" ở bậc 2 gộp ba thứ khác loại.**
`ConnectScreen.tsx:652` cộng `unavailableCandidates + prepareOptions +
recommendedInstalls` thành một con số duy nhất. Người mở nắp ra gặp lẫn lộn "cái
không dùng được", "cái cần chuẩn bị" và "cái nên cài thêm". Con số trên nắp
không nói được điều gì vì nó đếm ba loại cộng lại.

**Thứ tư, cú khởi động lại Gateway vẫn là khoảng lặng không tên.** Kích hoạt mô
hình làm bộ chạy khởi động lại. `apps/desktop/electron/main.mjs:745` đã biết
`openclaw.setup.activate` trả `gatewayRestartRequired === true`. 0051 sửa phần
*không đánh rơi biên nhận*, nhưng trên giao diện khoảng lặng ấy vẫn trống, và đó
là chỗ người dùng bấm lại rồi hỏng thật.

**Thứ năm, không có chỗ nào xem hay đổi mô hình mặc định.** Trang hiện tại nói
"Đang dùng {model}" lẫn trong dòng đếm mô hình của một thẻ. Product Owner hỏi
ngày 19/09 "chọn làm mô hình chính mặc định ở đâu" và câu trả lời là: chôn trong
luồng kích hoạt, không có mặt trên trang. Đây là hai tầng khác nhau bị gộp làm
một — *tài khoản dùng trước trong một hãng* khác với *mô hình cả app chạy bằng*.

**Thứ sáu, hành động trên mỗi dòng tài khoản không cố định.** `↑ ↓` chỉ hiện khi
`card.canReorder`, "Đăng xuất" chỉ hiện khi `account.canLogout`. Gating theo lõi
là đúng, nhưng hệ quả là mỗi dòng một hình dạng.

### Đối chiếu bên ngoài

AICoworker của Neurons AI, cũng là vỏ Electron nhúng runtime OpenClaw, đang cài
trên cùng máy Product Owner. Quan sát ngày 19/09 trên giao diện đang chạy:

- Một trang duy nhất trong Cài đặt. Không có bậc, không có danh mục, không có ô
  tìm kiếm, không có màn hình kết nối riêng.
- Danh sách chỉ gồm nhà cung cấp **đã nối**. Thêm cái mới là một nút.
- Một đoạn ba câu đặt đầu trang giải thích cả mô hình: tài khoản primary dùng
  trước, phần còn lại là dự phòng theo thứ tự khi gặp rate-limit hoặc lỗi auth,
  và thêm tài khoản thì bấm nút nào rồi đặt một nhãn.
- Trạng thái là **một** viên thuốc xanh, không phải một đoạn văn.
- Hành động là **biểu tượng không chữ**, viền trong suốt, luôn cùng vị trí.
- Kết quả báo bằng toast góc phải rồi tự tắt.
- Mô hình chạy trên máy là một thẻ nằm chung danh sách.

Nguồn đối chiếu là **giao diện đang chạy trên máy**, quan sát qua ảnh chụp màn
hình. Kho `Neurons-AI/aicoworker` không phát hành mã nguồn, và giấy phép
PolyForm Perimeter 1.0.0 cấm dùng phần mềm của họ để làm ra thứ cạnh tranh với
họ. Không đọc, không giải nén, không sao chép `app.asar` hay bất kỳ tài nguyên
nào của họ. Thứ kế thừa là hình dạng màn hình tự nghĩ ra được từ việc nhìn, và
phần lớn hình dạng đó **mình đã tự chốt ở 0060 trước khi nhìn**.

## Kiểm chứng bề mặt lõi trước khi vẽ nút

Ngày 19/09, trước khi chốt bộ biểu tượng, đã đối chiếu danh mục 388 phương thức
trong `artifacts/beta-0/gateway-handshake.json` và mã của 0060. Kết quả:

- Lõi chỉ có **bốn** phương thức `models.*`: `models.authLogout`,
  `models.authStatus`, `models.list`, `models.probe`. Không có `rename`,
  `setLabel`, `setPrimary` hay bất kỳ lệnh đổi tên hồ sơ nào.
- `usage.status` và `usage.cost` có thật nhưng là số toàn cục. Trong
  `provider-accounts.ts`, `usage` nằm ở **cấp nhà cung cấp**; `AccountRow` không
  có trường usage. Mức dùng theo từng tài khoản không tồn tại.
- `auth.order` là bảng *nhà cung cấp → danh sách hồ sơ*. Không có thứ tự **giữa**
  các nhà cung cấp.
- `setAuthOrder` (`setup-channel.mjs:214`) không gọi lệnh lõi nào. Nó là hàm cố
  định của host: `config.get` → kiểm `valid`, `hash` và đường dẫn → `config.patch`
  chỉ thay `auth.order.<provider>` → `config.get` đọc lại xác nhận. Renderer
  không bao giờ chạm `config.*`.

**Hệ quả ràng buộc cả các đợt sau:** mỗi nút *ghi* mới đều cần một hàm host cố
định theo đúng khuôn trên. Không có chuyện thêm một biểu tượng rồi nối thẳng vào
lõi. Bất kỳ đề xuất nút nào cũng phải nêu được lệnh lõi hoặc hàm host đứng sau
nó, trước khi được vẽ. Đây là R-025 áp dụng vào giao diện.

## Quyết định

**1. Trang Nhà cung cấp là mặt chính và là chỗ duy nhất.** Giữ nguyên khối "Tài
khoản AI của anh chị" mà 0060 đã dựng. Xoá hai khối còn lại trên trang:

- "Nhà cung cấp lõi có hỗ trợ" rút thành **một dòng chữ mờ ở cuối danh sách**,
  không phải thẻ riêng.
- "Danh mục nhà cung cấp của OpenClaw" và `CapabilityCatalog kind="providers"`
  rời khỏi trang này. Danh mục tra cứu chuyển vào hộp thoại Thêm nhà cung cấp,
  sau một dòng "Xem toàn bộ danh mục lõi", và không còn nút "Thiết lập" trên
  từng mục — tra cứu là tra cứu, kết nối là kết nối.

**2. Màn hình Kết nối toàn phần tụt xuống thành hộp thoại Thêm nhà cung cấp.**
Ba bậc của 0051 không biến mất, chúng chuyển thành ba lựa chọn *bên trong* một
hộp thoại mở từ đúng một nút. Không còn màn hình riêng, nên không còn nút đẩy
qua đẩy lại giữa hai nơi.

**3. Hộp thoại mở ra là bốn thẻ thương hiệu, sau đó đúng hai đường.**
`FEATURED_FAMILY_COUNT = 4` đã có trong `provider-order.ts`. Bấm một thẻ rồi chỉ
còn:

- **Đăng nhập bằng trình duyệt** (`openclaw.setup.auth.start`, gồm OAuth và mã
  thiết bị). Mặc định ở mọi thương hiệu lõi có tuyến này.
- **Dán khoá API**, một ô dán kèm một nút mở trang tạo khoá của hãng, cho nơi
  không có tuyến đăng nhập.

Bậc "ứng dụng đã đăng nhập trên máy" thôi làm một bậc riêng. Nó rút thành một
dòng gợi ý ngay trên thẻ khi lượt dò thấy có sẵn: "Máy này đã đăng nhập Claude
Code, dùng luôn". Ba nhóm `unavailableCandidates`, `prepareOptions`,
`recommendedInstalls` **tách làm ba nắp riêng có tên riêng**, không cộng dồn
thành một con số; nhóm nào rỗng thì không hiện nắp.

**3b. Đặt tên tài khoản nằm trong hộp thoại thêm, không phải trên dòng.** Vì lõi
không có lệnh đổi tên (xem mục kiểm chứng), tên tài khoản chính là phần đuôi của
`profileId` và chỉ đặt được lúc tạo. Hộp thoại có một ô **"Đặt tên cho tài khoản
này — không bắt buộc"**, kèm câu nói thật: *"Tên chỉ đặt được lúc thêm, đổi sau
phải nối lại."* Không vẽ nút đổi tên ở bất kỳ đâu khác.

**3c. Vì sao không có ô "điền email".** Giữ nguyên lập luận của bản nháp, ghi lại
để lần sau không ai đề xuất lại. Không nhà cung cấp nào cấp quyền dùng mô hình
theo địa chỉ email; họ cấp theo khoá API hoặc theo phiên OAuth. Một ô email
trong app sẽ nhận chữ, báo đã lưu, rồi hỏng ở lượt chat đầu tiên bằng một lỗi
không ai đọc hiểu. Đường "đăng nhập bằng trình duyệt" chính là thao tác điền
email mà người dùng mong đợi, chỉ khác chỗ ô email nằm trên trang của hãng, nơi
nó có nghĩa, và app không bao giờ thấy mật khẩu.

**4. Một thanh Mô hình mặc định, đặt trên cùng, tách hẳn khỏi thẻ nhà cung cấp.**
Nội dung: tên mô hình đang chạy, qua nhà cung cấp nào, và một nút **Đổi mô hình**.
Đọc `configuredModel` từ lượt dò và danh sách `models` đã có trong bộ nhớ. Đây là
chỗ trả lời câu "app đang chạy bằng cái gì", tách khỏi câu "trong hãng này dùng
tài khoản nào".

**5. Một đoạn giải thích mô hình, đặt đầu trang.** `ProviderSettings.tsx` đã có
`settings-lead` nói đúng ý này. Bổ sung: tài khoản số 1 được dùng trước, phần sau
là dự phòng, và di chuột lên biểu tượng thì biết nó làm gì.

**6. Hành động là biểu tượng không chữ, cố định về hình dạng.** Mỗi biểu tượng
bắt buộc có `title` tiếng Việt và `aria-label` tiếng Việt; nút bị lõi chặn thì
**mờ đi và giữ nguyên ô**, `title` nói vì sao, thay vì biến mất. Bộ đã chốt:

*Trên mỗi dòng tài khoản, bốn biểu tượng:*

| Biểu tượng | Việc | Đường thực thi |
| --- | --- | --- |
| Mũi tên vòng | Đăng nhập lại, làm mới token | `openclaw.setup.auth.start` |
| ↑ | Đưa lên trên, cho dùng trước | `setAuthOrder` |
| ↓ | Hạ xuống một bậc | `setAuthOrder` |
| Thùng rác, màu đỏ | Gỡ tài khoản khỏi máy | `models.authLogout` |

*Trên đầu mỗi thẻ nhà cung cấp, một biểu tượng:* biểu đồ cột — **Mức dùng của
nhà cung cấp này**, đọc `usage` ở cấp nhà cung cấp trong `provider-accounts.ts`.

**Ba biểu tượng bị loại, ghi lại để lần sau không ai vẽ lại:** biểu tượng nhãn
trên dòng (lõi không có lệnh đổi tên, đã chuyển vào hộp thoại thêm theo mục 3b);
ngôi sao "nhà cung cấp ưu tiên" (`auth.order` không xếp giữa các hãng, và việc đó
đã do thanh Mô hình mặc định ở mục 4 làm); bút chì "sửa thiết lập" (không có bề
mặt nào ngoài `config.*`, đang bị chặn cứng).

**7. Cú khởi động lại có tên và có tiến trình.** Khi `activate` trả
`gatewayRestartRequired === true`, hộp thoại chuyển sang một bước tên là "Đang
khởi động lại bộ chạy", có thanh chạy, câu "anh chị không phải làm gì, đừng bấm
lại", tự nối lại, rồi mới hiện biên nhận. Cờ đã có ở `main.mjs:745`; feature này
chỉ đặt tên cho khoảng lặng đó trên giao diện. Bất biến của 0051 giữ nguyên:
bước đang chờ không được nối lại qua mốc khởi động lại, còn biên nhận cuối thì
luôn hiện.

**8. Kết quả báo bằng toast, không chiếm chỗ trong luồng.** Áp dụng cho làm mới
token, đổi thứ tự, gỡ tài khoản. Lỗi thì vẫn ở lại trên trang cho tới khi người
dùng xử lý, không tự tắt.

**9. Mở trang không được làm chậm.** Giữ nguyên luật 0051 và 0060: trang dựng từ
danh sách `models` đã có trong bộ nhớ, `models.authStatus` gọi sau và chỉ khi đã
có ít nhất một tuyến kết nối. **Không** gọi `openclaw.setup.detect` khi mở
trang; lượt dò chỉ chạy khi người dùng mở hộp thoại Thêm nhà cung cấp. Đây cũng
là cách mất luôn dòng "việc đọc danh mục sẽ dò lại tài khoản trên máy nên mất tới
nửa phút" đang nằm trên trang.

**10. Chỗ trống cho mô hình chạy trên máy.** Trang chừa vị trí cho một thẻ "Mô
hình chạy thẳng trên máy" nằm cuối danh sách thẻ, nhưng **0063 không dựng thẻ
đó**. Xem spec 0064.

## Ràng buộc giữ nguyên

- Không thêm một dòng nào vào `SETUP_METHODS` hay `ALLOWED_METHODS`. Mọi phương
  thức feature này dùng đã nằm trong `setup-channel.mjs`:
  `openclaw.setup.detect`, `openclaw.setup.auth.start`,
  `openclaw.setup.activate.start`, `openclaw.setup.verify`, `wizard.next`,
  `models.authStatus`, `models.authLogout`. `config.*` vẫn bị chặn với renderer.
- Vỏ không đặt tên nhà cung cấp nào của riêng mình và không tự viết đường xác
  thực nào lõi không có. Giữ nguyên quyết định "Không tự viết đường đăng nhập
  Antigravity" ngày 13/09 và D-0022 mà nó dẫn lại. Thẻ chỉ dựng từ kết quả lõi,
  nên nhà cung cấp lõi thêm về sau tự xuất hiện, không phải sửa mã.
- D-0002 giữ nguyên: khách dùng tài khoản của chính họ. Vỏ không lưu khoá, không
  có vault tập trung, không đụng SecretRef (R-002 vẫn Open).
- R-003 được giảm chứ không mất: một nhà cung cấp đổi điều khoản thì hỏng đúng
  một thẻ và thẻ đó nói rõ hỏng gì, thay vì làm vỡ cả màn hình kết nối.
- Không đọc, giải nén hay sao chép bất kỳ phần nào của AICoworker.

## Cố ý không làm trong đợt này

- Không làm kéo thả. Hai nút mũi tên đủ cho danh sách hai tới ba tài khoản.
- Không hiện chi phí theo từng tài khoản — dữ liệu không tồn tại ở cấp đó.
- Không dựng thẻ mô hình chạy trên máy. Đó là spec 0064.
- Không rút ngắn thời gian dò của lõi. Việc đó thuộc OpenClaw.
- Không đụng hành trình first-run và không đụng nơi lõi giữ khoá.
- Không dọn 14 file `Uninstall-0.0.5-beta.*.exe` còn sót trong thư mục cài. Lỗi
  thật, đã ghi riêng, không thuộc feature giao diện này.

## Kế hoạch kiểm thử

- Unit `tests/unit/provider-settings.test.mjs`: mọi phép của 0060 còn xanh; trang
  **không** còn dựng `CapabilityCatalog`; phần đuôi "lõi có hỗ trợ" là một dòng
  chữ chứ không phải thẻ; thanh Mô hình mặc định đọc đúng `configuredModel`; mỗi
  biểu tượng có `title` và `aria-label` tiếng Việt không rỗng; nút bị lõi chặn thì
  mờ và giữ ô chứ không biến mất.
- Unit `tests/unit/connect-screen.test.mjs`: 27 phép hiện có còn xanh sau khi
  luồng chuyển vào hộp thoại. Thêm phép cho bốn thẻ thương hiệu mở ra đúng hai
  đường; cho ba nắp tách riêng có tên riêng và nắp rỗng thì không hiện; cho ô đặt
  tên là tuỳ chọn và trống vẫn kết nối được; cho bước khởi động lại có tên.
- Contract: một phép khoá `SETUP_METHODS` và `ALLOWED_METHODS` không đổi sau
  feature này.
- Một phép khoá bộ biểu tượng: đúng bốn nút trên dòng tài khoản, đúng một trên
  đầu thẻ. Phép này tồn tại để lần sau ai thêm nút thì phải sửa test, và sửa test
  thì phải nêu được lệnh lõi đứng sau nút đó.
- Đếm số cú bấm từ lúc mở hộp thoại tới lúc thẻ chuyển xanh, cho cả hai đường.
  Mục tiêu là hai cú bấm cộng phần đăng nhập trên trang của hãng.
- Đếm số lối vào việc kết nối trên toàn app. Mục tiêu là **một**.
- `pnpm verify` xanh và `pnpm smoke:ui` chạy lại trước khi đóng gói.
- Kiểm tay trên máy Product Owner, bốn đường: một tài khoản OAuth, một tài khoản
  API key, rút mạng giữa lúc đang đăng nhập, và gỡ tài khoản rồi kết nối lại.
- Rollback: feature nằm trọn trong renderer và không đổi hợp đồng IPC, nên quay
  về commit trước là đủ; không có dữ liệu phải chuyển đổi.

## Câu hỏi đã có câu trả lời

- **`models.authStatus` trả theo nhà cung cấp hay theo từng tài khoản.** Theo
  từng hồ sơ. 0060 đã dựng `provider-accounts.ts` trên đúng dữ liệu đó. Khép.
- **Gỡ tài khoản có được phép không.** Được: `models.authLogout` nằm trong
  `SETUP_METHODS` và 0060 đã phát hành nút Đăng xuất. Khép.
- **Số hiệu spec.** 0063, vì 0062 thuộc về installer-messages đã gộp. Lưu ý
  `KE-HOACH-AI-FOR-BOSS-HARNESS-SME.md` còn ghi 0060 là bảng dịch quyền và 0061
  là kho eval; thực tế 0060 là trang tài khoản và 0061 là tỉa đường dẫn plugin.
  Kế hoạch đó cần cập nhật số, ngoài phạm vi feature này.
- **Nút bị lõi chặn: mờ hay ẩn.** Mờ, giữ nguyên ô, `title` nói lý do. Chốt ngày
  19/09 khi duyệt bản mẫu. Khép.
- **Mức dùng và đặt nhãn để ở đâu.** Mức dùng lên đầu thẻ; đặt nhãn vào hộp thoại
  thêm. Cả hai vì dữ liệu và lệnh lõi chỉ tồn tại ở đó. Khép.

## Hai câu cuối, Product Owner uỷ quyền cho người viết chốt

Ngày 19/09 Product Owner uỷ quyền chốt hai câu còn lại vì chúng thuộc phần kỹ
thuật. Chốt như sau, ghi lại để review được:

**Danh mục lõi nằm trong hộp thoại Thêm nhà cung cấp, và bấm được, nhưng đi vào
đúng một luồng.** Không bỏ hẳn: D-0022 nói nhà cung cấp lõi thêm về sau phải tự
xuất hiện mà không sửa mã, nên phải còn một đường tới những tên ngoài bốn thương
hiệu nổi. Nhưng cũng không giữ kiểu cũ: bỏ nút "Thiết lập" riêng trên từng mục.
Một dòng trong danh mục bấm vào thì đi tiếp đúng bước hai đường của mục 3, y hệt
bốn thẻ thương hiệu. Bốn thẻ chỉ là lối tắt lên đầu cùng một danh sách. Như vậy
vẫn là **một lối vào**, vì cả hai đều nằm trong cùng hộp thoại và cùng luồng.

**Bỏ `recommendedInstalls`.** Gợi ý cài thêm phần mềm khác không phải việc của
hộp thoại nối tài khoản, và nó là nguồn lớn nhất của cái bệnh "mỗi máy ra một màn
hình khác nhau" nêu ở vấn đề thứ ba. Khi một nhà cung cấp thật sự cần một CLI đã
cài, điều đó nói ở bước hai đường của chính nhà cung cấp ấy, dưới dạng một dòng
gợi ý, chứ không phải một danh sách thường trực. Còn hai nắp:
`unavailableCandidates` và `prepareOptions`.

## Làm hai đợt

Feature này chạm hai file, một trong đó dài 712 dòng và là một màn hình riêng
trong `App.tsx`. Chia đôi để mỗi đợt có bằng chứng riêng và có đường lùi riêng.

**Đợt 1 — trang Nhà cung cấp. Đã xong.** Đây là mặt người dùng nhìn mỗi ngày và
là chỗ hai trong bốn lối vào đang nằm.

- Bỏ `CapabilityCatalog kind="providers"` khỏi trang: hết danh mục 84 mục, hết ô
  tìm kiếm, hết nút "Thiết lập" trên từng mục, hết nút "Kết nối AI" đẩy ngược.
  Cũng hết luôn lượt dò nửa phút mà khối đó kéo theo.
- Khối "Nhà cung cấp lõi có hỗ trợ" rút thành một dòng chữ mờ cuối danh sách.
- Thêm thanh **Mô hình mặc định** ở đầu trang, kèm nút Đổi mô hình chuyển sang
  mục Mô hình trong Cài đặt.
- Dòng tài khoản đổi sang **bốn biểu tượng cố định**: đăng nhập lại, lên, xuống,
  gỡ. Nút lõi không cho thì mờ và `title` nói vì sao, không biến mất nữa. Mỗi
  biểu tượng có `title` và `aria-label` tiếng Việt.
- Thẻ nhà cung cấp có một biểu tượng **mức dùng**, vì `usage` chỉ tồn tại ở cấp
  đó.
- Biểu tượng lấy từ bộ `WorkbenchIcon` đã có trong kho (`plug`, `trash`,
  `usage`); không thêm tài nguyên mới.
- Số lối vào còn **hai**: trang này, và màn hình Kết nối cũ.

**Đợt 2 — chưa làm.** `ConnectScreen` vẫn là một màn hình riêng do `App.tsx`
định tuyến (`if (showConnect) return <ConnectScreen …>`). Còn lại: hạ nó xuống
hộp thoại, bốn thẻ thương hiệu rồi hai đường, tách ba nắp có tên riêng, bỏ
`recommendedInstalls`, ô đặt tên tài khoản, và bước "Đang khởi động lại bộ chạy"
có tên. Sau đợt 2 số lối vào mới về **một**, và số cú bấm mới đo được.

Trong lúc chờ đợt 2, nhà cung cấp ngoài bốn thương hiệu nổi vẫn nối được qua màn
hình Kết nối cũ, nên không mất đường nào.

## Bằng chứng hoàn thành

Đợt 1, ngày 19/09:

- `pnpm verify` exit code 0: 799 phép, 798 xanh, 0 hỏng, 1 bỏ qua.
- `tests/unit/provider-settings.test.mjs` viết lại theo hợp đồng mới, 7 phép
  xanh. Đáng chú ý: fixture **ném lỗi** nếu trang còn `require`
  `./CapabilityCatalog`, nên việc danh mục rời khỏi trang được khoá bằng test
  chứ không bằng lời hứa. Thêm phép khoá bộ biểu tượng: đúng 12 nút cho ba tài
  khoản, mỗi nút phải có `title` và `aria-label` không rỗng, nút bị chặn phải
  còn chỗ và phải nói lý do.
- Chưa chạy `pnpm smoke:ui`; phải chạy trước khi đóng gói.

Còn thiếu để đóng feature: đợt 2, số cú bấm đo được, số lối vào bằng một,
reviewer, và xác nhận của Product Owner.
