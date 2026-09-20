# 小鳄龙桌面组件

[![macOS 构建](https://github.com/sheephjc/XiaoELong/actions/workflows/build-macos.yml/badge.svg)](https://github.com/sheephjc/XiaoELong/actions/workflows/build-macos.yml)

小鳄龙是一个给固定小群使用的 Windows/macOS 桌面伴侣。它用 Electron 提供桌面悬浮入口，React/Vite 渲染界面，Express + Socket.io 提供前后端连接。后端采用 MySQL 持久化数据。目前主要功能包括：聊天室、每日问题、每日心情、膜拜、五子棋等。

当前版本：`2.2.3`

## 2.2.3 更新要点

- 新增 `https://xiaoelong.cn/pet` 桌面组件发布页，提供 Windows 与 macOS 下载。
- 客户端、API 和自动更新迁移至 `https://xiaoelong.cn`。
- 托盘打开程序时直接显示左键主面板。
- 升级服务端、实时通信、上传与构建依赖，修复已知安全告警。

（详细见 [版本历史](CHANGELOG.md) ）

## 文档

- [需求文档](docs/requirements.md) — 产品定位、功能与非功能需求、路线图
- [架构文档](docs/architecture.md) — 系统架构、数据流、通信协议
- [文件清单](docs/file-inventory.md) — 全量文件用途说明
- [服务器部署说明](deploy/server/readme-server.md) — Linux + 1Panel 部署与更新
- [每日一题题库来源](docs/question-bank-sources.md) — 数据集版本、许可和使用边界
- [版本历史](CHANGELOG.md) — 各版本更新记录

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
│   │   ├── components/  # atoms、pages、panels 三层 UI 组件
│   │   ├── contexts/    # Auth、Chat、Daily、Deity、Desktop、Gomoku 状态
│   │   ├── services/    # REST 与 Socket.io 客户端
│   │   ├── styles/      # 全局与神选样式
│   │   ├── AppProviders.tsx
│   │   └── App.tsx
├── electron/            # Electron 主进程、preload、图片查看器页面
├── server/              # Express、Socket、数据库访问和业务服务
│   └── src/
├── shared/              # 前后端共享类型和 Socket 事件契约
├── scripts/             # 工程脚本
└── docker-compose.yml   # 本地 MySQL
```

## 环境准备

项目开发、测试与发布统一使用 Node.js `22.23.1`。根目录 `.nvmrc` 固定该版本，`package.json` 接受的范围为 `>=22.22.2 <23`。

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

`dev:client` / `dev:desktop` 会强制使用 `http://localhost:3001`，用于本地联调；正式客户端打包脚本会强制使用公网服务。

开发版使用独立的 `XiaoELong-dev` 用户数据目录，不会覆盖正式版登录信息，也不会修改正式版的开机自启动设置。

## 每日一题题库准备

先初始化数据库，再导入固定版本的 LogiQA 2.0、CMMLU 与项目内程序化图形题库：

```powershell
npm.cmd run db:init
npm.cmd run question-bank:import
```

导入只保存题干、选项和标准答案。使用 DeepSeek 分批复核并生成解析后，题目才会进入每日抽取范围；默认每次处理 20 道，可显式指定数量：

```powershell
npm.cmd run question-bank:explain -- --limit=100
```

也可只处理一个来源：

```powershell
npm.cmd run question-bank:import -- --source=logiqa2
npm.cmd run question-bank:explain -- --source=logiqa2 --limit=100
```

可用题源为 `logiqa2`、`cmmlu` 和 `raven_style`。`raven_style` 会直接生成带 SVG 图形和确定性解析的图形推理题，不需要调用 DeepSeek。

题目本身不会由 DeepSeek 生成。解析审核认为答案不唯一、题目过时或标准答案可疑时，该题会被停用。题库许可和固定版本见 [每日一题题库来源](docs/question-bank-sources.md)。

## DeepSeek 诊断（题库解析）

配置好 `server/.env` 并完成构建后，可以执行一次不会写入数据库的 DeepSeek 诊断：

```powershell
npm.cmd run deepseek:check
```

诊断会先验证 `/models` 鉴权与配置模型是否可用，再为一道固定样题生成解析并执行结构校验。成功时会显示：

```text
[DeepSeekCheck] Authentication succeeded.
[DeepSeekCheck] Explanation review passed schema validation.
```

诊断和服务日志不会输出 API Key。每日抽题本身不调用 DeepSeek，并会按题目内容指纹永久排除已经作为每日题出现过的内容；未出且已解析的题目耗尽时接口会明确提示补充题库，不会重复旧题或临时生成备用题。

## 构建与清理

清理本地构建产物：

```powershell
npm.cmd run clean
```

`clean` 会删除 client/server/shared 的 `dist`、Electron `release` 和本地构建缓存，但不会删除 `deploy/` 下已经生成的服务器部署 ZIP。

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

生成服务器部署包：

```powershell
npm.cmd run server:deploy
```

该命令会构建前后端（同时清理旧构建产物），然后生成 `deploy/XiaoELong-server-2.2.3.zip`。Windows 使用系统自带的 PowerShell/.NET 压缩，无需额外安装 `zip`；macOS/Linux 需要系统提供 `zip` 命令。脚本会先生成同目录临时 ZIP，成功后才替换正式包，失败时保留上一份正式包。

生成 Electron unpacked 目录包，适合本机快速测试：

```powershell
npm.cmd run electron:pack
```

生成带自动更新元数据的 Windows 安装包：

```powershell
npm.cmd run electron:dist
```

`electron:dist` 会在 `release/` 下生成 `XiaoELong Setup x.y.z.exe`、`.blockmap` 和 `latest.yml`。将这三个文件上传到服务器 `UPDATE_ROOT` 对应目录后，安装版客户端可在设置里检查、下载并重启安装更新。

将 Windows 自动更新三件套打成便于上传服务器的版本化 ZIP，并生成 SHA-256 清单：

```powershell
npm.cmd run updates:deploy
```

该命令会生成 `deploy/XiaoELong-updates-2.2.3.zip` 与 `deploy/SHA256-2.2.3.txt`；校验清单还会包含同版本服务器部署包（若已生成）的哈希。

在 macOS 或 GitHub Actions 的 macOS 运行器中生成 Intel + Apple Silicon 通用测试包：

```bash
npm run electron:dist:mac
```

该命令会在 `release/` 下生成 `XiaoELong-2.2.3-mac-universal.dmg`、`XiaoELong-2.2.3-mac-universal.zip`、`latest-mac.yml` 和 `latest-mac.json`。仓库中的 `Build macOS universal` GitHub Actions 工作流固定使用 Node.js `22.23.1`，可手动触发；工作流会从根 `package.json` 读取版本号，验证 App 同时包含 `x86_64` 和 `arm64`，核对版本、文件名、DMG 大小与 SHA-256，并上传名为 `XiaoELong-2.2.3-mac-universal` 的 Actions 产物。触发时可选填与版本一致的 `release_tag`（例如 `v2.2.3`），让运行器把验证后的 DMG、`latest-mac.json`、架构和 SHA-256 清单直接追加到已有 GitHub Release。

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
- 已经发出的 `1.3.1` 不包含检查逻辑，必须手动安装一次 `1.3.2` 或更新版本；从 `1.3.2` 开始才会提示后续版本。
- 发布时将 DMG 上传到标签为 `v2.2.3` 的 GitHub Release，再把 Actions 生成的 `latest-mac.json` 上传到服务器更新目录。不要上传 `latest-mac.yml`，它不用于当前的 Mac 手动更新流程。
- Windows 自动更新不受影响。若用户网络无法访问 GitHub，仍可直接向其发送 DMG。

`build` 会先运行 `clean`，避免旧的 `dist` 文件混入发布产物。

## 当前功能

- 邀请码入群：用户输入邀请码、昵称、可选头像后获得 JWT。
- 会话恢复与续签：客户端保存 token，启动后通过 `GET /api/auth/me` 恢复身份。仍有效的旧版 token 会在首次校验时升级；新版 token 至多提前 7 天自动续签（短期凭证按有效期比例提前），并同步到桌面端各窗口。
- 在线状态：Socket 握手校验 token，服务端维护多窗口在线状态。
- 实时聊天：文字、图片和普通文件附件，启动时加载最近 50 条记录，滚到顶部可继续查看全部更早记录；支持右键引用消息、引用预览与跳转原消息。
- 每日心情：每日选择一次心情，在线成员实时同步。
- 每日问题：每天从已复核且已有解析、且从未作为每日题出现过的公考题库内容中抽取一道四选一题，支持长材料、来源署名和结构化附图；题库耗尽时明确提示补充题目，手动刷新保留当前题目并显示稳定的刷新状态。
- 五子棋：邀请、接受、落子、胜负判定、实时更新和受服务端约束的单步撤回；刷新对局时保留现有列表与棋盘。
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
- `POST /api/gomoku/undo`

Socket：

- 服务端推送：`presence:init`、`presence:online`、`presence:offline`、`user:update`、`chat:message`、`question:update`、`mood:update`、`gomoku:update`、`gomoku:end`
- 客户端发送：`chat:send`、`gomoku:invite`、`gomoku:accept`、`gomoku:reject`、`gomoku:move`、`gomoku:undo`

共享类型集中在 `shared/src/index.ts`，前后端应优先复用这里的接口契约。

## 上传与生成物

- 用户上传文件默认落在 `server/uploads/`，桌面内置服务会使用 Electron `userData/uploads`。
- `node_modules/`、`dist/`、`release/`、`.local-logs/`、`.env`、上传文件和 TypeScript build info 都不提交。
- `server/uploads/avatars/.gitkeep` 仅用于保留头像目录结构。
