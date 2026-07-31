# 小鳄龙桌面组件

小鳄龙是一个给固定小群使用的 Windows/macOS 桌面伴侣。它用 Electron 提供桌面悬浮入口，React/Vite 渲染界面，Express + Socket.io 提供鉴权、聊天、每日问题、心情和五子棋服务，MySQL 持久化数据。

当前版本：`1.3.2`

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 桌面壳 | Electron |
| 前端 | React + Vite + TypeScript |
| 后端 | Node.js + Express + Socket.io + TypeScript |
| 数据库 | MySQL 8 |
| 共享契约 | `@xiaoelong/shared` |

## 项目结构

```text
.
├── client/              # React 前端
│   ├── src/
│   │   ├── components/  # Avatar、聊天、状态栏、每日问题、五子棋、设置
│   │   ├── api.ts       # REST 客户端
│   │   ├── socket.ts    # Socket.io 客户端
│   │   └── App.tsx
├── electron/            # Electron 主进程、preload、图片查看器页面
├── server/              # Express、Socket、数据库访问和业务服务
│   └── src/
├── shared/              # 前后端共享类型和 Socket 事件契约
├── scripts/             # 工程脚本
└── docker-compose.yml   # 本地 MySQL
```

## 环境准备

根目录安装依赖：

```powershell
npm.cmd install
```

准备服务端环境变量：

```powershell
Copy-Item server\.env.example server\.env
```

至少需要设置：

```env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,null

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=xiaoelong
DB_PASSWORD=xiaoelong
DB_NAME=XiaoELong

INVITE_CODE=your_invite_code
JWT_SECRET=replace_with_strong_secret
JWT_EXPIRES_IN=30d

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
QUESTION_CRON=0 8 * * *
QUESTION_TIMEZONE=Asia/Shanghai
```

准备客户端环境变量：

```powershell
Copy-Item client\.env.example client\.env
```

默认内容：

```env
VITE_SERVER_URL=http://localhost:3001
```

## 本地开发

启动 MySQL：

```powershell
docker compose up -d
```

初始化数据库：

```powershell
npm.cmd run db:init
```

分别启动前后端网页调试：

```powershell
npm.cmd run dev:server
npm.cmd run dev:client
```

浏览器访问 `http://localhost:5173`。不要直接打开 `client/index.html`。

启动桌面调试：

```powershell
npm.cmd run dev:desktop
```

`dev:client` / `dev:desktop` 会强制使用 `http://localhost:3001`，用于本地联调；正式客户端打包脚本会强制使用公网服务 `http://43.139.223.204:3001`。

开发版使用独立的 `XiaoELong-dev` 用户数据目录，不会覆盖正式版登录信息，也不会修改正式版的开机自启动设置。

## DeepSeek 诊断

配置好 `server/.env` 并完成构建后，可以执行一次不会写入数据库的 DeepSeek 诊断：

```powershell
npm.cmd run deepseek:check
```

诊断会先验证 `/models` 鉴权与配置模型是否可用，再真实生成一道题并执行结构校验。成功时会显示：

```text
[DeepSeekCheck] Authentication succeeded.
[DeepSeekCheck] Generated question passed schema validation.
```

诊断和服务日志不会输出 API Key。每日题首次生成失败后会保存当天的本地备用题；当天不会自动替换，DeepSeek 恢复后从下一道新题开始生效。

## 构建与清理

清理本地构建产物：

```powershell
npm.cmd run clean
```

构建 shared、server、client。默认构建使用公网服务地址：

```powershell
npm.cmd run build
```

本地回归测试构建使用本地服务地址：

```powershell
npm.cmd run build:local
```

正式发布构建使用公网服务地址：

```powershell
npm.cmd run build:cloud
```

生成 Electron unpacked 目录包，适合本机快速测试：

```powershell
npm.cmd run electron:pack
```

生成带自动更新元数据的 Windows 安装包：

```powershell
npm.cmd run electron:dist
```

`electron:dist` 会在 `release/` 下生成 `XiaoELong Setup x.y.z.exe`、`.blockmap` 和 `latest.yml`。将这三个文件上传到服务器 `UPDATE_ROOT` 对应目录后，安装版客户端可在设置里检查、下载并重启安装更新。

在 macOS 或 GitHub Actions 的 macOS 运行器中生成 Intel + Apple Silicon 通用测试包：

```bash
npm run electron:dist:mac
```

该命令会在 `release/` 下生成 `XiaoELong-1.3.2-mac-universal.dmg`、`XiaoELong-1.3.2-mac-universal.zip`、`latest-mac.yml` 和 `latest-mac.json`。仓库中的 `Build macOS universal` GitHub Actions 工作流可手动触发；工作流会从根 `package.json` 读取版本号，验证 App 同时包含 `x86_64` 和 `arm64`，核对版本、文件名、DMG 大小与 SHA-256，并上传名为 `XiaoELong-1.3.2-mac-universal` 的 Actions 产物。

下载并解压 Actions 产物后，可在 macOS 终端校验安装包：

```bash
shasum -a 256 -c SHA256-mac.txt
cat mac-architectures.txt
```

当前 macOS 版本是未签名测试版：

- 首次打开时需要在 Finder 中右键应用并选择“打开”，或在“系统设置 → 隐私与安全性”中允许运行。
- 如系统仍提示应用来自身份不明的开发者，先核对安装包确实来自本项目的 GitHub Release；仍需处理时可使用下面的高级兜底命令：

```bash
xattr -dr com.apple.quarantine /Applications/XiaoELong.app
```

- 从 `1.3.2` 起，Mac 客户端会读取服务器上的 `latest-mac.json` 检查版本；发现新版本时，“打开 DMG 下载”按钮会用默认浏览器打开本项目固定的 GitHub Release HTTPS 地址。
- 浏览器下载完成后，完全退出旧版 XiaoELong，打开 DMG，将应用拖入“应用程序”并选择替换，再重新打开。登录信息和本机设置保存在用户数据目录中，正常覆盖应用不会清除它们。
- 这是“检查版本 + 打开可信下载链接”，不是静默自动安装；未签名应用若要使用 Electron 的完整自动更新，仍需 Apple Developer 证书、签名和公证。
- 已经发出的 `1.3.1` 不包含检查逻辑，必须手动安装一次 `1.3.2`；从 `1.3.2` 开始才会提示后续版本。
- 发布时将 DMG 上传到标签为 `v1.3.2` 的 GitHub Release，再把 Actions 生成的 `latest-mac.json` 上传到服务器更新目录。不要上传 `latest-mac.yml`，它不用于当前的 Mac 手动更新流程。
- Windows 自动更新不受影响。若用户网络无法访问 GitHub，仍可直接向其发送 DMG。

`build` 会先运行 `clean`，避免旧的 `dist` 文件混入发布产物。

## 当前功能

- 邀请码入群：用户输入邀请码、昵称、可选头像后获得 JWT。
- 会话恢复：客户端保存 token，启动后通过 `GET /api/auth/me` 恢复身份。
- 在线状态：Socket 握手校验 token，服务端维护多窗口在线状态。
- 实时聊天：文字、图片和普通文件附件，历史消息从数据库加载。
- 每日心情：每日选择一次心情，在线成员实时同步。
- 每日问题：每天一道大学生向四选一题，支持 DeepSeek 生成、本地 fallback、逻辑/语文常识权重控制和结构化附图模板。
- 五子棋：邀请、接受、落子、胜负判定和实时更新。
- 桌面壳：悬浮 Avatar、独立面板、设置、开机自启、图片查看器。

## 服务端接口概览

REST：

- `POST /api/auth/join`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `DELETE /api/auth/me`
- `GET /api/chat/messages?limit=50`
- `POST /api/chat/images`
- `POST /api/chat/files`
- `GET /api/daily-question/today`
- `POST /api/daily-question/answer`
- `GET /api/daily-question/stats?questionId=`
- `GET /api/daily-mood/today`
- `POST /api/daily-mood`
- `GET /api/gomoku/games`
- `POST /api/gomoku/invite`
- `POST /api/gomoku/accept`
- `POST /api/gomoku/reject`
- `POST /api/gomoku/move`

Socket：

- 服务端推送：`presence:init`、`presence:online`、`presence:offline`、`user:update`、`chat:message`、`question:update`、`mood:update`、`gomoku:update`、`gomoku:end`
- 客户端发送：`chat:send`、`gomoku:invite`、`gomoku:accept`、`gomoku:reject`、`gomoku:move`

共享类型集中在 `shared/src/index.ts`，前后端应优先复用这里的接口契约。

## 上传与生成物

- 用户上传文件默认落在 `server/uploads/`，桌面内置服务会使用 Electron `userData/uploads`。
- `node_modules/`、`dist/`、`release/`、`.local-logs/`、`.env`、上传文件和 TypeScript build info 都不提交。
- `server/uploads/avatars/.gitkeep` 仅用于保留头像目录结构。
