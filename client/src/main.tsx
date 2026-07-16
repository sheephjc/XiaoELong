import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./divine-constellation.css";

const RENDER_RECOVERY_KEY = "xiaoelong_renderer_recovery_at";
const RENDER_RECOVERY_WINDOW_MS = 60_000;

interface AppErrorBoundaryState {
  error: Error | null;
  reloading: boolean;
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
    reloading: false
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, reloading: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[Renderer] React tree crashed.", error, info.componentStack);

    const previousRecoveryAt = Number(sessionStorage.getItem(RENDER_RECOVERY_KEY) ?? 0);
    if (Date.now() - previousRecoveryAt <= RENDER_RECOVERY_WINDOW_MS) {
      return;
    }

    sessionStorage.setItem(RENDER_RECOVERY_KEY, String(Date.now()));
    this.setState({ reloading: true });
    window.setTimeout(() => window.location.reload(), 250);
  }

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="page shell-page renderer-error-page">
        <section className="renderer-error-card">
          <h1>{this.state.reloading ? "正在恢复面板…" : "面板暂时无法显示"}</h1>
          <p>{this.state.reloading ? "检测到显示异常，正在重新加载。" : "自动恢复未成功，请手动重新加载。"}</p>
          {!this.state.reloading ? (
            <button type="button" onClick={() => window.location.reload()}>
              重新加载面板
            </button>
          ) : null}
        </section>
      </main>
    );
  }
}

function AppRecoveryMarker(): JSX.Element {
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem(RENDER_RECOVERY_KEY);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, []);

  return <App />;
}

if (window.xiaoelongDesktop?.isDesktop) {
  const role = window.xiaoelongDesktop.role ?? new URLSearchParams(window.location.search).get("desktopRole") ?? "auth";
  document.documentElement.classList.add("desktop-runtime");
  document.documentElement.classList.add(`desktop-role-${role}`);
  document.documentElement.dataset.desktopRole = role;
  document.documentElement.dataset.desktopPlacement = "upper-left";
  window.xiaoelongDesktop.onPlacementChange?.((placement) => {
    document.documentElement.dataset.desktopPlacement = placement;
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppRecoveryMarker />
    </AppErrorBoundary>
  </React.StrictMode>
);
