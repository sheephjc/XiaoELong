# 小鳄龙服务器部署与更新说明

当前版本：`1.3.3`

本目录是小鳄龙 Windows 服务器部署包，适用于宝塔 Windows 面板和 MySQL 5.6。部署包已将需要使用的 MySQL `JSON` 字段改为 `TEXT`，以兼容 MySQL 5.6。

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

如果以后在宝塔中更换了 Node.js 版本，需要把本文命令和计划任务中的 `v22.23.1` 改成实际版本目录。

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
- `UPLOAD_ROOT`：头像、聊天图片和文件的保存目录，更新时不得删除。
- `UPDATE_ROOT`：桌面客户端自动更新文件目录。
- `DEEPSEEK_API_KEY`：DeepSeek 密钥。为空或调用失败时，每日题目会使用本地备用题库。
- `QUESTION_CRON`：每日题目生成时间，默认每天北京时间 08:00。

生成随机 `JWT_SECRET`：

```powershell
& "C:\BtSoft\nodejs\v22.23.1\node.exe" -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

将输出结果填入 `.env` 的 `JWT_SECRET`，不要把真实密钥提交到代码仓库或发送给其他人。

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
Register-ScheduledTask -TaskName "XiaoELongServer" -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "XiaoELong 1.3.3 server" -Force
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

```powershell
Set-Location "C:\wwwroot\server"
& "C:\BtSoft\nodejs\v22.23.1\npm.cmd" install --omit=dev
```

### 5. 更新数据库结构

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

最后再通过公网地址验证，并实际测试登录、聊天、每日题目和五子棋。

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

### 2. Mac 检查更新并下载 DMG

Mac 版从 `1.3.2` 开始读取服务器上的：

```text
C:\wwwroot\server\updates\latest-mac.json
```

发布顺序如下：

1. 在 GitHub 创建标签为 `v1.3.3` 的 Release，并上传 Actions 产物中的 `XiaoELong-1.3.3-mac-universal.dmg`。
2. 在浏览器中确认下面的 GitHub HTTPS 地址能开始下载，并核对 DMG 的大小与 `SHA256-mac.txt`：

```text
https://github.com/sheephjc/XiaoELong/releases/download/v1.3.3/XiaoELong-1.3.3-mac-universal.dmg
```

3. 最后把同一次 Actions 产物中的 `latest-mac.json` 上传到服务器的 `updates` 目录，覆盖旧清单。
4. 打开下面的清单地址，确认 `version`、`fileName`、`size` 和 `sha256` 都属于本次 DMG：

```text
http://43.139.223.204:3001/updates/latest-mac.json
```

Mac 客户端只从清单读取版本和发布校验信息，实际打开的下载地址由客户端固定构造为本项目的 GitHub Release HTTPS 地址，清单不能将用户重定向到其他站点。`latest-mac.yml` 和 Mac ZIP 不需要上传到服务器。

静态清单替换后通常不需要重启后端。已经安装 `1.3.2` 的用户会看到 `1.3.3` 更新提示；`1.3.1` 没有这段逻辑，需要直接发送 `1.3.3` DMG。

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

### 每日题目显示备用题库

如果日志中出现以下内容，表示服务正常启动，但当天题目没有由 DeepSeek 成功生成：

```text
[DailyQuestion] ensured 2026-07-13 (fallback).
```

应检查 `.env` 中的 `DEEPSEEK_API_KEY`、服务器到 `https://api.deepseek.com` 的网络连接以及账户额度。修复后，已经写入数据库的当天备用题不会自动替换；下一道新题会重新尝试使用 DeepSeek。

### DeepSeek 独立诊断

诊断脚本不会写入数据库，也不会输出 API Key。它会检查鉴权、模型列表，并真实生成一道题进行结构校验：

```powershell
Set-Location "C:\wwwroot\server\server"
& "C:\BtSoft\nodejs\v22.23.1\node.exe" ".\dist\scripts\deepseek-check.js"
```

成功时会显示：

```text
[DeepSeekCheck] Authentication succeeded.
[DeepSeekCheck] Generated question passed schema validation.
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
