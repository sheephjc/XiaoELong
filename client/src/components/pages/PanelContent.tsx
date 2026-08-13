import { useAuth } from "../../contexts/AuthContext";
import { useChat } from "../../contexts/ChatContext";
import { useDeity } from "../../contexts/DeityContext";
import { useDesktop } from "../../contexts/DesktopContext";
import { ChatPanel } from "../panels/ChatPanel";
import { DailyQuestionPanel } from "../panels/DailyQuestionPanel";
import { DivineSelectionPanel } from "../panels/DivineSelectionPanel";
import { GomokuPanel } from "../panels/GomokuPanel";
import { StatusBar } from "../panels/StatusBar";
import { SettingsPanelView } from "./SettingsPanelView";

export function PanelContent(): JSX.Element | null {
  const { activeTab, panelView, setActiveTab } = useDesktop();
  const { socketError } = useChat();
  const { selectDivineTab } = useDeity();
  const { currentUser } = useAuth();

  if (!currentUser) {
    return null;
  }

  // 设置视图已迁到 shadcn + Tailwind，单独抽出
  if (panelView === "settings") {
    return <SettingsPanelView />;
  }

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

  return homePanel;
}