const { contextBridge, ipcRenderer } = require("electron");

const roleArg = process.argv.find((arg) => arg.startsWith("--xiaoelong-role="));

contextBridge.exposeInMainWorld("xiaoelongDesktop", {
  isDesktop: true,
  role: roleArg ? roleArg.split("=")[1] : "auth",
  setWindowMode: (mode) => ipcRenderer.send("desktop:window-mode", mode),
  toggleHomePanel: () => ipcRenderer.send("desktop:toggle-home"),
  openSettingsPanel: () => ipcRenderer.send("desktop:open-settings"),
  notifyPanelReady: () => ipcRenderer.send("desktop:panel-ready"),
  setPanelContentExtraHeight: (height) => ipcRenderer.send("desktop:panel-content-extra-height", height),
  notifyLogin: (token) => ipcRenderer.send("desktop:login", token),
  getPersistedAccessToken: () => ipcRenderer.sendSync("desktop:session-token:get"),
  persistAccessToken: (token) => ipcRenderer.send("desktop:session-token:set", token),
  clearPersistedAccessToken: () => ipcRenderer.send("desktop:session-token:clear"),
  hideAllWindows: () => ipcRenderer.send("desktop:hide-all-windows"),
  setMoodPromptVisible: (visible) => ipcRenderer.send("desktop:mood-prompt-visible", visible),
  setAvatarClickThrough: (enabled) => ipcRenderer.send("desktop:avatar-click-through", enabled),
  openImageViewer: (payload) => ipcRenderer.send("desktop:image-viewer-open", payload),
  requestLogout: () => ipcRenderer.send("desktop:logout"),
  getSettings: () => ipcRenderer.invoke("desktop:settings:get"),
  setLoginAtStartup: (enabled) => ipcRenderer.invoke("desktop:settings:set-login-at-startup", enabled),
  setPanelAlwaysOnTop: (enabled) => ipcRenderer.invoke("desktop:settings:set-panel-always-on-top", enabled),
  getUpdateState: () => ipcRenderer.invoke("updates:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("updates:state", listener);
    return () => ipcRenderer.removeListener("updates:state", listener);
  },
  onPanelViewChange: (callback) => {
    const listener = (_event, view) => callback(view);
    ipcRenderer.on("desktop:panel-view", listener);
    return () => ipcRenderer.removeListener("desktop:panel-view", listener);
  },
  onSettingsChange: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("desktop:settings", listener);
    return () => ipcRenderer.removeListener("desktop:settings", listener);
  },
  onLogout: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("desktop:logout", listener);
    return () => ipcRenderer.removeListener("desktop:logout", listener);
  },
  onLogin: (callback) => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on("desktop:login", listener);
    return () => ipcRenderer.removeListener("desktop:login", listener);
  },
  onPlacementChange: (callback) => {
    const listener = (_event, placement) => callback(placement);
    ipcRenderer.on("desktop:placement", listener);
    return () => ipcRenderer.removeListener("desktop:placement", listener);
  },
  startDrag: () => ipcRenderer.send("desktop:drag-start"),
  moveDrag: () => ipcRenderer.send("desktop:drag-move"),
  endDrag: () => ipcRenderer.send("desktop:drag-end")
});

contextBridge.exposeInMainWorld("xiaoelongImageViewer", {
  close: () => ipcRenderer.send("desktop:image-viewer-close"),
  previous: () => ipcRenderer.send("desktop:image-viewer-previous"),
  next: () => ipcRenderer.send("desktop:image-viewer-next"),
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("desktop:image-viewer-state", listener);
    return () => ipcRenderer.removeListener("desktop:image-viewer-state", listener);
  }
});
