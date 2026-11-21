<h1 align="center">
  <a href="https://trawl.germondai.com" target="_blank">
    <img align="center" src="https://icons.germondai.com/icons?i=bun,elysia,firefox,nuxt,vitepress" /><br/><br/>
    <span>TRAWL</span>
  </a>
</h1>

Self-hosted web scraping for applications and AI agents. Get page content through an API or MCP, with built-in handling for supported browser challenges and CAPTCHAs.

This fork publishes a single-session CloakBrowser image on the default branch. For setup, shared-session behavior, RSSHub CDP access, licenses and fingerprint environment variables, see [CloakBrowser 单 session 镜像](CLOAKBROWSER.md). The original Camoufox documentation below describes the legacy runtime.

## CloakBrowser 镜像

默认分支构建 `ghcr.io/ujzk/trawl:latest`，支持 Linux amd64 和 arm64。镜像默认使用最后公开的免密钥版本；设置 `CLOAKBROWSER_LICENSE_KEY` 后，官方 SDK 使用该许可证下载并启动授权版。密钥无需参与镜像构建，请只在运行时提供。免费密钥限制一个并发浏览器 session。

```bash
docker compose -f docker-compose.cloak.yml up -d
curl http://127.0.0.1:8191/health
curl http://127.0.0.1:9222/json/version
```

例如，可在运行 Compose 前设置 `CLOAKBROWSER_LICENSE_KEY`、`CLOAK_FINGERPRINT` 或 `CLOAK_PROXY`，也可以将这些变量写入 Compose 读取的 `.env` 文件。示例将浏览器数据保存在 Docker 卷中，并仅在宿主机回环地址开放 CDP。同一 Compose 网络中的 RSSHub 可使用 `PLAYWRIGHT_CDP_ENDPOINT=http://trawl:9222`。CDP 没有身份验证，连接者可读取浏览器登录状态并控制页面。

`/v1`、`/scrape`、`/read` 和 `/extract` 共用一个持久浏览器上下文；命名 session 是共享状态的逻辑别名。单请求代理或 TLS 设置会返回错误：请使用 `CLOAK_PROXY` 配置浏览器统一代理。共享模式下 MCP 公网隔离抓取不可用，MITM WebSocket 转发返回 501；CDP 每个连接同时支持一个 `newContext()` 别名。详细行为见 [CloakBrowser 单 session 镜像](CLOAKBROWSER.md)。

### 镜像环境变量

以下变量可通过 `docker run -e`、Compose 的 `environment` 或 `.env` 设置。留空的指纹参数通常由 CloakBrowser 自动生成；时区按下表规则选择。部分指纹参数仅由较新的授权版支持。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `CLOAKBROWSER_LICENSE_KEY` | 空 | 免费或付费许可证；非空时使用授权版下载流程。 |
| `CLOAKBROWSER_BINARY_PATH` | 空 | 使用指定浏览器二进制；优先于自动选择。 |
| `CLOAKBROWSER_CACHE_DIR` | `/data/cloak-cache` | 授权版二进制缓存目录。 |
| `CLOAKBROWSER_VERSION` | 空 | 固定授权版浏览器版本；具体可用性取决于许可证。 |
| `CLOAKBROWSER_RELEASE_CHANNEL` | `stable` | 授权版发布通道，可设为 `preview`。 |
| `CLOAKBROWSER_AUTO_UPDATE` | `true` | 设为 `false` 时复用已缓存版本。 |
| `CLOAK_SINGLE_SESSION` | `true` | 启用共享 CloakBrowser 后端；本镜像未打包旧版 Camoufox，不应关闭。 |
| `CLOAK_USER_DATA_DIR` | `/data/cloakbrowser` | 持久 profile 目录，保存 cookie、localStorage 和指纹种子。 |
| `CLOAK_HEADLESS` | `true` | 设为 `false` 使用有界面浏览器；容器无 `DISPLAY` 时自动启动 Xvfb。 |
| `CLOAK_HUMANIZE` | `true` | 启用官方 SDK 的拟人交互；设为 `false` 可关闭。 |
| `CLOAK_HUMAN_PRESET` | `careful` | 拟人交互预设：`default` 或 `careful`。 |
| `CLOAK_PROXY` | 空 | 整个共享浏览器使用的代理 URL。 |
| `CLOAK_PROXY_BYPASS` | 空 | 逗号分隔的全局代理绕过列表。 |
| `CLOAK_LICENSE_ROUTE` | `auto` | 授权请求路径：`auto`、`direct` 或 `proxy`。 |
| `CLOAK_SESSION_ALIAS_LIMIT` | `1000` | 可创建的命名 session 别名上限。 |
| `CLOAK_EXTRA_ARGS` | 空 | 额外 Chromium 参数的 JSON 字符串数组；不能覆盖服务管理的 CDP 或 profile 参数。 |
| `PORT` | `8191` | API 监听端口；Compose 示例用它设置宿主机端口。 |
| `CLOAK_CDP_PORT` | `9222` | CDP 监听端口；Compose 示例使用此值设置宿主机端口，容器内保持 `9222`。 |
| `CLOAK_CDP_INTERNAL_PORT` | `9223` | Chromium 内部回环 CDP 端口，须与对外 CDP 端口不同。 |
| `TZ` | 容器系统时区 | 设置容器时区，例如 `Asia/Shanghai`；Compose 会转发该变量。 |
| `BROWSER_SESSION_TTL_SECONDS` | `3600` | 命名 session 别名的空闲有效期；过期不会清空共享 profile。 |
| `BROWSER_ACQUIRE_TIMEOUT_MS` | `30000` | 等待共享浏览器可用的最长时间。 |
| `SCRAPE_MAX_TIMEOUT_MS` | `60000` | 抓取请求的默认总超时。 |
| `WAF_DETECTION_ENABLED` | `true` | 是否默认启用 WAF 检测。 |

| 指纹变量 | 控制项 |
| --- | --- |
| `CLOAK_FINGERPRINT` | 指纹种子；相同种子生成一致的身份。 |
| `CLOAK_FINGERPRINT_PLATFORM` / `CLOAK_FINGERPRINT_PLATFORM_VERSION` | 平台及 Client Hints 平台版本。 |
| `CLOAK_FINGERPRINT_GPU_VENDOR` | GPU 厂商，如 `NVIDIA` 或 `Intel`。 |
| `CLOAK_FINGERPRINT_HARDWARE_CONCURRENCY` / `CLOAK_FINGERPRINT_DEVICE_MEMORY` | CPU 线程数及设备内存。 |
| `CLOAK_FINGERPRINT_SCREEN_WIDTH` / `CLOAK_FINGERPRINT_SCREEN_HEIGHT` / `CLOAK_FINGERPRINT_TASKBAR_HEIGHT` | 屏幕尺寸和任务栏高度。 |
| `CLOAK_FINGERPRINT_TIMEZONE` / `CLOAK_FINGERPRINT_LOCALE` | 时区和语言区域。时区默认使用容器系统时区；系统为 UTC 时使用 `America/Los_Angeles`。显式设置始终优先。 |
| `CLOAK_FINGERPRINT_WEBRTC_IP` | WebRTC ICE 候选地址，可使用 IP 或 `auto`。 |
| `CLOAK_FINGERPRINT_STORAGE_QUOTA` | 存储配额余量，单位 MB。 |
| `CLOAK_FINGERPRINT_NOISE` / `CLOAK_FINGERPRINT_SAPI_VOICES` | 控制指纹噪声及 Windows 语音列表。 |
| `CLOAK_FINGERPRINT_MAX_TOUCH_POINTS` / `CLOAK_FINGERPRINT_SEARCH_ENGINE` | 触控点数及默认搜索引擎。 |
| `CLOAK_FINGERPRINT_ALLOW_3P_COOKIES` | 启用第三方 cookie，使用 `true` 或 `false`。 |
| `CLOAK_FINGERPRINT_TRANSPARENT_PROXY` / `CLOAK_FINGERPRINT_TRANSPARENT_PROXY_DNS` | 透明代理及其 DNS 设置。 |
| `CLOAK_FINGERPRINT_PORTABLE_COOKIES` | 启用可跨机器复制的 profile cookie。 |

其他通用 API、日志、验证码及 MITM 选项见 [.env.example](.env.example)；使用 Compose 时，未在示例中列出的变量须添加到 `environment` 才会传入容器。其中 Camoufox 浏览器池选项属于旧版运行时；共享模式禁止旧代理池变量 `PROXY_URL`、`PROXY_LIST_FILE`、`RESIDENTIAL_PROXY_URL` 和 `RESIDENTIAL_PROXY_LIST_FILE`，请改用 `CLOAK_PROXY`。

TRAWL starts with HTTP, reuses verified clearance and opens Camoufox when a browser is needed. Repeat requests fetch fresh content without repeating a full solve whenever the site accepts the saved session.

`HTTP + supported PoW walls → cached browser session → fresh browser solve → residential proxy`

The HTTP tier can clear supported ALTCHA and Friendly Captcha v1 access forms with bounded local computation. Ordinary embedded widgets keep their browser lifecycle. [Coverage and limits](apps/docs/getting-started/challenge-support.md).

[Website](https://trawl.germondai.com) · [Documentation](https://docs.trawl.germondai.com) · [Latest release](https://github.com/germondai/trawl/releases/latest)

## Features

- **Challenge handling:** Cloudflare, Anubis, NCBI proof of work, Akamai, Imperva, DDoS-Guard and supported AWS WAF and DataDome flows. Built-in CAPTCHA paths include Turnstile, reCAPTCHA v2, hCaptcha, GeeTest Slide, ALTCHA, Friendly Captcha, CAP and supported Shumei spatial puzzles. [Coverage and limits](apps/docs/getting-started/challenge-support.md).
- **Fast repeat requests:** automatic HTTP clearance reuse, Redis or in-memory caching, and browser fallback when required. No named session is needed for shared clearance reuse.
- **MCP for agents:** read Markdown, scrape HTML, extract structured JSON, capture screenshots and inspect browser activity from known URLs.
- **Isolated browser sessions:** retain cookies, localStorage, sessionStorage and browser identity. Scrape within a session, keep a page open for JavaScript eval and read cookies. [Session API](apps/docs/api-reference/browser-sessions.md).
- **API and forward proxy:** use `/scrape`, the FlareSolverr-compatible `/v1` endpoint, or a challenge-aware HTTP/HTTPS proxy with WebSockets and Range support.
- **Local dashboard:** persistent request history, tier outcomes, failure causes and live updates.
- **Local solving by default:** optional 2Captcha fallback and opt-in Firefox TLS/HTTP2 impersonation; Bun fetch remains the default HTTP transport.

## Sponsors

<details open>
  <summary>View/Collapse All</summary>

  <table>
    <tr>
      <td width="30%" align="center" valign="middle">
        <a href="https://get.brightdata.com/trawl" target="_blank">
          <img width="1254" height="1254" alt="Birght Data" src="https://github.com/user-attachments/assets/f23cfc4a-160d-4576-b27f-5d5bb4738530" />
        </a>
      </td>
      <td valign="middle">
        <b><a href="https://get.brightdata.com/trawl" target="_blank">Bright Data</a></b> - The most powerful platform for Web Unlocker, SERP API and web scraping tools.<br><br>
        <b>Why <a href="https://get.brightdata.com/trawl" target="_blank">Bright Data</a>?</b><br>
        • <a href="https://get.brightdata.com/trawl-web-unlocker" target="_blank">Web Unlocker</a> - bypass any anti-bot protection<br>
        • <a href="https://get.brightdata.com/trawl-serp-api" target="_blank">SERP API</a> - real-time Google, Bing & more results<br>
        • Scraping Browser & dedicated scrapers<br>
        • Massive residential proxy network<br>
        • Built for scale and reliability<br><br>
        <b>Get started for free with <a href="https://get.brightdata.com/trawl" target="_blank">Bright Data</a>!</b>
      </td>
    </tr>
    <tr>
      <td width="30%" align="center" valign="middle">
        <a href="https://go.nodemaven.com/germondaioctoberGH" target="_blank">
          <img width="4096" height="1024" alt="NodeMaven" src="https://github.com/user-attachments/assets/6382e10d-1b73-48ef-bb29-c2d38225f9d7" />
        </a>
      </td>
      <td valign="middle">
        <b><a href="https://go.nodemaven.com/germondaioctoberGH" target="_blank">NodeMaven</a></b> - The most efficient proxy provider for Web Scrapping and Automation with the Highest Quality IP on the market.<br><br>
        <b>Why <a href="https://go.nodemaven.com/germondaioctoberGH" target="_blank">NodeMaven</a>?</b><br>
        • ZIP targeting<br>
        • 99.9% uptime<br>
        • IP filtering: all proxies have fraud score <97%<br>
        • No KYC required<br>
        • Unique free tools: Proxy Bandwidth Checker, Meta Tag Checker, IP Lookup and others!<br><br>
        <b>Special codes for <a href="https://trawl.germondai.com" target="_blank">TRAWL</a> users:</b><br>
        • <code>TRAWL35</code> - 35% off to Mobile and Residential Proxies<br>
        • <code>TRAWL40</code> - 40% off to ISP (Static) Proxies<br>
        • <code>TRAWL2X</code> - 2X traffic for Black Friday
      </td>
    </tr>
    <tr>
      <td width="30%" align="center" valign="middle">
        <a href="https://www.thordata.com/?ls=dtw&lk=dtw" target="_blank">
          <img width="1254" height="1254" alt="Thordata" src="https://github.com/user-attachments/assets/4804c6c7-510a-4f3f-af47-5d6151bc26f1" />
        </a>
      </td>
      <td valign="middle">
        <b><a href="https://www.thordata.com/?ls=dtw&lk=dtw" target="_blank">Thordata</a></b> - Residential Proxies & Web Data APIs<br><br>
        <p>Give <b>TRAWL</b> reliable upstream access with <b>100M+ residential IPs across 190+ countries</b>, including city and ASN targeting.</p>
        <b>Why <a href="https://www.thordata.com/?ls=dtw&lk=dtw" target="_blank">Thordata</a>?</b><br>
        • <b>Residential Proxies:</b> rotating and sticky sessions for scraping and browser automation<br>
        • <b>SERP API:</b> structured Google, Bing, and other search results for research workflows<br>
        • <b>Web Scraper API:</b> collect public web data through a simple API<br><br>
        <b><a href="https://trawl.germondai.com" target="_blank">TRAWL</a> users:</b><br>
        • Start with free trial traffic and get <b>10% off</b> with code <code>TRAWL10</code>
      </td>
    </tr>
  </table>
</details>

## Performance

Selected same-machine comparisons show faster first and repeat responses than FlareSolverr and Byparr on the default Cloudflare workload:

| Protected page          | Best first | Best repeat |
| ----------------------- | ---------: | ----------: |
| NopeCHA Cloudflare demo |  **6.0 s** |  **879 ms** |
| 1337x                   |  **3.8 s** |   **85 ms** |
| EZTV                    |  **4.6 s** |  **473 ms** |

Measured **2026-10-17** on a development build after v1.8.0. These are verified minima from the recorded sample. First requests used a warm browser with an empty target cache; repeats are fresh fetches with reusable clearance. Results vary by site, IP and session state.

[Full comparison, medians and CPU/RAM](benchmarks/RESULTS.md) · [Method](benchmarks/README.md) · [Performance guide](apps/docs/getting-started/performance.md) · [Low-resource setup](apps/docs/getting-started/low-resource.md)

## Quick start

Run one browser with MCP, an in-memory clearance cache and persistent dashboard history:

```bash
docker run -d --name trawl \
  -p 127.0.0.1:8191:8191 \
  --shm-size=1gb \
  -e SESSION_CACHE_DRIVER=memory \
  -e BROWSER_POOL_SIZE=1 \
  -e MCP_ENABLED=true \
  -e METRICS_DASHBOARD_ENABLED=true \
  -v trawl_metrics:/data/metrics \
  ghcr.io/germondai/trawl:1.11.1

curl http://localhost:8191/health
```

Open [the local dashboard](http://localhost:8191/dashboard). Keep the API and MCP endpoint on a trusted network; dashboard history survives container recreation through the mounted volume.

For Redis and Compose deployments, see the [quick-start guide](apps/docs/getting-started/quick-start.md) and [Compose examples](apps/docs/deployment/docker-compose.md). Use `:1.11.1-baseline` on older CPUs or NAS hardware.

<details>
<summary>Dashboard preview</summary>

![TRAWL metrics dashboard showing illustrative request data](apps/docs/public/screenshots/dashboard.png)

The screenshot uses illustrative traffic. Your dashboard shows requests actually handled by your instance. [Metrics setup](apps/docs/api-reference/health-stats.md#local-metrics-dashboard).

</details>

## API

### Native scraping

```bash
curl -X POST http://localhost:8191/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://nopecha.com/demo/cloudflare","solveEmbeddedCaptchas":false}'
```

Returns HTML, cookies, the winning tier and timings. Set `solveEmbeddedCaptchas: false` for page content only; omit it to attempt supported embedded form widgets. Access challenges still need to clear. A delivered page does not by itself prove a form CAPTCHA was solved.

[Native API](apps/docs/api-reference/native-api.md) · [Custom headers](apps/docs/api-reference/custom-headers.md)

### JavaScript and TypeScript client

The `packages/client` workspace provides a typed client for Node.js, Bun, Deno and
browser applications, including scrape options, session handles and structured errors.
Build it locally before the first npm publication. [Client guide](packages/client/README.md).

### Prowlarr, Jackett and FlareSolverr clients

```bash
curl -X POST http://localhost:8191/v1 \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"request.get","url":"https://nopecha.com/demo/cloudflare"}'
```

Set your client's FlareSolverr URL to `http://trawl:8191` on a shared Docker network, or the TRAWL host address otherwise. `/v1` prioritizes page delivery and skips optional embedded widget solving by default.

[Prowlarr setup](apps/docs/integrations/prowlarr.md) · [Jackett setup](apps/docs/integrations/jackett.md) · [Compatibility reference](apps/docs/api-reference/flaresolvr-compat.md)

### MCP for AI clients

With `MCP_ENABLED=true`, connect your client using **Streamable HTTP** at `http://localhost:8191/mcp` or the TRAWL host address. Tools: `read`, `scrape`, `extract`, `screenshot` and `inspect`, plus the `scrape_url` compatibility alias.

TRAWL loads known public URLs; it does not provide web search. Reuse browser sessions with `sessionId`; create sessions used by MCP with `publicOnly: true`. [MCP guide](apps/docs/integrations/mcp.md).

### Browser sessions

Create an isolated session and pass its ID on subsequent requests:

```bash
curl -X POST http://localhost:8191/sessions \
  -H 'Content-Type: application/json' \
  -d '{"id":"research"}'

curl -X POST http://localhost:8191/sessions/research/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://nopecha.com/demo/cloudflare","solveEmbeddedCaptchas":false}'

curl -X DELETE http://localhost:8191/sessions/research
```

Sessions preserve browser storage between requests and keep login state out of the shared clearance cache. Requests within one session are sequential. `/scrape` with `sessionId` remains equivalent to `/sessions/:id/scrape`.

By default, request pages close after each operation. Create a session with `"keepPage": true` to retain one main page and use `/sessions/:id/eval` to run JavaScript in it. Sessions expire when idle and do not survive an API restart.

[Session API, authentication and lifecycle](apps/docs/api-reference/browser-sessions.md)

## Challenge and CAPTCHA support

TRAWL detects supported walls and runs the matching browser flow before returning content. Coverage includes JavaScript and proof-of-work challenges, interactive controls, and supported CAPTCHA widget variants.

Some challenges need a particular browser mode, a different egress IP or an external provider. For example, DataDome Device Check uses the opt-in headful pool; built-in hCaptcha support does not include image grids. Passive reCAPTCHA v3 scripts are not treated as blocking widgets.

The optional 2Captcha fallback supports captured Cloudflare Challenge Pages and supported declarative Turnstile/reCAPTCHA v2 widgets without a site profile. Other documented tasks require a site profile. It is disabled without a provider key; paid-service acceptance remains unverified.

[Full coverage matrix and external task catalogue](apps/docs/getting-started/challenge-support.md) · [Solver configuration](apps/docs/getting-started/configuration.md#optional-external-captcha-solver)

## HTTP/HTTPS forward proxy

Enable `MITM_ENABLED=true` and point your HTTP-compatible client at port `8192`. Normal traffic is forwarded directly; detected challenge responses escalate through TRAWL's browser tiers. HTTPS clients must trust the generated TRAWL CA. Keep the proxy private and persist its CA directory.

[Proxy setup](apps/docs/proxy/overview.md) · [Install the CA](apps/docs/proxy/ca-installation.md) · [Prowlarr and other clients](apps/docs/proxy/client-setup.md)

## Docker images

| Tags                             | Use case                             |
| -------------------------------- | ------------------------------------ |
| `:latest`, `:1.11.1`             | Standard release for modern hardware |
| `:baseline`, `:1.11.1-baseline`   | Older x86 CPUs and NAS kernels       |
| `:nightly`, `:nightly-<dev-sha>`  | Development builds from `dev`        |

All tags use `ghcr.io/germondai/trawl`. Both release variants are published for Linux AMD64 and ARM64. [Standalone containers and source builds](apps/docs/deployment/standalone.md).

<details>
<summary>Compose variants and NAS app catalogs</summary>

- [docker-compose.yml](docker-compose.yml): scraper and Redis.
- [docker-compose.minimal.yml](docker-compose.minimal.yml): scraper with in-memory caching.
- [docker-compose.prod.yml](docker-compose.prod.yml): Redis, restart policy and health checks.
- [TrueNAS Community Apps](https://apps.truenas.com/catalog/trawl_community/) and [Unraid Community Apps](https://ca.unraid.net/apps/trawl-1o4q23p06utr4h): community-maintained packages.

</details>

## Configuration

| Setting                               | Default | Purpose                                                   |
| ------------------------------------- | ------- | --------------------------------------------------------- |
| `BROWSER_POOL_SIZE`                   | `1`     | Warm browsers available for concurrent work               |
| `SESSION_CACHE_DRIVER`                | `redis` | Choose Redis or single-process `memory` caching           |
| `SCRAPE_MAX_TIMEOUT_MS`               | `60000` | Default scrape deadline; request timeouts take precedence |
| `TIER1_TRANSPORT`                     | `bun`   | Set `wreq` for optional Firefox TLS/HTTP2 impersonation   |
| `BROWSER_SESSION_MAX_ENTRIES`         | `4`     | Maximum named browser sessions per instance               |
| `PROXY_URL` / `RESIDENTIAL_PROXY_URL` | unset   | Optional upstream proxies and proxy pools                 |

[All settings](apps/docs/getting-started/configuration.md) · [Environment example](.env.example) · [Upgrade guide](apps/docs/deployment/configuration-migration.md)

## Documentation and development

- [Architecture and tier routing](apps/docs/architecture/tiered-execution.md)
- [Clearance cache and HTTP reuse](apps/docs/architecture/session-cache.md)
- [Browser pool and resource management](apps/docs/architecture/browser-pool.md)
- [Troubleshooting](apps/docs/deployment/troubleshooting.md)
- [Release history](CHANGELOG.md)
- [Contributing and local development](CONTRIBUTING.md)

<details>
<summary>Monorepo structure and stack</summary>

| Workspace          | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `apps/api`         | Bun + Elysia API, MCP, dashboard and forward proxy |
| `apps/web`         | Nuxt landing page                                  |
| `apps/docs`        | VitePress documentation                            |
| `packages/browser` | Camoufox pool and clearance cache                  |
| `packages/tiers`   | Routing, browser sessions and challenge solvers    |
| `packages/types`   | Shared types                                       |

</details>

## Star History

<a href="https://www.star-history.com/?repos=germondai%2Ftrawl">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=germondai/trawl&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=germondai/trawl&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=germondai/trawl&type=date&legend=top-left" />
 </picture>
</a>

## Contributors

<a href="https://github.com/germondai/trawl/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=germondai/trawl" />
</a>

---

<p align="center">
    <span>Made with ❤️ by</span>
    <a href="https://github.com/germondai" target="_blank">@germondai</a>
</p>
