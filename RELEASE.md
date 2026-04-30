# Release Playbook — sapo-mcp 0.5.0 và sau đó

Tài liệu này hướng dẫn các bước thủ công còn lại sau Phase 9: publish npm, đăng ký MCP Registry, dựng docs site Mintlify, và smoke test trên dev store thật.

> **Lưu ý quan trọng:** Phase 9 đã bump `package.json` 0.0.0 → 0.5.0 + viết CHANGELOG.md thủ công. Project có sẵn Changesets nhưng cho lần release đầu này dùng **publish thủ công** (Phần 1 — Path B). Từ 0.5.1 trở đi dùng Changesets workflow tự động (Path A — Phần 5).

---

## Phần 1 — Publish 0.5.0 lên npm (one-time, manual)

### 1.1 Chuẩn bị tài khoản & token

1. **Đăng ký npm:** https://www.npmjs.com/signup (nếu chưa có).
2. **Bật 2FA:** https://www.npmjs.com/settings/{username}/profile → Two-factor authentication → "Authorization and writes".
3. **Kiểm tra tên `sapo-mcp` còn trống:**
   ```bash
   npm view sapo-mcp
   ```
   Nếu trả `npm error 404` thì OK. Nếu đã có người chiếm, đổi `package.json` "name" thành `@plateau/sapo-mcp` (scoped) và mở [GitHub username] đảm bảo trùng npm scope.

### 1.2 Tạo npm access token cho CI

1. https://www.npmjs.com/settings/{username}/tokens → "Generate New Token" → **Granular Access Token**:
   - Name: `sapo-mcp-ci`
   - Expiration: 365 days
   - Permissions: **Read and write**
   - Packages and scopes: chọn `sapo-mcp` (hoặc `@plateau` scope)
2. Copy token (chỉ hiện 1 lần).
3. Add vào GitHub secret: repo → Settings → Secrets and variables → Actions → New repository secret:
   - Name: `NPM_TOKEN`
   - Value: token vừa tạo

### 1.3 Dọn changeset cũ (tránh xung đột với manual bump)

Trên branch `main`:

```bash
# Đã release thủ công ở 0.5.0 nên 2 changeset cũ không còn áp dụng
git rm .changeset/initial-release.md .changeset/phase-6-pos-counter.md
git commit -m "chore: clear pre-0.5.0 changesets (released manually)"
```

### 1.4 Smoke build & dry-run publish (làm trên máy local)

```bash
npm ci
npm run ci          # typecheck + lint + tests + build (917/917 phải pass)
npm pack --dry-run  # in danh sách file sẽ publish; phải gọn, không có .env
```

Kiểm tra `npm pack --dry-run` output:
- Có: `dist/index.mjs`, `dist/index.mjs.map`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`
- KHÔNG có: `src/`, `tests/`, `plans/`, `examples/`, `.github/`, `node_modules/`, `*.env`, `verify-report.md`

Nếu có file lạ → kiểm tra `package.json` `"files"` array.

### 1.5 Publish

```bash
# Đăng nhập (sẽ mở browser cho 2FA)
npm login

# Publish với provenance signature (yêu cầu npm 9.5+)
npm publish --provenance --access public
```

Provenance flag cần Node ≥ 18.17 hoặc 20.5+. Nếu lỗi "provenance not allowed", chạy `npm install -g npm@latest` rồi thử lại.

### 1.6 Tag GitHub release

```bash
git tag -a v0.5.0 -m "v0.5.0 — first public release (4 modes, 104 tools)"
git push origin v0.5.0

# Tạo GitHub Release với note từ CHANGELOG
gh release create v0.5.0 \
  --title "v0.5.0 — first public release" \
  --notes-file <(awk '/^## \[0\.5\.0\]/,/^## \[/{if(/^## \[/ && !/0\.5\.0/) exit; print}' CHANGELOG.md)
```

### 1.7 Verify publish

```bash
# Đợi ~30s sau khi publish
npm view sapo-mcp version              # phải = 0.5.0
npm view sapo-mcp dist.tarball         # link tarball
npx -y sapo-mcp --version              # phải in "0.5.0"
npx -y sapo-mcp --help                 # in help text đầy đủ
```

Provenance badge: https://www.npmjs.com/package/sapo-mcp → mục "Provenance" hiển thị link build CI.

---

## Phần 2 — Smoke test trên Sapo dev store

Trước khi quảng bá, chạy live trên 1 dev store để verify không có schema drift hoặc bug runtime.

### 2.1 Tạo Sapo dev store

1. Đăng ký https://www.sapo.vn → tạo store thử (`mystoredev.mysapo.net`).
2. Vào trang admin → Cài đặt → Tài khoản API → tạo **Private App**:
   - Name: `sapo-mcp-dev`
   - Quyền: tick toàn bộ Read; chọn Write nếu muốn test destructive ops
3. Lưu lại API key + secret.

### 2.2 Chạy probe

```bash
SAPO_STORE=mystoredev \
SAPO_API_KEY=xxx \
SAPO_API_SECRET=yyy \
npx -y sapo-mcp --help
# (nếu lỗi "command not found", dùng absolute: ~/.npm/_npx/.../bin/sapo-mcp)

# Read probe (an toàn — chỉ GET)
git clone https://github.com/nguyennguyenit/Sapo-MCP.git && cd sapo-mcp
npm ci
SAPO_STORE=mystoredev SAPO_API_KEY=xxx SAPO_API_SECRET=yyy npm run probe
# Output: plans/.../probe-results.json + verify-report.md
```

So sánh `verify-report.md` với version đã commit:

```bash
diff plans/260430-1000-sapo-mcp-implementation/verify-report.md <(npm run probe 2>&1)
```

Nếu khác biệt → schema drift → cần update tool description / decision-gates trước khi tag thêm.

### 2.3 Smoke với MCP Inspector

```bash
npx @modelcontextprotocol/inspector \
  -e SAPO_STORE=mystoredev -e SAPO_API_KEY=xxx -e SAPO_API_SECRET=yyy \
  npx -y sapo-mcp --mode=pos-online
```

Trong inspector UI:
1. Click "Connect" — phải hiện 48 tools.
2. Test `list_orders` với `limit=5` → response JSON có `orders` array.
3. Test `revenue_summary` với `from=2026-04-01,to=2026-04-30,group_by=day` (cần `--mode=pos-online,analytics`) → reasonable output.
4. Test 1 tool destructive khi không có ALLOW_OPS → phải bị guard reject với message rõ ràng.

### 2.4 Smoke với Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "sapo-dev": {
      "command": "npx",
      "args": ["-y", "sapo-mcp", "--mode=pos-online,analytics"],
      "env": {
        "SAPO_STORE": "mystoredev",
        "SAPO_API_KEY": "xxx",
        "SAPO_API_SECRET": "yyy"
      }
    }
  }
}
```

Restart Claude Desktop. Hỏi: *"Liệt kê 5 đơn hàng gần nhất"*. Nếu Claude gọi `list_orders` thành công → pass.

### 2.5 Smoke HTTP transport

```bash
docker build -f examples/Dockerfile -t sapo-mcp:smoke .
docker run --rm -p 3333:3333 \
  -e SAPO_STORE=mystoredev -e SAPO_API_KEY=xxx -e SAPO_API_SECRET=yyy \
  -e SAPO_HTTP_HOST=0.0.0.0 \
  -e SAPO_MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
  sapo-mcp:smoke

# Trên terminal khác:
curl http://localhost:3333/health
# {"status":"ok","version":"0.5.0",...}
```

Connect MCP Inspector qua HTTP: chọn transport "Streamable HTTP", URL `http://localhost:3333/mcp`, header `Authorization: Bearer <token>`.

---

## Phần 3 — Đăng ký MCP Registry

Sau khi 0.5.0 đã trên npm.

### 3.1 Fork & clone

```bash
gh repo fork modelcontextprotocol/servers --clone --remote
cd servers
git checkout -b add-sapo-mcp
```

### 3.2 Thêm entry

Repo `modelcontextprotocol/servers` có README.md với danh sách servers theo alphabetical. Tìm section `## 🌎 Third-Party Servers` → `### Official Integrations` (nếu user là vendor) hoặc `### Community Servers` (cho dự án cá nhân).

Thêm dòng (sắp xếp alphabetical):

```markdown
- **[Sapo](https://github.com/nguyennguyenit/Sapo-MCP)** - Sapo.vn POS & e-commerce platform — orders, customers, products, inventory, analytics across `pos-online` / `web` / `pos-counter` / `analytics` modes.
```

### 3.3 PR

```bash
git add README.md
git commit -m "Add sapo-mcp to community servers list"
git push -u origin add-sapo-mcp
gh pr create \
  --repo modelcontextprotocol/servers \
  --title "Add sapo-mcp to community servers" \
  --body "Adds [sapo-mcp](https://www.npmjs.com/package/sapo-mcp) — TypeScript MCP server cho Sapo.vn POS & e-commerce. 4 modes, 104 tools, stdio + Streamable HTTP. v0.5.0 published 2026-04-30 with npm provenance."
```

PR có thể mất 1–4 tuần để được merge. Trong khi chờ:
- Reply mọi comment review nhanh
- Đảm bảo npm package build/test pass (CI badge xanh)

---

## Phần 4 — Mintlify docs site (Phase 9 deferred → 0.6.x)

### 4.1 Init Mintlify

```bash
cd /Users/plateau/Project/SapoPOSMCP
npx mintlify@latest install   # tạo docs/ với template
cd docs
npx mintlify dev               # local preview localhost:3000
```

### 4.2 Cấu trúc khuyên dùng

```
docs/
├── docs.json                   # navigation, theme
├── introduction.mdx            # landing
├── quickstart.mdx              # 5-min onboard
├── modes/
│   ├── pos-online.mdx
│   ├── web.mdx
│   ├── pos-counter.mdx
│   └── analytics.mdx
├── reference/
│   ├── env-vars.mdx
│   ├── transports.mdx
│   └── tools/                  # auto-gen từ scripts/generate-tool-docs.ts
├── guides/
│   ├── claude-desktop.mdx
│   ├── cursor.mdx
│   ├── docker.mdx
│   └── destructive-ops.mdx
└── examples/
    ├── revenue-report.mdx
    ├── seo-bulk-update.mdx
    └── pos-shift-close.mdx
```

### 4.3 Auto-gen tool reference

Tạo `scripts/generate-tool-docs.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { SapoClient } from '../src/client/http.js';
import { registerModes, type ModeName } from '../src/modes/registry.js';

const fakeConfig = { /* minimal SapoConfig */ };
const fakeClient = new SapoClient({ store: 'x', apiKey: 'k', apiSecret: 's' });

for (const mode of ['pos-online', 'web', 'pos-counter', 'analytics'] as ModeName[]) {
  const server = new McpServer({ name: 'sapo-mcp', version: '0.5.0' });
  registerModes(server, [mode], fakeClient, fakeConfig);
  const tools = (server as any)._registeredTools as Record<string, any>;
  let mdx = `# ${mode} mode\n\n`;
  for (const [name, t] of Object.entries(tools)) {
    mdx += `## \`${name}\`\n\n${t.description}\n\n`;
    mdx += '### Input schema\n\n```json\n' + JSON.stringify(t.inputSchema, null, 2) + '\n```\n\n';
  }
  mkdirSync('docs/reference/tools', { recursive: true });
  writeFileSync(`docs/reference/tools/${mode}.mdx`, mdx);
}
```

Chạy `tsx scripts/generate-tool-docs.ts` → commit MDX. Add CI step verify file không thay đổi (= docs sync với code).

### 4.4 Deploy

Mintlify offer free tier:
1. Push `docs/` lên GitHub.
2. Đăng ký https://dashboard.mintlify.com → connect repo → chọn `docs/` folder.
3. Auto-deploy mỗi push. Custom domain: `docs.sapo-mcp.dev` (mua tên miền nếu cần).

Alternative: GitHub Pages với mkdocs-material — miễn phí, không cần SaaS.

---

## Phần 5 — Workflow release từ 0.5.1 trở đi (Changesets)

Từ release tiếp theo, dùng workflow Changesets có sẵn — không bump version thủ công nữa.

### 5.1 Mỗi PR có thay đổi

```bash
# Trên feature branch
npx changeset
# Prompt: chọn package "sapo-mcp", chọn bump type:
#   patch (0.5.0 → 0.5.1) — bug fix
#   minor (0.5.0 → 0.6.0) — new feature, backward compatible
#   major (0.5.0 → 1.0.0) — breaking change
# Mô tả ngắn (sẽ vào CHANGELOG)
git add .changeset/*.md
git commit -m "..."
```

### 5.2 Khi merge PR vào main

GitHub Action `release.yml` tự động:
1. **Lần 1:** thấy có changeset pending → mở/update PR `chore: release` (bump version + update CHANGELOG).
2. **Khi merge release PR:** action chạy lại → publish lên npm với provenance + tạo GitHub release tag.

Không cần `npm publish` thủ công nữa. Chỉ cần đảm bảo `NPM_TOKEN` secret còn hợp lệ.

### 5.3 Quy ước bump

| Thay đổi | Bump |
|---|---|
| Bug fix (logic sai, không đổi schema) | patch |
| Tool mới, mode mới, env var mới optional | minor |
| Đổi tên tool, đổi schema input/output, env var bắt buộc mới | major (chú ý pre-1.0: minor) |
| Drop tool, drop mode | major (pre-1.0: minor + ghi MIGRATION) |

Trong giai đoạn pre-1.0, breaking change chấp nhận ở minor bump nhưng PHẢI:
- Note rõ "BREAKING:" trong changeset description
- Thêm section "## Migration from 0.x" trong CHANGELOG
- Cân nhắc deprecation period 1 minor trước khi xoá

---

## Checklist tổng

Pre-publish:
- [ ] `npm run ci` xanh (917/917)
- [ ] `npm pack --dry-run` không có file lạ
- [ ] Smoke test `--version`, `--help` trên build local
- [ ] Probe trên dev store match verify-report.md đã commit

Publish:
- [ ] `NPM_TOKEN` secret tồn tại trên GitHub
- [ ] `npm login` + 2FA đã setup
- [ ] `npm publish --provenance --access public` chạy thành công
- [ ] `npm view sapo-mcp version` = 0.5.0
- [ ] `npx -y sapo-mcp --version` = 0.5.0

Post-publish:
- [ ] Tag `v0.5.0` đã push
- [ ] GitHub Release đã tạo
- [ ] MCP Inspector connect được qua stdio + HTTP
- [ ] Claude Desktop config mẫu chạy được
- [ ] PR `modelcontextprotocol/servers` đã submit
- [ ] Xoá `.changeset/initial-release.md` và `.changeset/phase-6-pos-counter.md`

Marketing (optional):
- [ ] Tweet announce với link npm + GitHub
- [ ] Post lên Sapo Partner Facebook group
- [ ] Dev.to bài viết về dự án + use case

---

## Khi gặp sự cố

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| `npm publish` lỗi `403 Forbidden` | Tên đã chiếm | Đổi sang `@plateau/sapo-mcp` |
| `npm publish` lỗi `provenance` | Node < 20.5 hoặc npm < 9.5 | `nvm install 20 && npm i -g npm@latest` |
| CI release workflow không chạy | `NPM_TOKEN` thiếu/hết hạn | Tạo lại token, update secret |
| `npx -y sapo-mcp` lỗi `MODULE_NOT_FOUND` | `package.json` "files" thiếu `dist` | Kiểm tra `npm pack --dry-run` |
| MCP Inspector "connection failed" qua HTTP | Token sai hoặc CORS | Verify `Authorization: Bearer <token>` header; check `SAPO_HTTP_CORS_ORIGINS` nếu connect từ browser |
| Probe lỗi 401 | Sai key hoặc app chưa kích hoạt | Vào Sapo admin → Cài đặt → Tài khoản API → kiểm tra Private App status |
| Probe lỗi 403 trên endpoint POS counter | Internal-only endpoint | Đúng — đã document, không phải bug |
