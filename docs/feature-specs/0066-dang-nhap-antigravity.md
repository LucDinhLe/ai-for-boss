# 0066 — Đăng nhập Antigravity

Trạng thái: Draft, **chờ Product Owner chốt trước khi viết mã**. Mở ngày 2026-09-22.

Product Owner đã gỡ nguyên tắc "vỏ không tự viết đường đăng nhập lõi không có"
(D-0022, quyết định 13/09) cho riêng việc này, kèm ba ràng buộc: phải chạy hiệu
quả, **chỉ sửa phần plugin**, không đụng phần khác có thể ảnh hưởng tới lõi.

## Vì sao cần

Lõi OpenClaw `2026.9.1` **đã khai tử** đường đăng nhập Antigravity. Bằng chứng
lấy thẳng từ lõi đang đóng gói:

```js
const RETIRED_PLUGIN_IDS = new Set([
  "google-antigravity-auth",
  "google-gemini-cli-auth",
  "skill-workshop"
]);
```

Đã kiểm và loại trừ mọi đường vòng:

- Không bản lõi nào từ `2026.6.35` tới `2026.9.5` còn plugin này. Bản `2026.7.x`
  chỉ sót một tệp biểu tượng. Trang tài liệu của plugin trả 404 ở mọi bản.
  **Hạ lõi không lấy lại được Antigravity.**
- Không có gói npm OpenClaw nào cho nó — ba tên đã thử đều 404.
- Trong lõi hiện tại còn đúng một dấu vết: hàm chuẩn hoá tên mô hình
  `normalizeAntigravityModelId`. Lõi vẫn **đọc được tên mô hình** Antigravity,
  chỉ thiếu phần lấy quyền dùng.

## Đề xuất: app tự chạy OAuth của chính nó

Đây là đường spec này khuyến nghị, và là đường duy nhất nên viết mã.

Người dùng bấm đăng nhập → trình duyệt mở trang của Google → họ đăng nhập →
app nhận token **cấp cho chính app này** qua OAuth. Y hệt cách ChatGPT và Grok
đang hoạt động trong sản phẩm, chỉ khác nhà cung cấp.

Vì sao là đường này:

- **Token thuộc về app**, tự hết hạn và thu hồi được, không phụ thuộc phần mềm
  nào khác trên máy. Không có Antigravity IDE vẫn nối được.
- **Giữ đúng ba ràng buộc của Product Owner**: mã nằm trọn trong một gói plugin,
  không chạm một dòng nào của lõi OpenClaw, không đọc dữ liệu của phần mềm khác.
- Khả thi đã được chứng minh: có hai gói tham khảo trên npm chạy đúng luồng này
  (cho Opencode, không phải OpenClaw). **Không sao chép mã của họ** — chỉ ghi
  nhận đường này có người đi trước.

## Đã cân nhắc và loại: đọc thông tin đăng nhập của Antigravity IDE

Có một ý là đi tìm token mà Antigravity IDE đã lưu trên máy rồi dùng lại. Spec
này **loại bỏ** ý đó, vì bốn lý do, không phải vì thiếu công cụ:

1. Antigravity IDE là một nhánh của VS Code; nó **không để token trong tệp
   thường** mà trong kho bí mật của hệ điều hành. Đọc kho bí mật thuộc về một
   phần mềm khác của một hãng khác là đúng loại việc mà lằn ranh đỏ của dự án
   cấm ("không chạm dữ liệu của phần mềm khác", "không tự phát minh auth").
2. **Không có hợp đồng.** Định dạng không được ghi tài liệu; Antigravity đổi lúc
   nào cũng được và không ai báo. Đây chính là R-005, và Antigravity vừa chứng
   minh nó xảy ra thật khi thượng nguồn gỡ plugin không báo trước.
3. Dữ liệu trên máy Product Owner có ngày cuối là tháng 3–6/2026, không có phiên
   đăng nhập còn sống gần đây. Đường này còn chẳng chắc có token để đọc.
4. Token đọc trộm được như vậy là **của phiên IDE**, không thu hồi hay quản lý
   được từ app. Đường A cho một phiên sạch mà app làm chủ.

Ghi lại để lần sau không ai đề xuất lại.

## Việc Product Owner phải làm trước khi viết mã

Đường A cần một OAuth client đăng ký với Google, và **soát điều khoản dùng của
Antigravity/Google trước khi phát hành** (R-003). Đây là việc của Product Owner
và Legal, không phải việc kỹ thuật, và không được bỏ qua:

- Đăng ký OAuth client (client id, redirect URI cho ứng dụng để bàn).
- Xác nhận điều khoản Antigravity/Google **cho phép** một app bên thứ ba đăng
  nhập lấy quyền dùng mô hình theo cách này. Nếu điều khoản cấm thì dừng, không
  có đường kỹ thuật nào vượt qua được điều đó.

Chưa có hai thứ trên thì spec này không chuyển sang viết mã.

## Ranh giới khi viết (khi đã được phép)

- Plugin nằm trong **một gói riêng** dưới `packages/`, mẫu như `harness-plugin`
  và `document-tools` đã có. Không sửa `apps/desktop/electron/setup-channel.mjs`,
  `main.mjs`, adapter, hay danh sách phương thức cho phép.
- Không sửa lõi OpenClaw, không sửa `native-catalog.json` sinh tự động.
- Bí mật chỉ đi qua đúng đường lõi đã có cho token (SecretRef / kho bí mật hệ
  điều hành), không bao giờ ghi ra tệp thường. D-0002 giữ nguyên.
- Phần vỏ chỉ thêm đúng chỗ hiển thị Antigravity thành một thẻ bấm được, không
  đổi bốn thẻ cố định của 0063.

## Kế hoạch kiểm thử (khi đã được phép)

- Đăng nhập thành công cấp token cho app, và token đó nối được tới một mô hình
  Antigravity thật.
- Rút mạng giữa lúc đăng nhập: hỏng sạch, báo rõ, không để lại phiên nửa vời.
- Thu hồi được: đăng xuất xoá token của app, không đụng tới Antigravity IDE.
- `pnpm verify` xanh trước và sau, chứng minh không làm hỏng thứ đang chạy.
- Một phép khoá rằng gói này không import gì từ lõi và không đọc kho bí mật của
  phần mềm khác.

## Bằng chứng hoàn thành

Điền khi xong. Trước đó, hai việc ở mục "Product Owner phải làm" phải có kết quả
ghi lại được.
