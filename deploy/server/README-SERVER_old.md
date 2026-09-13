# 小鳄龙服务器部署与更新说明

当前版本：`2.2.0`

本目录是小鳄龙 Windows 服务器部署包，适用于宝塔 Windows 面板和 MySQL 5.6。部署包已将需要使用的 MySQL `JSON` 字段改为 `TEXT`，以兼容 MySQL 5.6。

## 2.2.0 更新说明

- 聊天新增 `@所有人` 与 `@指定成员`，提及信息会随实时消息和历史记录一同返回。
- 每日一题改为从固定版本的 LogiQA 2.0、CMMLU 与程序化图形推理题库均衡抽取；DeepSeek 仅负责在维护阶段复核文本题标准答案并生成解析。
- 正式每日抽取按内容硬性排除全部历史题目；未出题库耗尽时返回 503，不重复旧题或生成备用题。
- 新增 `question_bank` 表，只有启用且已有解析的题目会进入每日抽取范围。
- `messages` 表新增 `mention_all` 与 `mentioned_user_ids` 字段；升级后必须执行一次 `db:init`。
- 本版本没有新增服务端依赖，从 `2.1.2` 升级可以跳过 `npm install`，但不能跳过数据库初始化和题库准备。
- 建议按“覆盖程序 → 执行 `db:init` → 导入题库 → 分批生成解析 → 启动新版服务端 → 发布桌面客户端”的顺序更新。

## 2.1.1 更新说明

- 服务端会为仍有效的旧版登录凭证返回当前版本 token，并在当前版 token 临近到期时自动续签。
- 客户端通过 Electron 主进程原子同步多窗口凭证；晚到的旧 `401` 不会清掉已经续签或切换后的会话。
- 聊天在 Socket 重连或网络恢复后会补拉并合并遗漏记录；补拉请求绑定当前会话，换账号时不会串入旧消息。
- 五子棋新增最后一手撤回：只有落子者能在对方回应前撤回，服务端通过 `last_undone_move_no` 阻止连续回退和反复撤回同一手。
- 五子棋与每日一题手动刷新时保留当前内容，并显示短暂且稳定的“刷新中…”提示，不再闪出整块加载状态。
- 五子棋胜利时棋盘本体保持固定，不再随结算特效缩放或位移。
- DeepSeek 每日题修正附图 JSON 结构提示，三次生成均使用 JSON Output 并按上一轮错误纠正；最后一次会强制生成无附图题。同一日期的并发请求只执行一次生成，避免重复调用和重复写入。
- 本版本没有新增依赖，从 `2.1.0` 升级可以跳过 `npm install`；但 `gomoku_games` 新增 `last_undone_move_no`，必须执行 `db:init`。覆盖程序后应按“执行 `db:init` → 启动新版服务端 → 发布桌面客户端”的顺序更新，同时保留原有 `JWT_SECRET`。
- 旧客户端可以继续使用新版服务端，但会忽略响应中的续签 token；只有新版客户端与新版服务端同时到位后才会自动保存续签结果。

## 2.1.0 更新说明

- 前端完成 Context + 三层组件架构重构，并补充前端测试和项目文档。
- Electron 升级到 `43.3.0`，Windows 与 macOS 客户端发布版本统一为 `2.1.0`。
- 服务器部署包改由仓库根目录的 `npm run server:deploy` 从最新源码构建和组装，不再维护重复的源码快照。
- 本版本相对 `2.0.1` 没有新增后端接口或数据库结构变更；仍可按第六节的标准更新步骤覆盖程序并执行初始化检查。

## 2.0.1 更新说明

- 聊天新增右键引用消息，引用关系会写入数据库，并在实时消息和历史记录中返回。
- `messages` 表新增 `reply_to_message_id` 字段、索引和自关联外键。从旧版升级时必须按第六节第 5 步重新执行数据库初始化脚本。
- Windows 客户端同时修复每日心情跨日刷新、图片查看器闪旧图，并优化设置面板和状态栏。
- 服务器程序和数据库升级完成后，再上传 Windows 自动更新产物；`2.0.1` 当次发布未覆盖 `updates/latest-mac.json`，macOS 当时保持 `2.0.0`。

## 2.0.0 更新说明

- 修复选择今日心情后透明桌宠窗口重新缩放导致的闪屏。
- 未保存显示偏好的用户默认使用“只显示形象”；已经明确选择过显示模式的用户继续沿用原设置。
- 本次没有后端接口或数据库结构变更。服务器已是 `1.3.3` 时无需重新安装依赖或初始化数据库；Windows 只需替换更新产物，Mac 只需在 GitHub Release 就绪后替换 `updates/latest-mac.json`。

## 1.3.3 更新说明

- 修复神选全屏界面中凡人、半神错误显示高阶能量翼，以及 Emoji 粒子退化为横排文字的问题。
- 神选视觉现在严格按等级启用：真神起显示漂浮粒子，主神和创世神显示能量翼，凡人和半神使用普通身份样式。
- 本次没有后端接口或数据库结构变更。服务器已是 `1.3.2` 时无需重新安装依赖或初始化数据库；发布 Mac 更新只需在 GitHub Release 就绪后替换 `updates/latest-mac.json`。

## 1.3.2 更新说明

- Mac 客户端新增版本检查：服务器提供 `latest-mac.json`，客户端发现新版本后会用默认浏览器打开本项目固定的 GitHub Release HTTPS 下载地址。
- Mac 仍是未签名测试版，下载后需要用户退出旧版、打开 DMG 并覆盖安装；`1.3.1` 用户必须先手动安装一次 `1.3.2`。
- 本版本没有新增后端接口或数据库结构；已有服务器仍建议按第六节的标准步骤覆盖程序、安装依赖并运行一次数据库初始化检查。

## 1.3.1 更新说明

- 神选页面恢复按服务器返回的真实神位显示，不再固定显示为创世神。
- 聊天消息在非当天时显示完整日期和时间。
- 如果服务器曾用于神选测试并且需要清空测试供奉记录，请按第六节第 6 步执行一次性重置。

## 1.3.0 更新说明

- 新增神选供奉后端接口和数据表。由旧版本升级时，必须按第六节第 5 步重新执行数据库初始化脚本。
- 修正五子棋结束事件的推送范围，确保对局双方都能收到最终状态。
- 更新时继续保留现有 `.env`、`uploads` 和 `updates`；不要直接用压缩包中的空目录替换服务器数据。

本文默认使用以下路径：

```text
C:\wwwroot\server
C:\BtSoft\nodejs\v22.23.1\node.exe
C:\BtSoft\nodejs\v22.23.1\npm.cmd
```

项目开发、打包和服务器运行统一使用 Node.js `22.23.1`，允许范围为 `>=22.22.2 <23`。如果宝塔中的 Node.js 路径不同，需要先确认版本仍在该范围内，再把本文命令和计划任务中的绝对路径改成实际目录。

## 生成服务器部署包（仓库维护者）

在仓库根目录使用 Node.js `22.23.1` 执行：

```powershell
npm.cmd run server:deploy
```

命令会先只清理 `server/dist` 和 `shared/dist`，重新构建后生成：

```text
deploy\XiaoELong-server-2.2.0.zip
```

Windows 使用系统自带的 PowerShell/.NET 完成压缩，不需要安装额外的 `zip` 工具；macOS/Linux 需要系统提供 `zip` 命令。脚本先生成同目录临时 ZIP，成功后才替换正式 ZIP，失败时保留上一份正式包。常规 `npm run clean` 不会删除 `deploy` 下已有的部署 ZIP。

## 一、首次部署前的准备

### 1. 上传并解压服务器部署包

将服务器部署压缩包上传到：

```text
C:\wwwroot\server
```

解压后应能看到以下内容：

```text
C:\wwwroot\server\package.json
C:\wwwroot\server\server
C:\wwwroot\server\shared
C:\wwwroot\server\updates
```

不要再多套一层同名目录，否则后续绝对路径需要相应修改。

### 2. 确认 Node.js 的绝对路径

宝塔的 Node.js 版本管理器可能没有把 Node.js 加入系统 `PATH`，因此直接执行 `node` 或 `npm.cmd` 可能提示找不到命令。不要修改 `npmrc` 来解决这个问题，直接使用绝对路径即可。

在 PowerShell 中检查：

```powershell
& "C:\BtSoft\nodejs\v22.23.1\node.exe" --version
& "C:\BtSoft\nodejs\v22.23.1\npm.cmd" --version
```

宝塔终端重新打开后可能默认是 CMD。本文命令应在 PowerShell 中执行，提示符应以 `PS` 开头；如果当前是 CMD，先执行：

```cmd
powershell
```

### 3. 安装生产依赖

进入部署包根目录，并使用 npm 的绝对路径安装依赖：

```powershell
Set-Location "C:\wwwroot\server"
& "C:\BtSoft\nodejs\v22.23.1\npm.cmd" install --omit=dev
```

## 二、设置环境变量

### 1. 创建环境文件

```powershell
Copy-Item "C:\wwwroot\server\server\.env.example" "C:\wwwroot\server\server\.env" -Force
notepad "C:\wwwroot\server\server\.env"
```

建议至少确认以下内容：

```env
NODE_ENV=production
PORT=3001
CLIENT_ORIGIN=null,http://43.139.223.204,http://43.139.223.204:3001

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=XiaoELong

INVITE_CODE=your_invite_code
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=30d

UPLOAD_ROOT=C:\wwwroot\server\uploads
UPDATE_ROOT=C:\wwwroot\server\updates

DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
QUESTION_CRON=0 8 * * *
QUESTION_TIMEZONE=Asia/Shanghai
```

各项用途：

- `CLIENT_ORIGIN`：允许桌面客户端和指定网页来源访问服务器。Electron 客户端需要保留 `null`。
- `DB_PASSWORD`：MySQL 用户密码。
- `INVITE_CODE`：新用户注册时使用的邀请码。
- `JWT_SECRET`：登录令牌签名密钥，部署后不要随意更换，否则现有登录状态会失效。
- `JWT_EXPIRES_IN`：新签发和自动续签后的登录凭证有效期，必须带明确单位，例如 `30d` 或 `10y`。修改后需要重启服务；不要写裸数字（例如 `3600` 会按毫秒解释）。
- `UPLOAD_ROOT`：头像、聊天图片和文件的保存目录，更新时不得删除。
- `UPDATE_ROOT`：桌面客户端自动更新文件目录。
- `DEEPSEEK_API_KEY`：DeepSeek 密钥，仅用于题库解析维护命令，不再用于在线生成题目。
- `QUESTION_CRON`：每日题目抽取时间，默认每天北京时间 08:00。

生成随机 `JWT_SECRET`：

```powershell
& "C:\BtSoft\nodejs\v22.23.1\node.exe" -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

将输出结果填入 `.env` 的 `JWT_SECRET`，不要把真实密钥提交到代码仓库或发送给其他人。

### 登录凭证有效期与自动续签

服务端只会续签仍然有效、且账号仍存在的 JWT；已经过期、签名无效或账号已删除的凭证仍会返回 `401`，不会被自动恢复。

- 没有续签版本标记的旧凭证，会在新版客户端下一次调用 `GET /api/auth/me` 时立即按当前 `JWT_EXPIRES_IN` 重新签发。
- 新版凭证至多提前 7 天续签，短期凭证按有效期比例提前。桌面程序常驻运行时会在到期前自动检查，无需每天重启。
- 修改 `JWT_EXPIRES_IN` 不会直接改写已经发出去的 JWT；要部署同时包含续签功能的新服务端和新客户端后，旧有效凭证才会被替换。
- 多窗口桌面端会通过主进程原子替换并广播新凭证，避免旧窗口覆盖新会话。
- 必须保持 `JWT_SECRET` 不变；更换密钥会让所有尚未过期的旧凭证立即失效。

如果希望续签后的登录状态长期有效，可以在生产 `.env` 中设置：

```env
JWT_EXPIRES_IN=10y
```

`10y` 是长期 Bearer 凭证：一旦 token 被复制，在服务端没有独立撤销列表的情况下，持有者可在有效期内冒用账号。当前部署若仍使用 HTTP，更应严格保护服务器、客户端用户目录和日志；不要把 token 发给他人。若不接受这个风险，保留默认 `30d` 即可，活跃客户端仍会自动续签。

修改后重启计划任务。自动续签本身不修改数据库结构，也不需要为续签功能单独执行 `db:init`；但从 `2.1.0` 升级完整的 `2.1.1` 仍必须执行数据库初始化，以添加五子棋撤回字段。

## 三、初始化数据库

数据库初始化脚本必须从服务器程序目录运行，因为它需要读取该目录下的 `.env` 和 `src\db\init.sql`。

```powershell
Set-Location "C:\wwwroot\server\server"
& "C:\BtSoft\nodejs\v22.23.1\node.exe" ".\dist\db\init.js"
```

成功时会显示：

```text
Database initialized successfully.
```

脚本会在不存在时创建数据库和数据表，也可以在后续服务器更新后再次执行。仅出现 npm 的脚本名称不代表初始化成功，必须看到上面的成功提示。

## 四、首次前台启动与公网验证

先以前台方式启动一次，便于直接查看错误：

```powershell
Set-Location "C:\wwwroot\server\server"
& "C:\BtSoft\nodejs\v22.23.1\node.exe" ".\dist\index.js"
```

成功时会显示：

```text
Server listening on http://localhost:3001
```

本机检查：

```powershell
Invoke-RestMethod "http://127.0.0.1:3001/health"
```

公网检查：

```text
http://43.139.223.204:3001/health
```

正常返回：

```json
{"ok":true}
```

如果本机可以访问而公网不能访问，需要在云服务器安全组和 Windows 防火墙中放行 TCP 端口 `3001`。

宝塔网页终端有时只会显示 `^C`，却不会真正向 Node.js 进程发送中断信号。遇到这种情况，可以关闭当前终端并重新打开 PowerShell，然后查询并停止对应进程：

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*dist\index.js*" } | Select-Object ProcessId, CommandLine
```

确认命令行属于小鳄龙服务器后，按实际进程号停止：

```powershell
Stop-Process -Id 进程号 -Force
```

不要直接停止所有 `node.exe`，以免影响服务器上的其他 Node.js 程序。

## 五、设置开机自启和异常重启

宝塔 Windows 没有 Node 项目管理器时，可以使用 Windows 计划任务托管服务器。以下命令需要在管理员 PowerShell 中执行，建议每次只粘贴一行。

计划任务中的工作目录必须是 `C:\wwwroot\server\server`，否则程序可能读不到 `.env`，上传目录和更新目录也可能发生偏移。

```powershell
$Action = New-ScheduledTaskAction -Execute "C:\BtSoft\nodejs\v22.23.1\node.exe" -Argument ".\dist\index.js" -WorkingDirectory "C:\wwwroot\server\server"
```

```powershell
$Trigger = New-ScheduledTaskTrigger -AtStartup
```

```powershell
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
```

```powershell
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
```

```powershell
Register-ScheduledTask -TaskName "XiaoELongServer" -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "XiaoELong 2.2.0 server" -Force
```

启动计划任务：

```powershell
Start-ScheduledTask -TaskName "XiaoELongServer"
```

查看运行状态：

```powershell
Get-ScheduledTask -TaskName "XiaoELongServer" | Select-Object TaskName, State
```

长时间运行的服务器正常应显示 `Running`。也可以查看计划任务的最近运行信息：

```powershell
Get-ScheduledTaskInfo -TaskName "XiaoELongServer"
```

停止服务器：

```powershell
Stop-ScheduledTask -TaskName "XiaoELongServer"
```

重启服务器：

```powershell
Stop-ScheduledTask -TaskName "XiaoELongServer"
Start-ScheduledTask -TaskName "XiaoELongServer"
```

计划任务启动的 Node.js 不属于当前 PowerShell 窗口，因此不能使用 `Ctrl+C` 停止，必须使用 `Stop-ScheduledTask`。

## 六、后续更新服务器程序

服务器程序更新和桌面客户端自动更新是两件不同的事。本节用于更新后端程序。

从 `2.1.2` 升级到 `2.2.0` 时没有依赖变化，可以跳过本节第 4 步；但聊天提及新增数据库字段，必须执行第 5 步。更早版本或依赖状态无法确认时，按完整流程执行。

### 1. 更新前备份

至少备份以下内容：

```text
C:\wwwroot\server\server\.env
C:\wwwroot\server\uploads
```

同时建议通过宝塔数据库工具备份 `XiaoELong` 数据库。不要把 `.env`、上传目录或数据库当作普通程序文件覆盖或删除。

### 2. 停止服务器

```powershell
Stop-ScheduledTask -TaskName "XiaoELongServer"
```

确认服务已经停止：

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*dist\index.js*" } | Select-Object ProcessId, CommandLine
```

### 3. 覆盖新程序文件

将新版本服务器部署包上传并解压到：

```text
C:\wwwroot\server
```

覆盖程序文件，但保留原有的：

```text
C:\wwwroot\server\server\.env
C:\wwwroot\server\uploads
C:\wwwroot\server\updates
```

### 4. 重新安装依赖

从 `2.1.2` 升级到 `2.2.0` 可以跳过本步骤；从更早版本升级或依赖状态无法确认时再执行。

```powershell
Set-Location "C:\wwwroot\server"
& "C:\BtSoft\nodejs\v22.23.1\npm.cmd" install --omit=dev
```

### 5. 更新数据库结构

升级到 `2.2.0` 必须运行本步骤。脚本会幂等添加 `messages.mention_all` 与 `messages.mentioned_user_ids`，并补齐更早版本所需字段；已有聊天、对局和落子记录会保留，重复执行不会重复添加字段。

```powershell
Set-Location "C:\wwwroot\server\server"
& "C:\BtSoft\nodejs\v22.23.1\node.exe" ".\dist\db\init.js"
```

确认出现：

```text
Database initialized successfully.
```

### 6. 仅测试服：重置神选累计

只有在确认 `deity_worships` 中都是可以删除的测试记录时才执行本步骤。清理会将所有神位恢复为凡人，同时清除所有用户的“今日已膜拜”状态；不会影响账号、聊天、心情、每日题目或五子棋数据。

先通过宝塔数据库工具备份 `XiaoELong` 数据库，再查看待清理数据：

```sql
USE XiaoELong;

SELECT deity_id, COUNT(*) AS total_worships
FROM deity_worships
GROUP BY deity_id;
```

确认后开启事务并清理：

```sql
START TRANSACTION;

DELETE FROM deity_worships;

SELECT ROW_COUNT() AS deleted_rows;
SELECT COUNT(*) AS remaining_rows FROM deity_worships;
```

确认 `remaining_rows` 为 `0` 后执行：

```sql
COMMIT;
```

如果结果不符合预期，则执行：

```sql
ROLLBACK;
```

不要使用 `TRUNCATE`，也不要把清理语句写入 `src\db\init.sql`。

### 7. 重新启动并验证

```powershell
Start-ScheduledTask -TaskName "XiaoELongServer"
```

```powershell
Get-ScheduledTask -TaskName "XiaoELongServer" | Select-Object TaskName, State
```

```powershell
Invoke-RestMethod "http://127.0.0.1:3001/health"
```

最后再通过公网地址验证，并实际测试登录、聊天、每日题目刷新，以及五子棋刷新、落子和撤回。确认新版服务端和数据库迁移正常后，再发布桌面客户端更新。

如果更换了 Node.js 版本或服务器目录，需要重新执行第五节中的计划任务注册命令，更新其可执行文件路径和工作目录。

## 七、发布桌面客户端更新

服务器从以下目录公开客户端更新文件：

```text
C:\wwwroot\server\updates
```

### 1. Windows 自动更新

在本地完成新版本打包后，将 `release` 目录中的以下三个 Windows 文件一起上传到该目录：

```text
latest.yml
XiaoELong Setup x.y.z.exe
XiaoELong Setup x.y.z.exe.blockmap
```

上传时必须保持文件名不变，并确保 `latest.yml`、安装包和 `blockmap` 属于同一个版本。建议先上传安装包和 `blockmap`，最后覆盖 `latest.yml`，避免客户端在上传过程中读取到尚未完整上传的新版本。

Windows 自动更新清单地址：

```text
http://43.139.223.204:3001/updates/latest.yml
```

可以直接在浏览器中打开该地址，确认其中的版本号和文件名正确。静态更新文件替换后通常不需要重启服务器。

手动把安装程序发给朋友时，只需要发送：

```text
XiaoELong Setup x.y.z.exe
```

`latest.yml` 和 `blockmap` 只供自动更新服务使用，不需要发送给普通用户。客户端只会更新到比当前版本更高的版本，因此不能用同一个版本号验证自动更新。

### 2. macOS 2.2.0 检查更新并下载 DMG

Mac 版从 `1.3.2` 开始读取服务器上的：

```text
C:\wwwroot\server\updates\latest-mac.json
```

发布顺序如下：

1. 在 GitHub 创建标签为 `v2.2.0` 的 Release，并上传 Actions 产物中的 `XiaoELong-2.2.0-mac-universal.dmg`。
2. 在浏览器中确认下面的 GitHub HTTPS 地址能开始下载，并核对 DMG 的大小与 `SHA256-mac.txt`：

```text
https://github.com/sheephjc/XiaoELong/releases/download/v2.2.0/XiaoELong-2.2.0-mac-universal.dmg
```

3. 最后把同一次 Actions 产物中的 `latest-mac.json` 上传到服务器的 `updates` 目录，覆盖旧清单。
4. 打开下面的清单地址，确认 `version`、`fileName`、`size` 和 `sha256` 都属于本次 DMG：

```text
http://43.139.223.204:3001/updates/latest-mac.json
```

Mac 客户端只从清单读取版本和发布校验信息，实际打开的下载地址由客户端固定构造为本项目的 GitHub Release HTTPS 地址，清单不能将用户重定向到其他站点。`latest-mac.yml` 和 Mac ZIP 不需要上传到服务器。

静态清单替换后通常不需要重启后端。已经安装 `1.3.2` 或更高版本的用户会看到 `2.2.0` 更新提示；`1.3.1` 没有这段逻辑，需要直接发送 `2.2.0` DMG。

Mac 用户下载后需要完全退出旧版 XiaoELong，打开 DMG，把应用拖入“应用程序”并选择替换。未签名测试版首次打开时，可能还需在 Finder 中右键选择“打开”，或在“系统设置 → 隐私与安全性”中允许运行。若用户无法访问 GitHub，可以直接把 DMG 文件发给他。

## 八、常用检查与故障排查

### 查看小鳄龙 Node.js 进程

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*dist\index.js*" } | Select-Object ProcessId, CommandLine
```

### 查看端口占用

```powershell
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State, OwningProcess
```

### 检查本机健康状态

```powershell
Invoke-RestMethod "http://127.0.0.1:3001/health"
```

### 计划任务显示 `Ready`

对于长期运行的 Node.js 服务，启动后通常应显示 `Running`。如果显示 `Ready` 且健康检查失败，查看最近运行结果：

```powershell
Get-ScheduledTaskInfo -TaskName "XiaoELongServer" | Format-List *
```

常见原因包括 Node.js 绝对路径错误、工作目录错误、`.env` 缺失或数据库连接失败。可以先按第四节以前台方式启动，以便直接看到具体报错。

### 在服务器终端删除账号

优先让用户在客户端设置中使用“注销账号”；只有无法通过客户端操作时，才直接从数据库删除。删除账号不可撤销，并会通过外键级联删除该用户的聊天消息、每日答题、每日心情、神选记录以及相关五子棋对局和落子。其他用户消息中指向已删除消息的引用会被置空。

开始前先通过宝塔数据库工具备份 `XiaoELong` 数据库。昵称不唯一，必须先查询并核对完整的用户 UUID，不能直接按昵称删除。以下流程不进入交互式 MySQL，也不使用 `-p`，可避免宝塔终端无法正确隐藏密码输入的问题。

先停止服务器：

```powershell
Stop-ScheduledTask -TaskName "XiaoELongServer"
Set-Location 'C:\BtSoft\mysql\MySQL5.5\bin'

$DbLine = Get-Content -LiteralPath 'C:\wwwroot\server\server\.env' | Where-Object { $_ -match '^\s*DB_PASSWORD\s*=' } | Select-Object -First 1

$env:MYSQL_PWD = (($DbLine -replace '^\s*DB_PASSWORD\s*=\s*', '').Trim()).Trim('"').Trim("'")
```

列出账号并复制目标账号的完整 `id`：

```powershell
.\mysql.exe -h 127.0.0.1 -P 3306 -u root -D XiaoELong --default-character-set=utf8mb4 -e "SELECT id,nickname,avatar_url,created_at FROM users ORDER BY created_at DESC;"
```

把目标 UUID 填入 `$UserId`，并再次查询确认。格式检查可以避免误把昵称或不完整的 ID 当成删除条件：

```powershell
$UserId = '这里粘贴完整UUID'

.\mysql.exe -h 127.0.0.1 -P 3306 -u root -D XiaoELong --default-character-set=utf8mb4 -e "SELECT id,nickname,avatar_url,created_at FROM users WHERE id='$UserId';"
```

只有确认上一步显示的是目标账号后，才执行删除：

```powershell
.\mysql.exe -h 127.0.0.1 -P 3306 -u root -D XiaoELong --default-character-set=utf8mb4 -e "START TRANSACTION; DELETE FROM users WHERE id='$UserId'; SELECT ROW_COUNT() AS deleted_users; COMMIT;"
```

输出中的 `deleted_users` 必须为 `1`。完成后清除当前 PowerShell 会话中的临时密码变量，并重新启动服务器：

```powershell
Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
$DbLine = $null
Start-ScheduledTask -TaskName "XiaoELongServer"
```

直接执行 SQL 只会删除数据库记录，不会自动删除 `uploads` 目录中的头像、聊天图片和附件文件；不要为清理单个账号而删除整个 `uploads` 目录。通过客户端“注销账号”时，服务端还会删除该用户当前头像并主动断开其在线连接。

### 在终端查看当前每日题目来源

在宝塔终端或服务器 PowerShell 中逐行执行：

```powershell
$MysqlExe = (Get-ChildItem -LiteralPath 'C:\BtSoft\mysql' -Filter 'mysql.exe' -File -Recurse | Select-Object -First 1).FullName

$MysqlExe

$Sql = 'SELECT `date`, source_type, source_context, created_at FROM daily_questions ORDER BY `date` DESC LIMIT 1;'

$DbLine = Get-Content -LiteralPath 'C:\wwwroot\server\server\.env' | Where-Object { $_ -match '^\s*DB_PASSWORD\s*=' } | Select-Object -First 1

if (-not $DbLine) { throw 'DB_PASSWORD not found in .env' }
$env:MYSQL_PWD = (($DbLine -replace '^\s*DB_PASSWORD\s*=\s*', '').Trim()).Trim('"').Trim("'")

try { & "$MysqlExe" -h 127.0.0.1 -P 3306 -u root -D XiaoELong -e $Sql } finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue; $DbLine = $null }
```

### 导入并准备每日题库

执行 `db:init` 后，在服务器部署根目录运行固定版本题库导入：

```powershell
Set-Location "C:\wwwroot\server\server"
& "C:\BtSoft\nodejs\v22.23.1\node.exe" ".\dist\scripts\question-bank-import.js"
```

导入完成后，分批复核答案并生成解析。默认处理 20 道，建议首次准备至少 365 道；命令会逐题调用 DeepSeek，耗时和费用随数量增加：

```powershell
& "C:\BtSoft\nodejs\v22.23.1\node.exe" ".\dist\scripts\question-bank-explain.js" --limit=365
```

若要只处理某个来源，可增加 `--source=logiqa2`、`--source=cmmlu` 或 `--source=raven_style`。图形题自带确定性规则解析，无需执行 AI 解析命令。审核发现文本题答案不唯一、标准答案可疑或知识过时的题会自动停用。重复运行导入不会清除内容未变化题目的已有解析；数据源题目内容发生变化时，其旧解析会自动失效并等待重新审核。

如果每日题接口返回 503 并提示题库中的未出题目已经用完，表示所有已复核题目都曾作为每日题出现。正式流程会按内容指纹和历史题面硬性去重，不会重复旧题或生成备用题；导入并解析新题后，下一次创建每日题即可恢复。已经写入 `daily_questions` 的当天题目不会自动替换。

题库来源、固定版本和非商业许可见部署包中的 `QUESTION-BANK-SOURCES.md`。

### DeepSeek 独立诊断

诊断脚本不会写入数据库，也不会输出 API Key。它会检查鉴权、模型列表，并为一道固定样题生成解析进行结构校验：

```powershell
Set-Location "C:\wwwroot\server\server"
& "C:\BtSoft\nodejs\v22.23.1\node.exe" ".\dist\scripts\deepseek-check.js"
```

成功时会显示：

```text
[DeepSeekCheck] Authentication succeeded.
[DeepSeekCheck] Explanation review passed schema validation.
```

常见结果：

- `DEEPSEEK_API_KEY is not configured`：`.env` 中没有填写密钥。
- `401`：密钥无效或请求头中的密钥不是有效的 `sk-...` API Key。
- `402`：DeepSeek 账户余额不足。
- `429`：请求频率受限，应稍后重试。
- `timed out`、`ECONNRESET`：服务器到 DeepSeek 的网络或 TLS 连接异常。

修改 `.env` 后需要重启计划任务：

```powershell
Stop-ScheduledTask -TaskName "XiaoELongServer"
Start-ScheduledTask -TaskName "XiaoELongServer"
```

### npm 可以运行但脚本提示找不到 node

这是因为 npm 自身通过绝对路径启动成功，但 `package.json` 脚本内部执行的裸 `node` 没有出现在系统 `PATH` 中。数据库初始化和服务器启动应直接使用本文给出的 `node.exe` 绝对路径，不要改用：

```powershell
npm.cmd run db:init
npm.cmd run start
```
