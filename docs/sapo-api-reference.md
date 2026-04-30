# Sapo API Reference

> Tài liệu tra cứu API Sapo (sapo.vn / mysapo.net) tổng hợp từ https://support.sapo.vn/gioi-thieu-api  
> Cập nhật: 2026-04-30  
> Mục đích: tra cứu nhanh trong project tích hợp Sapo Web

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Authentication](#2-authentication)
   - [2.1 OAuth 2.0](#21-oauth-20)
   - [2.2 Private Apps (Basic Auth)](#22-private-apps-basic-auth)
3. [Webhook](#3-webhook)
4. [API Reference](#4-api-reference)
   - [Article](#41-article)
   - [Asset](#42-asset)
   - [Blog](#43-blog)
   - [Collect](#44-collect)
   - [Comment](#45-comment)
   - [Customer](#46-customer)
   - [CustomerAddress](#47-customeraddress)
   - [CustomCollection](#48-customcollection)
   - [DiscountCode](#49-discountcode)
   - [Event](#410-event)
   - [Fulfillment](#411-fulfillment)
   - [Metafield](#412-metafield)
   - [Order](#413-order)
   - [Page](#414-page)
   - [Price Rule](#415-price-rule)
   - [Product](#416-product)
   - [Product Variant](#417-product-variant)
   - [Product Image](#418-product-image)
   - [Redirect](#419-redirect)
   - [Refund](#420-refund)
   - [ScriptTag](#421-scripttag)
   - [SmartCollection](#422-smartcollection)
   - [Store](#423-store)
   - [Theme](#424-theme)
   - [Transaction](#425-transaction)
   - [Carrier Service](#426-carrier-service)
5. [Bảng tra cứu nhanh endpoints](#5-bảng-tra-cứu-nhanh-endpoints)

---

## 1. Giới thiệu

Sapo API là REST API cho phép thiết lập phần lớn tính năng của Sapo CMS từ ứng dụng bên ngoài. Có thể dùng để xây Web app, mobile app, hoặc phần mềm bên thứ ba tích hợp với Sapo.

- **Base URL:** `https://{store}.mysapo.net/admin/`
- **Định dạng:** JSON (mặc định) hoặc XML
- **Header bắt buộc khi gọi API:** `Content-Type: application/json`
- **Đăng ký Partner:** https://developers.sapo.vn/services/partners/auth/register
- **Trang quản lý Apps:** https://developers.sapo.vn/services/partners/api_clients

---

## 2. Authentication

Có 2 cơ chế xác thực: **OAuth 2.0** (cho public apps) và **Private Apps** (Basic Auth, cho ứng dụng riêng của shop).

### 2.1 OAuth 2.0

Tham chiếu: [OAuth 2.0 specification (RFC 6749)](https://tools.ietf.org/html/rfc6749)

#### Thuật ngữ
- **Client:** Ứng dụng muốn truy cập dữ liệu Shop. Phải được User cấp quyền.
- **API:** REST API của Sapo.
- **User:** Tài khoản quản trị Sapo (thường là chủ Shop). Người cấp quyền cho Client.

#### Bước 1: Lấy credentials của Client
1. Mở trang **Apps** trong Partner: https://developers.sapo.vn/services/partners/api_clients
2. Click vào tên App để xem chi tiết
3. Lấy `API Key` và `Secret Key`

#### Bước 2: Xin cấp quyền (Authorization)

Redirect User đến URL:

```
https://{store}.mysapo.net/admin/oauth/authorize?client_id={api_key}&scope={scopes}&redirect_uri={redirect_uri}
```

| Tham số | Mô tả |
|---|---|
| `{store}` | Tên Shop |
| `{api_key}` | API Key của App |
| `{scopes}` | Danh sách scopes, cách nhau bằng dấu phẩy. Ví dụ: `write_orders,read_customers` |
| `{redirect_uri}` | **Bắt buộc.** URL redirect sau khi User cấp quyền. Phải khớp với *Redirect URL* của App |

#### Bước 3: Xác nhận cài đặt

Sau khi User click *Install*, họ được redirect về:

```
https://{your_domain}/some/redirect/uri?code={authorization_code}&signature=...&timestamp=...
```

Đổi `code` lấy `access_token` bằng request:

```
POST https://{store}.mysapo.net/admin/oauth/access_token
```

Body:
```json
{
  "client_id": "{api_key}",
  "client_secret": "{secret_key}",
  "code": "{authorization_code}"
}
```

Response:
```json
{
  "access_token": "f85632530bf277ec9ac6f649fc327f17"
}
```

> Access token này là **vĩnh viễn** — Client nên lưu lại để dùng lâu dài.

#### Bước 4: Gọi API đã xác thực

Mọi request gắn header:

```
X-Sapo-Access-Token: {access_token}
```

#### Scopes (danh sách quyền)

| Scope | Tài nguyên truy cập |
|---|---|
| `read_content` / `write_content` | Article, Blog, Comment, Page, Redirect |
| `read_themes` / `write_themes` | Asset, Theme |
| `read_products` / `write_products` | Product, ProductVariant, ProductImage, Collect, CustomCollection, SmartCollection |
| `read_customers` / `write_customers` | Customer |
| `read_orders` / `write_orders` | Order, Transaction, Fulfillment, Carrier Service |
| `read_script_tags` / `write_script_tags` | ScriptTag |
| `read_price_rules` / `write_price_rules` | Price Rule, DiscountCode |
| `read_draft_orders` / `write_draft_orders` | Đơn hàng nháp |

#### Verification (HMAC validation)

Mỗi request hoặc redirect từ Sapo về Client có chứa `signature` và `hmac` để xác minh dữ liệu là từ Sapo.

**Quy trình HMAC validation:**

1. Parse query string thành dict các cặp `(key, value)`
2. Loại bỏ `hmac` ra khỏi dict
3. Sort các key theo thứ tự từ điển
4. Ghép thành chuỗi: `key1=value1&key2=value2&...`
5. HMAC-SHA256 chuỗi đó với key là **Secret Key**, encode Base64
6. So sánh kết quả với `hmac` ban đầu

Ví dụ Ruby:
```ruby
require 'openssl'
require 'base64'

digest = OpenSSL::Digest.new('sha256')
secret = "hush"
message = "code=a94a110d86d2452eb3e2af4cfb8a3828&store=some-store.mysapo.net&timestamp=1337178173"
hmac = Base64.strict_encode64(OpenSSL::HMAC.digest(digest, secret, message))
```

### 2.2 Private Apps (Basic Auth)

Phù hợp với ứng dụng riêng của một shop (không cần qua flow OAuth).

#### Tạo Private App
1. Trang quản trị Sapo Web → menu **Ứng dụng**
2. Lướt xuống **"Bạn đang làm việc với nhà phát triển?"** → click **Ứng dụng riêng**
3. Click **Tạo ứng dụng riêng**
4. Điền **Tên ứng dụng** (bắt buộc), **Email liên hệ**
5. Cấp quyền cho từng tài nguyên với 3 mức:
   - **Không cho phép** — không truy cập được
   - **Chỉ đọc** — read-only
   - **Đọc và ghi** — read-write
6. Lưu → nhận `API Key` và `API Secret`

#### Cách dùng

Định dạng URL với Basic Auth:

```
https://{api_key}:{api_secret}@{hostname}/admin/{resource}.json
```

Ví dụ lấy danh sách đơn hàng:
```
https://999f35603fef47849b6a44b67104a647:abc123def@yourshop.mysapo.net/admin/orders.json
```

> Sửa quyền không thay đổi `API Key`/`API Secret`.

---

## 3. Webhook

Webhook cho phép đăng ký một URL (HTTP/HTTPS) để Sapo POST dữ liệu khi có Event xảy ra.

### Các Topic được hỗ trợ

| Tài nguyên | Events |
|---|---|
| **App** | `app/uninstalled`, `app/charge` |
| **Collection** | `collections/create`, `collections/update`, `collections/delete` |
| **Customer** | `customers/create`, `customers/update`, `customers/delete`, `customers/enable`, `customers/disable` |
| **Fulfillment** | `fulfillments/create`, `fulfillments/update` |
| **Order** | `orders/create`, `orders/delete`, `orders/updated`, `orders/paid`, `orders/cancelled`, `orders/fulfilled`, `orders/partially_fulfilled` |
| **Order_Transaction** | `order_transactions/create` |
| **Product** | `products/create`, `products/update`, `products/delete` |
| **Refund** | `refunds/create` |
| **Store** | `store/update` |
| **Cart** | `carts/create`, `carts/update` |

### Thuộc tính

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất định danh Webhook (ví dụ: `901431826`) |
| `address` | URI nhận POST request khi event xảy ra |
| `topic` | Event kích hoạt webhook |
| `format` | `json` hoặc `xml` |
| `created_on` | ISO 8601 |
| `modified_on` | ISO 8601 |

### Endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/webhooks.json` | List webhooks |
| GET | `/admin/webhooks/count.json` | Đếm webhooks |
| GET | `/admin/webhooks/{id}.json` | Lấy 1 webhook |
| POST | `/admin/webhooks.json` | Tạo webhook |
| PUT | `/admin/webhooks/{id}.json` | Update webhook |
| DELETE | `/admin/webhooks/{id}.json` | Xóa webhook |

### Query parameters cho list/count

| Param | Mô tả |
|---|---|
| `address` | Filter theo URI |
| `topic` | Filter theo topic |
| `created_on_min` / `created_on_max` | Filter ngày tạo |
| `modified_on_min` / `modified_on_max` | Filter ngày update |
| `since_id` | ID > ngưỡng |
| `limit` | Mặc định 50, max 250 |
| `page` | Mặc định 1 |
| `fields` | Trường trả về, cách bằng dấu phẩy |

### Ví dụ

**Tạo webhook:**
```http
POST /admin/webhooks.json
{
  "webhook": {
    "topic": "orders/create",
    "address": "http://whatever.hostname.com/",
    "format": "json"
  }
}
```

**Response:**
```json
{
  "webhook": {
    "id": 987911590,
    "address": "http://whatever.hostname.com/",
    "topic": "orders/create",
    "created_on": "2016-01-20T13:01:10Z",
    "modified_on": "2016-01-20T13:01:10Z",
    "format": "json"
  }
}
```

**Lỗi 422 khi thiếu topic/address:**
```json
{
  "errors": {
    "topic": ["can't be blank", "Invalid topic specified..."],
    "address": ["can't be blank"]
  }
}
```

---

## 4. API Reference

### 4.1 Article

Bài viết trong Blog. Một blog có thể chứa nhiều article, sắp xếp theo ngày giảm dần.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/blogs/{blog_id}/articles.json` | List articles |
| GET | `/admin/blogs/{blog_id}/articles/count.json` | Đếm articles |
| GET | `/admin/blogs/{blog_id}/articles/{id}.json` | Lấy 1 article |
| POST | `/admin/blogs/{blog_id}/articles.json` | Tạo article |
| PUT | `/admin/blogs/{blog_id}/articles/{id}.json` | Update article |
| DELETE | `/admin/blogs/{blog_id}/articles/{id}.json` | Xóa article |
| GET | `/admin/articles/authors.json` | List tất cả authors |
| GET | `/admin/blogs/{blog_id}/articles/tags.json?limit=1&popular=1` | List tags |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất định danh article |
| `blog_id` | ID của blog chứa article |
| `title` | Tiêu đề |
| `content` | Nội dung HTML |
| `summary` | Tóm tắt |
| `author` | Tên tác giả |
| `user_id` | ID tác giả |
| `tags` | String, các tag cách nhau bằng dấu phẩy |
| `template_layout` | Template tùy chọn (null = mặc định) |
| `image` | `{ "src": "...", "base64": "..." }` |
| `metafield` | Metadata: key, namespace, value, value_type, description |
| `created_on` / `modified_on` / `published_on` | ISO 8601 |

**Query params cho list:**
`limit` (max 250), `page`, `since_id`, `fields`, `created_on_min/max`, `modified_on_min/max`, `published_on_min/max`, `published` (true/false).

**Ví dụ tạo article có ảnh từ URL:**
```json
POST /admin/blogs/{id}/articles.json
{
  "article": {
    "title": "My new Article",
    "author": "John Smith",
    "tags": "tag1, tag2",
    "content": "<h1>Hello</h1>",
    "published_on": "2008-07-31T20:00:00Z",
    "image": { "src": "http://example.com/image.gif" }
  }
}
```

**Ẩn bài đã xuất bản:** PUT với `"published_on": null`. Hiện lại: set `published_on` về thời điểm trong quá khứ.

---

### 4.2 Asset

File theme: ảnh, CSS, JS, .bwt (liquid). Một theme có 3 buckets: `layouts/`, `templates/`, `assets/`.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/themes/{id}/assets.json` | List assets (chỉ metadata) |
| GET | `/admin/themes/{id}/assets.json?key={path}&theme_id={id}` | Lấy 1 asset (kèm value) |
| PUT | `/admin/themes/{id}/assets.json` | Tạo hoặc update asset |
| DELETE | `/admin/themes/{id}/assets.json?key={path}` | Xóa asset |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `key` | Đường dẫn (e.g. `assets/bg-body.gif`, `templates/index.bwt`) |
| `value` | Nội dung (text/liquid) |
| `base64` | Nội dung dạng base64 (để upload binary) |
| `src` | URL nguồn (để Sapo download) |
| `source_key` | Key của asset nguồn (để copy) |
| `public_url` | URL public của asset |
| `content_type` | MIME type |
| `size` | Dung lượng (bytes) |
| `theme_id` | ID theme |
| `created_on` / `modified_on` | ISO 8601 |

**Lưu ý:** PUT đảm nhiệm cả tạo mới lẫn update. Một số file mặc định không thể xóa (trả về 403).

**Ví dụ update file liquid:**
```json
PUT /admin/themes/{id}/assets.json
{
  "asset": {
    "key": "templates/index.bwt",
    "value": "<img src='backsoon.png'><p>Updating...</p>"
  }
}
```

**Copy asset:**
```json
{
  "asset": {
    "key": "layouts/alternate.bwt",
    "source_key": "layouts/theme.bwt"
  }
}
```

---

### 4.3 Blog

Blog là container chứa nhiều Article.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/blogs.json` | List blogs |
| GET | `/admin/blogs/count.json` | Đếm blogs |
| GET | `/admin/blogs/{id}.json` | Lấy 1 blog |
| POST | `/admin/blogs.json` | Tạo blog |
| PUT | `/admin/blogs/{id}.json` | Update blog |
| DELETE | `/admin/blogs/{id}.json` | Xóa blog |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất định danh blog |
| `name` | Tiêu đề blog |
| `alias` | Slug duy nhất, sinh tự động từ title |
| `commentable` | `no` (mặc định), `moderate`, `yes` |
| `template_layout` | Template tùy chọn |
| `meta_title` / `meta_description` | SEO |
| `metafield` | Metadata |
| `created_on` / `modified_on` | ISO 8601. Lưu ý: `modified_on` không đổi khi thêm/sửa article trong blog |

**Ví dụ tạo blog:**
```json
POST /admin/blogs.json
{ "blog": { "name": "Apple main blog" } }
```

---

### 4.4 Collect

Collect là object kết nối Product với (Custom) Collection. Một product có thể thuộc nhiều collection (nhiều collect).

> Collect chỉ áp dụng cho **Custom Collection**. SmartCollection dùng rules tự động — tạo collect cho smart collection sẽ trả lỗi **422**.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/collects.json` | List collects |
| GET | `/admin/collects/count.json` | Đếm |
| GET | `/admin/collects/{id}.json` | Lấy 1 collect |
| POST | `/admin/collects.json` | Tạo collect |
| DELETE | `/admin/collects/{id}.json` | Xóa collect |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `collection_id` | ID collection |
| `product_id` | ID product |
| `position` | Thứ tự sản phẩm trong collection (1 = đầu tiên), chỉ dùng khi sort = manual |
| `featured` | true/false |
| `created_on` / `modified_on` | ISO 8601 |

**Query params:** `product_id`, `collection_id`, `limit`, `page`, `fields`.

**Ví dụ:**
```json
POST /admin/collects.json
{ "collect": { "product_id": 921728736, "collection_id": 841564295 } }
```

---

### 4.5 Comment

Bình luận của người đọc trên Article. Có cơ chế chống spam.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/comments.json` | List comments |
| GET | `/admin/comments/count.json` | Đếm comments |
| GET | `/admin/comments/{id}.json` | Lấy 1 comment |
| POST | `/admin/comments.json` | Tạo comment |
| PUT | `/admin/comments/{id}.json` | Update comment |
| POST | `/admin/comments/{id}/spam.json` | Đánh dấu spam |
| POST | `/admin/comments/{id}/not_spam.json` | Bỏ đánh dấu spam |
| POST | `/admin/comments/{id}/approve.json` | Duyệt comment |
| POST | `/admin/comments/{id}/remove.json` | Xóa comment |
| POST | `/admin/comments/{id}/restore.json` | Khôi phục comment |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `article_id` | ID article |
| `blog_id` | ID blog |
| `author` | Tên người viết |
| `email` | Email |
| `body` | Nội dung |
| `ip` | IP người viết |
| `agent` | User agent |
| `status` | `unapproved` (default), `published`, `spam`, `removed` |
| `created_on` / `modified_on` / `published_on` | ISO 8601 |

**Query params:** `article_id`, `blog_id`, `limit`, `page`, `since_id`, `fields`, `published`, `status` (`pending`/`published`/`unapproved`), date filters.

---

### 4.6 Customer

Tài khoản khách hàng của shop. Lưu thông tin liên hệ, không lưu thẻ.

Setting checkout:
- **Guest checkout only** — không cần tài khoản
- **Guest checkout with optional sign-in** — tùy chọn
- **Sign-in required** — bắt buộc tài khoản

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/customers.json` | List customers |
| GET | `/admin/customers/count.json` | Đếm |
| GET | `/admin/customers/{id}.json` | Lấy 1 customer |
| POST | `/admin/customers.json` | Tạo customer |
| PUT | `/admin/customers/{id}.json` | Update customer |
| DELETE | `/admin/customers/{id}.json` | Xóa customer |
| GET | `/admin/orders.json?customer_id={id}` | Orders của 1 customer |

**Thuộc tính chính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `email` | Email |
| `phone` | Số điện thoại (`+84345678900`) |
| `first_name` / `last_name` | Tên/Họ |
| `gender` | `Male` / `Female` / `Other` |
| `dob` | Ngày sinh `yyyy-mm-dd` |
| `accepts_marketing` | true/false |
| `verified_email` | true/false |
| `tags` | String, cách nhau dấu phẩy |
| `note` | Ghi chú |
| `state` | `disabled`/`enabled`, có thể `decline` hoặc `invited` |
| `orders_count` | Số đơn hàng |
| `total_spent` | Tổng tiền đã chi |
| `last_order_id` / `last_order_name` | Đơn cuối |
| `addresses` | Mảng địa chỉ |
| `default_address` | Địa chỉ mặc định |
| `metafield` | Metadata |
| `created_on` / `modified_on` | ISO 8601 |

**Address sub-object:** `id`, `first_name`, `last_name`, `company`, `address1`, `address2`, `city`, `province`, `province_code`, `country`, `country_code`, `country_name`, `zip`, `phone`, `name`, `primary`.

---

### 4.7 CustomerAddress

Địa chỉ của customer (1 customer có thể có nhiều address).

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/customers/{id}/addresses.json` | List addresses |
| GET | `/admin/customers/{customer_id}/addresses/{id}.json` | Lấy 1 address |
| POST | `/admin/customers/{id}/addresses.json` | Tạo address |
| PUT | `/admin/customers/{customer_id}/addresses/{id}.json` | Update address |
| DELETE | `/admin/customers/{customer_id}/addresses/{id}.json` | Xóa address |
| PUT | `/admin/customers/{customer_id}/addresses/{id}/default.json` | Đặt làm mặc định |

**Thuộc tính:** `address1`, `address2`, `city`, `company`, `first_name`, `last_name`, `phone`, `province`, `province_code`, `country`, `country_code`, `country_name`, `zip`, `name`, `default`.

> Không thể xóa địa chỉ mặc định (lỗi 422). Phải đặt một địa chỉ khác làm default trước.

---

### 4.8 CustomCollection

Danh mục sản phẩm thường (chủ shop chọn sản phẩm thủ công).

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/custom_collections.json` | List |
| GET | `/admin/custom_collections/count.json` | Đếm |
| GET | `/admin/custom_collections/{id}.json` | Lấy 1 |
| POST | `/admin/custom_collections.json` | Tạo |
| PUT | `/admin/custom_collections/{id}.json` | Update |
| DELETE | `/admin/custom_collections/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `name` | Tên collection (tiêu đề) |
| `alias` | Slug, max 255 ký tự |
| `description` | Mô tả HTML |
| `image` | `{ "id": ..., "src": "..." }` |
| `published_on` | ISO 8601, hoặc `null` để ẩn |
| `sort_order` | `alpha-asc`, `alpha-desc`, `best-selling`, `created`, `created-desc`, `manual`, `price-asc`, `price-desc` |
| `template_suffix` | Template layout |
| `metafield` | Metadata |

**Query params:** `since_id`, `product_id`, `title`, `published_status` (`published`/`unpublished`/`any`), date filters.

---

### 4.9 DiscountCode

Mã giảm giá thuộc về một PriceRule. Khách dùng mã ở checkout.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| POST | `/admin/price_rules/{price_rule_id}/discount_codes.json` | Tạo |
| PUT | `/admin/price_rules/{price_rule_id}/discount_codes/{id}.json` | Update |
| GET | `/admin/price_rules/{price_rule_id}/discount_codes.json` | List |
| GET | `/admin/price_rules/{price_rule_id}/discount_codes/{id}.json` | Lấy 1 |
| DELETE | `/admin/price_rules/{price_rule_id}/discount_codes/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `price_rule_id` | ID PriceRule chứa |
| `code` | Chuỗi mã, max 255 ký tự (e.g. `SUMMERSALE10OFF`) |
| `usage_count` | Đã dùng bao nhiêu lần |
| `created_on` / `updated_on` | ISO 8601 |

> **Best practice:** Đặt `price_rule.title` = `discount_code.code` (vì admin chỉ search được theo title).

DELETE trả về `204 No Content`.

---

### 4.10 Event

Event được sinh khi có hành động trên các tài nguyên. **Lưu ý:** event có thể delay vài giây đến vài phút.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/events.json` | List events shop |
| GET | `/admin/{resource}/{id}/events.json` | List events của 1 resource |
| GET | `/admin/events/{id}.json` | Lấy 1 event |
| GET | `/admin/events/count.json` | Đếm |

**Tài nguyên có Event:** Article, Blog, Custom Collection, Comment, Order, Page, Product, Smart Collection.

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `subject_id` / `subject_type` | Resource liên quan |
| `verb` | Hành động (`create`, `update`, `destroy`, `published`, `unpublished`, `confirmed`, `cancelled`, `placed`, `closed`, `re_opened`, etc.) |
| `arguments` | Tham số liên quan |
| `body` | Mô tả thêm |
| `message` | Thông báo |
| `author` | User thực hiện |
| `description` | Description |
| `path` | URL |
| `created_on` | ISO 8601 |

**Order Event categories:** Authorization, Capture, Email, Fulfillment, Order, Refund, Sale, Void (mỗi loại có success/failure/pending).

---

### 4.11 Fulfillment

Đại diện việc vận chuyển items của 1 order. Một order có thể có nhiều fulfillment.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/orders/{order_id}/fulfillments.json` | List |
| GET | `/admin/orders/{order_id}/fulfillments/count.json` | Đếm |
| GET | `/admin/orders/{order_id}/fulfillments/{id}.json` | Lấy 1 |
| POST | `/admin/orders/{order_id}/fulfillments.json` | Tạo |
| PUT | `/admin/orders/{order_id}/fulfillments/{id}.json` | Update |
| POST | `/admin/orders/{order_id}/fulfillments/{id}/complete.json` | Hoàn thành |
| POST | `/admin/orders/{order_id}/fulfillments/{id}/cancel.json` | Hủy |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `order_id` | ID order |
| `status` | `pending`, `success`, `cancelled`, `error`, `failure` |
| `service` | Nhà cung cấp (`manual`, `amazon`, etc.) |
| `tracking_company` | Tên hãng vận chuyển |
| `tracking_number` / `tracking_numbers` | Mã tracking (string hoặc mảng) |
| `tracking_url` / `tracking_urls` | URL tracking |
| `receipt` | `{ "testcase": ..., "authorization": ... }` |
| `line_items` | Mảng items được giao |
| `created_on` / `modified_on` | ISO 8601 |

**`line_item` sub-object:** `id`, `variant_id`, `product_id`, `title`, `quantity`, `price`, `grams`, `sku`, `variant_title`, `vendor`, `name`, `requires_shipping`, `taxable`, `gift_card`, `fulfillment_service`, `fulfillment_status`, `fulfillable_quantity`, `total_discount`, `properties`, `product_exists`, `variant_inventory_management`, `tax_lines`.

---

### 4.12 Metafield

Metadata bổ sung cho các tài nguyên: Blog, CustomCollection, Customer, Order, Page, Product, ProductVariant.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/metafields.json` | List metafields shop |
| GET | `/admin/{resource}/{id}/metafields.json` | List metafields của resource |
| GET | `/admin/metafields/count.json` | Đếm |
| GET | `/admin/{resource}/{id}/metafields/count.json` | Đếm theo resource |
| GET | `/admin/metafields/{id}.json` | Lấy 1 |
| GET | `/admin/{resource}/{id}/metafields/{id}.json` | Lấy 1 của resource |
| POST | `/admin/metafields.json` | Tạo |
| POST | `/admin/{resource}/{id}/metafields.json` | Tạo cho resource |
| PUT | `/admin/metafields/{id}.json` | Update |
| PUT | `/admin/{resource}/{id}/metafields/{id}.json` | Update của resource |
| DELETE | `/admin/metafields/{id}.json` | Xóa |
| DELETE | `/admin/{resource}/{id}/metafields/{id}.json` | Xóa của resource |

**Thuộc tính (4 trường bắt buộc):**

| Field | Mô tả |
|---|---|
| `key` | Định danh metafield, max 30 ký tự |
| `namespace` | Container, max 20 ký tự |
| `value` | Giá trị |
| `value_type` | `string` hoặc `integer` |
| `description` | Tùy chọn |
| `id` | Số duy nhất |
| `owner_id` | ID resource sở hữu |
| `owner_resource` | Loại resource (`shop`, `product`, etc.) |
| `created_on` / `modified_on` | ISO 8601 |

**Filter Metafield của ảnh sản phẩm:**
```
GET /admin/metafields.json?metafield[owner_id]=850703190&metafield[owner_resource]=product_image
```

---

### 4.13 Order

Đơn hàng — yêu cầu hoàn chỉnh của khách mua một/nhiều sản phẩm.

> **Lưu ý:** Order có thể tạo qua API nhưng thông tin thanh toán không được lưu, không có Transaction tự động. Bạn có thể đánh dấu trạng thái thanh toán bất kỳ. Không thể thay đổi line items hoặc số lượng qua API.

**Endpoints:**

| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/orders.json` | List orders |
| GET | `/admin/orders/count.json` | Đếm |
| GET | `/admin/orders/{id}.json` | Lấy 1 order |
| POST | `/admin/orders.json` | Tạo order |
| PUT | `/admin/orders/{id}.json` | Update order |
| DELETE | `/admin/orders/{id}.json` | Xóa order |
| POST | `/admin/orders/{id}/close.json` | Lưu trữ |
| POST | `/admin/orders/{id}/open.json` | Bỏ lưu trữ |
| POST | `/admin/orders/{id}/cancel.json` | Hủy order |

**Thuộc tính chính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất (dùng cho API) |
| `name` | Tên đơn hàng (e.g. `#1001`) |
| `number` | Số duy nhất theo shop, tự tăng từ 1000 |
| `order_number` | Số dùng cho chủ shop và khách (e.g. `1001`) |
| `token` | Chuỗi token định danh order |
| `cart_token` | Chuỗi token định danh cart |
| `email` | Email khách |
| `currency` | ISO 4217 (e.g. `USD`, `VND`) |
| `total_price` | Tổng tiền cuối cùng |
| `subtotal_price` | Tổng trước ship/thuế |
| `total_line_items_price` | Tổng line items |
| `total_discounts` | Tổng giảm giá |
| `total_weight` | Tổng khối lượng (gram) |
| `financial_status` | `pending`, `authorized`, `partially_paid`, `paid` (mặc định), `partially_refunded`, `refunded`, `voided` |
| `fulfillment_status` | `fulfilled`, `null`, `partial` |
| `status` | `open`, `closed`, `cancelled` |
| `cancel_reason` | `customer`, `fraud`, `inventory`, `other`, hoặc null |
| `cancelled_on` | Thời gian hủy |
| `closed_on` | Thời gian lưu trữ |
| `processed_on` | Thời gian xử lý (set khi import từ hệ thống khác) |
| `processing_method` | `checkout`, `direct`, `manual`, `offsite`, `express` |
| `source_name` | `web`, `pos`, `iphone`, `android`, `api` (mặc định nếu tạo qua API) |
| `payment_gateway_names` | Mảng tên gateway |
| `referring_site` | Site giới thiệu |
| `landing_site` | URL landing |
| `browser_ip` | IP khách |
| `buyer_accepts_marketing` | true/false |
| `tags` | String, cách nhau dấu phẩy, max 40 ký tự/tag |
| `note` | Ghi chú |
| `note_attributes` | Mảng `[{ "name": ..., "value": ... }]` |
| `customer` | Sub-object Customer (có thể null) |
| `billing_address` | Địa chỉ thanh toán |
| `shipping_address` | Địa chỉ giao hàng |
| `client_details` | `{ accept_language, browser_height, browser_ip, browser_width, session_hash, user_agent }` |
| `discount_codes` | Mảng `[{ amount, code, type }]`. Type: `percentage`, `shipping`, `fixed_amount` (mặc định) |
| `line_items` | Mảng line items |
| `shipping_lines` | Mảng phương thức ship |
| `fulfillments` | Mảng Fulfillment |
| `refunds` | Mảng Refund |
| `created_on` / `modified_on` | ISO 8601 |

**`line_item` sub-object:** `id`, `variant_id`, `product_id`, `title`, `name`, `vendor`, `quantity`, `price`, `total_discount`, `grams`, `sku`, `variant_title`, `requires_shipping`, `taxable`, `gift_card`, `fulfillment_service`, `fulfillment_status`, `fulfillable_quantity`, `tax_lines`, `properties`.

**`shipping_line` sub-object:** `code`, `price`, `source`, `title`, `tax_lines`.

#### 4.13.1 GET /admin/orders.json — List orders

**Query params:**

| Param | Mô tả |
|---|---|
| `ids` | Danh sách Id, ngăn cách dấu phẩy |
| `limit` | Số kết quả (mặc định 50, tối đa 250) |
| `page` | Trang (mặc định 1) |
| `since_id` | Giới hạn kết quả sau ID xác định |
| `created_on_min` / `created_on_max` | Khoảng thời gian tạo (định dạng `2008-12-31 03:00`) |
| `modified_on_min` / `modified_on_max` | Khoảng thời gian cập nhật |
| `processed_on_min` / `processed_on_max` | Khoảng thời gian import |
| `status` | `open` (mặc định), `closed`, `cancelled`, `any` |
| `financial_status` | `authorized`, `pending`, `paid`, `partially_paid`, `refunded`, `voided`, `partially_refunded`, `any`, `unpaid` |
| `fulfillment_status` | `fulfilled`, `partial`, `unfulfilled`, `any` (mặc định) |
| `fields` | Danh sách trường trả về, ngăn cách dấu phẩy |

**Ví dụ — chỉ lấy một vài thuộc tính:**

```
GET /admin/orders.json?fields=created_on,id,name,total-price
```

```json
HTTP/1.1 200 OK
{
  "orders": [
    {
      "id": 450789469,
      "created_on": "2008-01-10T11:00:00Z",
      "total_price": "409.94",
      "name": "#1001"
    }
  ]
}
```

#### 4.13.2 GET /admin/orders/{id}.json — Lấy 1 order

**Query params:** `fields` (tương tự).

```
GET /admin/orders/#{id}.json?fields=id,line_items,name,total_price
```

```json
HTTP/1.1 200 OK
{
  "order": {
    "id": 450789469,
    "total_price": "409.94",
    "name": "#1001",
    "line_items": [...]
  }
}
```

#### 4.13.3 GET /admin/orders/count.json — Đếm

Đếm số order, hỗ trợ filter `status`, `financial_status`, `fulfillment_status`, date range.

#### 4.13.4 POST /admin/orders/{id}/close.json — Lưu trữ order

```
POST /admin/orders/#{id}/close.json
{}
```

Trả về `200 OK` với thông tin order kèm `closed_on`.

Tương tự có:
- `POST /admin/orders/{id}/open.json` — Bỏ lưu trữ
- `POST /admin/orders/{id}/cancel.json` — Hủy order

#### 4.13.5 POST /admin/orders.json — Tạo order

**Cờ tùy chọn:**

| Cờ | Mô tả |
|---|---|
| `send_webhooks` | Có bắn webhook về không |
| `send_receipt` | Gửi email xác nhận order (mặc định `false`) |
| `send_fulfillment_receipt` | Gửi email xác nhận giao vận (mặc định `false`) |
| `inventory_behaviour` | `bypass` (mặc định, không kiểm tra kho), `decrement_ignoring_policy` (cho phép kể cả hết hàng), `decrement_obeying_policy` (tuân theo policy của Product) |

**Ví dụ — Order đơn giản với gửi receipt:**

```json
POST /admin/orders.json
{
  "order": {
    "email": "test@example.com",
    "send_receipt": true,
    "send_fulfillment_receipt": true,
    "line_items": [
      { "variant_id": 447654529, "quantity": 1 }
    ]
  }
}
```

**Ví dụ — Order với customer ID có sẵn (status pending):**

```json
{
  "order": {
    "line_items": [{ "variant_id": 447654529, "quantity": 1 }],
    "customer": { "id": 207119551 }
  }
}
```

**Ví dụ — Order với mã giảm giá fixed_amount:**

```json
{
  "order": {
    "line_items": [{ "variant_id": 447654529, "quantity": 1 }],
    "discount_codes": [
      { "amount": 10.00, "code": "DISCOUNT", "type": "fixed_amount" }
    ]
  }
}
```

**Ví dụ — Order partially_paid với khách mới + địa chỉ + transaction:**

```json
{
  "order": {
    "line_items": [{ "variant_id": 447654529, "quantity": 1 }],
    "customer": { "phone": null, "email": "jane@example.com" },
    "billing_address": {
      "first_name": "John", "last_name": "Smith",
      "address1": "123 Fake Street", "phone": "555-555-5555",
      "city": "Fakecity", "province": "Ontario",
      "country": "Canada", "zip": "K2P 1L4"
    },
    "shipping_address": {
      "first_name": "Jane", "last_name": "Smith",
      "address1": "123 Fake Street", "phone": "777-777-7777",
      "city": "Fakecity", "province": "Ontario",
      "country": "Canada", "zip": "K2P 1L4"
    },
    "email": "jane@example.com",
    "transactions": [
      { "kind": "sale", "status": "success", "amount": 50.0 }
    ]
  }
}
```

#### 4.13.6 PUT /admin/orders/{id}.json — Update order

Có thể cập nhật: `note`, `customer` (set `null` để xóa), `note_attributes`, `metafields`, `email`, `buyer_accepts_marketing`, `tags`.

```json
PUT /admin/orders/#{id}.json
{
  "order": {
    "id": 450789469,
    "note": "Customer contacted us about a custom engraving"
  }
}
```

**Xóa Customer khỏi Order:**

```json
{ "order": { "id": 450789469, "customer": null } }
```

**Update tags:**

```json
{ "order": { "id": 450789469, "tags": "External, Inbound, Outbound" } }
```

**Thêm metafield:**

```json
{
  "order": {
    "id": 450789469,
    "metafields": [
      { "key": "new", "value": "newvalue", "value_type": "string", "namespace": "global" }
    ]
  }
}
```

#### 4.13.7 DELETE /admin/orders/{id}.json — Xóa order

```
DELETE /admin/orders/#{id}.json
```

```json
HTTP/1.1 200 OK
{}
```

---

### 4.14 Page

Trang nội dung tĩnh (e.g. "Giới thiệu", "Liên hệ"). Khác Article ở chỗ Page là static, Article có timeline.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/pages.json` | List |
| GET | `/admin/pages/count.json` | Đếm |
| GET | `/admin/pages/{id}.json` | Lấy 1 |
| POST | `/admin/pages.json` | Tạo |
| PUT | `/admin/pages/{id}.json` | Update |
| DELETE | `/admin/pages/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `title` | Tiêu đề |
| `alias` | Slug |
| `content` | Nội dung HTML |
| `author` | Người tạo |
| `template_layout` | Template tùy chọn |
| `published_on` | ISO 8601 hoặc null (ẩn) |
| `metafield` | Metadata |
| `created_on` / `modified_on` | ISO 8601 |

**Query params cho list:** `limit`, `page`, `since_id`, `title`, `alias`, `published`, `fields`, date filters.

---

### 4.15 Price Rule

Quy tắc giá để tự động tạo giảm giá. Tạo các loại discount: % off, fixed amount off, free shipping.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| POST | `/admin/price_rules.json` | Tạo |
| PUT | `/admin/price_rules/{id}.json` | Update |
| GET | `/admin/price_rules.json` | List |
| GET | `/admin/price_rules/{id}.json` | Lấy 1 |
| DELETE | `/admin/price_rules/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `title` | Tiêu đề (recommend bằng `code` của DiscountCode) |
| `target_type` | `line_item` (cho mặt hàng) hoặc `shipping_line` (phí ship) |
| `target_selection` | `all` hoặc `entitled` |
| `allocation_method` | `each` (per item) hoặc `across` (toàn bộ items) |
| `value_type` | `fixed_amount`, `percentage`, `fixed_price`. Nếu `target_type=shipping_line` thì chỉ cho `percentage` |
| `value` | Số âm (e.g. `-30` = giảm 30%). Nếu `target_type=shipping_line` thì = -100. Nếu `value_type=fixed_price` thì là số dương |
| `exclude_type` | true/false. Mặc định không cho áp dụng chung với khuyến mãi |
| `once_per_customer` | true/false (kiểm tra theo customer ID) |
| `usage_limit` | Số lần dùng tối đa |
| `customer_selection` | `all` hoặc `prerequisite` |
| `prerequisite_saved_search_ids` | Mảng IDs nhóm khách hàng |
| `prerequisite_subtotal_range` | `{ "greater_than_or_equal_to": "40.0" }` |
| `prerequisite_quantity_range` | `{ "greater_than_or_equal_to": 2 }` (min 2) |
| `prerequisite_shipping_price_range` | `{ "less_than_or_equal_to": "10.0" }` |
| `prerequisite_to_entitlement_quantity_ratio` | Mua X tặng Y (BOGO) |
| `entitled_product_ids` | Mảng product IDs được giảm |
| `entitled_variant_ids` | Mảng variant IDs |
| `entitled_collection_ids` | Mảng collection IDs |
| `entitled_country_ids` | Mảng country IDs |
| `prerequisite_product_ids` / `prerequisite_variant_ids` / `prerequisite_collection_ids` | Tiên quyết |
| `starts_on` / `ends_on` | Khoảng thời gian áp dụng |
| `created_on` | ISO 8601 |

**Ví dụ usecase:**
- Giảm 10K nếu order >= 40K
- Giảm 15% cho 1 collection
- Free ship cho order > 100K, áp dụng 20 lần, chỉ Hà Nội

---

### 4.16 Product

Đơn vị sản phẩm bán trên shop. Tối đa **100 variants**, **0–250 images**.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/products.json` | List |
| GET | `/admin/products/count.json` | Đếm |
| GET | `/admin/products/{id}.json` | Lấy 1 |
| POST | `/admin/products.json` | Tạo |
| PUT | `/admin/products/{id}.json` | Update |
| DELETE | `/admin/products/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `name` | Tên product |
| `alias` | Slug |
| `content` | Mô tả HTML |
| `summary` | Mô tả ngắn HTML |
| `vendor` | Nhà sản xuất |
| `product_type` | Loại để phân loại/lọc |
| `tags` | String cách nhau dấu phẩy, max 255 ký tự |
| `published_on` | ISO 8601, hoặc null = ẩn |
| `template_layout` | Template (mặc định `product.bwt`) |
| `options` | Mảng `[{ name }]`, max 3 options |
| `variants` | Mảng ProductVariant |
| `images` | Mảng ProductImage |
| `metafield` | Metadata |
| `created_on` / `modified_on` | ISO 8601 |

**Variant sub-object:** `id`, `product_id`, `title`, `price`, `compare_at_price`, `sku`, `barcode`, `position`, `grams`, `weight`, `weight_unit` (`g`/`kg`/`oz`/`lb`), `inventory_management` (`""` hoặc `bizweb`), `inventory_policy` (`deny` mặc định, hoặc `continue`), `inventory_quantity`, `option1`, `option2`, `option3`, `requires_shipping`, `image_id`.

> **Sắp xếp variants:** update product với mảng variants theo thứ tự mong muốn. Field `position` trong variant sẽ bị bỏ qua.

**Chi tiết phương thức:**

#### 4.16.1 GET /admin/products.json — List products

**Query params:**

| Param | Mô tả |
|---|---|
| `ids` | Danh sách Id, ngăn cách dấu phẩy |
| `limit` | Mặc định 50, tối đa 250 |
| `page` | Mặc định 1 |
| `since_id` | Sau ID xác định |
| `query` | Lọc theo tên product |
| `vendor` | Lọc theo nhà cung cấp |
| `alias` | Lọc theo slug |
| `product_type` | Lọc theo loại sản phẩm |
| `collection_id` | Lọc theo danh mục |
| `created_on_min` / `created_on_max` | Thời gian tạo |
| `modified_on_min` / `modified_on_max` | Thời gian cập nhật |
| `published_on_min` / `published_on_max` | Thời gian xuất bản |
| `published` | `true` (đã xuất bản), `false` (chưa) |
| `fields` | Trường trả về |

**Ví dụ — Lấy products theo IDs:**

```
GET /admin/products.json?ids=632910392,921728736
```

```json
HTTP/1.1 200 OK
{
  "products": [
    {
      "id": 632910392,
      "name": "IPod Nano - 8GB",
      "vendor": "Apple",
      "product_type": "Cult Products",
      "alias": "ipod-nano",
      "tags": "Emotive, Flash Memory, MP3, Music",
      "variants": [...],
      "options": [...],
      "images": [...]
    }
  ]
}
```

#### 4.16.2 POST /admin/products.json — Tạo product

**Ví dụ — Product với ảnh tải về từ URL:**

```json
{
  "product": {
    "name": "Burton Custom Freestlye 151",
    "content": "<strong>Good snowboard!</strong>",
    "vendor": "Burton",
    "product_type": "Snowboard",
    "images": [{ "src": "http://example.com/rails_logo.gif" }]
  }
}
```

**Ví dụ — Product với ảnh base64:**

```json
{
  "product": {
    "name": "Burton Custom Freestlye 151",
    "vendor": "Burton",
    "product_type": "Snowboard",
    "images": [
      { "base64": "R0lGODlhAQABAIAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==\n" }
    ]
  }
}
```

**Ví dụ — Product với tags:**

```json
{
  "product": {
    "name": "Burton Custom Freestlye 151",
    "content": "<strong>Good snowboard!</strong>",
    "vendor": "Burton",
    "product_type": "Snowboard",
    "tags": "Barnes & Noble, John's Fav, \"Big Air\""
  }
}
```

**Ví dụ — Product với metafield:**

```json
{
  "product": {
    "name": "Burton Custom Freestlye 151",
    "vendor": "Burton",
    "product_type": "Snowboard",
    "metafields": [
      { "key": "new", "value": "newvalue", "value_type": "string", "namespace": "global" }
    ]
  }
}
```

**Ví dụ — Product nhiều variant có tồn kho:**

```json
{
  "product": {
    "name": "Burton Custom Freestlye 151",
    "content": "Good snowboard!",
    "vendor": "Burton",
    "product_type": "Snowboard",
    "variants": [
      {
        "option1": "First", "price": "10.00", "sku": 123,
        "inventory_management": "bizweb", "inventory_quantity": 10
      },
      {
        "option1": "Second", "price": "20.00", "sku": 456,
        "inventory_management": "bizweb", "inventory_quantity": 5
      }
    ]
  }
}
```

#### 4.16.3 PUT /admin/products/{id}.json — Update product

**Update tên:**

```json
{ "product": { "id": 632910392, "name": "New product name" } }
```

**Xóa toàn bộ ảnh:**

```json
{ "product": { "id": 632910392, "images": [] } }
```

**Update tags:**

```json
{ "product": { "id": 632910392, "tags": "Barnes & Noble, John's Fav" } }
```

**Sắp xếp lại thứ tự ảnh:**

```json
{
  "product": {
    "id": 632910392,
    "images": [
      { "id": 850703190, "position": 2 },
      { "id": 562641783, "position": 1 }
    ]
  }
}
```

**Thêm ảnh mới qua URL:**

```json
{
  "product": {
    "id": 632910392,
    "images": [
      { "id": 850703190 },
      { "id": 562641783 },
      { "src": "http://example.com/rails_logo.gif" }
    ]
  }
}
```

**Update product + variants + options + images đồng thời:** Gửi nguyên object product với mảng `variants`, `options`, `images` đầy đủ.

#### 4.16.4 DELETE /admin/products/{id}.json — Xóa product

```
DELETE /admin/products/#{id}.json
```

```json
HTTP/1.1 200 OK
{}
```

---

### 4.17 Product Variant

Phiên bản khác nhau của Product (size, màu, ...). Mỗi product max 100 variants.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/products/{product_id}/variants.json` | List |
| GET | `/admin/products/{product_id}/variants/count.json` | Đếm |
| GET | `/admin/variants/{id}.json` | Lấy 1 |
| POST | `/admin/products/{product_id}/variants.json` | Tạo |
| PUT | `/admin/variants/{id}.json` | Update |
| DELETE | `/admin/products/{product_id}/variants/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `product_id` | ID product cha |
| `title` | Tiêu đề variant |
| `price` | Giá |
| `compare_at_price` | Giá so sánh |
| `sku` | SKU duy nhất trong shop |
| `barcode` | Barcode/UPC/ISBN |
| `position` | Thứ tự (1 = đầu) |
| `grams` | Khối lượng (gram) |
| `weight` | Khối lượng theo `weight_unit` |
| `weight_unit` | `g`, `kg`, `oz`, `lb` |
| `inventory_management` | `""` (Sapo không quản lý) hoặc `bizweb` (Sapo quản lý) |
| `inventory_policy` | `deny` (mặc định, không cho mua khi hết) hoặc `continue` (cho mua) |
| `inventory_quantity` | Số lượng trong kho |
| `inventory_quantity_adjustment` | Giá trị điều chỉnh inventory |
| `option1` / `option2` / `option3` | Giá trị các options |
| `requires_shipping` | true/false |
| `image_id` | ID ảnh associated |
| `metafield` | Metadata |
| `created_on` / `modified_on` | ISO 8601 |

---

### 4.18 Product Image

Ảnh sản phẩm. Định dạng .png, .gif, .jpg. Max 250 ảnh/product.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/products/{product_id}/images.json` | List |
| GET | `/admin/products/{product_id}/images/count.json` | Đếm |
| GET | `/admin/products/{product_id}/images/{id}.json` | Lấy 1 |
| POST | `/admin/products/{product_id}/images.json` | Tạo |
| PUT | `/admin/products/{product_id}/images/{id}.json` | Update |
| DELETE | `/admin/products/{product_id}/images/{id}.json` | Xóa |

**Thuộc tính chi tiết:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất định danh Product Image (e.g. `850703190`) |
| `product_id` | ID của Product tương ứng |
| `position` | Thứ tự ảnh trong danh sách. Position = 1 là ảnh đại diện |
| `src` | Đường dẫn public của ảnh (e.g. `https://bizweb.dktcdn.net/products/ipod-nano.png`) |
| `attachment` | Dữ liệu ảnh base64 dùng khi upload qua POST |
| `filename` | Tên file khi upload base64 |
| `variant_ids` | Mảng Id các variant ứng với ảnh (e.g. `[808950810]`) |
| `alt` | Alt text cho SEO |
| `width` / `height` | Kích thước ảnh |
| `created_on` | ISO 8601 (e.g. `"2012-03-13T16:09:58Z"`) |
| `modified_on` | ISO 8601 |

**Chi tiết phương thức:**

#### 4.18.1 GET — Lấy danh sách / count / single

**Query params chung:** `since_id`, `fields`.

**List images:**

```
GET /admin/products/#{id}/images.json
```

```json
HTTP/1.1 200 OK
{
  "images": [
    {
      "id": 850703190,
      "product_id": 632910392,
      "position": 1,
      "created_on": "2015-12-08T11:33:54Z",
      "modified_on": "2015-12-08T11:33:54Z",
      "src": "https://bizweb.dktcdn.net/.../ipod-nano.png",
      "variant_ids": []
    },
    {
      "id": 562641783,
      "product_id": 632910392,
      "position": 2,
      "src": "https://bizweb.dktcdn.net/.../ipod-nano-2.png",
      "variant_ids": [808950810]
    }
  ]
}
```

**Lấy sau ID xác định:**

```
GET /admin/products/#{id}/images.json?since_id=850703190
```

**Đếm:**

```
GET /admin/products/#{id}/images/count.json
```

```json
{ "count": 2 }
```

**Lấy 1 ảnh:**

```
GET /admin/products/#{id}/images/#{id}.json
```

#### 4.18.2 POST — Tạo Product Image

**Bằng URL:**

```json
POST /admin/products/#{id}/images.json
{
  "image": { "src": "http://example.com/rails_logo.gif" }
}
```

**Bằng base64:**

```json
{
  "image": {
    "attachment": "R0lGODlhAQABAIAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==\n",
    "filename": "rails_logo.gif"
  }
}
```

**Đính kèm vào nhiều variants:**

```json
{
  "image": {
    "src": "http://example.com/rails_logo.gif",
    "variant_ids": [457924702, 808950810]
  }
}
```

**Đặt làm ảnh đại diện (position 1):**

```json
{
  "image": {
    "src": "http://example.com/rails_logo.gif",
    "position": 1
  }
}
```

**Kèm metafield:**

```json
{
  "image": {
    "src": "http://example.com/rails_logo.gif",
    "metafields": [
      { "key": "alt", "value": "alt-text", "value_type": "string", "namespace": "tags" }
    ]
  }
}
```

**Response mẫu:**

```json
HTTP/1.1 200 OK
{
  "image": {
    "id": 1003141240,
    "product_id": 632910392,
    "position": 3,
    "created_on": "2015-12-08T11:35:32Z",
    "modified_on": "2015-12-08T11:35:32Z",
    "src": "https://bizweb.dktcdn.net/.../rails_logo.gif",
    "variant_ids": [457924702, 808950810]
  }
}
```

#### 4.18.3 PUT — Update Product Image

```json
PUT /admin/products/#{id}/images/#{image_id}.json
{
  "image": {
    "id": 850703190,
    "position": 2,
    "variant_ids": [808950810, 457924702]
  }
}
```

#### 4.18.4 DELETE — Xóa Product Image

```
DELETE /admin/products/#{id}/images/#{image_id}.json
```

```json
HTTP/1.1 200 OK
{}
```

---

### 4.19 Redirect

Chuyển hướng từ một path sang URL khác. Path là duy nhất trong shop.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/redirects.json` | List |
| GET | `/admin/redirects/count.json` | Đếm |
| GET | `/admin/redirects/{id}.json` | Lấy 1 |
| POST | `/admin/redirects.json` | Tạo |
| PUT | `/admin/redirects/{id}.json` | Update |
| DELETE | `/admin/redirects/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `path` | Đường dẫn nguồn (e.g. `/products.php`) |
| `target` | Đích (relative, absolute, hoặc cross-domain) |

**Query params:** `limit`, `page`, `since_id`, `path`, `target`, `fields`.

---

### 4.20 Refund

Bản ghi hoàn tiền cho order. Read-only qua API (tạo Refund qua Transaction API).

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/orders/{order_id}/refunds/{id}.json` | Lấy 1 refund |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `order_id` | ID order |
| `note` | Ghi chú |
| `restock` | true/false (có hoàn về kho không) |
| `user_id` | ID user thực hiện |
| `refund_line_items` | Mảng `[{ id, line_item_id, line_item, quantity }]` |
| `transactions` | Mảng Transaction kiểu `refund` |
| `order_adjustments` | Mảng điều chỉnh |
| `created_on` | ISO 8601 |

---

### 4.21 ScriptTag

Inject JavaScript vào storefront (chạy onload). Khi app gỡ, tất cả ScriptTag của app cũng tự gỡ.

> **Quan trọng:** URL phải bắt đầu bằng `https://` để tránh lỗi SSL.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/script_tags.json` | List |
| GET | `/admin/script_tags/count.json` | Đếm |
| GET | `/admin/script_tags/{id}.json` | Lấy 1 |
| POST | `/admin/script_tags.json` | Tạo |
| PUT | `/admin/script_tags/{id}.json` | Update |
| DELETE | `/admin/script_tags/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `src` | URL script (HTTPS) |
| `event` | DOM event kích hoạt. Hiện chỉ hỗ trợ `onload` |
| `created_on` / `modified_on` | ISO 8601 |

**Query params:** `limit`, `page`, `since_id`, `src`, `fields`, date filters.

---

### 4.22 SmartCollection

Danh mục thông minh — sản phẩm được chọn tự động dựa trên rules. Collect cho SmartCollection do Sapo quản lý, không thể tạo/xóa qua API.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/smart_collections.json` | List |
| GET | `/admin/smart_collections/count.json` | Đếm |
| GET | `/admin/smart_collections/{id}.json` | Lấy 1 |
| POST | `/admin/smart_collections.json` | Tạo |
| PUT | `/admin/smart_collections/{id}.json` | Update |
| PUT | `/admin/smart_collections/{id}/order.json?sort_order={...}` | Đổi thứ tự sort |
| DELETE | `/admin/smart_collections/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `name` / `title` | Tiêu đề |
| `alias` | Slug, max 255 |
| `description` | Mô tả HTML |
| `image` | `{ "id": ..., "src": "..." }` |
| `published_on` | ISO 8601 hoặc null |
| `sort_order` | `alpha-asc`, `alpha-desc`, `best-selling`, `created`, `created-desc`, `manual`, `price-asc`, `price-desc` |
| `template_suffix` | Template |
| `disjunctive` | true (any rule = match) hoặc false (all rules) |
| `rules` | Mảng `[{ column, relation, condition }]` |

**Rule object:**

| Field | Mô tả |
|---|---|
| `column` | `tag`, `title`, `type`, `vendor`, `variant_compare_at_price`, `variant_inventory`, `variant_price`, `variant_title`, `variant_weight` |
| `relation` (kiểu số) | `greater_than`, `less_than`, `equals`, `not_equals` |
| `relation` (kiểu text) | `equals`, `not_equals`, `starts_with`, `ends_with`, `contains`, `not_contains` |
| `condition` | Giá trị so sánh |

---

### 4.23 Store

Cài đặt và thông tin shop. **Read-only qua API** (chỉ chủ shop chỉnh được trong admin).

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/store.json` | Lấy thông tin shop |

**Thuộc tính chính:**

| Field | Mô tả |
|---|---|
| `id` | ID shop |
| `name` | Tên shop |
| `email` | Email Sapo liên hệ |
| `customer_email` | Email gửi cho khách |
| `domain` | Tên miền chính |
| `bizweb_domain` | Subdomain `*.bizwebvietnam.net` |
| `address1` / `city` / `province` / `province_code` / `country` / `country_code` / `country_name` / `zip` | Địa chỉ |
| `phone` | SĐT |
| `currency` | Mã tiền tệ |
| `money_format` | Format khi chưa xác định currency |
| `money_with_currency_format` | Format có currency |
| `timezone` | Timezone |
| `store_owner` | Tên chủ shop |
| `plan_name` | Gói dịch vụ (e.g. `enterprise`) |
| `plan_display_name` | Tên gói (e.g. `Sapo Plus`) |
| `has_storefront` | true/false |
| `has_discounts` / `has_gift_cards` | Tính năng |
| `created_on` / `modified_on` | ISO 8601 |

Response key: `shop` (không phải `store`).

---

### 4.24 Theme

Theme = giao diện shop. Tối đa **20 themes/shop**, 1 main + nhiều unpublished.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/themes.json` | List |
| GET | `/admin/themes/{id}.json` | Lấy 1 |
| POST | `/admin/themes.json` | Tạo (từ URL .zip) |
| PUT | `/admin/themes/{id}.json` | Update |
| DELETE | `/admin/themes/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `name` | Tên theme |
| `role` | `main` (desktop chính), `mobile` (mobile chính), `unpublished` |
| `previewable` | true/false |
| `processing` | true/false (đang xử lý file zip) |
| `src` | URL .zip để tạo theme |
| `created_on` / `modified_on` | ISO 8601 |

> Theme mới luôn bắt đầu với `role: "unpublished"`. Dùng PUT để chuyển sang `main`/`mobile`.

---

### 4.25 Transaction

Giao dịch tiền tệ gắn với Order. Có 5 loại: Authorization, Sale, Capture, Void, Refund.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/orders/{order_id}/transactions.json` | List |
| GET | `/admin/orders/{order_id}/transactions/count.json` | Đếm |
| GET | `/admin/orders/{order_id}/transactions/{id}.json` | Lấy 1 |
| POST | `/admin/orders/{order_id}/transactions.json` | Tạo |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `order_id` | ID order |
| `amount` | Số tiền |
| `currency` | ISO 4217 |
| `kind` | `authorization`, `capture`, `sale`, `void`, `refund` |
| `status` | `pending`, `failure`, `success`, `error` |
| `gateway` | Tên cổng thanh toán (e.g. `bogus`) |
| `source_name` | `web`, `pos`, `iphone`, `android` (set bởi Sapo) |
| `authorization` | Mã xác thực |
| `parent_id` | ID transaction cha (e.g. capture có parent là authorization) |
| `device_id` / `user_id` / `location_id` | IDs tham chiếu |
| `error_code` | `incorrect_number`, `invalid_number`, `invalid_expiry_date`, `invalid_cvc`, `expired_card`, `incorrect_cvc`, `incorrect_zip`, `incorrect_address`, `card_declined`, `processing_error`, `call_issuer`, `pick_up_card` |
| `test` | true/false |
| `receipt` | `{ testcase, authorization }` |
| `payment_details` | `{ credit_card_bin, avs_result_code, cvv_result_code, credit_card_number, credit_card_company }` |
| `created_on` | ISO 8601 |

**Loại transaction chi tiết:**
- **Authorization**: xác thực, tiền chưa về shop. Hold 7-30 ngày.
- **Sale**: Authorization + Capture trong 1 bước.
- **Capture**: nhận tiền từ Authorization.
- **Void**: hủy Authorization/Capture đang pending.
- **Refund**: hoàn tiền (chỉ sau khi đã Capture).

---

### 4.26 Carrier Service

Tính phí ship động dựa trên giỏ hàng + địa chỉ giao. Dùng để tích hợp với đối tác vận chuyển bên ngoài.

**Permission cần:** `read_orders`, `write_orders`.

**Endpoints:**
| Method | Path | Mô tả |
|---|---|---|
| POST | `/admin/carrier_services.json` | Tạo |
| PUT | `/admin/carrier_services/{id}.json` | Update |
| GET | `/admin/carrier_services.json` | List |
| GET | `/admin/carrier_services/{id}.json` | Lấy 1 |
| DELETE | `/admin/carrier_services/{id}.json` | Xóa |

**Thuộc tính:**

| Field | Mô tả |
|---|---|
| `id` | Số duy nhất |
| `name` | Tên (hiển thị trong admin shop) |
| `callback_url` | Public POST endpoint Sapo gọi để lấy phí ship |
| `active` | Bật/tắt |
| `type` | `legacy` hoặc `api` (mặc định) |
| `service_discovery` | Có cho admin xem rates trong cấu hình không |

#### Cách hoạt động: Sapo POST đến `callback_url`

**Request từ Sapo gửi tới callback của bạn:**
```json
{
  "rate": {
    "origin": {
      "country": "Việt Nam", "country_code": "VN",
      "province": "Hà Nội", "province_code": "04",
      "district": "", "district_code": "",
      "ward": "", "ward_code": null,
      "name": "Cửa hàng tiện lợi",
      "address1": "434 Nguyễn Chí Thanh",
      "address2": "", "phone": null, "email": null
    },
    "destination": {
      "country": "Việt Nam", "country_code": "VN",
      "province": "Hà Nội", "province_code": "04",
      "district": "Ba Đình", "district_code": "494",
      "ward": null, "ward_code": null,
      "name": null,
      "address1": "43 Nguyễn Chí Thanh",
      "address2": null, "phone": null, "email": null
    },
    "items": [
      {
        "name": "Nước tăng lực", "sku": null,
        "quantity": 2, "grams": 300,
        "price": 1000000, "vendor": null,
        "requires_shipping": true,
        "product_id": 1122429712,
        "variant_id": 3424219217
      }
    ],
    "currency": "VND"
  }
}
```

**Response phải trả về:**
```json
{
  "rates": [
    {
      "service_name": "Giao hàng trong 2h",
      "service_code": "GH2H",
      "total_price": 1000000,
      "description": "",
      "currency": "VND"
    },
    {
      "service_name": "Giao hàng tiêu chuẩn",
      "service_code": "GHTC",
      "total_price": 500000,
      "description": "",
      "currency": "VND"
    }
  ]
}
```

| Field response | Required | Mô tả |
|---|---|---|
| `service_name` | ✓ | Tên hiển thị ở checkout |
| `service_code` | ✓ | Code phân biệt rates |
| `total_price` | ✓ | Phí ship (integer × 100 cho thập phân) |
| `currency` | ✓ | Phải cùng currency với request |
| `description` | | Mô tả thêm |

#### Caching server-side

Sapo cache shipping rates dựa trên: `product_id`, `variant_id`, `grams`, `quantity`, carrier `service_id`, địa chỉ origin & destination.

- Cache success: **15 phút**
- Cache failure: **30 giây**

Nếu một trong các trường trên thay đổi → request mới sang carrier.

---

## 5. Bảng tra cứu nhanh endpoints

### Pattern chung

| Action | Method | Path |
|---|---|---|
| List | GET | `/admin/{resource}.json` |
| Count | GET | `/admin/{resource}/count.json` |
| Show | GET | `/admin/{resource}/{id}.json` |
| Create | POST | `/admin/{resource}.json` |
| Update | PUT | `/admin/{resource}/{id}.json` |
| Delete | DELETE | `/admin/{resource}/{id}.json` |

### Common query parameters

| Param | Mô tả | Default | Max |
|---|---|---|---|
| `limit` | Số kết quả/page | 50 | 250 |
| `page` | Số trang | 1 | — |
| `since_id` | ID > ngưỡng (cursor pagination) | — | — |
| `fields` | Trường trả về (comma-separated) | tất cả | — |
| `created_on_min` / `created_on_max` | Filter ngày tạo | — | — |
| `modified_on_min` / `modified_on_max` | Filter ngày update | — | — |
| `published_on_min` / `published_on_max` | Filter ngày xuất bản | — | — |
| `published` | true/false | — | — |

### HTTP Status Codes

| Code | Ý nghĩa |
|---|---|
| 200 OK | Thành công (GET, PUT) |
| 201 Created | Tạo thành công (POST) |
| 204 No Content | Xóa thành công không body |
| 403 Forbidden | Không có quyền (e.g. không thể xóa file mặc định) |
| 404 Not Found | Resource không tồn tại |
| 422 Unprocessable Entity | Dữ liệu không hợp lệ (validation error) |

### Headers quan trọng

| Header | Bắt buộc | Mô tả |
|---|---|---|
| `Content-Type: application/json` | ✓ | Format request |
| `X-Sapo-Access-Token: {token}` | OAuth | Access token |
| `Authorization: Basic {base64(api_key:api_secret)}` | Private App | Basic Auth (hoặc dùng URL pattern) |

### Định dạng dữ liệu

- **Datetime:** ISO 8601 (e.g. `2015-09-02T14:52:56Z`)
- **Datetime filter (query):** `2008-12-31 03:00`
- **Currency:** ISO 4217 (e.g. `VND`, `USD`)
- **Country code:** ISO 3166-1 alpha-2 hoặc alpha-3
- **Tags:** String, cách nhau bằng dấu phẩy

### Mapping Scope ↔ Resource

| Scope | Resources |
|---|---|
| `read_content`/`write_content` | Article, Blog, Comment, Page, Redirect |
| `read_themes`/`write_themes` | Asset, Theme |
| `read_products`/`write_products` | Product, ProductVariant, ProductImage, Collect, CustomCollection, SmartCollection |
| `read_customers`/`write_customers` | Customer, CustomerAddress |
| `read_orders`/`write_orders` | Order, Transaction, Fulfillment, Refund, Carrier Service |
| `read_script_tags`/`write_script_tags` | ScriptTag |
| `read_price_rules`/`write_price_rules` | Price Rule, DiscountCode |
| `read_draft_orders`/`write_draft_orders` | Draft Orders |

---

## Tham khảo nguồn

| Trang | URL |
|---|---|
| Giới thiệu API | https://support.sapo.vn/gioi-thieu-api |
| OAuth | https://support.sapo.vn/oauth |
| Private Apps | https://support.sapo.vn/ung-dung-rieng-private-apps |
| Webhook | https://support.sapo.vn/sapo-webhook |
| API Reference root | https://support.sapo.vn/article |
| Đăng ký Partner | https://developers.sapo.vn/services/partners/auth/register |
| Quản lý Apps | https://developers.sapo.vn/services/partners/api_clients |

---

*File này được tổng hợp từ tài liệu chính thức Sapo, cập nhật ngày 30/04/2026. Các trường, endpoint cụ thể có thể thay đổi — verify với tài liệu gốc khi triển khai production.*
