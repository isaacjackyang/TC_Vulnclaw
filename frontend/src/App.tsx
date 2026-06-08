import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ShellAction } from "./components/AppShell";
import { AppShell } from "./components/AppShell";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ToastHost, type ToastItem, type ToastTone } from "./components/ToastHost";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { ReportsPage } from "./pages/ReportsPage";
import { RiskResultsPage } from "./pages/RiskResultsPage";
import { SafetyBoundaryPage } from "./pages/SafetyBoundaryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TaskConsolePage } from "./pages/TaskConsolePage";
import { createTask, openTaskStream, stopTask } from "./api/web";
import { useConfigQuery } from "./hooks/queries";
import type { TaskCommand, TaskEvent, TaskOptions, TaskRecord, TaskSummary } from "./types/api";
import { uiText, useUiLanguage } from "./utils/i18n";
import { formatTaskTitle } from "./utils/taskLabels";

type AppView = "home" | "risk" | "reports" | "boundary" | "history" | "settings" | "advanced";
type SettingsSection = "basic" | "ai" | "checks" | "boundary" | "data" | "python" | "diagnostics";

interface ReportFocus {
  target: string | null;
  path?: string;
  openPreview?: boolean;
}

const VIEW_META: Record<AppView, { eyebrow: string; title: string; copy: string }> = {
  home: {
    eyebrow: "SCAN",
    title: "New Scan",
    copy: "Enter a target and start.",
  },
  risk: {
    eyebrow: "RESULTS",
    title: "Findings",
    copy: "Verified risks and evidence.",
  },
  reports: {
    eyebrow: "REPORTS",
    title: "Reports",
    copy: "Preview and export.",
  },
  boundary: {
    eyebrow: "SCOPE",
    title: "Boundary",
    copy: "Scope limits and blocked actions.",
  },
  history: {
    eyebrow: "LOG",
    title: "History",
    copy: "Tasks and snapshots.",
  },
  settings: {
    eyebrow: "CONFIG",
    title: "Settings",
    copy: "Runtime defaults.",
  },
  advanced: {
    eyebrow: "CONTROL",
    title: "Task Console",
    copy: "Raw task controls.",
  },
};

const VIEW_META_ZH: Record<AppView, { eyebrow: string; title: string; copy: string }> = {
  home: {
    eyebrow: "掃描",
    title: "新增掃描",
    copy: "輸入目標並開始。",
  },
  risk: {
    eyebrow: "結果",
    title: "發現項目",
    copy: "已驗證風險與證據。",
  },
  reports: {
    eyebrow: "報告",
    title: "報告",
    copy: "預覽與匯出。",
  },
  boundary: {
    eyebrow: "範圍",
    title: "安全邊界",
    copy: "範圍限制與封鎖動作。",
  },
  history: {
    eyebrow: "記錄",
    title: "歷史",
    copy: "任務與快照。",
  },
  settings: {
    eyebrow: "設定",
    title: "設定",
    copy: "執行預設值。",
  },
  advanced: {
    eyebrow: "控制",
    title: "任務主控台",
    copy: "原始任務控制。",
  },
};

const HASH_TO_VIEW: Record<string, AppView> = {
  home: "home",
  risk: "risk",
  reports: "reports",
  boundary: "boundary",
  history: "history",
  settings: "settings",
  advanced: "advanced",
};

function viewFromHash(): AppView {
  const key = window.location.hash.replace(/^#/, "");
  return HASH_TO_VIEW[key] ?? "home";
}

function viewHash(view: AppView): string {
  return view;
}

export function App() {
  const configQuery = useConfigQuery();
  const queryClient = useQueryClient();
  const language = useUiLanguage();
  const viewMeta = language === "zh-TW" ? VIEW_META_ZH : VIEW_META;
  const [activeView, setActiveView] = useState<AppView>(() => viewFromHash());
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [reportFocus, setReportFocus] = useState<ReportFocus | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("basic");
  const [taskEvents, setTaskEvents] = useState<TaskEvent[]>([]);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const nav = useMemo(
    () => [
      { key: "home" as const, label: uiText(language, "Scan", "掃描"), description: "", icon: "/icons/sidebar/scan.svg" },
      { key: "risk" as const, label: uiText(language, "Findings", "發現"), description: "", icon: "/icons/sidebar/findings.svg" },
      { key: "reports" as const, label: uiText(language, "Reports", "報告"), description: "", icon: "/icons/sidebar/reports.svg" },
      { key: "boundary" as const, label: uiText(language, "Scope", "範圍"), description: "", icon: "/icons/sidebar/scope.svg" },
      { key: "history" as const, label: uiText(language, "History", "歷史"), description: "", icon: "/icons/sidebar/history.svg" },
      { key: "settings" as const, label: uiText(language, "Settings", "設定"), description: "", icon: "/icons/sidebar/settings.svg" },
    ],
    [language],
  );

  const latestEvent = taskEvents.length > 0 ? taskEvents[taskEvents.length - 1] : null;
  const hasStoppableTask = activeTask?.status === "running" || activeTask?.status === "pending";

  useEffect(() => {
    const handleHashChange = () => setActiveView(viewFromHash());
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function navigateToView(view: AppView) {
    const nextHash = viewHash(view);
    if (window.location.hash !== `#${nextHash}`) {
      window.location.hash = nextHash;
    }
    setActiveView(view);
  }

  function eventSummary(event: TaskEvent): TaskSummary | null {
    const summary = event.payload.summary;
    return summary && typeof summary === "object" ? (summary as TaskSummary) : null;
  }

  function pushToast(
    tone: ToastTone,
    title: string,
    copy?: string,
    action?: Pick<ToastItem, "actionLabel" | "onAction">,
  ) {
    const id = Date.now() + Math.round(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-3), { id, tone, title, copy, ...action }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4800);
  }

  function refreshTaskData(target: string | null | undefined) {
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["targets"] });
    void queryClient.invalidateQueries({ queryKey: ["constraint-audit"] });
    void queryClient.invalidateQueries({ queryKey: ["reports"] });
    if (target) {
      void queryClient.invalidateQueries({ queryKey: ["target", target] });
      void queryClient.invalidateQueries({ queryKey: ["target-preview", target] });
      void queryClient.invalidateQueries({ queryKey: ["target-snapshots", target] });
    }
  }

  useEffect(() => {
    if (!activeTask) return;
    const source = openTaskStream(activeTask.task_id, (event) => {
      setTaskEvents((prev) => [...prev.slice(-79), event]);
      if (event.event === "task_completed") {
        const summary = eventSummary(event);
        setActiveTask((prev) =>
          prev && prev.task_id === event.task_id
            ? { ...prev, status: "completed", summary: summary ?? prev.summary }
            : prev,
        );
        refreshTaskData(summary?.target ?? activeTask.target);
        pushToast(
          "success",
          uiText(language, "Task finished", "任務已完成"),
          uiText(language, "Review the risk results or generate a report.", "請檢視風險結果或產生報告。"),
          {
            actionLabel: uiText(language, "Open results", "開啟結果"),
            onAction: () => {
              setSelectedTarget(summary?.target ?? activeTask.target);
              navigateToView("risk");
            },
          },
        );
      }
      if (event.event === "task_failed") {
        setActiveTask((prev) => (prev && prev.task_id === event.task_id ? { ...prev, status: "failed" } : prev));
        refreshTaskData(activeTask.target);
        pushToast("error", uiText(language, "Task failed", "任務失敗"), String(event.payload.message ?? event.payload.error ?? uiText(language, "Check advanced logs.", "請檢查進階記錄。")), {
          actionLabel: uiText(language, "Open console", "開啟主控台"),
          onAction: () => navigateToView("advanced"),
        });
      }
      if (event.event === "task_stopped") {
        setActiveTask((prev) => (prev && prev.task_id === event.task_id ? { ...prev, status: "stopped" } : prev));
        refreshTaskData(activeTask.target);
        pushToast("info", uiText(language, "Task stopped", "任務已停止"), uiText(language, "Saved state and reports remain available.", "已儲存的狀態與報告仍可使用。"));
      }
    });
    return () => source.close();
  }, [activeTask?.task_id]);

  async function handleCreateTask(command: TaskCommand, target: string, resume: boolean, options: TaskOptions): Promise<TaskRecord> {
    const task = await createTask(command, target, resume, options);
    setActiveTask(task);
    setSelectedTarget(task.target);
    setTaskEvents([]);
    pushToast("success", uiText(language, "Task started", "任務已開始"), formatTaskTitle(task.command, task.target));
    return task;
  }

  async function handleStopTask() {
    if (!activeTask) return;
    await stopTask(activeTask.task_id);
    setActiveTask((prev) => (prev ? { ...prev, status: "stopped" } : prev));
    refreshTaskData(activeTask.target);
    pushToast("info", uiText(language, "Stop request sent", "已送出停止要求"), uiText(language, "VulnClaw is ending the current task.", "VulnClaw 正在結束目前任務。"));
  }

  function openBoundaryForActiveTask() {
    if (activeTask?.target) {
      setSelectedTarget(activeTask.target);
    }
    navigateToView("boundary");
  }

  function openReports(target: string | null = selectedTarget, path?: string, openPreview = false) {
    if (target) {
      setSelectedTarget(target);
    }
    setReportFocus({ target, path, openPreview });
    navigateToView("reports");
  }

  function openSettings(section: SettingsSection = "basic") {
    setSettingsSection(section);
    navigateToView("settings");
  }

  function handleSelectView(view: AppView) {
    if (view === "settings") {
      setSettingsSection("basic");
    }
    navigateToView(view);
  }

  const quickActions: ShellAction[] = [
    { label: uiText(language, "New scan", "新增掃描"), glyph: "+", active: activeView === "home", onClick: () => navigateToView("home") },
    { label: uiText(language, "History", "歷史"), glyph: "T", active: activeView === "history", onClick: () => navigateToView("history") },
    { label: uiText(language, "Reports", "報告"), glyph: "R", active: activeView === "reports", onClick: () => openReports(activeTask?.target ?? selectedTarget) },
    {
      label: uiText(language, "Assets", "資產"),
      glyph: "A",
      active: activeView === "risk",
      onClick: () => {
        if (activeTask?.target) setSelectedTarget(activeTask.target);
        navigateToView("risk");
      },
    },
    {
      label: uiText(language, "Scope", "範圍"),
      glyph: "IP",
      active: activeView === "boundary",
      onClick: openBoundaryForActiveTask,
    },
    {
      label: uiText(language, "Findings", "發現"),
      glyph: "!",
      active: activeView === "risk",
      onClick: () => navigateToView("risk"),
    },
    { label: uiText(language, "Console", "主控台"), glyph: "C", active: activeView === "advanced", onClick: () => navigateToView("advanced") },
    {
      label: uiText(language, "Refresh", "重新整理"),
      glyph: "F",
      onClick: () => refreshTaskData(activeTask?.target ?? selectedTarget),
    },
  ];

  const sidebarActions: ShellAction[] = [
    hasStoppableTask
      ? { label: uiText(language, "Stop task", "停止任務"), glyph: "ST", onClick: () => setStopConfirmOpen(true) }
      : { label: uiText(language, "Home", "首頁"), glyph: "H", active: activeView === "home", onClick: () => navigateToView("home") },
    { label: uiText(language, "Settings", "設定"), glyph: "S", active: activeView === "settings", onClick: () => openSettings("basic") },
    { label: uiText(language, "Console", "主控台"), glyph: "C", active: activeView === "advanced", onClick: () => navigateToView("advanced") },
  ];

  return (
    <AppShell
      activeView={activeView}
      activeNavView={activeView === "advanced" ? "settings" : activeView}
      nav={nav}
      meta={viewMeta[activeView]}
      quickActions={quickActions}
      sidebarActions={sidebarActions}
      backendUnavailable={configQuery.isError}
      backendError={configQuery.error instanceof Error ? configQuery.error.message : undefined}
      onRetryBackend={() => void configQuery.refetch()}
      selectedTarget={selectedTarget}
      activeTask={activeTask}
      latestEvent={latestEvent}
      onSelectView={handleSelectView}
      onOpenAdvanced={() => navigateToView("advanced")}
      onOpenBoundary={openBoundaryForActiveTask}
      onOpenReports={() => openReports()}
      onOpenTarget={(target) => {
        setSelectedTarget(target);
        navigateToView("risk");
      }}
      onStopTask={() => setStopConfirmOpen(true)}
    >
      {activeView === "home" && (
        <HomePage
          selectedTarget={selectedTarget}
          activeTask={activeTask}
          latestEvent={latestEvent}
          taskEvents={taskEvents}
          onCreateTask={handleCreateTask}
          onOpenRisk={() => navigateToView("risk")}
          onOpenReports={() => openReports(activeTask?.target ?? selectedTarget)}
          onOpenBoundary={openBoundaryForActiveTask}
        />
      )}

      {activeView === "risk" && (
        <RiskResultsPage
          selectedTarget={selectedTarget}
          onSelectTarget={setSelectedTarget}
          onOpenHome={() => navigateToView("home")}
          onOpenReports={(path) => openReports(selectedTarget, path, Boolean(path))}
          onOpenBoundary={openBoundaryForActiveTask}
        />
      )}

      {activeView === "reports" && <ReportsPage selectedTarget={selectedTarget} focus={reportFocus} />}

      {activeView === "boundary" && (
        <SafetyBoundaryPage
          selectedTarget={selectedTarget}
          activeTask={activeTask}
          onOpenHome={() => navigateToView("home")}
          onOpenSettings={() => openSettings("boundary")}
          onSelectTarget={setSelectedTarget}
        />
      )}

      {activeView === "history" && (
        <HistoryPage
          selectedTarget={selectedTarget}
          onSelectTarget={setSelectedTarget}
          onOpenHome={() => navigateToView("home")}
          onOpenReports={(target) => openReports(target)}
          onOpenTarget={(target) => {
            setSelectedTarget(target);
            navigateToView("risk");
          }}
        />
      )}

      {activeView === "settings" && <SettingsPage initialSection={settingsSection} onOpenAdvanced={() => navigateToView("advanced")} />}

      {activeView === "advanced" && (
        <TaskConsolePage
          activeTask={activeTask}
          events={taskEvents}
          onTaskCreated={(task) => {
            setActiveTask(task);
            setSelectedTarget(task.target);
            setTaskEvents([]);
            navigateToView("advanced");
          }}
          onEvent={(event) => {
            setTaskEvents((prev) => [...prev.slice(-79), event]);
          }}
          onFocusTarget={(target) => {
            setSelectedTarget(target);
            navigateToView("risk");
          }}
        />
      )}

      <ConfirmDialog
        open={stopConfirmOpen}
        title={uiText(language, "Stop current scan?", "要停止目前掃描嗎？")}
        copy={uiText(language, "Stopping will end the current task, but saved state and reports will remain available.", "停止會結束目前任務，但已儲存的狀態與報告仍會保留。")}
        tone="danger"
        confirmLabel={uiText(language, "Stop task", "停止任務")}
        onCancel={() => setStopConfirmOpen(false)}
        onConfirm={() => {
          setStopConfirmOpen(false);
          void handleStopTask();
        }}
      />
      <ToastHost toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </AppShell>
  );
}
