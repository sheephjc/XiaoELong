# 小鳄龙之家服务器部署

版本：**2.2.3**。环境：Ubuntu 22.04 + 1Panel，Node.js 22.23.1，MySQL 8.0。

桌面客户端、API 和自动更新仍使用 `http://111.231.19.104:3001`。`https://xiaoelong.cn/pet` 仅承载发布页，域名不转发其他客户端接口。

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
2. 本地运行 `npm run server:deploy`，上传 `deploy/XiaoELong-server-2.2.3.zip`，解压至 `/opt/xiaoelong_home`。根目录应直接包含 `package.json`、`server`、`shared`、`web`、`compose.yaml`。
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

以下以更新到 **2.2.3** 为例，实际操作时替换成要发布的版本。后端和网页在同一个部署包中；桌面安装包及更新清单另外发布。仅修改本地源码不会更新线上服务。

### 1. 准备新版本并上传

在本机项目根目录执行 `npm run server:deploy`，生成 `deploy/XiaoELong-server-2.2.3.zip`。这个命令会构建前后端并清理旧构建产物，桌面安装包应在需要发布时另外构建。

在 1Panel → 系统 → 文件，将部署包上传并解压到独立目录，例如 `/opt/xiaoelong_home-update/2.2.3`。确认这一层直接包含 `server`、`shared`、`web`、`package.json`、`package-lock.json`，不要出现多套一层目录的情况。先在临时目录解压，不直接覆盖正在运行的程序。

确认新包版本、发布说明和数据库变更，再开始停机。若本次只更新后端，不需要重新上传桌面安装包；若客户端连接地址或界面有变化，则需要发布对应客户端版本。

### 2. 停止应用并备份

在 1Panel → 容器，停止 **`xiaoelong_home`**，MySQL 容器保持运行。应用停止期间客户端会断开，避免备份过程中继续产生消息和上传文件。也可以在 1Panel 服务器终端执行：

```bash
docker stop xiaoelong_home

BACKUP_DIR="/opt/xiaoelong_home-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

docker exec xiaoelong_home_mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 xiaoelong_home' \
  > "$BACKUP_DIR/xiaoelong_home.sql"

tar -czf "$BACKUP_DIR/application.tar.gz" -C /opt xiaoelong_home
chmod 600 "$BACKUP_DIR/xiaoelong_home.sql" "$BACKUP_DIR/application.tar.gz"
```

数据库导出命令必须成功，SQL 文件不能是空文件；应用归档必须生成成功，再进行替换。应用归档包含旧程序、Linux 依赖、`server/.env`、上传文件和客户端更新文件，因此可能较大。备份目录放在程序目录之外，绝不能放到 `web` 或 `updates`。记录本次备份路径，并通过 1Panel 下载备份到本机。

以上命令使用当前 1Panel MySQL 容器的 `MYSQL_ROOT_PASSWORD` 环境变量，不需要把密码写进命令。如果容器名称或密码配置方式变更，应先调整备份命令。

### 3. 替换程序，保留线上数据

需要替换的是 `server/dist`、`shared/dist`、`web` 及对应的依赖清单。必须保留：

- `server/.env`：实际数据库密码、JWT 密钥、邀请码等；新包的 `.env.example` 只是参考，不能覆盖它。
- `xiaoelong_home/`：真实头像、聊天图片及附件。
- `updates/`：现有桌面安装包和更新清单。

可在 1Panel 文件管理器中完成，也可继续在同一个服务器终端执行下列命令。`BACKUP_DIR` 应为上一步创建的路径；若终端重开，需要重新填写它。

```bash
APP_DIR=/opt/xiaoelong_home
NEW_DIR=/opt/xiaoelong_home-update/2.2.3
mkdir -p "$BACKUP_DIR/replaced/server" "$BACKUP_DIR/replaced/shared"

mv "$APP_DIR/server/dist" "$BACKUP_DIR/replaced/server/dist"
mv "$APP_DIR/shared/dist" "$BACKUP_DIR/replaced/shared/dist"
mv "$APP_DIR/web" "$BACKUP_DIR/replaced/web"

cp -a "$NEW_DIR/server/dist" "$APP_DIR/server/"
cp -a "$NEW_DIR/shared/dist" "$APP_DIR/shared/"
cp -a "$NEW_DIR/web" "$APP_DIR/"
cp "$NEW_DIR/package.json" "$NEW_DIR/package-lock.json" "$APP_DIR/"
cp "$NEW_DIR/server/package.json" "$APP_DIR/server/"
cp "$NEW_DIR/shared/package.json" "$APP_DIR/shared/"
cp "$NEW_DIR/readme-server.md" "$APP_DIR/"
```

移动旧构建目录后再放入新目录，可以避免已经删除的旧代码仍残留在线上。每一步成功后再继续；替换失败时保持应用停止，先恢复旧版本。

`compose.yaml` 和 `.env` 只有在发布说明要求修改时才调整，修改前核对端口、路径、网络和镜像版本。保持原 `JWT_SECRET`，避免现有用户登录状态失效。不要复制本机 Windows 的 `node_modules`。

### 4. 安装依赖并更新数据库结构

每次更新都按新锁文件安装 Linux 生产依赖，防止旧依赖或安全漏洞随旧 `node_modules` 留在服务器：

```bash
docker run --rm --network 1panel-network \
  -v /opt/xiaoelong_home:/app -w /app \
  node:22.23.1-bookworm-slim npm ci --omit=dev
```

安装成功后执行数据库初始化，以补齐该版本需要的结构。它不是导入备份，也不是重新导入题库：

```bash
docker run --rm --network 1panel-network \
  --env-file /opt/xiaoelong_home/server/.env \
  -v /opt/xiaoelong_home:/app -w /app/server \
  node:22.23.1-bookworm-slim node dist/db/init.js
```

如果新版本更换了 Node 镜像，两条命令应与 `compose.yaml` 使用相同版本。依赖安装或数据库更新失败时不要启动新版本，先查看错误。已有用户、消息和每日题库数据继续保留，不需要重复 AI 验证或解析。

### 5. 启动与检查

仅替换程序和依赖时，在 1Panel 启动 `xiaoelong_home`，或执行 `docker start xiaoelong_home`。如果修改了 `.env`、镜像或编排配置，应在 1Panel 的 `xiaoelong_home` 编排中重新创建应用容器，使配置重新加载；普通重启不会重新读取 `env_file`。

先在 1Panel 查看容器日志，确认没有数据库连接、缺少模块或启动异常，再检查：

1. `http://111.231.19.104:3001/health` 返回成功，容器健康状态正常。
2. 网页能打开，已有用户能登录，历史消息和头像能显示。
3. 上传图片与附件可用，两个客户端之间的实时聊天正常。
4. 有客户端更新时，对应更新清单及安装包下载可用。

不要只凭容器状态“运行中”判断更新成功。网页有旧缓存时刷新页面；桌面内嵌的界面需要安装新版客户端才能更新。

### 6. 发布桌面客户端更新

**Windows：** 将同版本安装包和 `.blockmap` 上传至 `/opt/xiaoelong_home/updates`，文件名必须与构建生成的 `latest.yml` 完全一致。确认安装包上传完整、能通过 `/updates/文件名` 下载后，**最后替换 `latest.yml`**。不要手动改清单中的版本、文件大小或校验值。保留上一版安装包和清单备份，避免上传到一半就通知客户端更新。

**Mac：** 通过 GitHub Actions 构建 Universal DMG，先将安装包正式发布到对应的 `v2.2.3` GitHub Release。确认公开下载链接可用后，再将构建生成的 `latest-mac.json` 上传至服务器 `updates`。清单中的版本、文件名、大小及 SHA256 必须对应实际 DMG；GitHub 草稿的附件尚不能作为公开更新下载来源。

后端部署包不包含桌面新版安装包。旧客户端若内置旧服务器 IP，无法从新服务器检查更新，需要先手动安装能连接新服务器的版本。

### 7. 更新失败时回滚

1. 停止 `xiaoelong_home`，保留错误日志和失败版本的文件，MySQL 保持运行。
2. 在独立临时目录解压本次备份的 `application.tar.gz`，按上面的替换方式恢复旧 `server/dist`、`shared/dist`、`web` 和各份 `package.json`、`package-lock.json`，再按旧锁文件安装 Linux 生产依赖。也可使用归档中的旧 Linux `node_modules`，前提是 Node 镜像与备份时一致。
3. 若本次改过 `.env` 或 `compose.yaml`，恢复备份配置并通过 1Panel 重新创建应用容器。没有改过时保留当前配置。
4. 数据库结构若仍兼容旧程序，通常只需回滚程序。只有确认必须恢复数据库时才使用 SQL 备份；恢复会丢失备份之后的新数据，应先另外备份当前数据库，并按该版本的迁移说明操作，不要直接向已有表重复导入 SQL。
5. 如已发布客户端更新，恢复服务器上旧的更新清单。已经安装新版的客户端不会因此自动降级，需另行提供兼容修复版本。
6. 启动旧应用并重新检查健康接口、登录、历史消息及上传。保留此次备份，直到确认服务稳定。

平时可在 1Panel 设置数据库和上传目录的定期备份；更新前仍应做一次单独备份。

## `/pet` 发布页

`xiaoelong.cn` 的现有网站继续保留首页和其他页面。桌面组件只在 `/pet` 增加一个静态发布页，不需要为 API、WebSocket、上传或更新配置域名反向代理。桌面程序继续连接 `http://111.231.19.104:3001`；发布页的 Windows、macOS 下载按钮指向 GitHub Release 的 HTTPS 文件。

本机运行 `npm run pet:deploy`，生成 `deploy/XiaoELong-pet-2.2.3.zip`。压缩包顶层是 `pet/`，其中包含 `index.html` 和 `assets/`，资源路径已固定为 `/pet/assets/...`。在 1Panel 中核对 `xiaoelong.cn` 网站的实际根目录，将压缩包上传到该目录并解压；若已有 `pet/`，先备份再替换。不要把这个压缩包解压到 `/opt/xiaoelong_home` 或覆盖网站首页。

访问 `https://xiaoelong.cn/pet` 检查页面是否正常显示，并确认两个下载按钮能打开对应的 2.2.3 Release 文件。若网站的静态目录不自动把 `/pet` 重定向到 `/pet/`，只需为 `/pet` 增加一个指向 `/pet/` 的 301 规则；无需增加其他反向代理。

以后若决定让桌面客户端也改走 HTTPS，再单独配置 API、WebSocket、上传和更新路径的反向代理，修改前端与客户端地址并重新构建发布。

旧 Windows 操作文档留存在仓库 `README-SERVER_old.md`，不适用于当前服务器。
