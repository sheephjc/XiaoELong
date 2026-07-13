const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { autoUpdater } = require("electron-updater");

const isDevelopment = Boolean(process.env.ELECTRON_START_URL);
app.setName(isDevelopment ? "XiaoELong Dev" : "XiaoELong");
if (isDevelopment) {
  app.setPath("userData", path.join(app.getPath("appData"), "XiaoELong-dev"));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

const AUTH_WIDTH = 440;
const AUTH_HEIGHT = 520;
const AVATAR_WIDTH = 180;
const AVATAR_MOOD_WIDTH = 356;
const AVATAR_HEIGHT = 190;
const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 560;
const SETTINGS_PANEL_WIDTH = 320;
const SETTINGS_PANEL_HEIGHT = 420;
const IMAGE_VIEWER_WIDTH = 840;
const IMAGE_VIEWER_HEIGHT = 640;
const PANEL_GAP = 12;
const PANEL_READY_FALLBACK_MS = 150;
const MAX_PANEL_CONTENT_EXTRA_HEIGHT = 300;
const DESKTOP_MARGIN_RIGHT = 28;
const DESKTOP_MARGIN_BOTTOM = 34;

let authWindow = null;
let authWindowReady = false;
let pendingAuthShow = false;
let avatarWindow = null;
let panelWindow = null;
let imageViewerWindow = null;
let tray = null;
let serverProcess = null;
let avatarDragState = null;
let panelOpen = false;
let panelPlacement = "upper-left";
let currentWindowMode = "auth";
let currentPanelView = "home";
let panelAlwaysOnTop = true;
let panelRendererReady = false;
let pendingPanelShow = false;
let panelReadyFallbackTimer = null;
let panelRecoveryTimer = null;
let panelRecoveryAttempts = 0;
let panelContentExtraHeight = 0;
let avatarMoodPromptVisible = false;
let avatarClickThrough = false;
let imageViewerState = {
  images: [],
  index: 0
};
let imageViewerReady = false;
let updateState = {
  status: "idle",
  message: "",
  version: app.getVersion(),
  progress: null
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function getSessionFilePath() {
  return path.join(app.getPath("userData"), "session.json");
}

function readPersistedAccessToken() {
  try {
    const parsed = JSON.parse(fs.readFileSync(getSessionFilePath(), "utf8"));
    return typeof parsed?.accessToken === "string" && parsed.accessToken.length > 0
      ? parsed.accessToken
      : null;
  } catch {
    return null;
  }
}

function persistAccessToken(token) {
  if (typeof token !== "string" || token.length === 0 || token.length > 8192) {
    return;
  }

  const sessionFile = getSessionFilePath();
  const temporaryFile = `${sessionFile}.tmp`;
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  fs.writeFileSync(temporaryFile, JSON.stringify({ accessToken: token }), "utf8");
  fs.renameSync(temporaryFile, sessionFile);
}

function clearPersistedAccessToken() {
  try {
    fs.rmSync(getSessionFilePath(), { force: true });
  } catch (error) {
    console.error("[Electron] Failed to clear persisted login.", error);
  }
}

function getBottomRightBounds(width, height) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  return {
    x: workArea.x + workArea.width - width - DESKTOP_MARGIN_RIGHT,
    y: workArea.y + workArea.height - height - DESKTOP_MARGIN_BOTTOM,
    width,
    height
  };
}

function getCenteredBounds(width, height, referenceBounds = null) {
  const display = referenceBounds ? screen.getDisplayMatching(referenceBounds) : screen.getPrimaryDisplay();
  const workArea = display.workArea;
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width: Math.min(width, workArea.width),
    height: Math.min(height, workArea.height)
  };
}

function clampBoundsToWorkArea(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const workArea = display.workArea;
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  return {
    x: clamp(bounds.x, workArea.x, workArea.x + Math.max(0, workArea.width - width)),
    y: clamp(bounds.y, workArea.y, workArea.y + Math.max(0, workArea.height - height)),
    width,
    height
  };
}

function clampAvatarBounds(bounds, cursorPoint = null) {
  const display = cursorPoint ? screen.getDisplayNearestPoint(cursorPoint) : screen.getDisplayMatching(bounds);
  const workArea = display.workArea;
  const avatarSize = getAvatarSize();
  const hiddenLeftWidth = avatarMoodPromptVisible ? 0 : Math.max(0, avatarSize.width - AVATAR_WIDTH);
  return {
    x: clamp(bounds.x, workArea.x - hiddenLeftWidth, workArea.x + workArea.width - avatarSize.width),
    y: clamp(bounds.y, workArea.y, workArea.y + workArea.height - avatarSize.height),
    width: avatarSize.width,
    height: avatarSize.height
  };
}

function getAvatarSize() {
  return {
    width: avatarMoodPromptVisible ? AVATAR_MOOD_WIDTH : AVATAR_WIDTH,
    height: AVATAR_HEIGHT
  };
}

function getMascotBoundsFromAvatarWindow() {
  if (!avatarWindow || avatarWindow.isDestroyed()) {
    return null;
  }
  const bounds = avatarWindow.getBounds();
  return {
    x: bounds.x + bounds.width - AVATAR_WIDTH,
    y: bounds.y,
    width: AVATAR_WIDTH,
    height: AVATAR_HEIGHT
  };
}

function setAvatarMoodPromptVisible(visible) {
  if (avatarMoodPromptVisible === visible) {
    return;
  }

  const mascotBounds = getMascotBoundsFromAvatarWindow();
  avatarMoodPromptVisible = visible;
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    const currentBounds = avatarWindow.getBounds();
    const avatarSize = getAvatarSize();
    const nextBounds = clampAvatarBounds({
      x: mascotBounds ? mascotBounds.x - (avatarSize.width - AVATAR_WIDTH) : currentBounds.x,
      y: currentBounds.y,
      width: avatarSize.width,
      height: avatarSize.height
    });
    if (
      currentBounds.x !== nextBounds.x ||
      currentBounds.y !== nextBounds.y ||
      currentBounds.width !== nextBounds.width ||
      currentBounds.height !== nextBounds.height
    ) {
      avatarWindow.setBounds(nextBounds, false);
    }
  }
  if (panelOpen) {
    updatePanelBounds();
  }
}

function setAvatarClickThrough(enabled) {
  const nextEnabled = Boolean(enabled);
  if (avatarDragState && nextEnabled) {
    return;
  }
  if (avatarClickThrough === nextEnabled) {
    return;
  }

  avatarClickThrough = nextEnabled;
  if (!avatarWindow || avatarWindow.isDestroyed()) {
    return;
  }

  if (avatarClickThrough) {
    avatarWindow.setIgnoreMouseEvents(true, { forward: true });
    return;
  }

  avatarWindow.setIgnoreMouseEvents(false);
}

function choosePanelPlacement(avatarBounds) {
  const display = screen.getDisplayMatching(avatarBounds);
  const workArea = display.workArea;
  const centerX = avatarBounds.x + avatarBounds.width / 2;
  const centerY = avatarBounds.y + avatarBounds.height / 2;
  const horizontal = centerX < workArea.x + workArea.width / 2 ? "right" : "left";
  const vertical = centerY < workArea.y + workArea.height / 2 ? "lower" : "upper";
  return `${vertical}-${horizontal}`;
}

function getPanelSize(avatarBounds) {
  const display = screen.getDisplayMatching(avatarBounds);
  const workArea = display.workArea;
  if (currentPanelView === "settings") {
    return {
      width: Math.min(SETTINGS_PANEL_WIDTH, Math.max(300, workArea.width - AVATAR_WIDTH - PANEL_GAP - 24)),
      height: Math.min(SETTINGS_PANEL_HEIGHT, Math.max(360, workArea.height - 16))
    };
  }

  return {
    width: Math.min(PANEL_WIDTH, Math.max(320, workArea.width - AVATAR_WIDTH - PANEL_GAP - 24)),
    height: Math.min(PANEL_HEIGHT + panelContentExtraHeight, Math.max(420, workArea.height - 16))
  };
}

function getPanelMinimumSize() {
  return currentPanelView === "settings" ? [300, 360] : [320, 420];
}

function getPanelBounds(avatarBounds, placement) {
  const size = getPanelSize(avatarBounds);
  const horizontal = placement.endsWith("right") ? "right" : "left";
  const vertical = placement.startsWith("lower") ? "lower" : "upper";
  return clampBoundsToWorkArea({
    x: horizontal === "right" ? avatarBounds.x + avatarBounds.width + PANEL_GAP : avatarBounds.x - size.width - PANEL_GAP,
    y: vertical === "lower" ? avatarBounds.y : avatarBounds.y + avatarBounds.height - size.height,
    width: size.width,
    height: size.height
  });
}

function getRendererUrl(role) {
  if (!process.env.ELECTRON_START_URL) {
    return null;
  }
  const url = new URL(process.env.ELECTRON_START_URL);
  url.searchParams.set("desktopRole", role);
  if (role === "panel") {
    url.searchParams.set("desktopPanelView", currentPanelView);
  }
  return url.toString();
}

function loadRenderer(targetWindow, role) {
  const url = getRendererUrl(role);
  if (url) {
    targetWindow.loadURL(url);
    return;
  }

  targetWindow.loadFile(path.join(app.getAppPath(), "client", "dist", "index.html"), {
    query: {
      desktopRole: role,
      desktopPanelView: role === "panel" ? currentPanelView : "home"
    }
  });
}

function getWebPreferences(role) {
  return {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    backgroundThrottling: role !== "panel",
    additionalArguments: [`--xiaoelong-role=${role}`]
  };
}

function getDesktopSettings() {
  return {
    openAtLogin: isDevelopment ? false : app.getLoginItemSettings().openAtLogin,
    panelAlwaysOnTop
  };
}

function sendToRenderers(channel, payload) {
  for (const targetWindow of [authWindow, avatarWindow, panelWindow]) {
    if (targetWindow && !targetWindow.webContents.isDestroyed()) {
      targetWindow.webContents.send(channel, payload);
    }
  }
}

function sendPanelView() {
  if (panelWindow && !panelWindow.webContents.isDestroyed()) {
    panelWindow.webContents.send("desktop:panel-view", currentPanelView);
  }
}

function broadcastSettings() {
  sendToRenderers("desktop:settings", getDesktopSettings());
}

function getPublicUpdateState() {
  return { ...updateState };
}

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch
  };
  sendToRenderers("updates:state", getPublicUpdateState());
}

function canUseAutoUpdater() {
  return process.platform !== "darwin" && app.isPackaged && !process.env.ELECTRON_START_URL;
}

function setupAutoUpdater() {
  if (process.platform === "darwin") {
    setUpdateState({
      status: "unavailable",
      message: "macOS 未签名测试版暂不支持自动更新。",
      progress: null
    });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    setUpdateState({
      status: "checking",
      message: "正在检查更新...",
      progress: null
    });
  });

  autoUpdater.on("update-available", (info) => {
    setUpdateState({
      status: "available",
      message: `发现新版本 ${info.version}。`,
      version: info.version,
      progress: null
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    setUpdateState({
      status: "not-available",
      message: `已是最新版本 ${info.version || app.getVersion()}。`,
      version: info.version || app.getVersion(),
      progress: null
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    setUpdateState({
      status: "downloading",
      message: `正在下载更新 ${Math.round(progress.percent)}%...`,
      progress: Math.round(progress.percent)
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState({
      status: "downloaded",
      message: `新版本 ${info.version} 已下载，重启后安装。`,
      version: info.version,
      progress: 100
    });
  });

  autoUpdater.on("error", (error) => {
    setUpdateState({
      status: "error",
      message: error instanceof Error ? error.message : "检查更新失败。",
      progress: null
    });
  });
}

function setPanelAlwaysOnTop(enabled) {
  panelAlwaysOnTop = enabled;
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.setAlwaysOnTop(panelAlwaysOnTop);
  }
  broadcastSettings();
}

function parkPanelWindow() {
  if (!panelWindow || panelWindow.isDestroyed()) {
    return;
  }

  panelWindow.setIgnoreMouseEvents(true);
  if (panelWindow.isVisible()) {
    panelWindow.hide();
  }
  if (!panelWindow.webContents.isDestroyed()) {
    panelWindow.webContents.setBackgroundThrottling(false);
  }
}

function revealPanelWindow() {
  if (!panelWindow || panelWindow.isDestroyed()) {
    return;
  }

  panelWindow.setIgnoreMouseEvents(false);
  if (!panelWindow.webContents.isDestroyed()) {
    panelWindow.webContents.setBackgroundThrottling(false);
  }
  if (!panelWindow.isVisible()) {
    panelWindow.show();
    return;
  }
  panelWindow.moveTop();
}

function showPanelWhenReady() {
  if (!panelWindow || panelWindow.isDestroyed()) {
    return;
  }

  if (!panelRendererReady) {
    pendingPanelShow = true;
    schedulePanelReadyFallback();
    return;
  }

  clearPanelReadyFallback();
  pendingPanelShow = false;
  revealPanelWindow();
}

function clearPanelReadyFallback() {
  if (panelReadyFallbackTimer) {
    clearTimeout(panelReadyFallbackTimer);
    panelReadyFallbackTimer = null;
  }
}

function clearPanelRecoveryTimer() {
  if (panelRecoveryTimer) {
    clearTimeout(panelRecoveryTimer);
    panelRecoveryTimer = null;
  }
}

function schedulePanelRecovery(reason) {
  if (!panelWindow || panelWindow.isDestroyed() || panelWindow.webContents.isDestroyed() || panelRecoveryTimer) {
    return;
  }

  const recoveringWindow = panelWindow;
  panelRecoveryAttempts += 1;
  panelRendererReady = false;
  pendingPanelShow = panelOpen;
  clearPanelReadyFallback();
  parkPanelWindow();

  const delay = Math.min(250 * panelRecoveryAttempts, 1500);
  console.error(`[Electron] Recovering panel renderer (${reason}), attempt ${panelRecoveryAttempts}.`);
  panelRecoveryTimer = setTimeout(() => {
    panelRecoveryTimer = null;
    if (
      !panelWindow ||
      panelWindow !== recoveringWindow ||
      panelWindow.isDestroyed() ||
      panelWindow.webContents.isDestroyed()
    ) {
      return;
    }
    panelWindow.webContents.reload();
  }, delay);
}

function schedulePanelReadyFallback() {
  clearPanelReadyFallback();
  panelReadyFallbackTimer = setTimeout(() => {
    panelReadyFallbackTimer = null;
    if (!panelWindow || panelWindow.isDestroyed() || !panelOpen || !pendingPanelShow) {
      return;
    }

    panelRendererReady = true;
    pendingPanelShow = false;
    updatePanelBounds();
    revealPanelWindow();
  }, PANEL_READY_FALLBACK_MS);
}

function findTrayIconPaths() {
  const projectRoot = path.resolve(__dirname, "..");
  const iconPaths = [
    path.join(__dirname, "assets", "xiaoelong-tray-icon.ico"),
    path.join(__dirname, "assets", "xiaoelong-tray-icon.png"),
    path.join(projectRoot, "client", "src", "assets", "xiaoelong-mascot.png")
  ];

  const distAssetsPath = path.join(projectRoot, "client", "dist", "assets");
  if (fs.existsSync(distAssetsPath)) {
    const iconFile = fs
      .readdirSync(distAssetsPath)
      .find((fileName) => /^xiaoelong-mascot(?!-hitmask).*\.png$/i.test(fileName));
    if (iconFile) {
      iconPaths.push(path.join(distAssetsPath, iconFile));
    }
  }

  return iconPaths;
}

function getTrayIcon() {
  const iconPaths = findTrayIconPaths();
  for (const iconPath of iconPaths) {
    if (!fs.existsSync(iconPath)) {
      continue;
    }

    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.warn(`[Electron] Unable to decode tray icon: ${iconPath}`);
      continue;
    }

    if (iconPath.toLowerCase().endsWith(".ico")) {
      return icon;
    }

    return icon.resize({
      width: 16,
      height: 16,
      quality: "best"
    });
  }

  console.error(`[Electron] No usable tray icon found. Checked: ${iconPaths.join(", ")}`);
  return nativeImage.createEmpty();
}

function hideAllWindows() {
  pendingPanelShow = false;
  clearPanelReadyFallback();
  parkPanelWindow();
  for (const targetWindow of [authWindow, avatarWindow, imageViewerWindow]) {
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.hide();
    }
  }
}

function showCurrentModeFromTray() {
  if (currentWindowMode === "expanded") {
    showExpandedMode(currentPanelView);
    return;
  }

  if (currentWindowMode === "collapsed") {
    showCollapsedMode();
    return;
  }

  showAuthMode();
}

function createTray() {
  if (tray) {
    return tray;
  }

  tray = new Tray(getTrayIcon());
  tray.setToolTip("小鳄龙之家");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示小鳄龙",
        click: showCurrentModeFromTray
      },
      {
        label: "隐藏",
        click: hideAllWindows
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          app.quit();
        }
      }
    ])
  );
  tray.on("click", showCurrentModeFromTray);
  tray.on("double-click", showCurrentModeFromTray);
  return tray;
}

function createAuthWindow() {
  if (authWindow) {
    return authWindow;
  }

  authWindowReady = false;
  authWindow = new BrowserWindow({
    width: AUTH_WIDTH,
    height: AUTH_HEIGHT,
    minWidth: AUTH_WIDTH,
    minHeight: AUTH_HEIGHT,
    frame: false,
    transparent: false,
    backgroundColor: "#f6fff9",
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: getWebPreferences("auth")
  });

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  authWindow.setBounds({
    x: Math.round(workArea.x + (workArea.width - AUTH_WIDTH) / 2),
    y: Math.round(workArea.y + (workArea.height - AUTH_HEIGHT) / 2),
    width: AUTH_WIDTH,
    height: AUTH_HEIGHT
  });

  loadRenderer(authWindow, "auth");
  authWindow.once("ready-to-show", () => {
    authWindowReady = true;
    if (authWindow && pendingAuthShow) {
      pendingAuthShow = false;
      authWindow.show();
    }
  });
  authWindow.on("closed", () => {
    authWindow = null;
    authWindowReady = false;
    pendingAuthShow = false;
  });
  return authWindow;
}

function createAvatarWindow() {
  if (avatarWindow) {
    return avatarWindow;
  }

  const avatarSize = getAvatarSize();
  avatarWindow = new BrowserWindow({
    ...getBottomRightBounds(avatarSize.width, avatarSize.height),
    minWidth: AVATAR_WIDTH,
    minHeight: AVATAR_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: getWebPreferences("avatar")
  });

  loadRenderer(avatarWindow, "avatar");
  avatarWindow.once("ready-to-show", () => {
    if (avatarWindow) {
      avatarWindow.show();
    }
  });
  avatarWindow.on("closed", () => {
    avatarWindow = null;
    avatarClickThrough = false;
    avatarDragState = null;
  });
  return avatarWindow;
}

function createPanelWindow() {
  if (panelWindow) {
    return panelWindow;
  }

  panelRendererReady = false;
  pendingPanelShow = false;

  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    minWidth: 300,
    minHeight: 150,
    frame: false,
    transparent: false,
    backgroundColor: "#ffffff",
    resizable: false,
    alwaysOnTop: panelAlwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: getWebPreferences("panel")
  });

  panelWindow.setIgnoreMouseEvents(true);
  loadRenderer(panelWindow, "panel");
  panelWindow.webContents.on("did-finish-load", () => {
    panelRecoveryAttempts = 0;
    clearPanelRecoveryTimer();
    sendPanelView();
    broadcastSettings();
    if (panelOpen && pendingPanelShow) {
      showPanelWhenReady();
    }
  });
  panelWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      schedulePanelRecovery(`load failed: ${errorDescription} (${errorCode})`);
    }
  });
  panelWindow.webContents.on("render-process-gone", (_event, details) => {
    schedulePanelRecovery(`renderer ${details.reason}`);
  });
  panelWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.error(`[Electron][Panel] ${message} (${sourceId}:${line})`);
    }
  });
  panelWindow.on("unresponsive", () => {
    schedulePanelRecovery("window unresponsive");
  });
  panelWindow.on("closed", () => {
    panelWindow = null;
    panelRendererReady = false;
    pendingPanelShow = false;
    clearPanelReadyFallback();
    clearPanelRecoveryTimer();
    panelRecoveryAttempts = 0;
  });
  return panelWindow;
}

function sendImageViewerState() {
  if (!imageViewerWindow || imageViewerWindow.isDestroyed() || !imageViewerReady) {
    return;
  }

  imageViewerWindow.webContents.send("desktop:image-viewer-state", imageViewerState);
}

function createImageViewerWindow(referenceBounds = null) {
  if (imageViewerWindow) {
    return imageViewerWindow;
  }

  imageViewerReady = false;
  imageViewerWindow = new BrowserWindow({
    ...getCenteredBounds(IMAGE_VIEWER_WIDTH, IMAGE_VIEWER_HEIGHT, referenceBounds),
    minWidth: 480,
    minHeight: 360,
    frame: false,
    transparent: false,
    backgroundColor: "#eef1f3",
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: getWebPreferences("imageViewer")
  });

  imageViewerWindow.loadFile(path.join(__dirname, "image-viewer.html"));
  imageViewerWindow.webContents.once("did-finish-load", () => {
    imageViewerReady = true;
    sendImageViewerState();
  });
  imageViewerWindow.on("closed", () => {
    imageViewerWindow = null;
    imageViewerReady = false;
  });
  return imageViewerWindow;
}

function showImageViewer(payload) {
  const images = Array.isArray(payload?.images)
    ? payload.images
        .map((image) => ({
          url: typeof image?.url === "string" ? image.url : "",
          name: typeof image?.name === "string" ? image.name : "",
          userNickname: typeof image?.userNickname === "string" ? image.userNickname : ""
        }))
        .filter((image) => image.url)
    : [];

  if (images.length === 0) {
    return;
  }

  const nextIndex = clamp(Number(payload?.index) || 0, 0, images.length - 1);
  imageViewerState = {
    images,
    index: nextIndex
  };

  const referenceWindow = panelWindow && !panelWindow.isDestroyed() ? panelWindow : avatarWindow;
  const referenceBounds = referenceWindow && !referenceWindow.isDestroyed() ? referenceWindow.getBounds() : null;
  const targetWindow = createImageViewerWindow(referenceBounds);
  targetWindow.setBounds(getCenteredBounds(IMAGE_VIEWER_WIDTH, IMAGE_VIEWER_HEIGHT, referenceBounds), false);
  sendImageViewerState();
  if (!targetWindow.isVisible()) {
    targetWindow.show();
  }
  targetWindow.focus();
}

function showPreviousImage() {
  if (imageViewerState.images.length === 0) {
    return;
  }

  imageViewerState = {
    ...imageViewerState,
    index: (imageViewerState.index - 1 + imageViewerState.images.length) % imageViewerState.images.length
  };
  sendImageViewerState();
}

function showNextImage() {
  if (imageViewerState.images.length === 0) {
    return;
  }

  imageViewerState = {
    ...imageViewerState,
    index: (imageViewerState.index + 1) % imageViewerState.images.length
  };
  sendImageViewerState();
}

function sendPanelPlacement() {
  for (const targetWindow of [avatarWindow, panelWindow]) {
    if (targetWindow && !targetWindow.webContents.isDestroyed()) {
      targetWindow.webContents.send("desktop:placement", panelPlacement);
    }
  }
}

function updatePanelBounds() {
  if (!avatarWindow || !panelWindow) {
    return;
  }
  const avatarBounds = getMascotBoundsFromAvatarWindow();
  if (!avatarBounds) {
    return;
  }
  panelPlacement = choosePanelPlacement(avatarBounds);
  panelWindow.setMinimumSize(...getPanelMinimumSize());
  panelWindow.setBounds(getPanelBounds(avatarBounds, panelPlacement), false);
  sendPanelPlacement();
}

function showAuthMode() {
  panelOpen = false;
  pendingAuthShow = true;
  pendingPanelShow = false;
  clearPanelReadyFallback();
  if (avatarWindow) {
    avatarWindow.hide();
  }
  parkPanelWindow();
  const targetWindow = createAuthWindow();
  if (authWindowReady) {
    pendingAuthShow = false;
    targetWindow.show();
  }
}

function showCollapsedMode() {
  panelOpen = false;
  pendingAuthShow = false;
  pendingPanelShow = false;
  clearPanelReadyFallback();
  if (authWindow) {
    authWindow.hide();
  }
  if (panelWindow) {
    parkPanelWindow();
  }
  createAvatarWindow().show();
  createPanelWindow();
  updatePanelBounds();
  parkPanelWindow();
  sendPanelView();
  broadcastSettings();
}

function showExpandedMode(panelView = "home") {
  panelOpen = true;
  pendingAuthShow = false;
  const viewChanged = currentPanelView !== panelView;
  currentPanelView = panelView;
  if (authWindow) {
    authWindow.hide();
  }
  createAvatarWindow().show();
  const nextPanelWindow = createPanelWindow();
  if (viewChanged || !panelRendererReady) {
    panelRendererReady = false;
    pendingPanelShow = true;
    parkPanelWindow();
  }
  updatePanelBounds();
  sendPanelView();
  broadcastSettings();
  showPanelWhenReady();
}

function setWindowMode(mode) {
  currentWindowMode = mode;
  if (mode === "auth") {
    showAuthMode();
    return;
  }
  if (mode === "collapsed") {
    showCollapsedMode();
    return;
  }
  if (mode === "expanded") {
    showExpandedMode("home");
  }
}

function getServerEntryPath() {
  return path.join(app.getAppPath(), "server", "dist", "index.js");
}

function startEmbeddedServer() {
  if (process.env.ELECTRON_START_URL) {
    return;
  }
  if (process.env.XIAOELONG_EMBEDDED_SERVER !== "1") {
    return;
  }

  const serverEntry = getServerEntryPath();
  serverProcess = spawn(process.execPath, [serverEntry], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: process.env.PORT || "3001",
      CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173,null",
      INVITE_CODE: process.env.INVITE_CODE || "123456",
      JWT_SECRET: process.env.JWT_SECRET || "desktop-local-secret",
      UPLOAD_ROOT: process.env.UPLOAD_ROOT || path.join(app.getPath("userData"), "uploads"),
      ELECTRON_RUN_AS_NODE: "1"
    }
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[Electron] Embedded server exited with code ${code}.`);
    }
    serverProcess = null;
  });
}

function stopEmbeddedServer() {
  if (!serverProcess) {
    return;
  }
  serverProcess.kill("SIGTERM");
  serverProcess = null;
}

app.whenReady().then(() => {
  setupAutoUpdater();
  startEmbeddedServer();
  createTray();
  createAuthWindow();
});

app.on("second-instance", () => {
  const targetWindow = panelWindow ?? avatarWindow ?? authWindow;
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }
  if (!targetWindow.isVisible()) {
    targetWindow.show();
  }
  targetWindow.focus();
});

ipcMain.on("desktop:window-mode", (_event, mode) => {
  if (mode === "auth" || mode === "collapsed" || mode === "expanded") {
    setWindowMode(mode);
  }
});

ipcMain.on("desktop:panel-ready", (event) => {
  if (!panelWindow || panelWindow.isDestroyed() || event.sender !== panelWindow.webContents) {
    return;
  }

  panelRendererReady = true;
  clearPanelReadyFallback();
  if (panelOpen && pendingPanelShow) {
    updatePanelBounds();
    showPanelWhenReady();
  }
});

ipcMain.on("desktop:panel-content-extra-height", (event, height) => {
  if (!panelWindow || panelWindow.isDestroyed() || event.sender !== panelWindow.webContents) {
    return;
  }

  const numericHeight = Number(height);
  if (!Number.isFinite(numericHeight)) {
    return;
  }

  const nextHeight = clamp(Math.round(numericHeight), 0, MAX_PANEL_CONTENT_EXTRA_HEIGHT);
  if (panelContentExtraHeight === nextHeight) {
    return;
  }

  panelContentExtraHeight = nextHeight;
  if (currentPanelView === "home") {
    updatePanelBounds();
  }
});

ipcMain.on("desktop:toggle-home", () => {
  if (
    currentWindowMode === "expanded" &&
    currentPanelView === "home" &&
    (panelWindow?.isVisible() || pendingPanelShow)
  ) {
    currentWindowMode = "collapsed";
    showCollapsedMode();
    return;
  }

  currentWindowMode = "expanded";
  showExpandedMode("home");
});

ipcMain.on("desktop:open-settings", () => {
  if (
    currentWindowMode === "expanded" &&
    currentPanelView === "settings" &&
    (panelWindow?.isVisible() || pendingPanelShow)
  ) {
    currentWindowMode = "collapsed";
    showCollapsedMode();
    return;
  }

  currentWindowMode = "expanded";
  showExpandedMode("settings");
});

ipcMain.on("desktop:hide-all-windows", () => {
  hideAllWindows();
});

ipcMain.on("desktop:image-viewer-open", (_event, payload) => {
  showImageViewer(payload);
});

ipcMain.on("desktop:image-viewer-close", () => {
  if (imageViewerWindow && !imageViewerWindow.isDestroyed()) {
    imageViewerWindow.hide();
  }
});

ipcMain.on("desktop:image-viewer-previous", () => {
  showPreviousImage();
});

ipcMain.on("desktop:image-viewer-next", () => {
  showNextImage();
});

ipcMain.on("desktop:login", (_event, token) => {
  if (typeof token === "string" && token.length > 0) {
    persistAccessToken(token);
    sendToRenderers("desktop:login", token);
  }
});

ipcMain.on("desktop:session-token:get", (event) => {
  event.returnValue = readPersistedAccessToken();
});

ipcMain.on("desktop:session-token:set", (_event, token) => {
  persistAccessToken(token);
});

ipcMain.on("desktop:session-token:clear", () => {
  clearPersistedAccessToken();
});

ipcMain.on("desktop:mood-prompt-visible", (_event, visible) => {
  setAvatarMoodPromptVisible(Boolean(visible));
});

ipcMain.on("desktop:avatar-click-through", (_event, enabled) => {
  setAvatarClickThrough(Boolean(enabled));
});

ipcMain.on("desktop:logout", () => {
  clearPersistedAccessToken();
  sendToRenderers("desktop:logout");
  currentWindowMode = "auth";
  showAuthMode();
});

ipcMain.handle("desktop:settings:get", () => getDesktopSettings());

ipcMain.handle("desktop:settings:set-login-at-startup", (_event, enabled) => {
  if (isDevelopment) {
    return getDesktopSettings();
  }

  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled)
  });
  broadcastSettings();
  return getDesktopSettings();
});

ipcMain.handle("desktop:settings:set-panel-always-on-top", (_event, enabled) => {
  setPanelAlwaysOnTop(Boolean(enabled));
  return getDesktopSettings();
});

ipcMain.handle("updates:get-state", () => getPublicUpdateState());

ipcMain.handle("updates:check", async () => {
  if (!canUseAutoUpdater()) {
    return getPublicUpdateState();
  }

  await autoUpdater.checkForUpdates();
  return getPublicUpdateState();
});

ipcMain.handle("updates:download", async () => {
  if (!canUseAutoUpdater()) {
    return getPublicUpdateState();
  }

  setUpdateState({
    status: "downloading",
    message: "正在下载更新...",
    progress: 0
  });
  await autoUpdater.downloadUpdate();
  return getPublicUpdateState();
});

ipcMain.handle("updates:install", () => {
  if (updateState.status !== "downloaded") {
    return getPublicUpdateState();
  }
  autoUpdater.quitAndInstall(false, true);
  return getPublicUpdateState();
});

ipcMain.on("desktop:drag-start", (event) => {
  if (!avatarWindow || avatarWindow.isDestroyed() || event.sender !== avatarWindow.webContents) {
    return;
  }
  setAvatarClickThrough(false);
  const bounds = avatarWindow.getBounds();
  const cursor = screen.getCursorScreenPoint();
  avatarDragState = {
    cursorStart: cursor,
    cursorLast: cursor,
    windowStart: { x: bounds.x, y: bounds.y }
  };
});

ipcMain.on("desktop:drag-move", (event) => {
  if (!avatarWindow || avatarWindow.isDestroyed() || event.sender !== avatarWindow.webContents || !avatarDragState) {
    return;
  }
  const cursor = screen.getCursorScreenPoint();
  if (cursor.x === avatarDragState.cursorLast.x && cursor.y === avatarDragState.cursorLast.y) {
    return;
  }
  avatarDragState.cursorLast = cursor;
  const avatarSize = getAvatarSize();
  const nextAvatarBounds = clampAvatarBounds({
    x: avatarDragState.windowStart.x + cursor.x - avatarDragState.cursorStart.x,
    y: avatarDragState.windowStart.y + cursor.y - avatarDragState.cursorStart.y,
    width: avatarSize.width,
    height: avatarSize.height
  }, cursor);

  const currentBounds = avatarWindow.getBounds();
  if (currentBounds.x === nextAvatarBounds.x && currentBounds.y === nextAvatarBounds.y) {
    return;
  }

  avatarWindow.setBounds(nextAvatarBounds, false);
  if (panelOpen) {
    updatePanelBounds();
  }
});

ipcMain.on("desktop:drag-end", (event) => {
  if (avatarWindow && !avatarWindow.isDestroyed() && event.sender !== avatarWindow.webContents) {
    return;
  }
  avatarDragState = null;
  if (panelOpen) {
    updatePanelBounds();
  }
});

app.on("window-all-closed", () => {
  stopEmbeddedServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopEmbeddedServer();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createAuthWindow();
  }
});
