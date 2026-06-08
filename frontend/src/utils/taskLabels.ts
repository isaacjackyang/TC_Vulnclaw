import type { TaskCommand } from "../types/api";
import { isTraditionalChinese } from "./i18n";

const COMMAND_LABELS: Record<TaskCommand, string> = {
  recon: "Quick Recon",
  run: "Standard Scan",
  scan: "Deep Scan",
  exploit: "Verification",
  persistent: "Continuous Scan",
};

const COMMAND_LABELS_ZH: Record<TaskCommand, string> = {
  recon: "快速偵察",
  run: "標準掃描",
  scan: "深度掃描",
  exploit: "驗證",
  persistent: "持續掃描",
};

const ACTION_LABELS: Record<string, string> = {
  recon: "Recon",
  run: "Standard Scan",
  scan: "Scan",
  exploit: "Verify",
  persistent: "Continuous Scan",
  post_exploitation: "Post-exploitation",
};

const ACTION_LABELS_ZH: Record<string, string> = {
  recon: "偵察",
  run: "標準掃描",
  scan: "掃描",
  exploit: "驗證",
  persistent: "持續掃描",
  post_exploitation: "後滲透",
};

const PHASE_LABELS: Record<string, string> = {
  scope: "Scope",
  recon: "Recon",
  scan: "Scan",
  verify: "Verify",
  exploit: "Exploit",
  report: "Report",
};

const PHASE_LABELS_ZH: Record<string, string> = {
  scope: "範圍",
  recon: "偵察",
  scan: "掃描",
  verify: "驗證",
  exploit: "利用",
  report: "報告",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

const STATUS_LABELS_ZH: Record<string, string> = {
  pending: "佇列中",
  running: "執行中",
  completed: "已完成",
  failed: "失敗",
  stopped: "已停止",
};

const FINDING_STATUS_LABELS: Record<string, string> = {
  verified: "Verified",
  pending: "Pending",
  candidate: "Candidate",
  manual_review: "Manual review",
  dismissed: "Dismissed",
  false_positive: "False positive",
};

const FINDING_STATUS_LABELS_ZH: Record<string, string> = {
  verified: "已驗證",
  pending: "待處理",
  candidate: "候選",
  manual_review: "人工審查",
  dismissed: "已忽略",
  false_positive: "誤報",
};

const EVENT_LABELS: Record<string, string> = {
  task_started: "Task started",
  task_progress: "Task progress",
  task_message: "Task message",
  task_completed: "Task completed",
  task_failed: "Task failed",
  task_stopped: "Task stopped",
};

const EVENT_LABELS_ZH: Record<string, string> = {
  task_started: "任務已開始",
  task_progress: "任務進度",
  task_message: "任務訊息",
  task_completed: "任務已完成",
  task_failed: "任務失敗",
  task_stopped: "任務已停止",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  warn: "Warn",
  warning: "Warn",
  low: "Low",
  info: "Info",
};

const SEVERITY_LABELS_ZH: Record<string, string> = {
  critical: "嚴重",
  high: "高",
  medium: "中",
  warn: "警告",
  warning: "警告",
  low: "低",
  info: "資訊",
};

const MCP_HEALTH_LABELS: Record<string, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unavailable: "Offline",
  unknown: "Unknown",
};

const MCP_HEALTH_LABELS_ZH: Record<string, string> = {
  healthy: "正常",
  degraded: "降級",
  unavailable: "離線",
  unknown: "未知",
};

const MCP_MODE_LABELS: Record<string, string> = {
  local: "Local",
  placeholder: "Placeholder",
  sdk: "SDK",
  sse: "SSE",
};

const MCP_MODE_LABELS_ZH: Record<string, string> = {
  local: "本機",
  placeholder: "占位",
  sdk: "SDK",
  sse: "SSE",
};

export function formatTaskCommand(command: string | null | undefined): string {
  const labels = isTraditionalChinese() ? COMMAND_LABELS_ZH : COMMAND_LABELS;
  if (!command) return isTraditionalChinese() ? "掃描" : "Scan";
  return labels[command as TaskCommand] ?? (isTraditionalChinese() ? "自訂掃描" : "Custom Scan");
}

export function formatTaskTitle(command: string | null | undefined, target: string): string {
  return `${formatTaskCommand(command)} - ${target}`;
}

export function formatActionLabel(action: string): string {
  const labels = isTraditionalChinese() ? ACTION_LABELS_ZH : ACTION_LABELS;
  return labels[action] ?? action;
}

export function formatActionList(actions: string[] | undefined, fallback = isTraditionalChinese() ? "預設範圍" : "Default scope"): string {
  if (!actions?.length) return fallback;
  return actions.map(formatActionLabel).join(", ");
}

export function formatPhaseLabel(phase: string | null | undefined): string {
  const labels = isTraditionalChinese() ? PHASE_LABELS_ZH : PHASE_LABELS;
  if (!phase) return isTraditionalChinese() ? "無階段" : "No phase";
  const normalized = phase.toLowerCase();
  const matchedKey = Object.keys(labels).find((key) => normalized.includes(key));
  return labels[normalized] ?? (matchedKey ? labels[matchedKey] : phase);
}

export function formatTaskStatus(status: string | null | undefined): string {
  const labels = isTraditionalChinese() ? STATUS_LABELS_ZH : STATUS_LABELS;
  if (!status) return isTraditionalChinese() ? "閒置" : "Idle";
  return labels[status] ?? status;
}

export function formatFindingStatus(status: string | null | undefined): string {
  const labels = isTraditionalChinese() ? FINDING_STATUS_LABELS_ZH : FINDING_STATUS_LABELS;
  if (!status) return isTraditionalChinese() ? "待處理" : "Pending";
  const normalized = status.toLowerCase();
  const matchedKey = Object.keys(labels).find((key) => normalized.includes(key));
  return labels[normalized] ?? (matchedKey ? labels[matchedKey] : status);
}

export function formatEventLabel(event: string | null | undefined): string {
  const labels = isTraditionalChinese() ? EVENT_LABELS_ZH : EVENT_LABELS;
  if (!event) return isTraditionalChinese() ? "任務事件" : "Task event";
  return labels[event] ?? event;
}

export function formatSeverityLabel(severity: string | null | undefined): string {
  const labels = isTraditionalChinese() ? SEVERITY_LABELS_ZH : SEVERITY_LABELS;
  if (!severity) return isTraditionalChinese() ? "資訊" : "Info";
  const normalized = severity.toLowerCase();
  const matchedKey = Object.keys(labels).find((key) => normalized.includes(key));
  return labels[normalized] ?? (matchedKey ? labels[matchedKey] : severity);
}

export function formatMcpHealth(status: string | null | undefined): string {
  const labels = isTraditionalChinese() ? MCP_HEALTH_LABELS_ZH : MCP_HEALTH_LABELS;
  if (!status) return isTraditionalChinese() ? "未知" : "Unknown";
  return labels[status] ?? status;
}

export function formatMcpExecutionMode(mode: string | null | undefined): string {
  const labels = isTraditionalChinese() ? MCP_MODE_LABELS_ZH : MCP_MODE_LABELS;
  if (!mode) return isTraditionalChinese() ? "未知" : "Unknown";
  return labels[mode] ?? mode;
}

export function formatResumeStrategy(strategy: string | null | undefined): string {
  const zh = isTraditionalChinese();
  if (!strategy) return zh ? "無續跑建議" : "No resume guidance";
  const normalized = strategy.toLowerCase();
  if (normalized.includes("stop") || normalized.includes("complete")) return zh ? "可結束目前掃描" : "Can end current scan";
  if (normalized.includes("verify")) return zh ? "先檢視已驗證發現" : "Review verified findings first";
  if (normalized.includes("exploit")) return zh ? "驗證前先確認授權" : "Verify authorization before validation";
  if (normalized.includes("scan")) return zh ? "繼續風險探索" : "Continue risk discovery";
  if (normalized.includes("recon")) return zh ? "補充更多偵察" : "Add more recon";
  if (normalized.includes("continue") || normalized.includes("resume")) return zh ? "從目前狀態續跑" : "Resume from current state";
  return strategy;
}

export function formatConstraintSummary(constraints: Record<string, unknown> | undefined): string {
  const zh = isTraditionalChinese();
  if (!constraints || !Object.keys(constraints).length) return zh ? "沒有額外邊界" : "No extra boundary";
  const labels: string[] = [];
  const onlyHost = constraints.allowed_hosts ?? constraints.only_host;
  const onlyPath = constraints.allowed_paths ?? constraints.only_path;
  const onlyPort = constraints.allowed_ports ?? constraints.only_port;
  const blockedHost = constraints.blocked_hosts ?? constraints.blocked_host;
  const blockedPath = constraints.blocked_paths ?? constraints.blocked_path;
  const allowActions = constraints.allowed_actions ?? constraints.allow_actions;
  const blockActions = constraints.blocked_actions ?? constraints.block_actions;
  if (onlyHost) labels.push(`${zh ? "限定主機" : "host"} ${formatConstraintValue(onlyHost)}`);
  if (onlyPath) labels.push(`${zh ? "限定路徑" : "path"} ${formatConstraintValue(onlyPath)}`);
  if (onlyPort) labels.push(`${zh ? "限定連接埠" : "port"} ${formatConstraintValue(onlyPort)}`);
  if (blockedHost) labels.push(`${zh ? "封鎖主機" : "block host"} ${formatConstraintValue(blockedHost)}`);
  if (blockedPath) labels.push(`${zh ? "封鎖路徑" : "block path"} ${formatConstraintValue(blockedPath)}`);
  if (Array.isArray(allowActions)) labels.push(`${zh ? "允許" : "allow"} ${formatActionList(allowActions.map(String))}`);
  if (Array.isArray(blockActions)) labels.push(`${zh ? "封鎖" : "block"} ${formatActionList(blockActions.map(String))}`);
  return labels.length ? labels.join(", ") : zh ? "自訂邊界" : "Custom boundary";
}

export function countConstraintViolations(
  events: unknown[] | undefined,
  violations: unknown[] | undefined,
  fallback = 0,
): number {
  if (events?.length) return events.length;
  if (violations?.length) return violations.length;
  return fallback;
}

function formatConstraintValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  return String(value);
}
