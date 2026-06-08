import { useEffect, useMemo, useState } from "react";
import type { TaskCommand, TaskEvent, TaskOptions, TaskRecord, TaskSummary } from "../types/api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SectionCard } from "../components/SectionCard";
import { uiText, type UiLanguage, useUiLanguage } from "../utils/i18n";
import { loadUiPreferences, subscribeUiPreferences } from "../utils/preferences";
import {
  countConstraintViolations,
  formatActionLabel,
  formatActionList,
  formatEventLabel,
  formatPhaseLabel,
  formatTaskCommand,
  formatTaskStatus,
} from "../utils/taskLabels";
import { parseOptionalPort } from "../utils/validation";

type CheckMode = "quick" | "standard" | "deep" | "continuous";

interface HomePageProps {
  selectedTarget: string | null;
  activeTask: TaskRecord | null;
  latestEvent: TaskEvent | null;
  taskEvents: TaskEvent[];
  onCreateTask: (command: TaskCommand, target: string, resume: boolean, options: TaskOptions) => Promise<TaskRecord>;
  onOpenRisk: () => void;
  onOpenReports: () => void;
  onOpenBoundary: () => void;
}

const MODES: Array<{
  key: CheckMode;
  title: string;
  copy: string;
  command: TaskCommand;
  allowActions?: string[];
  blockActions?: string[];
}> = [
  {
    key: "quick",
    title: "Quick",
    copy: "Light discovery.",
    command: "recon",
    allowActions: ["recon"],
    blockActions: ["exploit", "persistent"],
  },
  {
    key: "standard",
    title: "Standard",
    copy: "Recommended scan.",
    command: "run",
    allowActions: ["recon", "scan"],
    blockActions: ["post_exploitation"],
  },
  {
    key: "deep",
    title: "Deep",
    copy: "More checks.",
    command: "scan",
    allowActions: ["recon", "scan", "exploit"],
  },
  {
    key: "continuous",
    title: "Loop",
    copy: "Repeat scan.",
    command: "persistent",
    allowActions: ["recon", "scan", "persistent"],
    blockActions: ["post_exploitation"],
  },
];

const ACTION_OPTIONS = [
  { value: "recon", copy: "Asset discovery and public signal collection." },
  { value: "scan", copy: "Service and entry-point identification." },
  { value: "exploit", copy: "Verification actions that need explicit approval." },
  { value: "persistent", copy: "Multi-round continuous checking." },
  { value: "post_exploitation", copy: "Post-exploitation steps, usually blocked." },
];

const MODE_COPY_ZH: Record<CheckMode, { title: string; copy: string }> = {
  quick: { title: "快速", copy: "輕量探索。" },
  standard: { title: "標準", copy: "建議掃描。" },
  deep: { title: "深度", copy: "更多檢查。" },
  continuous: { title: "循環", copy: "重複掃描。" },
};

function modeTitle(mode: CheckMode, title: string, language: UiLanguage): string {
  return uiText(language, title, MODE_COPY_ZH[mode].title);
}

function modeCopy(mode: CheckMode, copy: string, language: UiLanguage): string {
  return uiText(language, copy, MODE_COPY_ZH[mode].copy);
}

function latestEventText(event: TaskEvent | null, language: UiLanguage): string {
  if (!event) return uiText(language, "Waiting for task events.", "等待任務事件。");
  const message = event.payload.message ?? event.payload.text;
  if (typeof message === "string" && message.trim()) return message;
  if (typeof event.payload.phase === "string" && event.payload.phase.trim()) {
    return formatPhaseLabel(event.payload.phase);
  }
  return formatEventLabel(event.event);
}

function currentPhaseKey(task: TaskRecord | null, event: TaskEvent | null): string {
  if (!task) return "scope";
  if (task.status === "completed" || task.status === "failed" || task.status === "stopped") return "report";
  const text = `${event?.payload.phase ?? ""} ${event?.event ?? ""} ${task.latest_phase ?? ""}`.toLowerCase();
  if (text.includes("report")) return "report";
  if (text.includes("exploit") || text.includes("verify")) return "verify";
  if (text.includes("scan")) return "scan";
  if (text.includes("recon")) return "recon";
  return task.status === "running" ? "recon" : "scope";
}

function taskResultTitle(task: TaskRecord, language: UiLanguage): string {
  if (task.status === "completed") return uiText(language, "Scan complete", "掃描完成");
  if (task.status === "failed") return uiText(language, "Scan stopped by an error", "掃描因錯誤停止");
  if (task.status === "stopped") return uiText(language, "Scan stopped", "掃描已停止");
  return `${uiText(language, "Scanning", "掃描中")} ${task.target}`;
}

function eventSummary(event: TaskEvent | null): TaskSummary | null {
  const summary = event?.payload.summary;
  return summary && typeof summary === "object" ? (summary as TaskSummary) : null;
}

function taskSummary(task: TaskRecord, event: TaskEvent | null): TaskSummary | null {
  return task.summary ?? eventSummary(event);
}

function formatEventPayload(event: TaskEvent): string {
  return JSON.stringify(event.payload, null, 2);
}

function joinScopeItems(items: string[], language: UiLanguage): string {
  return items.length ? items.join(" - ") : uiText(language, "Auto scope", "自動範圍");
}

function inferScopeFromTarget(value: string): { host: string; port: string; path: string } {
  const target = value.trim();
  if (!target) return { host: "", port: "", path: "" };
  try {
    const parsed = new URL(target.includes("://") ? target : `https://${target}`);
    const inferredPath = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return { host: parsed.hostname, port: parsed.port, path: inferredPath };
  } catch {
    const withoutScheme = target.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    const match = withoutScheme.match(/^([^/:?#]+)(?::([^/?#]+))?(\/[^?#]*)?/);
    const inferredPath = match?.[3] && match[3] !== "/" ? match[3] : "";
    return { host: match?.[1] ?? "", port: match?.[2] ?? "", path: inferredPath };
  }
}

function uniqueActions(actions: Array<string | undefined>): string[] {
  return Array.from(new Set(actions.filter((action): action is string => Boolean(action))));
}

export function HomePage({ selectedTarget, activeTask, latestEvent, taskEvents, onCreateTask, onOpenRisk, onOpenReports, onOpenBoundary }: HomePageProps) {
  const language = useUiLanguage();
  const preferences = loadUiPreferences();
  const [target, setTarget] = useState(selectedTarget ?? "");
  const [mode, setMode] = useState<CheckMode>(() => preferences.defaultCheckMode);
  const [onlyPort, setOnlyPort] = useState(preferences.defaultBoundary.onlyPort);
  const [onlyHost, setOnlyHost] = useState(preferences.defaultBoundary.onlyHost);
  const [onlyPath, setOnlyPath] = useState(preferences.defaultBoundary.onlyPath);
  const [blockedHost, setBlockedHost] = useState(preferences.defaultBoundary.blockedHost);
  const [blockedPath, setBlockedPath] = useState(preferences.defaultBoundary.blockedPath);
  const [allowActions, setAllowActions] = useState<string[]>(preferences.defaultBoundary.allowActions);
  const [blockActions, setBlockActions] = useState<string[]>(preferences.defaultBoundary.blockActions);
  const [resume, setResume] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [technicalLogsOpen, setTechnicalLogsOpen] = useState(() => preferences.showTechnicalLogs);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeUiPreferences((nextPreferences) => {
    setMode(nextPreferences.defaultCheckMode);
    setTechnicalLogsOpen(nextPreferences.showTechnicalLogs);
    setOnlyPort(nextPreferences.defaultBoundary.onlyPort);
    setOnlyHost(nextPreferences.defaultBoundary.onlyHost);
    setOnlyPath(nextPreferences.defaultBoundary.onlyPath);
    setBlockedHost(nextPreferences.defaultBoundary.blockedHost);
    setBlockedPath(nextPreferences.defaultBoundary.blockedPath);
    setAllowActions(nextPreferences.defaultBoundary.allowActions);
    setBlockActions(nextPreferences.defaultBoundary.blockActions);
  }), []);

  useEffect(() => {
    if (selectedTarget) setTarget(selectedTarget);
  }, [selectedTarget]);

  const selectedMode = useMemo(() => MODES.find((item) => item.key === mode) ?? MODES[1], [mode]);
  const inferredScope = inferScopeFromTarget(target);
  const effectiveOnlyHost = onlyHost.trim() || inferredScope.host;
  const effectiveOnlyPort = onlyPort.trim() || inferredScope.port;
  const effectiveOnlyPath = onlyPath.trim() || inferredScope.path;
  const scopeCount = [effectiveOnlyPort, effectiveOnlyHost, effectiveOnlyPath, blockedHost, blockedPath].filter((item) => item.trim()).length;
  const activeSummary = activeTask ? taskSummary(activeTask, latestEvent) : null;
  const boundaryBlockCount = countConstraintViolations(activeSummary?.constraint_violation_events, activeSummary?.constraint_violations);
  const inferredLabel = uiText(language, " (inferred)", "（推斷）");
  const scopePreview = joinScopeItems([
    effectiveOnlyHost ? `${uiText(language, "host", "主機")} ${effectiveOnlyHost}${onlyHost.trim() ? "" : inferredLabel}` : "",
    effectiveOnlyPort ? `${uiText(language, "port", "連接埠")} ${effectiveOnlyPort}${onlyPort.trim() ? "" : inferredLabel}` : "",
    effectiveOnlyPath ? `${uiText(language, "path", "路徑")} ${effectiveOnlyPath}${onlyPath.trim() ? "" : inferredLabel}` : "",
    blockedHost.trim() ? `${uiText(language, "block host", "封鎖主機")} ${blockedHost.trim()}` : "",
    blockedPath.trim() ? `${uiText(language, "block path", "封鎖路徑")} ${blockedPath.trim()}` : "",
  ].filter(Boolean), language);
  const effectiveAllowActions = uniqueActions([...(allowActions.length ? allowActions : selectedMode.allowActions ?? []), selectedMode.command]);
  const effectiveBlockActions = uniqueActions(blockActions.length ? blockActions : selectedMode.blockActions ?? [])
    .filter((action) => action !== selectedMode.command);
  const allowPreview = formatActionList(effectiveAllowActions);
  const blockPreview = formatActionList(effectiveBlockActions);
  const requiresExtraCare = mode === "deep" || mode === "continuous";
  const confirmCopy = [
    `${uiText(language, "Target", "目標")}: ${target.trim() || uiText(language, "Not set", "未設定")}`,
    `${uiText(language, "Mode", "模式")}: ${modeTitle(selectedMode.key, selectedMode.title, language)}`,
    `${uiText(language, "Scope", "範圍")}: ${scopePreview}`,
    requiresExtraCare ? uiText(language, "This scan may run longer.", "此掃描可能需要較長時間。") : "",
  ].join("\n");

  function buildOptions(): TaskOptions {
    return {
      only_port: parseOptionalPort(effectiveOnlyPort),
      only_host: effectiveOnlyHost || undefined,
      only_path: effectiveOnlyPath || undefined,
      blocked_host: blockedHost.trim() || undefined,
      blocked_path: blockedPath.trim() || undefined,
      allow_actions: effectiveAllowActions,
      block_actions: effectiveBlockActions,
    };
  }

  function toggleAction(
    value: string,
    selected: string[],
    setSelected: (next: string[]) => void,
    oppositeSelected?: string[],
    setOppositeSelected?: (next: string[]) => void,
  ) {
    const isSelected = selected.includes(value);
    setSelected(isSelected ? selected.filter((item) => item !== value) : [...selected, value]);
    if (!isSelected && oppositeSelected && setOppositeSelected) {
      setOppositeSelected(oppositeSelected.filter((item) => item !== value));
    }
  }

  async function submit() {
    try {
      setSubmitting(true);
      setError(null);
      await onCreateTask(selectedMode.command, target.trim(), resume, buildOptions());
    } catch (err) {
      setError(err instanceof Error ? err.message : uiText(language, "Failed to start task", "無法啟動任務"));
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  function handleStart() {
    try {
      parseOptionalPort(effectiveOnlyPort);
      if (mode === "continuous" && effectiveOnlyPath) {
        setError(uiText(language, "Continuous mode does not support a path-only scope.", "持續模式不支援僅限路徑的範圍。"));
        return;
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : uiText(language, "Invalid port format", "連接埠格式無效"));
      return;
    }
    if (requiresExtraCare) {
      setConfirmOpen(true);
      return;
    }
    void submit();
  }

  const phaseKey = currentPhaseKey(activeTask, latestEvent);
  const phaseSteps = [
    ["scope", uiText(language, "Scope", "範圍")],
    ["recon", uiText(language, "Recon", "偵察")],
    ["scan", uiText(language, "Scan", "掃描")],
    ["verify", uiText(language, "Verify", "驗證")],
    ["report", uiText(language, "Report", "報告")],
  ] as const;

  return (
    <section className="home-page">
      <div className="goby-home-board">
        <div className="goby-welcome-panel" aria-hidden="true">
          <div className="goby-map-illustration">
            <span className="map-node map-node-a">IP</span>
            <span className="map-node map-node-b">WEB</span>
            <span className="map-node map-node-c">APP</span>
            <span className="map-node map-node-d">CVE</span>
            <div className="map-ring">
              <div className="map-shield">VC</div>
            </div>
          </div>
          <div className="goby-welcome-copy">
            <h2>{uiText(language, "Welcome to VulnClaw", "歡迎使用 VulnClaw")}</h2>
            <p>{uiText(language, "Attack surface mapping", "攻擊面測繪")}</p>
          </div>
          <button
            type="button"
            className={`goby-scan-orb ${submitting ? "hero-orb-busy" : ""}`}
            disabled={submitting || !target.trim()}
            onClick={handleStart}
          >
            {submitting ? uiText(language, "Starting", "啟動中") : uiText(language, "Scan", "掃描")}
          </button>
        </div>

        <div className="scan-launch goby-task-panel">
          <div className="goby-task-title">
            <span className="goby-task-icon">▣</span>
            <strong>{uiText(language, "New Scan Task", "新增掃描任務")}</strong>
            <button type="button" className="text-btn inline-text-btn" onClick={() => setTarget("")} aria-label={uiText(language, "Clear target", "清除目標")}>
              ×
            </button>
          </div>
          <div className="goby-task-form">
            <label className="field scan-target-field field-wide">
              <span>{uiText(language, "IP/Domain", "IP/網域")}</span>
              <textarea
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder={"172.16.20.36\nexample.com\n192.0.2.0/24"}
              />
            </label>
            <label className="field field-wide">
              <span>{uiText(language, "Black IP", "封鎖 IP")}</span>
              <textarea value={blockedHost} onChange={(event) => setBlockedHost(event.target.value)} placeholder="192.0.2.10" />
            </label>
            <label className="field">
              <span>{uiText(language, "Port", "連接埠")}</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as CheckMode)}>
                {MODES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {modeTitle(item.key, item.title, language)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{uiText(language, "Custom ports", "自訂連接埠")}</span>
              <input value={onlyPort} onChange={(event) => setOnlyPort(event.target.value)} inputMode="numeric" placeholder="21,22,80,443" />
            </label>
          </div>

          <div className="scan-mode-row" aria-label={uiText(language, "Scan mode", "掃描模式")}>
            {MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`scan-mode-pill ${mode === item.key ? "selected-item" : ""}`}
                onClick={() => setMode(item.key)}
              >
                <strong>{modeTitle(item.key, item.title, language)}</strong>
                <span>{modeCopy(item.key, item.copy, language)}</span>
              </button>
            ))}
          </div>

          <div className="scan-summary-row">
            <label className="check-row goby-printer-row">
              <input checked={resume} onChange={(event) => setResume(event.target.checked)} type="checkbox" />
              <span>{uiText(language, "Resume previous state", "沿用先前狀態")}</span>
            </label>
            <span>{scopeCount ? uiText(language, `${scopeCount} bounds`, `${scopeCount} 個邊界`) : uiText(language, "Auto scope", "自動範圍")}</span>
            <button type="button" className="text-btn inline-text-btn" onClick={() => setAdvancedOpen((value) => !value)}>
              {advancedOpen ? uiText(language, "Hide advanced", "隱藏進階") : uiText(language, "Advanced", "進階")}
            </button>
          </div>

          <button
            type="button"
            className={`primary-btn scan-start-btn ${submitting ? "hero-orb-busy" : ""}`}
            disabled={submitting || !target.trim()}
            onClick={handleStart}
          >
            {submitting ? uiText(language, "Starting...", "啟動中...") : uiText(language, "Start", "開始")}
          </button>
        </div>
      </div>

      {advancedOpen && (
        <SectionCard title={uiText(language, "Advanced", "進階")}>
          <div className="form-grid compact-form">
            <label className="check-row">
              <input checked={resume} onChange={(event) => setResume(event.target.checked)} type="checkbox" />
              <span>{uiText(language, "Resume previous state", "沿用先前狀態")}</span>
            </label>
            <label className="field">
              <span>{uiText(language, "Port", "連接埠")}</span>
              <input value={onlyPort} onChange={(event) => setOnlyPort(event.target.value)} inputMode="numeric" placeholder="443" />
            </label>
            <label className="field">
              <span>{uiText(language, "Host", "主機")}</span>
              <input value={onlyHost} onChange={(event) => setOnlyHost(event.target.value)} placeholder="example.com" />
            </label>
            <label className="field">
              <span>{uiText(language, "Path", "路徑")}</span>
              <input value={onlyPath} onChange={(event) => setOnlyPath(event.target.value)} placeholder="/admin" />
            </label>
            <label className="field">
              <span>{uiText(language, "Block host", "封鎖主機")}</span>
              <input value={blockedHost} onChange={(event) => setBlockedHost(event.target.value)} placeholder="staging.example.com" />
            </label>
            <label className="field">
              <span>{uiText(language, "Block path", "封鎖路徑")}</span>
              <input value={blockedPath} onChange={(event) => setBlockedPath(event.target.value)} placeholder="/internal" />
            </label>
          </div>
          <div className="scope-summary">
            <strong>{uiText(language, "Scope", "範圍")}</strong>
            <span>{scopePreview}</span>
            <strong>{uiText(language, "Allow", "允許")}</strong>
            <span>{allowPreview}</span>
            <strong>{uiText(language, "Block", "封鎖")}</strong>
            <span>{blockPreview}</span>
          </div>
          <details className="advanced-details">
            <summary>{uiText(language, "Action rules", "動作規則")}</summary>
            <div className="action-boundary-panel">
              <div className="action-choice-grid">
                {ACTION_OPTIONS.map((action) => (
                  <button
                    key={`allow-${action.value}`}
                    type="button"
                    className={`action-choice ${allowActions.includes(action.value) ? "selected-item" : ""}`}
                    onClick={() => toggleAction(action.value, allowActions, setAllowActions, blockActions, setBlockActions)}
                  >
                    <strong>{formatActionLabel(action.value)}</strong>
                  </button>
                ))}
              </div>
              <div className="action-choice-grid">
                {ACTION_OPTIONS.map((action) => (
                  <button
                    key={`block-${action.value}`}
                    type="button"
                    className={`action-choice action-choice-block ${blockActions.includes(action.value) ? "selected-item" : ""}`}
                    onClick={() => toggleAction(action.value, blockActions, setBlockActions, allowActions, setAllowActions)}
                  >
                    <strong>{uiText(language, "Block", "封鎖")} {formatActionLabel(action.value)}</strong>
                  </button>
                ))}
              </div>
            </div>
          </details>
          {error && <div className="error-box">{error}</div>}
        </SectionCard>
      )}

      {activeTask && (
        <SectionCard title={uiText(language, "Running", "執行中")} aside={<span className="status-badge">{formatTaskStatus(activeTask.status)}</span>}>
          <div className="check-progress-card">
            <div className="check-progress-head">
              <div>
                <span className="pill">{uiText(language, "Current task", "目前任務")}</span>
                <h3>{taskResultTitle(activeTask, language)}</h3>
                <p>{latestEventText(latestEvent, language)}</p>
              </div>
              <div className="check-progress-target">
                <span>{uiText(language, "Target", "目標")}</span>
                <strong>{activeTask.target}</strong>
              </div>
            </div>
            <div className="check-stepper">
              {phaseSteps.map(([key, label]) => {
                const done = phaseSteps.findIndex(([stepKey]) => stepKey === key) <= phaseSteps.findIndex(([stepKey]) => stepKey === phaseKey);
                return (
                  <div key={key} className={`check-step ${done ? "check-step-done" : ""}`}>
                    <span />
                    <strong>{label}</strong>
                  </div>
                );
              })}
            </div>
            <div className="next-actions">
              <button type="button" className="primary-btn" onClick={onOpenRisk}>{uiText(language, "View results", "檢視結果")}</button>
              <button type="button" className="secondary-btn" onClick={onOpenReports}>{uiText(language, "View reports", "檢視報告")}</button>
              <button type="button" className="secondary-btn" onClick={onOpenBoundary}>{uiText(language, "View boundary", "檢視邊界")}</button>
            </div>
            {activeSummary && (
              <div className="stats-grid check-result-stats">
                <article className="stat">
                  <span className="stat-label">{uiText(language, "Verified", "已驗證")}</span>
                  <strong>{activeSummary.verified_count}</strong>
                </article>
                <article className="stat">
                  <span className="stat-label">{uiText(language, "Pending", "待處理")}</span>
                  <strong>{activeSummary.pending_count}</strong>
                </article>
                <article className="stat">
                  <span className="stat-label">{uiText(language, "Boundary hits", "邊界命中")}</span>
                  <strong>{boundaryBlockCount}</strong>
                </article>
                <article className="stat">
                  <span className="stat-label">{uiText(language, "Snapshot", "快照")}</span>
                  <strong>{activeSummary.snapshot_id || uiText(language, "Saved", "已儲存")}</strong>
                </article>
              </div>
            )}
            <div className="technical-log-panel">
              <button type="button" className="text-btn technical-log-toggle" onClick={() => setTechnicalLogsOpen((value) => !value)}>
                {technicalLogsOpen ? uiText(language, "Hide raw events", "隱藏原始事件") : uiText(language, "Show raw events", "顯示原始事件")}
              </button>
              {technicalLogsOpen && (
                <div className="technical-log-stream" aria-live="polite">
                  {taskEvents.length ? (
                    taskEvents.slice(-24).map((event) => (
                      <article key={`${event.task_id}-${event.timestamp}-${event.event}`} className="technical-log-entry">
                        <header>
                          <strong>{formatEventLabel(event.event)}</strong>
                          <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                        </header>
                        <pre>{formatEventPayload(event)}</pre>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">{uiText(language, "No raw task events yet.", "尚無原始任務事件。")}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={uiText(language, "Start deep scan?", "要開始深度掃描嗎？")}
        copy={confirmCopy}
        confirmLabel={uiText(language, "Start scan", "開始掃描")}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void submit();
        }}
      />
    </section>
  );
}
