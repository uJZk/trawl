# CloakBrowser 单 session 镜像

默认分支的 GitHub Actions 构建 `ghcr.io/<仓库所有者>/trawl:latest`，支持 Linux amd64 和 arm64。镜像默认使用最后公开的免密钥版本（amd64 为 Chromium 146.0.7680.177.5，arm64 为 146.0.7680.177.3）。设置 `CLOAKBROWSER_LICENSE_KEY` 后，官方 SDK 会下载并运行许可证对应的最新浏览器；密钥通过运行环境传入，不放进镜像。免费密钥仍限制一个并发浏览器 session。SDK 支持的 `CLOAKBROWSER_VERSION`、`CLOAKBROWSER_RELEASE_CHANNEL` 和 `CLOAKBROWSER_AUTO_UPDATE` 可用于授权版，版本固定是否可用取决于授权方案。

```bash
docker compose -f docker-compose.cloak.yml up -d
curl http://127.0.0.1:8191/health
curl http://127.0.0.1:9222/json/version
```

通过环境变量或 Compose 的 `.env` 文件配置许可证和其他参数。`/data` 保存浏览器 profile 和授权版二进制缓存，重启后可复用 cookie、localStorage 和指纹种子。不要同时让多个实例使用同一个 profile。首次使用授权版需访问 CloakBrowser 授权和下载服务。

FlareSolverr `/v1`、`/scrape`、`/read` 和 `/extract` 默认使用同一个持久上下文。命名 session 是逻辑别名；删除别名不会清空共享 cookie。`CLOAK_SESSION_ALIAS_LIMIT` 限制别名数，默认 1000。单个浏览器的 API 请求排队执行，CDP 客户端可以同时打开自己的页面。全局代理使用 `CLOAK_PROXY`，`CLOAK_PROXY_BYPASS` 可填写逗号分隔的绕过列表。旧的 `PROXY_URL`、`RESIDENTIAL_PROXY_URL` 及代理列表文件不能与共享模式同时使用；设置它们会阻止启动，避免意外直连。每请求或每 session 的代理及 TLS 策略无法在共享上下文中隔离，会返回错误。MCP 的 public-only 网络隔离也无法与该共享上下文组合，因此共享模式下的 MCP 抓取会拒绝执行。MITM 代理启用时 HTTP 请求走浏览器抓取路径；共享模式下不支持 MITM WebSocket 转发，返回 501。

CDP 无身份验证，可控制浏览器和读取登录状态；示例只将宿主机端口绑定到 `127.0.0.1`。同一 Compose 网络内的 RSSHub 可配置 `PLAYWRIGHT_CDP_ENDPOINT=http://trawl:9222`，无需将 CDP 端口开放到公网。CDP 的 `newContext()` 映射到共享上下文，每条 CDP 连接同时支持一个此类别名；关闭别名只清理该连接通过别名创建的页面。与浏览器原生行为一致，`sessionStorage` 按标签页隔离。

浏览器启动项：`CLOAK_HEADLESS`（默认 true）、`CLOAK_HUMANIZE`（默认 true）、`CLOAK_HUMAN_PRESET`（默认 `careful`，也可选 `default`）、`CLOAK_PROXY`、`CLOAK_PROXY_BYPASS`、`CLOAK_LICENSE_ROUTE`（`auto`、`direct`、`proxy`）。`CLOAK_USER_DATA_DIR` 默认 `/data/cloakbrowser`；`CLOAKBROWSER_CACHE_DIR` 默认 `/data/cloak-cache`。设置 `CLOAK_HEADLESS=false` 且未设置 `DISPLAY` 时，容器通过 Xvfb 启动有界面浏览器。

浏览器默认使用容器的系统时区；系统时区是 UTC 时，使用 `America/Los_Angeles`（旧金山，自动处理夏令时）。通过 `CLOAK_FINGERPRINT_TIMEZONE` 或 `CLOAK_EXTRA_ARGS` 显式指定时区时，以指定值为准，包括显式指定的 UTC。Docker 容器不会自动继承宿主机的时区；可设置 `TZ=Asia/Shanghai` 等 IANA 时区，Compose 示例会将 `TZ` 传入容器。

除上述时区规则外，指纹配置留空时由 CloakBrowser 自动生成一致的配置。可按需设置以下变量；对应官方 Chromium 参数，将 `_` 换成 `-`：

- `CLOAK_FINGERPRINT`、`CLOAK_FINGERPRINT_PLATFORM`、`CLOAK_FINGERPRINT_PLATFORM_VERSION`
- `CLOAK_FINGERPRINT_GPU_VENDOR`、`CLOAK_FINGERPRINT_HARDWARE_CONCURRENCY`、`CLOAK_FINGERPRINT_DEVICE_MEMORY`
- `CLOAK_FINGERPRINT_SCREEN_WIDTH`、`CLOAK_FINGERPRINT_SCREEN_HEIGHT`、`CLOAK_FINGERPRINT_TASKBAR_HEIGHT`
- `CLOAK_FINGERPRINT_TIMEZONE`、`CLOAK_FINGERPRINT_LOCALE`、`CLOAK_FINGERPRINT_WEBRTC_IP`
- `CLOAK_FINGERPRINT_STORAGE_QUOTA`、`CLOAK_FINGERPRINT_NOISE`、`CLOAK_FINGERPRINT_SAPI_VOICES`、`CLOAK_FINGERPRINT_MAX_TOUCH_POINTS`、`CLOAK_FINGERPRINT_SEARCH_ENGINE`
- `CLOAK_FINGERPRINT_ALLOW_3P_COOKIES`、`CLOAK_FINGERPRINT_TRANSPARENT_PROXY`、`CLOAK_FINGERPRINT_TRANSPARENT_PROXY_DNS`、`CLOAK_FINGERPRINT_PORTABLE_COOKIES`

布尔开关接受 `true` / `false`。其他或未来版本的参数可用 `CLOAK_EXTRA_ARGS` 传入 JSON 字符串数组，例如 `["--fingerprint=12345"]`；CDP 和 profile 路径参数由服务管理。部分参数只受较新授权版支持，旧免费版可能忽略它们。修改单独指纹值可能降低一致性，请自行验证目标站点。
