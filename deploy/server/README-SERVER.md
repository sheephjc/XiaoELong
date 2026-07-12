# XiaoELong Server Deploy

Version: 1.0.0

This folder is a server-only upload package for Windows Server with MySQL 5.6.

## 1. Install dependencies

```powershell
cd C:\wwwroot\server
npm.cmd install --omit=dev
```

## 2. Configure environment

```powershell
Copy-Item server\.env.example server\.env
notepad server\.env
```

Required values:

```env
NODE_ENV=production
PORT=3001
CLIENT_ORIGIN=null,http://43.139.223.204,http://43.139.223.204:3001
UPDATE_ROOT=C:\wwwroot\server\updates

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=XiaoELong

INVITE_CODE=your_invite_code
JWT_SECRET=replace_with_a_long_random_secret
UPLOAD_ROOT=C:\wwwroot\server\uploads
```

Generate a JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Initialize database

```powershell
npm.cmd run db:init
```

## 4. Start server

```powershell
npm.cmd run start
```

Health check:

```text
http://43.139.223.204:3001/health
```

This package changes MySQL JSON columns to TEXT for MySQL 5.6 compatibility.

## Client Updates

The server exposes update files from:

```text
C:\wwwroot\server\updates
```

After running `npm.cmd run electron:dist` on your local machine, upload these files from `release/` into that folder:

```text
latest.yml
XiaoELong Setup x.y.z.exe
XiaoELong Setup x.y.z.exe.blockmap
```

Clients check:

```text
http://43.139.223.204:3001/updates/latest.yml
```
