import { useCallback, useEffect, useRef, type UIEvent } from "react";
import { type PetDisplayMode } from "../../utils/pet-animation";
import { useAuth } from "../../contexts/AuthContext";
import { useChat } from "../../contexts/ChatContext";
import { useDeity } from "../../contexts/DeityContext";
import { useDesktop } from "../../contexts/DesktopContext";
import clientPackage from "../../../package.json";
import { ChatPanel } from "../panels/ChatPanel";
import { DailyQuestionPanel } from "../panels/DailyQuestionPanel";
import { DivineSelectionPanel } from "../panels/DivineSelectionPanel";
import { GomokuPanel } from "../panels/GomokuPanel";
import { SettingsProfileForm } from "../panels/SettingsProfileForm";
import { StatusBar } from "../panels/StatusBar";

const PET_DISPLAY_MODE_LABELS: Record<PetDisplayMode, string> = {
  dynamic: "动态显示：开",
  static: "动态显示：关",
  image: "只显示形象"
};

export function PanelContent(): JSX.Element | null {
  const {
    activeTab, panelView, deleteConfirmOpen, detailsOpen, desktopSettings, updateState,
    setActiveTab,
    setDeleteConfirmOpen, setDetailsOpen,
    toggleLoginAtStartup, togglePanelTopmost, cyclePetDisplayMode,
    checkForUpdates, downloadUpdate, installUpdate, hideAllWindows,
  } = useDesktop();
  const { socketError } = useChat();
  const { selectDivineTab } = useDeity();
  const { currentUser, accountDeleting, deleteAccount } = useAuth();

  // 设置面板顶部栏滚动时才显示滚动条，滚动停止 500ms 后隐藏
  const settingsScrollEndTimerRef = useRef<number | null>(null);

  const handleSettingsScroll = useCallback((event: UIEvent<HTMLElement>): void => {
    const scrollArea = event.currentTarget;
    scrollArea.classList.add("is-scrolling");

    if (settingsScrollEndTimerRef.current !== null) {
      window.clearTimeout(settingsScrollEndTimerRef.current);
    }
    settingsScrollEndTimerRef.current = window.setTimeout(() => {
      scrollArea.classList.remove("is-scrolling");
      settingsScrollEndTimerRef.current = null;
    }, 500);
  }, []);

  useEffect(() => () => {
    if (settingsScrollEndTimerRef.current !== null) {
      window.clearTimeout(settingsScrollEndTimerRef.current);
    }
  }, []);

  if (!currentUser) {
    return null;
  }

  const updateBusy = updateState.status === "checking" || updateState.status === "downloading";
  const updateAvailable = updateState.status === "available";
  const updateDownloaded = updateState.status === "downloaded";
  const showUpdateStatus = updateState.message.length > 0 || updateState.progress !== null;
  const appVersion = clientPackage.version;

  const homePanel = (
    <div className="panel">
      <header className="topbar">
        <h1>小鳄龙之家</h1>
      </header>

      {socketError ? <div className="connection-toast">{socketError}</div> : null}

      <div className="panel-body">
        <nav className="module-tabs module-tabs-sidebar" aria-label="模块切换">
          <button type="button" className={activeTab === "chat" ? "active" : ""} onClick={() => setActiveTab("chat")}>
            聊天
          </button>
          <button type="button" className={activeTab === "daily" ? "active" : ""} onClick={() => setActiveTab("daily")}>
            每日一题
          </button>
          <button type="button" className={activeTab === "divine" ? "active" : ""} onClick={() => void selectDivineTab()}>
            神选
          </button>
          <button type="button" className={activeTab === "gomoku" ? "active" : ""} onClick={() => setActiveTab("gomoku")}>
            五子棋
          </button>
        </nav>

        <div className="panel-content">
          <StatusBar />

          {activeTab === "chat" ? <ChatPanel /> : null}

          {activeTab === "daily" ? <DailyQuestionPanel /> : null}

          {activeTab === "divine" ? <DivineSelectionPanel /> : null}

          {activeTab === "gomoku" ? <GomokuPanel /> : null}
        </div>
      </div>
    </div>
  );

  const settingsPanel = (
    <div className={`panel settings-panel ${deleteConfirmOpen || detailsOpen ? "confirming" : ""}`}>
      <div className="settings-content">
        <SettingsProfileForm />
        <header className="topbar settings-topbar" onScroll={handleSettingsScroll}>
          <div className="panel-action-buttons" aria-label="设置操作">
            <button type="button" className="ghost-button" onClick={hideAllWindows}>
              隐藏小鳄龙
            </button>
            <button
              type="button"
              className={desktopSettings.openAtLogin ? "primary-soft-button" : "ghost-button"}
              onClick={() => void toggleLoginAtStartup()}
            >
              {desktopSettings.openAtLogin ? "已开机自启" : "开机自启"}
            </button>
            <button
              type="button"
              className={desktopSettings.panelAlwaysOnTop ? "primary-soft-button" : "ghost-button"}
              onClick={() => void togglePanelTopmost()}
            >
              {desktopSettings.panelAlwaysOnTop ? "已置顶" : "置顶"}
            </button>
            <button
              type="button"
              className={desktopSettings.petDisplayMode === "dynamic" ? "primary-soft-button" : "ghost-button"}
              aria-label={`小鳄龙显示方式：${PET_DISPLAY_MODE_LABELS[desktopSettings.petDisplayMode]}，点击切换`}
              title="点击切换小鳄龙显示方式"
              onClick={() => void cyclePetDisplayMode()}
            >
              {PET_DISPLAY_MODE_LABELS[desktopSettings.petDisplayMode]}
            </button>
            <button
              type="button"
              className="ghost-button settings-detail-button"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDetailsOpen(true);
              }}
            >
              详情
            </button>
            <button
              type="button"
              className={updateBusy ? "primary-soft-button" : "ghost-button"}
              disabled={updateBusy}
              onClick={() => void checkForUpdates()}
            >
              {updateState.status === "checking" ? "检查中" : "检查更新"}
            </button>
            {updateAvailable ? (
              <button
                type="button"
                className="primary-soft-button"
                disabled={updateBusy}
                onClick={() => void downloadUpdate()}
              >
                {updateState.manual ? "打开 DMG 下载" : "下载更新"}
              </button>
            ) : null}
            {updateDownloaded ? (
              <button type="button" className="primary-soft-button" onClick={() => void installUpdate()}>
                重启安装
              </button>
            ) : null}
            {showUpdateStatus ? (
              <div className="settings-update-status">
                <span>{updateState.message}</span>
                {updateState.progress !== null ? (
                  <span className="settings-update-progress">{updateState.progress}%</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>
        <footer className="settings-bottom-bar">
          <button
            type="button"
            className="danger-button"
            disabled={accountDeleting}
            onClick={() => {
              setDetailsOpen(false);
              setDeleteConfirmOpen(true);
            }}
          >
            {accountDeleting ? "注销中" : "注销"}
          </button>
          <p className="settings-app-version">版本 v{appVersion}</p>
        </footer>
      </div>

      {detailsOpen ? (
        <div className="settings-detail-layer" role="dialog" aria-modal="true" aria-label="项目详情">
          <div className="settings-detail-card">
            <div className="settings-detail-head">
              <h2>项目详情</h2>
              <button type="button" className="ghost-button" onClick={() => setDetailsOpen(false)}>
                关闭
              </button>
            </div>
            <div className="settings-detail-body">
              <p>
                小鳄龙之家是一个基于 React、TypeScript 与 Electron 的桌面组件项目。前端由 Vite 构建，桌宠窗口、主面板与图片查看器通过 Electron IPC 协作，界面状态由 React 组件集中管理。
              </p>
              <p>
                后端采用 Node.js、Express 与 Socket.IO，负责 REST 接口、实时事件、文件上传和数据持久化；公共数据结构沉淀在 shared 包中，保持前后端类型契约一致。
              </p>
              <p className="settings-detail-credit">制作：HJC by Codex</p>
              <p className="settings-detail-members">
                小鳄龙之家成员🥰：HJC、哆啦X梦、莴韭、can you feel my world、HSX、offset、夕惕
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen ? (
        <div className="settings-confirm-layer" role="dialog" aria-modal="true" aria-label="确认注销">
          <div className="settings-confirm-card">
            <p>注销将删除该user所有记录</p>
            <div className="settings-confirm-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={accountDeleting}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={accountDeleting}
                onClick={() => void deleteAccount()}
              >
                {accountDeleting ? "注销中" : "确定"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );

  return panelView === "settings" ? settingsPanel : homePanel;
}
