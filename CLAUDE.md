# Tool-KSK — Hệ thống quản lý khám sức khỏe (BV Tâm Trí Sài Gòn)

Ghi lại toàn bộ ngữ cảnh và quyết định đã có tính đến hiện tại, để không phải giải thích lại từ đầu ở phiên làm việc sau.

## Tổng quan

Web app tĩnh (không build step) cho nhân viên bệnh viện quét CCCD, quản lý các "đợt khám sức khỏe", nhập liệu, in tem STT, xuất Excel. Backend là Firebase (Auth + Realtime Database).

- **Live**: https://ndtri87.github.io/quan-ly-kham-suc-khoe/
- **Repo**: `ndtri87/quan-ly-kham-suc-khoe` trên GitHub (public), publish qua GitHub Pages, nhánh `main`.
- **Bản cũ (deprecated)**: https://ndtri87.github.io/tool-cccd-scan/ — không có đăng nhập, đọc thẳng `cccd_records`/`config` (schema phẳng, trước khi có mô hình "đợt khám"). Vẫn được giữ sống chỉ để **xem lại dữ liệu cũ đóng băng**, không dùng để nhập liệu mới nữa.

## Stack

- `index.html` + `app.js` + `print-export.js` — thuần HTML/CSS/JS, **không dùng ES modules** (cố ý — để chạy được bằng cách mở file trực tiếp qua `file://`, không cần server). Firebase dùng **compat SDK** (`firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-database-compat.js`), không phải modular SDK.
- **SheetJS (`xlsx.full.min.js`)** — đọc/xuất Excel.
- **html5-qrcode** (CDN `unpkg.com/html5-qrcode@2.3.8`) — quét mã QR bằng camera điện thoại.
- Firebase project: `ksk-crud` (config đã nằm sẵn trong `app.js`, không phải bí mật vì là client-side key).

## Cấu trúc dữ liệu Firebase Realtime Database

```
batchMeta/{batchId}          -> { name, date, location, status, eligibleAreaKeyword?,
                                   createdByEmail, createdAt }
batchRecords/{batchId}/{id}  -> { cccd, name, dob, gender, address, tempAddress?, phone,
                                   customSTT?, timestamp, createdAt, createdByEmail, createdBy,
                                   updatedAt?, updatedByEmail?, updatedBy? }
cccd_records/{id}, config/startNum   -> dữ liệu CŨ (trước khi có mô hình đợt khám), ĐÓNG BĂNG,
                                         chỉ .read: true (công khai, không cần đăng nhập) để bản
                                         tool cũ (không có login) đọc lại được. Không ai ghi vào đây nữa.
```

`eligibleAreaKeyword` (chuỗi, có thể nhiều khu vực cách nhau bằng dấu phẩy, để trống = tắt tính năng) cấu hình riêng cho từng đợt khám — xem mục 11 bên dưới.

Rules đang ở [database.rules.json](database.rules.json) — **phải tự tay dán vào Firebase Console → Realtime Database → Rules → Publish**, tôi không có quyền deploy rules trực tiếp.

## File trong repo (được publish)

- `index.html`, `app.js`, `print-export.js` — app chính.
- `database.rules.json` — rules tham khảo/version-control, không tự động deploy.

## File CHỈ ở máy local, KHÔNG publish (có trong `.gitignore`)

- `fix-stt.html` — công cụ chạy 1 lần để gán lại `customSTT` hàng loạt cho 1 đợt khám (dùng khi cần đổi số STT bắt đầu của dữ liệu đã có sẵn). Đăng nhập admin, chọn đợt khám, nhập số bắt đầu.
- `migrate.html` — đã bị xóa khỏi thư mục (dùng 1 lần để di chuyển dữ liệu cũ `cccd_records` sang mô hình `batchRecords` lúc nâng cấp ban đầu, không còn cần nữa).

Lý do không publish: đây là công cụ ghi thẳng dữ liệu hàng loạt, không cần ai khác ngoài admin biết nó tồn tại (dù rules vẫn chặn ghi nếu không đăng nhập).

## Các quyết định/thay đổi quan trọng đã làm (theo thời gian)

1. **Fix đăng nhập không chạy khi mở file trực tiếp**: chuyển từ Firebase Modular SDK (`import`, `type="module"`) sang Compat SDK — vì `<script type="module">` bị trình duyệt chặn CORS khi chạy qua `file://`.
2. **Redesign UI**: giao diện CSS thuần, tối giản, chuyên nghiệp — không emoji, không gradient màu mè, có một chút điểm nhấn màu accent xanh than (`--accent: #1d4e6e`) và shadow nhẹ để đỡ đơn điệu.
3. **Bỏ tính năng**: cấu hình số STT bắt đầu (giờ luôn mặc định 1, chỉnh qua `customSTT` từng dòng hoặc dùng `fix-stt.html`), và Import Excel (giữ lại Xuất Excel).
4. **Sort toàn bộ cột** trong bảng (không riêng STT) — bấm tiêu đề cột bất kỳ.
5. **Sửa bug xuất Excel**: trước đó ép sai cột thành text (nhầm cột Tên thay vì CCCD) khiến STT/CCCD mất số 0 đầu. Giờ ép toàn bộ cột về dạng text (`raw:true` + set `t:'s', z:'@'` mọi ô) để khớp y hệt dữ liệu hiển thị trên lưới.
6. **Tương thích bản tool cũ**: mở `.read: true` công khai cho `cccd_records`/`config` vì bản cũ không có cơ chế đăng nhập, chỉ đọc được nếu rule cho phép không cần `auth`. Đây là đánh đổi bảo mật có chủ đích (đã hỏi và được xác nhận) — dữ liệu CCCD/tên/địa chỉ bệnh nhân trong 2 node này công khai với bất kỳ ai có link.
7. **Quét CCCD bằng camera điện thoại** (tính năng lớn nhất, nhiều vòng sửa lỗi thực tế trên thiết bị):
   - Dùng `html5-qrcode`, ưu tiên `BarcodeDetector` gốc của trình duyệt khi có (`experimentalFeatures.useBarCodeDetectorIfSupported`) — chỉ có tác dụng trên Chrome Android, **KHÔNG có trên iOS Safari** (WebKit không hỗ trợ).
   - `facingMode` (kể cả `exact: 'environment'`) **không đáng tin cậy trên Safari/iPhone** — có thể "thành công" nhưng vẫn mở nhầm camera trước. Giải pháp: liệt kê camera qua `Html5Qrcode.getCameras()` rồi **chọn theo tên (label)** chứa "back"/"rear", loại "ultra wide"/"tele". `facingMode` chỉ còn là phương án dự phòng cuối cùng.
   - Thêm nút **"Chụp ảnh & quét"** dự phòng: chụp 1 khung hình độ phân giải đầy đủ rồi giải mã riêng ảnh đó (qua `html5QrCode.scanFile()`) — quan trọng cho iPhone vì quét video liên tục bằng JS thuần (không có engine gốc) khó đọc nổi mã QR dày đặc của CCCD gắn chip.
   - Có nút bật đèn flash (chỉ hiện nếu máy hỗ trợ, dò qua `getRunningTrackCapabilities()`).
   - Camera **cần HTTPS** (secure context) — không chạy được khi mở `index.html` qua `file://`, chỉ hoạt động trên bản đã publish.
   - Logic parse dữ liệu QR (`split('|')` → cccd/name/dob/gender/address) dùng chung 1 hàm `handleScannedCccdPayload()` cho cả máy quét vật lý (giả lập bàn phím) và camera.
8. **Thêm trường SĐT** (chỉ nhập tay — mã QR CCCD không có số điện thoại), **thao tác Sửa** (modal sửa toàn bộ field) và **Xóa** (có `confirm()` trước khi xóa, không hoàn tác được).
9. **Layout bảng**: container rộng 1600px (từ 1100px), toàn bộ ô trong bảng không xuống dòng (`white-space: nowrap`) **trừ cột Địa Chỉ** (`white-space: normal`, có `min-width`), bảng bọc trong `.table-scroll { overflow-x: auto }` để cuộn ngang thay vì phá layout khi hẹp hơn nội dung.
10. **Logo bệnh viện** (`https://bvtamtrisaigon.com.vn/vnt_upload/weblink/logo-tam-tri-2.png`) thêm ở màn hình đăng nhập và top-bar.
11. **Chặn trùng CCCD trong cùng đợt khám**: `isDuplicateCccdInBatch()` so `cccd` với `rawRecordsCache` (cache của đợt khám đang chọn, không phải toàn bộ hệ thống — trùng CCCD giữa 2 đợt khám khác nhau vẫn được phép). Áp dụng cho cả thêm thủ công lẫn quét QR (máy quét vật lý và camera, dùng chung `handleScannedCccdPayload()`).
12. **Sửa/Xóa đợt khám**: modal "Sửa đợt khám" cho đổi tên/ngày/địa điểm/trạng thái (`active`/`archived`). Xóa hẳn chỉ cho phép khi đợt khám **chưa có bản ghi nào** (tránh mất dữ liệu ngoài ý muốn) — nếu đã có dữ liệu, phải đổi Trạng thái sang "Đã lưu trữ" thay vì xóa.
13. **Kiểm duyệt điều kiện khám theo khu vực địa chỉ** (badge "Điều Kiện Khám" trên bảng):
    - Nghiệp vụ: đợt khám có thể giới hạn theo khu vực cư trú (VD: chỉ nhận cư dân "Đông Hưng Thuận"). Khớp `address`; nếu không khớp thì thử `tempAddress` (Địa Chỉ Tạm Trú); nếu cả hai đều không khớp thì hồ sơ "Không đủ điều kiện khám".
    - Từ khoá khu vực **cấu hình theo từng đợt khám** (`eligibleAreaKeyword` trong `batchMeta`, sửa trong modal Tạo/Sửa đợt khám), **không hard-code trong JS** — vì các đợt khám khác nhau có thể nhắm tới khu vực khác nhau và chạy song song, đổi tiêu chí không cần sửa code/deploy. Để trống = tắt tính năng cho đợt đó (badge "Không áp dụng").
    - So khớp qua `normalizeVN()` (bỏ dấu + hạ chữ thường) nên không phân biệt hoa/thường hay lỗi gõ dấu.
    - `computeEligibility()` tính lại **mỗi lần render** từ dữ liệu hiện tại (không lưu trạng thái cứng vào DB) — sửa `address`/`tempAddress` tại chỗ sẽ tự cập nhật badge ngay, không bị lệch dữ liệu.
    - `warnIfNotEligible()` bật `alert()` cảnh báo ngay sau khi thêm hồ sơ (thủ công hoặc quét QR) nếu rơi vào diện cảnh báo/không đủ điều kiện.
    - Nút **In Tem** tự `disabled` khi hồ sơ chưa chắc đủ điều kiện (badge khác "Đủ điều kiện"/"Không áp dụng").
    - Badge dùng nền màu đặc (chữ trắng) + `border-radius: var(--radius)` (bo góc nhẹ, không bo tròn kiểu pill) để nổi bật và đồng bộ style vuông vắn của button/input trong app.
    - Đã thử thêm thao tác "Đồng kiểm" (nhân viên xác nhận đã kiểm tra lại hồ sơ, lưu `verifiedBy`/`verifiedByEmail`/`verifiedAt`) nhưng **bỏ lại** vì dư thừa thông tin so với badge điều kiện khám đã có sẵn — không còn trong code.

## Quy trình publish

```bash
git add <file...>
git commit -m "..."
git push origin main
```
GitHub Pages tự rebuild sau khi push (thường 30s–2 phút). Kiểm tra bằng cách curl lại nội dung file trên `https://ndtri87.github.io/quan-ly-kham-suc-khoe/...` để xác nhận đã cập nhật trước khi báo user.

**Lưu ý môi trường máy này**: `gh` CLI cần chạy với `GH_CONFIG_DIR="$HOME/.gh-config"` (vì `~/.config` bị sở hữu bởi `root`, không ghi được, gây lỗi khi `gh auth login` lưu cấu hình mặc định).

## Việc cần làm mỗi khi đổi `database.rules.json`

File này **không tự động deploy**. User phải tự vào Firebase Console → Realtime Database → Rules → dán nội dung mới → Publish.
