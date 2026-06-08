import type { ReactNode } from "react";
import type { TaskEvent, TaskRecord } from "../types/api";
import { ActiveTaskBanner } from "./ActiveTaskBanner";
import { Sidebar, type NavItem } from "./Sidebar";
import { Topbar } from "./Topbar";
import { uiText, useUiLanguage } from "../utils/i18n";

interface ViewMeta {
  eyebrow: string;
  title: string;
  copy: string;
}

export interface ShellAction {
  label: string;
  glyph: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

interface AppShellProps<T extends string> {
  activeView: T;
  activeNavView?: T;
  nav: NavItem<T>[];
  meta: ViewMeta;
  quickActions: ShellAction[];
  sidebarActions: ShellAction[];
  backendUnavailable?: boolean;
  backendError?: string;
  onRetryBackend?: () => void;
  selectedTarget: string | null;
  activeTask: TaskRecord | null;
  latestEvent: TaskEvent | null;
  onSelectView: (view: T) => void;
  onOpenAdvanced: () => void;
  onOpenBoundary: () => void;
  onOpenReports: () => void;
  onOpenTarget: (target: string) => void;
  onStopTask: () => void;
  children: ReactNode;
}

export function AppShell<T extends string>({
  activeView,
  activeNavView,
  nav,
  meta,
  quickActions,
  sidebarActions,
  backendUnavailable = false,
  backendError,
  onRetryBackend,
  selectedTarget,
  activeTask,
  latestEvent,
  onSelectView,
  onOpenAdvanced,
  onOpenBoundary,
  onOpenReports,
  onOpenTarget,
  onStopTask,
  children,
}: AppShellProps<T>) {
  const language = useUiLanguage();

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        activeNavView={activeNavView}
        nav={nav}
        footerActions={sidebarActions}
        onSelectView={onSelectView}
      />
      <main className="workspace">
        <Topbar
          eyebrow={meta.eyebrow}
          title={meta.title}
          copy={meta.copy}
          selectedTarget={selectedTarget}
          activeTaskStatus={activeTask?.status}
        />
        {backendUnavailable && (
          <section className="connection-banner" role="status">
            <div>
              <strong>{uiText(language, "Backend unavailable", "後端無法連線")}</strong>
              <span>
                {uiText(language, "Start", "請啟動")} <code>vulnclaw web</code>
                {uiText(language, " and open the local address to load the live console.", "，並開啟本機網址載入即時主控台。")}
              </span>
              {backendError && <small>{backendError}</small>}
            </div>
            {onRetryBackend && (
              <button className="secondary-btn" onClick={onRetryBackend} type="button">
                {uiText(language, "Retry", "重試")}
              </button>
            )}
          </section>
        )}
        <ActiveTaskBanner
          task={activeTask}
          latestEvent={latestEvent}
          onOpenAdvanced={onOpenAdvanced}
          onOpenBoundary={onOpenBoundary}
          onOpenReports={onOpenReports}
          onOpenTarget={onOpenTarget}
          onStop={onStopTask}
        />
        <div className="view-mount">{children}</div>
      </main>
      <aside className="quick-rail" aria-label={uiText(language, "quick actions", "快速動作")}>
        <div className="quick-rail-main">
          {quickActions.map((item) => (
            <button
              key={item.label}
              type="button"
              className={item.active ? "active" : ""}
              title={item.label}
              aria-label={item.label}
              disabled={item.disabled}
              onClick={item.onClick}
            >
              <span>{item.glyph}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
