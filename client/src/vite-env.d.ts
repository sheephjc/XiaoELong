/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type XiaoELongUpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error"
  | "unavailable";

interface XiaoELongUpdateState {
  status: XiaoELongUpdateStatus;
  message: string;
  version: string;
  progress: number | null;
  manual: boolean;
}

interface XiaoELongDesktopSettings {
  openAtLogin: boolean;
  panelAlwaysOnTop: boolean;
  petDisplayMode: "dynamic" | "static" | "image";
  petAnimationsEnabled: boolean;
  petDisplayModePersisted: boolean;
}

interface Window {
  readonly xiaoelongDesktop?: {
    readonly isDesktop: boolean;
    readonly role?: "auth" | "avatar" | "panel" | "divine" | "imageViewer";
    readonly setWindowMode?: (mode: "auth" | "collapsed" | "expanded") => void;
    readonly toggleHomePanel?: () => void;
    readonly openSettingsPanel?: () => void;
    readonly openDivineSelection?: (
      data?: import("@xiaoelong/shared").DeityWorshipTodayResponse | null
    ) => Promise<{ ok: boolean; error?: string }>;
    readonly getInitialDivineData?: () => import("@xiaoelong/shared").DeityWorshipTodayResponse | null;
    readonly getInitialDivineSession?: () => {
      requestId: number;
      data: import("@xiaoelong/shared").DeityWorshipTodayResponse | null;
    };
    readonly onDivineData?: (
      callback: (session: {
        requestId: number;
        data: import("@xiaoelong/shared").DeityWorshipTodayResponse | null;
      }) => void
    ) => () => void;
    readonly notifyDivineReady?: (requestId: number) => void;
    readonly updateDivineSelectionData?: (
      data: import("@xiaoelong/shared").DeityWorshipTodayResponse
    ) => void;
    readonly closeDivineSelection?: (completed?: boolean) => void;
    readonly getInitialPanelSession?: () => {
      requestId: number;
      view: "home" | "settings";
    };
    readonly notifyPanelReady?: (requestId: number) => void;
    readonly getPanelVisibility?: () => boolean;
    readonly setPanelContentExtraHeight?: (height: number) => void;
    readonly notifyLogin?: (token: string) => void;
    readonly getPersistedAccessToken?: () => string | null;
    readonly persistAccessToken?: (token: string) => void;
    readonly clearPersistedAccessToken?: () => void;
    readonly hideAllWindows?: () => void;
    readonly setMoodPromptVisible?: (visible: boolean) => void;
    readonly setAvatarClickThrough?: (enabled: boolean) => void;
    readonly openImageViewer?: (payload: {
      images: Array<{
        url: string;
        name: string;
        userNickname: string;
      }>;
      index: number;
    }) => void;
    readonly requestLogout?: () => void;
    readonly getSettings?: () => Promise<XiaoELongDesktopSettings>;
    readonly setLoginAtStartup?: (enabled: boolean) => Promise<XiaoELongDesktopSettings>;
    readonly setPanelAlwaysOnTop?: (enabled: boolean) => Promise<XiaoELongDesktopSettings>;
    readonly setPetDisplayMode?: (
      mode: "dynamic" | "static" | "image"
    ) => Promise<XiaoELongDesktopSettings>;
    readonly migratePetDisplayMode?: (
      mode: "dynamic" | "static" | "image"
    ) => Promise<XiaoELongDesktopSettings>;
    readonly setPetAnimationsEnabled?: (enabled: boolean) => Promise<XiaoELongDesktopSettings>;
    readonly getUpdateState?: () => Promise<XiaoELongUpdateState>;
    readonly checkForUpdates?: () => Promise<XiaoELongUpdateState>;
    readonly downloadUpdate?: () => Promise<XiaoELongUpdateState>;
    readonly installUpdate?: () => Promise<XiaoELongUpdateState>;
    readonly onUpdateState?: (callback: (state: XiaoELongUpdateState) => void) => () => void;
    readonly onPanelViewChange?: (
      callback: (session: { requestId: number; view: "home" | "settings" }) => void
    ) => () => void;
    readonly onPanelVisibilityChange?: (callback: (visible: boolean) => void) => () => void;
    readonly onDivineReturn?: (
      callback: (state: {
        completed: boolean;
        data: import("@xiaoelong/shared").DeityWorshipTodayResponse | null;
      }) => void
    ) => () => void;
    readonly onSettingsChange?: (callback: (settings: XiaoELongDesktopSettings) => void) => () => void;
    readonly onLogout?: (callback: () => void) => () => void;
    readonly onLogin?: (callback: (token: string) => void) => () => void;
    readonly onPlacementChange?: (
      callback: (placement: "upper-left" | "upper-right" | "lower-left" | "lower-right") => void
    ) => () => void;
    readonly startDrag?: () => void;
    readonly moveDrag?: () => void;
    readonly endDrag?: () => void;
  };

  readonly xiaoelongImageViewer?: {
    readonly close: () => void;
    readonly previous: () => void;
    readonly next: () => void;
    readonly onStateChange: (
      callback: (state: {
        images: Array<{
          url: string;
          name: string;
          userNickname: string;
        }>;
        index: number;
      }) => void
    ) => () => void;
  };
}
