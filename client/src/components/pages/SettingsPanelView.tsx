import {
  EyeOff,
  Download,
  Power,
  Pin,
  PinOff,
  RefreshCw,
  RotateCw,
  Info
} from "lucide-react";
import clientPackage from "../../../package.json";
import { useAuth } from "../../contexts/AuthContext";
import { useDesktop } from "../../contexts/DesktopContext";
import { SettingsProfileForm } from "../panels/SettingsProfileForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Progress } from "../ui/progress";
import { Switch } from "../ui/switch";
import { PET_DISPLAY_MODE_LABELS, PET_DISPLAY_MODE_ORDER, PET_DISPLAY_MODE_SHORT } from "./settings-constants";

export function SettingsPanelView(): JSX.Element {
  const {
    deleteConfirmOpen,
    detailsOpen,
    desktopSettings,
    updateState,
    setDeleteConfirmOpen,
    setDetailsOpen,
    toggleLoginAtStartup,
    togglePanelTopmost,
    cyclePetDisplayMode,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    hideAllWindows
  } = useDesktop();
  const { accountDeleting, deleteAccount } = useAuth();

  const updateBusy = updateState.status === "checking" || updateState.status === "downloading";
  const updateAvailable = updateState.status === "available";
  const updateDownloaded = updateState.status === "downloaded";
  const showUpdateStatus = updateState.message.length > 0 || updateState.progress !== null;
  const appVersion: string = clientPackage.version;

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden p-3">
      <header className="flex items-center justify-between pb-1">
        <h2 className="text-sm font-semibold text-foreground">设置</h2>
        <span className="rounded-full bg-secondary px-2 py-px text-[10px] font-medium text-secondary-foreground">
          v{appVersion}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* —— 资料：沿用旧实现 —— */}
        <SettingsProfileForm />

        {/* —— 桌面行为 —— */}
        <Section title="桌面行为">
          <SettingRow
            icon={<Power className="size-3.5" />}
            title="开机自启"
            hint="系统启动时自动打开"
          >
            <Switch
              checked={desktopSettings.openAtLogin}
              onCheckedChange={() => void toggleLoginAtStartup()}
              aria-label="切换开机自启"
            />
          </SettingRow>
          <SettingRow
            icon={desktopSettings.panelAlwaysOnTop ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
            title="面板置顶"
            hint="始终在其它窗口之上"
          >
            <Switch
              checked={desktopSettings.panelAlwaysOnTop}
              onCheckedChange={() => void togglePanelTopmost()}
              aria-label="切换面板置顶"
            />
          </SettingRow>
          <SettingRow
            icon={<EyeOff className="size-3.5" />}
            title="隐藏小鳄龙"
            hint="立即隐藏桌宠与所有面板"
          >
            <Button variant="outline" size="sm" onClick={hideAllWindows} aria-label="隐藏小鳄龙">
              隐藏
            </Button>
          </SettingRow>
        </Section>

        {/* —— 小鳄龙显示（3 态循环） —— */}
        <Section title="小鳄龙显示" hint={PET_DISPLAY_MODE_LABELS[desktopSettings.petDisplayMode]}>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="小鳄龙显示方式">
            {PET_DISPLAY_MODE_ORDER.map((mode) => {
              const active = desktopSettings.petDisplayMode === mode;
              return (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "outline"}
                  aria-pressed={active}
                  onClick={() => void cyclePetDisplayMode()}
                >
                  {PET_DISPLAY_MODE_SHORT[mode]}
                </Button>
              );
            })}
          </div>
        </Section>

        {/* —— 更新 —— */}
        <Section title="软件更新">
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={updateBusy}
              onClick={() => void checkForUpdates()}
            >
              {updateState.status === "checking" ? (
                <RefreshCw className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              {updateState.status === "checking" ? "检查中" : "检查更新"}
            </Button>
            {updateAvailable ? (
              <Button size="sm" onClick={() => void downloadUpdate()} disabled={updateBusy}>
                <Download />
                {updateState.manual ? "DMG 下载" : "下载更新"}
              </Button>
            ) : null}
            {updateDownloaded ? (
              <Button size="sm" variant="secondary" onClick={() => void installUpdate()}>
                <RotateCw />
                重启安装
              </Button>
            ) : null}
          </div>
          {showUpdateStatus ? (
            <div className="mt-2 space-y-1.5 rounded bg-muted/50 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{updateState.message}</span>
                {updateState.progress !== null ? (
                  <span className="font-mono font-semibold text-primary">
                    {updateState.progress}%
                  </span>
                ) : null}
              </div>
              {updateState.progress !== null ? (
                <Progress value={updateState.progress} />
              ) : null}
            </div>
          ) : null}
        </Section>

        {/* —— 危险区 —— */}
        <Section title="危险操作" tone="danger">
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            注销会删除该 user 的所有记录，不可恢复。
          </p>
          <Button
            variant="destructive"
            size="sm"
            disabled={accountDeleting}
            onClick={() => {
              setDetailsOpen(false);
              setDeleteConfirmOpen(true);
            }}
          >
            {accountDeleting ? "注销中" : "注销账号"}
          </Button>
        </Section>
      </div>

      <footer className="flex items-center justify-between border-t pt-1.5 text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <Info className="size-3" />
          项目详情
        </button>
        <span>小鳄龙 v{appVersion}</span>
      </footer>

      {/* —— 详情 Dialog —— */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>项目详情</DialogTitle>
            <DialogDescription>
              小鳄龙之家的设计、架构与制作成员
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 text-sm leading-relaxed text-foreground">
            <p>
              小鳄龙之家是一个基于 React、TypeScript 与 Electron 的桌面组件项目。前端由 Vite
              构建，桌宠窗口、主面板与图片查看器通过 Electron IPC 协作，界面状态由 React
              组件集中管理。
            </p>
            <p>
              后端采用 Node.js、Express 与 Socket.IO，负责 REST 接口、实时事件、文件上传和数据持久化；公共数据结构沉淀在
              shared 包中，保持前后端类型契约一致。
            </p>
            <div className="rounded bg-accent p-2.5 text-xs font-semibold text-accent-foreground">
              制作：HJC by Codex
            </div>
            <div className="rounded bg-secondary p-2.5 text-xs font-semibold text-secondary-foreground">
              小鳄龙之家成员🥰：HJC、哆啦X梦、莴韭、can you feel my world、HSX、offset、夕惕
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* —— 注销 AlertDialog —— */}
      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!accountDeleting) {
            setDeleteConfirmOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认注销</AlertDialogTitle>
            <AlertDialogDescription>
              注销将永久删除该 user 的所有记录，包括聊天、神选、五子棋与个人资料，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accountDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={accountDeleting} onClick={() => void deleteAccount()}>
              {accountDeleting ? "注销中" : "确定"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({
  title,
  hint,
  tone,
  children
}: {
  title: string;
  hint?: string;
  tone?: "danger";
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="border-t py-2.5 first:border-t-0 first:pt-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3
          className={
            tone === "danger"
              ? "text-[11px] font-semibold text-destructive"
              : "text-[11px] font-semibold text-muted-foreground"
          }
        >
          {title}
        </h3>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

interface SettingRowProps {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}

function SettingRow({ icon, title, hint, children }: SettingRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm text-foreground">
          {title}
          {hint ? <span className="ml-1.5 text-[11px] text-muted-foreground">· {hint}</span> : null}
        </span>
      </div>
      <div className="flex min-h-[32px] shrink-0 items-center justify-end">{children}</div>
    </div>
  );
}
