import type { TaskEvent, TaskRecord } from "../types/api";
import { uiText, type UiLanguage, useUiLanguage } from "../utils/i18n";
import { countConstraintViolations, formatEventLabel, formatPhaseLabel, formatTaskTitle } from "../utils/taskLabels";

interface ActiveTaskBannerProps {
  task: TaskRecord | null;
  latestEvent: TaskEvent | null;
  onOpenBoundary: () => void;
  onOpenAdvanced: () => void;
  onOpenReports: () => void;
  onOpenTarget: (target: string) => void;
  onStop: () => void;
}

function eventText(event: TaskEvent | null, language: UiLanguage): string {
  if (!event) return uiText(language, "Waiting for task events.", "等待任務事件。");
  const text = event.payload.text;
  const message = event.payload.message;
  const phase = event.payload.phase;
  if (typeof text === "string" && text.trim()) return text;
  if (typeof message === "string" && message.trim()) return message;
  if (typeof phase === "string" && phase.trim()) return `${uiText(language, "Phase", "階段")}: ${formatPhaseLabel(phase)}`;
  return formatEventLabel(event.event);
}

function estimateProgress(task: TaskRecord, latestEvent: TaskEvent | null): number {
  if (task.status === "completed") return 100;
  if (task.status === "failed" || task.status === "stopped") return 100;
  const phase = String(latestEvent?.payload.phase ?? task.latest_phase ?? "").toLowerCase();
  if (phase.includes("report")) return 88;
  if (phase.includes("exploit") || phase.includes("verify")) return 70;
  if (phase.includes("scan")) return 52;
  if (phase.includes("recon")) return 34;
  if (task.status === "running") return 18;
  return 8;
}

function eventBlockedAttempts(event: TaskEvent | null): number {
  if (!event) return 0;
  const payload = event.payload as {
    constraint_violation_events?: unknown[];
    constraint_violations?: unknown[];
    message?: unknown;
    error?: unknown;
    summary?: {
      constraint_violation_events?: unknown[];
      constraint_violations?: unknown[];
    };
  };
  const directCount = countConstraintViolations(payload.constraint_violation_events, payload.constraint_violations);
  const summaryCount = countConstraintViolations(payload.summary?.constraint_violation_events, payload.summary?.constraint_violations);
  if (directCount) return directCount;
  if (summaryCount) return summaryCount;
  const message = String(payload.message ?? payload.error ?? "");
  return message.includes("constraint_violation") ? 1 : 0;
}

function blockedAttempts(task: TaskRecord, event: TaskEvent | null): number {
  return countConstraintViolations(task.summary?.constraint_violation_events, task.summary?.constraint_violations, eventBlockedAttempts(event));
}

export function ActiveTaskBanner({ task, latestEvent, onOpenAdvanced, onOpenBoundary, onOpenReports, onOpenTarget, onStop }: ActiveTaskBannerProps) {
  const language = useUiLanguage();

  if (!task) return null;

  const progress = estimateProgress(task, latestEvent);
  const blocked = blockedAttempts(task, latestEvent);
  const canStop = task.status === "running" || task.status === "pending";
  const isComplete = task.status === "completed";
  const isFailed = task.status === "failed";

  return (
    <section className={`task-banner task-banner-${task.status}`}>
      <div className="task-banner-main">
        <div>
          <span className="task-banner-kicker">{uiText(language, "Active scan", "進行中的掃描")}</span>
          <h3>{formatTaskTitle(task.command, task.target)}</h3>
          <p>{eventText(latestEvent, language)}</p>
        </div>
        <div className="task-banner-actions">
          <button type="button" className="secondary-btn" onClick={() => onOpenTarget(task.target)}>
            {uiText(language, "Results", "結果")}
          </button>
          <button
            type="button"
            className={`secondary-btn ${blocked > 0 ? "boundary-alert-btn" : ""}`}
            onClick={onOpenBoundary}
            aria-label={blocked > 0 ? uiText(language, `View ${blocked} blocked boundary attempts`, `檢視 ${blocked} 次被封鎖的邊界嘗試`) : uiText(language, "View safety boundary", "檢視安全邊界")}
          >
            {blocked > 0 ? uiText(language, `${blocked} blocked`, `${blocked} 次封鎖`) : uiText(language, "Boundary", "邊界")}
          </button>
          {isFailed ? (
            <button type="button" className="danger-btn" onClick={onOpenAdvanced}>
              {uiText(language, "Open console", "開啟主控台")}
            </button>
          ) : isComplete ? (
            <button type="button" className="primary-btn" onClick={onOpenReports}>
              {uiText(language, "Reports", "報告")}
            </button>
          ) : (
            <button type="button" className="danger-btn" disabled={!canStop} onClick={onStop}>
              {uiText(language, "Stop", "停止")}
            </button>
          )}
        </div>
      </div>
      <div className="task-progress" aria-label={uiText(language, `Task progress ${progress}%`, `任務進度 ${progress}%`)}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
