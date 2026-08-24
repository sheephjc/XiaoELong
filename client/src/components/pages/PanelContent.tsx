import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";
import { type PetDisplayMode } from "../../utils/pet-animation";
import { COLOR_THEME_OPTIONS } from "../../utils/color-theme";
import {
  getBirthdayCelebration,
  rememberBirthdayDialog,
  shouldShowBirthdayDialog
} from "../../utils/birthday-celebration";
import { getReleaseAnnouncement, RELEASE_ANNOUNCEMENTS } from "../../data/release-announcements";
import mascotHitMaskImage from "../../assets/xiaoelong-mascot-hitmask.png";
import mascotImage from "../../assets/xiaoelong-mascot.png";
import { useAuth } from "../../contexts/AuthContext";
import { useChat } from "../../contexts/ChatContext";
import { useDeity } from "../../contexts/DeityContext";
import { useDesktop, type ModuleTab } from "../../contexts/DesktopContext";
import clientPackage from "../../../package.json";
import { ModuleTabIcon } from "../atoms/ModuleTabIcon";
import { PetSprite } from "../atoms/PetSprite";
import { ChatPanel } from "../panels/ChatPanel";
import { BirthdayCelebration } from "../panels/BirthdayCelebration";
import { DailyQuestionPanel } from "../panels/DailyQuestionPanel";
import { DivineSelectionPanel } from "../panels/DivineSelectionPanel";
import { GomokuPanel } from "../panels/GomokuPanel";
import { SettingsProfileForm } from "../panels/SettingsProfileForm";
import { StatusBar } from "../panels/StatusBar";
import { ReleaseAnnouncementDialog } from "../panels/ReleaseAnnouncementDialog";

const CURRENT_APP_VERSION = clientPackage.version;
const RELEASE_ANNOUNCEMENT_SEEN_STORAGE_KEY = "xiaoelong_release_announcement_seen_version";

function shouldShowCurrentReleaseAnnouncement(): boolean {
  try {
    return localStorage.getItem(RELEASE_ANNOUNCEMENT_SEEN_STORAGE_KEY) !== CURRENT_APP_VERSION;
  } catch {
    return true;
  }
}

function rememberCurrentReleaseAnnouncement(): void {
  try {
    localStorage.setItem(RELEASE_ANNOUNCEMENT_SEEN_STORAGE_KEY, CURRENT_APP_VERSION);
  } catch {
    // 存储不可用时只影响“仅展示一次”，不阻止关闭公告。
  }
}

function millisecondsUntilNextDay(date: Date): number {
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return Math.max(1_000, nextDay.getTime() - date.getTime() + 250);
}

const PET_DISPLAY_MODE_LABELS: Record<PetDisplayMode, string> = {
  dynamic: "动态交互",
  static: "静态形象",
  image: "原始形象"
};

const PET_DISPLAY_MODE_DESCRIPTIONS: Record<PetDisplayMode, string> = {
  dynamic: "播放待机、拖动与胜负反馈动画",
  static: "保留动画形象，固定显示代表画面",
  image: "使用最初的单张小鳄龙形象"
};

const PET_DISPLAY_MODES: PetDisplayMode[] = ["image", "dynamic", "static"];

function getAdjacentPetDisplayMode(mode: PetDisplayMode, offset: -1 | 1): PetDisplayMode {
  const currentIndex = PET_DISPLAY_MODES.indexOf(mode);
  return PET_DISPLAY_MODES[(currentIndex + offset + PET_DISPLAY_MODES.length) % PET_DISPLAY_MODES.length];
}

type AppearanceSection = "colors" | "layout" | "pet";

const MODULE_TABS: Array<{ id: ModuleTab; label: string }> = [
  { id: "chat", label: "聊天" },
  { id: "daily", label: "每日一题" },
  { id: "divine", label: "神选" },
  { id: "gomoku", label: "五子棋" }
];

export function PanelContent(): JSX.Element | null {
  const {
    activeTab, panelView, deleteConfirmOpen, detailsOpen, desktopSettings, updateState,
    setActiveTab,
    setDeleteConfirmOpen, setDetailsOpen,
    toggleLoginAtStartup, togglePanelTopmost, setColorTheme, setPanelLayout, setPetDisplayMode,
    checkForUpdates, downloadUpdate, installUpdate, hideAllWindows,
  } = useDesktop();
  const { socketError } = useChat();
  const { selectDivineTab } = useDeity();
  const { currentUser, accountDeleting, deleteAccount } = useAuth();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [releaseHistoryOpen, setReleaseHistoryOpen] = useState(false);
  const [currentReleaseOpen, setCurrentReleaseOpen] = useState(shouldShowCurrentReleaseAnnouncement);
  const [appearanceSection, setAppearanceSection] = useState<AppearanceSection>("colors");
  const [today, setToday] = useState(() => new Date());
  const birthdayCelebration = getBirthdayCelebration(today);
  const birthdayDateKey = birthdayCelebration?.dateKey ?? null;
  const [birthdayDialogDateKey, setBirthdayDialogDateKey] = useState<string | null>(() => (
    birthdayCelebration && shouldShowBirthdayDialog(birthdayCelebration)
      ? birthdayCelebration.dateKey
      : null
  ));
  const birthdayDialogOpen = birthdayDateKey !== null && birthdayDialogDateKey === birthdayDateKey;

  // 设置面板顶部栏滚动时才显示滚动条，滚动停止 500ms 后隐藏
  const settingsScrollEndTimerRef = useRef<number | null>(null);
  const appearanceScrollEndTimerRef = useRef<number | null>(null);

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
    if (appearanceScrollEndTimerRef.current !== null) {
      window.clearTimeout(appearanceScrollEndTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(new Date()), millisecondsUntilNextDay(today));
    return () => window.clearTimeout(timer);
  }, [today]);

  useEffect(() => {
    const celebration = getBirthdayCelebration(today);
    setBirthdayDialogDateKey(
      celebration && shouldShowBirthdayDialog(celebration) ? celebration.dateKey : null
    );
  }, [birthdayDateKey, today]);

  const handleAppearanceScroll = useCallback((event: UIEvent<HTMLElement>): void => {
    const scrollArea = event.currentTarget;
    scrollArea.classList.add("is-scrolling");

    if (appearanceScrollEndTimerRef.current !== null) {
      window.clearTimeout(appearanceScrollEndTimerRef.current);
    }
    appearanceScrollEndTimerRef.current = window.setTimeout(() => {
      scrollArea.classList.remove("is-scrolling");
      appearanceScrollEndTimerRef.current = null;
    }, 500);
  }, []);

  useEffect(() => {
    if (panelView !== "settings" || !currentUser) {
      setAppearanceOpen(false);
      setReleaseHistoryOpen(false);
    }
  }, [panelView, currentUser]);

  if (!currentUser) {
    return null;
  }

  const updateBusy = updateState.status === "checking" || updateState.status === "downloading";
  const updateAvailable = updateState.status === "available";
  const updateDownloaded = updateState.status === "downloaded";
  const showUpdateStatus = updateState.message.length > 0 || updateState.progress !== null;
  const appVersion = CURRENT_APP_VERSION;

  const selectModuleTab = (tab: ModuleTab): void => {
    if (tab === "divine") {
      void selectDivineTab();
      return;
    }
    setActiveTab(tab);
  };

  const homePanel = (
    <div className={`panel home-panel panel-layout-${desktopSettings.panelLayout}${birthdayCelebration ? " birthday-active" : ""}`}>
      <header className="topbar">
        <h1>小鳄龙之家</h1>
        {birthdayCelebration ? (
          <BirthdayCelebration
            celebration={birthdayCelebration}
            dialogOpen={birthdayDialogOpen}
            onCloseDialog={() => {
              rememberBirthdayDialog(birthdayCelebration);
              setBirthdayDialogDateKey(null);
            }}
          />
        ) : null}
      </header>

      {socketError ? <div className="connection-toast">{socketError}</div> : null}

      <StatusBar />

      <div className="panel-workspace">
        <nav className="module-tabs" aria-label="功能模块">
          {MODULE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`module-tab-button${activeTab === tab.id ? " active" : ""}`}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? "page" : undefined}
              data-label={tab.label}
              title={desktopSettings.panelLayout === "guo" ? tab.label : undefined}
              onClick={() => selectModuleTab(tab.id)}
            >
              <ModuleTabIcon tab={tab.id} />
              <span className="module-tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <main className="panel-module-content">
          {activeTab === "chat" ? <ChatPanel /> : null}

          {activeTab === "daily" ? <DailyQuestionPanel /> : null}

          {activeTab === "divine" ? <DivineSelectionPanel /> : null}

          {activeTab === "gomoku" ? <GomokuPanel /> : null}
        </main>
      </div>
    </div>
  );

  const settingsPanel = (
    <div className={`panel settings-panel ${deleteConfirmOpen || detailsOpen || appearanceOpen || releaseHistoryOpen ? "confirming" : ""}`}>
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
              className="ghost-button settings-appearance-button"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDetailsOpen(false);
                setReleaseHistoryOpen(false);
                setAppearanceSection("colors");
                setAppearanceOpen(true);
              }}
            >
              外观
            </button>
            <button
              type="button"
              className="ghost-button settings-detail-button"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setAppearanceOpen(false);
                setReleaseHistoryOpen(false);
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
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDetailsOpen(false);
                setAppearanceOpen(false);
                setReleaseHistoryOpen(true);
              }}
            >
              版本公告
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
              setAppearanceOpen(false);
              setReleaseHistoryOpen(false);
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

      {appearanceOpen ? (
        <div className="settings-appearance-layer" role="dialog" aria-modal="true" aria-label="外观设置">
          <div className="settings-appearance-card">
            <div className="settings-appearance-toprow">
              <div className="settings-appearance-tabs" role="tablist" aria-label="外观分类">
                <button
                  type="button"
                  role="tab"
                  aria-selected={appearanceSection === "colors"}
                  className={appearanceSection === "colors" ? "active" : ""}
                  onClick={() => setAppearanceSection("colors")}
                >
                  配色
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appearanceSection === "layout"}
                  className={appearanceSection === "layout" ? "active" : ""}
                  onClick={() => setAppearanceSection("layout")}
                >
                  布局
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appearanceSection === "pet"}
                  className={appearanceSection === "pet" ? "active" : ""}
                  onClick={() => setAppearanceSection("pet")}
                >
                  形象
                </button>
              </div>
              <button
                type="button"
                className="settings-appearance-close"
                aria-label="关闭外观设置"
                onClick={() => setAppearanceOpen(false)}
              />
            </div>

            {appearanceSection === "colors" ? (
              <div
                className="settings-theme-grid"
                role="tabpanel"
                aria-label="配色"
                onScroll={handleAppearanceScroll}
              >
                {COLOR_THEME_OPTIONS.map((theme) => {
                  const selected = desktopSettings.colorTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      className={`settings-theme-option${selected ? " selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => void setColorTheme(theme.id)}
                    >
                      <span className="settings-theme-swatches" aria-hidden="true">
                        {theme.swatches.map((color) => (
                          <span key={color} style={{ backgroundColor: color }} />
                        ))}
                      </span>
                      <span className="settings-theme-copy">
                        <strong>{theme.name}</strong>
                        <small>{theme.description}</small>
                      </span>
                      <span className="settings-theme-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {appearanceSection === "layout" ? (
              <div
                className="settings-layout-grid"
                role="tabpanel"
                aria-label="布局"
                onScroll={handleAppearanceScroll}
              >
                <button
                  type="button"
                  className={`settings-layout-option${desktopSettings.panelLayout === "classic" ? " selected" : ""}`}
                  aria-pressed={desktopSettings.panelLayout === "classic"}
                  onClick={() => void setPanelLayout("classic")}
                >
                  <span className="settings-layout-preview is-classic" aria-hidden="true">
                    <i className="settings-layout-preview-title" />
                    <i className="settings-layout-preview-status" />
                    <i className="settings-layout-preview-tabs" />
                    <i className="settings-layout-preview-content" />
                  </span>
                  <span className="settings-layout-copy">
                    <strong>原始布局</strong>
                    <small>顶部文字导航，保留熟悉的使用方式</small>
                  </span>
                  <span className="settings-layout-check" aria-hidden="true">
                    {desktopSettings.panelLayout === "classic" ? "✓" : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className={`settings-layout-option${desktopSettings.panelLayout === "guo" ? " selected" : ""}`}
                  aria-pressed={desktopSettings.panelLayout === "guo"}
                  onClick={() => void setPanelLayout("guo")}
                >
                  <span className="settings-layout-preview is-guo" aria-hidden="true">
                    <i className="settings-layout-preview-title" />
                    <i className="settings-layout-preview-status" />
                    <i className="settings-layout-preview-rail" />
                    <i className="settings-layout-preview-content" />
                  </span>
                  <span className="settings-layout-copy">
                    <strong>郭之布局</strong>
                    <small>左侧图标导航，把纵向空间留给内容</small>
                  </span>
                  <span className="settings-layout-check" aria-hidden="true">
                    {desktopSettings.panelLayout === "guo" ? "✓" : ""}
                  </span>
                </button>
              </div>
            ) : null}

            {appearanceSection === "pet" ? (
              <div className="settings-pet-panel" role="tabpanel" aria-label="形象">
                <strong>小鳄龙显示方式</strong>
                <div className="settings-pet-carousel">
                  <button
                    type="button"
                    className="settings-pet-nav"
                    aria-label="上一个形象"
                    onClick={() => void setPetDisplayMode(getAdjacentPetDisplayMode(desktopSettings.petDisplayMode, -1))}
                  >
                    ‹
                  </button>
                  <div className="settings-pet-preview" aria-label={`${PET_DISPLAY_MODE_LABELS[desktopSettings.petDisplayMode]}预览`}>
                    <PetSprite
                      animation="idle"
                      displayMode={desktopSettings.petDisplayMode}
                      fallbackImageUrl={mascotImage}
                      fallbackMaskUrl={mascotHitMaskImage}
                      onAnimationComplete={() => undefined}
                    />
                  </div>
                  <button
                    type="button"
                    className="settings-pet-nav"
                    aria-label="下一个形象"
                    onClick={() => void setPetDisplayMode(getAdjacentPetDisplayMode(desktopSettings.petDisplayMode, 1))}
                  >
                    ›
                  </button>
                </div>
                <p className="settings-pet-current">{PET_DISPLAY_MODE_LABELS[desktopSettings.petDisplayMode]}</p>
                <small>{PET_DISPLAY_MODE_DESCRIPTIONS[desktopSettings.petDisplayMode]}</small>
                <div className="settings-pet-dots" aria-hidden="true">
                  {PET_DISPLAY_MODES.map((mode) => (
                    <span key={mode} className={desktopSettings.petDisplayMode === mode ? "active" : ""} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {releaseHistoryOpen ? (
        <ReleaseAnnouncementDialog
          announcements={RELEASE_ANNOUNCEMENTS}
          heading="历史版本公告"
          onClose={() => setReleaseHistoryOpen(false)}
        />
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

  return (
    <>
      {panelView === "settings" ? settingsPanel : homePanel}
      {currentReleaseOpen && !birthdayDialogOpen ? (
        <ReleaseAnnouncementDialog
          announcements={[getReleaseAnnouncement(CURRENT_APP_VERSION)]}
          heading="本次更新内容"
          onClose={() => {
            rememberCurrentReleaseAnnouncement();
            setCurrentReleaseOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
