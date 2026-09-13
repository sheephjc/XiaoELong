# 小鳄龙之家服务器部署

版本：**2.2.2**。环境：Ubuntu 22.04 + 1Panel，Node.js 22.23.1，MySQL 8.0。

目前使用 `http://111.231.19.104:3001`。`xiaoelong.cn` 备案完成前不配置域名和 DNS；之后再启用 OpenResty、HTTPS 并更新客户端地址。

## 目录与数据库

| 内容 | 位置 / 名称 |
| --- | --- |
| 程序 | `/opt/xiaoelong_home` |
| 数据库 / 应用用户 | `xiaoelong_home` |
| MySQL 容器 | `xiaoelong_home_mysql` |
| Node.js 容器 | `xiaoelong_home` |
| 上传文件 | `/opt/xiaoelong_home/xiaoelong_home` |
| 客户端更新 | `/opt/xiaoelong_home/updates` |
| 网页 | `/opt/xiaoelong_home/web` |
| 后端环境文件 | `/opt/xiaoelong_home/server/.env` |

上传目录内部继续使用 `avatars`、`chat-images`、`chat-files`。访问地址仍为 `/uploads/...`，无需改历史消息和头像记录。游戏大厅以后使用独立的 `xiaoelong_game` 数据库、目录和端口。

## 首次迁移

1. 在 1Panel 安装 MySQL 8.0，名称和容器名均为 `xiaoelong_home_mysql`，不勾选端口外部访问。创建 `xiaoelong_home` 数据库和专用用户，使用强密码。
2. 本地运行 `npm run server:deploy`，上传 `deploy/XiaoELong-server-2.2.2.zip`，解压至 `/opt/xiaoelong_home`。根目录应直接包含 `package.json`、`server`、`shared`、`web`、`compose.yaml`。
3. 导入旧数据库时，只把 SQL 的数据库创建/选择语句从 `XiaoELong` 改为 `xiaoelong_home`。恢复旧上传目录的内容至 `/opt/xiaoelong_home/xiaoelong_home`；迁移备份与 SQL 不要放进公开更新目录。
4. 用旧 `.env` 中的 `JWT_SECRET`、邀请码等配置建立新 `server/.env`，保留原密钥以兼容旧登录状态。参考 `.env.example` 设置新的数据库连接和容器内目录。
5. 在 1Panel 的服务器终端执行以下命令，安装 Linux 生产依赖并补齐数据库结构。先完成数据库恢复，且不要复制 Windows 的 `node_modules`。

```bash
docker run --rm --network 1panel-network \
  -v /opt/xiaoelong_home:/app -w /app \
  node:22.23.1-bookworm-slim npm ci --omit=dev

docker run --rm --network 1panel-network \
  --env-file /opt/xiaoelong_home/server/.env \
  -v /opt/xiaoelong_home:/app -w /app/server \
  node:22.23.1-bookworm-slim node dist/db/init.js
```

6. 在 1Panel → 容器 → 编排，用文件 `/opt/xiaoelong_home/compose.yaml` 创建 `xiaoelong_home`。内部网络必须与 MySQL 一致，示例为 `1panel-network`。
7. 临时 IP 连接需放行 TCP 3001（腾讯云防火墙和服务器防火墙）。MySQL 3306 不对公网开放。检查 `/health`、网页登录、历史消息、上传和双端实时聊天。

关键环境变量（密码、邀请码、JWT 密钥从实际配置填写）：

```dotenv
NODE_ENV=production
PORT=3001
CLIENT_ORIGIN=null,http://111.231.19.104,http://111.231.19.104:3001
DB_HOST=xiaoelong_home_mysql
DB_PORT=3306
DB_USER=xiaoelong_home
DB_NAME=xiaoelong_home
UPLOAD_ROOT=/app/xiaoelong_home
UPDATE_ROOT=/app/updates
WEB_ROOT=/app/web
TZ=Asia/Shanghai
```

## 更新

- 先备份数据库、`server/.env` 和 `xiaoelong_home` 上传目录。
- 停止应用容器，覆盖程序，保留环境文件、上传文件和 `updates`。依赖变更时重新执行 `npm ci --omit=dev`，再运行数据库初始化命令和启动容器。
- Windows：上传同版本安装包、`.blockmap`，最后上传 `latest.yml` 到 `updates`。
- Mac：通过 GitHub Actions 构建 universal DMG，发布到 `v2.2.2` Release 后，再上传相应 `latest-mac.json`。旧客户端内置旧 IP，可能需要先手动安装本版。
- 用 1Panel 查看容器日志、设置数据库及上传目录备份。保留每日题库已有数据，本次迁移不重复进行 AI 验证或解析。

## 备案后

配置域名解析和 OpenResty 反向代理，启用 HTTPS 与 WebSocket；再统一修改前端服务地址、Windows 更新地址、Mac 更新清单地址和 `CLIENT_ORIGIN`，重新构建发布客户端。确认 HTTPS 可用后收紧 3001 的公网入口。

旧 Windows 操作文档留存在仓库 `README-SERVER_old.md`，不适用于当前服务器。
