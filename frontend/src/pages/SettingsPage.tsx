import { useEffect, useMemo, useState } from "react";
import { updateConfig } from "../api/web";
import { SectionCard } from "../components/SectionCard";
import { useConfigQuery, useMcpDiagnosticsQuery } from "../hooks/queries";
import { formatActionLabel, formatActionList, formatMcpExecutionMode, formatMcpHealth } from "../utils/taskLabels";
import { uiText, type UiLanguage } from "../utils/i18n";
import { loadUiPreferences, saveUiPreferences, type UiPreferences } from "../utils/preferences";
import { parseOptionalPort } from "../utils/validation";

type SettingsSection = "basic" | "ai" | "checks" | "boundary" | "data" | "python" | "diagnostics";

function settingsSections(language: UiLanguage): Array<{ key: SettingsSection; title: string; copy: string }> {
  return [
    { key: "basic", title: uiText(language, "Preferences", "偏好設定"), copy: uiText(language, "Local UI defaults", "本機介面預設值") },
    { key: "ai", title: uiText(language, "Model", "模型"), copy: uiText(language, "Provider and endpoint", "提供者與端點") },
    { key: "checks", title: uiText(language, "Scan Policy", "掃描政策"), copy: uiText(language, "Rounds and runtime", "輪數與執行") },
    { key: "boundary", title: uiText(language, "Boundary", "邊界"), copy: uiText(language, "Default scope", "預設範圍") },
    { key: "data", title: uiText(language, "Data", "資料"), copy: uiText(language, "Output paths", "輸出路徑") },
    { key: "python", title: uiText(language, "Scripts", "腳本"), copy: uiText(language, "Local execution", "本機執行") },
    { key: "diagnostics", title: uiText(language, "Diagnostics", "診斷"), copy: uiText(language, "MCP status", "MCP 狀態") },
  ];
}

function actionOptions(language: UiLanguage) {
  return [
    { value: "recon", copy: uiText(language, "Asset discovery and public signal collection.", "資產探索與公開訊號收集。") },
    { value: "scan", copy: uiText(language, "Service and entry-point discovery.", "服務與入口點探索。") },
    { value: "exploit", copy: uiText(language, "Verification actions requiring approval.", "需要核准的驗證動作。") },
    { value: "persistent", copy: uiText(language, "Multi-round continuous checks.", "多輪持續檢查。") },
    { value: "post_exploitation", copy: uiText(language, "Post-exploitation actions, usually blocked.", "後滲透動作，通常會被封鎖。") },
  ];
}

function pythonModes(language: UiLanguage) {
  return [
  {
    value: "safe",
    label: uiText(language, "Safe", "安全"),
    copy: uiText(language, "Restricts file I/O, network access, and system calls.", "限制檔案 I/O、網路存取與系統呼叫。"),
  },
  {
    value: "lab",
    label: uiText(language, "Lab", "實驗室"),
    copy: uiText(language, "Allows more local analysis for controlled labs.", "允許受控實驗室進行更多本機分析。"),
  },
  {
    value: "trusted-local",
    label: uiText(language, "Trusted local", "受信任本機"),
    copy: uiText(language, "Full local capability for trusted authorized machines.", "在受信任且已授權的機器上使用完整本機能力。"),
  },
  ];
}

interface SettingsPageProps {
  initialSection?: SettingsSection;
  onOpenAdvanced: () => void;
}

export function SettingsPage({ initialSection = "basic", onOpenAdvanced }: SettingsPageProps) {
  const configQuery = useConfigQuery();
  const mcpQuery = useMcpDiagnosticsQuery();
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [maxRounds, setMaxRounds] = useState(15);
  const [persistentRounds, setPersistentRounds] = useState(100);
  const [persistentCycles, setPersistentCycles] = useState(10);
  const [showThinking, setShowThinking] = useState(false);
  const [pythonExecuteEnabled, setPythonExecuteEnabled] = useState(true);
  const [pythonExecuteMode, setPythonExecuteMode] = useState("trusted-local");
  const [pythonExecuteMaxLines, setPythonExecuteMaxLines] = useState(50);
  const [pythonExecuteAuditEnabled, setPythonExecuteAuditEnabled] = useState(true);
  const [language, setLanguage] = useState<UiPreferences["language"]>(() => loadUiPreferences().language);
  const [defaultCheckMode, setDefaultCheckMode] = useState<UiPreferences["defaultCheckMode"]>("standard");
  const [reportFormat, setReportFormat] = useState<UiPreferences["reportFormat"]>("markdown");
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
  const [defaultOnlyPort, setDefaultOnlyPort] = useState("");
  const [defaultOnlyHost, setDefaultOnlyHost] = useState("");
  const [defaultOnlyPath, setDefaultOnlyPath] = useState("");
  const [defaultBlockedHost, setDefaultBlockedHost] = useState("");
  const [defaultBlockedPath, setDefaultBlockedPath] = useState("");
  const [defaultAllowActions, setDefaultAllowActions] = useState<string[]>([]);
  const [defaultBlockActions, setDefaultBlockActions] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const displayLanguage = language;
  const sections = useMemo(() => settingsSections(displayLanguage), [displayLanguage]);
  const actions = useMemo(() => actionOptions(displayLanguage), [displayLanguage]);
  const modes = useMemo(() => pythonModes(displayLanguage), [displayLanguage]);

  useEffect(() => {
    const preferences = loadUiPreferences();
    setLanguage(preferences.language);
    setDefaultCheckMode(preferences.defaultCheckMode);
    setReportFormat(preferences.reportFormat);
    setShowTechnicalLogs(preferences.showTechnicalLogs);
    setDefaultOnlyPort(preferences.defaultBoundary.onlyPort);
    setDefaultOnlyHost(preferences.defaultBoundary.onlyHost);
    setDefaultOnlyPath(preferences.defaultBoundary.onlyPath);
    setDefaultBlockedHost(preferences.defaultBoundary.blockedHost);
    setDefaultBlockedPath(preferences.defaultBoundary.blockedPath);
    setDefaultAllowActions(preferences.defaultBoundary.allowActions);
    setDefaultBlockActions(preferences.defaultBoundary.blockActions);
  }, []);

  useEffect(() => setActiveSection(initialSection), [initialSection]);

  useEffect(() => {
    if (!configQuery.data) return;
    setProvider(configQuery.data.provider);
    setModel(configQuery.data.model);
    setBaseUrl(configQuery.data.base_url);
    setOutputDir(configQuery.data.output_dir);
    setMaxRounds(configQuery.data.max_rounds);
    setPersistentRounds(configQuery.data.persistent_rounds_per_cycle);
    setPersistentCycles(configQuery.data.persistent_max_cycles);
    setShowThinking(configQuery.data.show_thinking);
    setPythonExecuteEnabled(configQuery.data.python_execute_enabled);
    setPythonExecuteMode(configQuery.data.python_execute_mode);
    setPythonExecuteMaxLines(configQuery.data.python_execute_max_lines);
    setPythonExecuteAuditEnabled(configQuery.data.python_execute_audit_enabled);
  }, [configQuery.data]);

  const activeMeta = useMemo(() => sections.find((section) => section.key === activeSection) ?? sections[0], [activeSection, sections]);
  const authStatusLabel = configQuery.data?.auth_ready
    ? configQuery.data.requires_api_key
      ? uiText(displayLanguage, "API key set", "API key 已設定")
      : uiText(displayLanguage, "Local endpoint ready", "本機端點就緒")
    : uiText(displayLanguage, "No API key", "沒有 API key");
  const saveButtonLabel = activeSection === "basic"
    ? uiText(displayLanguage, "Save preferences", "儲存偏好設定")
    : activeSection === "boundary"
      ? uiText(displayLanguage, "Save boundary", "儲存邊界")
      : uiText(displayLanguage, "Save settings", "儲存設定");

  function saveLocalPreferences() {
    saveUiPreferences({
      language,
      defaultCheckMode,
      reportFormat,
      showTechnicalLogs,
      defaultBoundary: {
        onlyPort: defaultOnlyPort,
        onlyHost: defaultOnlyHost,
        onlyPath: defaultOnlyPath,
        blockedHost: defaultBlockedHost,
        blockedPath: defaultBlockedPath,
        allowActions: defaultAllowActions,
        blockActions: defaultBlockActions,
      },
    });
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setStatus(null);

      if (activeSection === "basic" || activeSection === "boundary") {
        if (activeSection === "boundary") parseOptionalPort(defaultOnlyPort);
        saveLocalPreferences();
        setStatus(activeSection === "boundary" ? uiText(displayLanguage, "Boundary defaults saved.", "邊界預設值已儲存。") : uiText(displayLanguage, "Preferences saved.", "偏好設定已儲存。"));
        return;
      }

      await updateConfig({
        provider,
        model,
        base_url: baseUrl,
        output_dir: outputDir,
        max_rounds: maxRounds,
        persistent_rounds_per_cycle: persistentRounds,
        persistent_max_cycles: persistentCycles,
        show_thinking: showThinking,
        python_execute_enabled: pythonExecuteEnabled,
        python_execute_mode: pythonExecuteMode,
        python_execute_max_lines: pythonExecuteMaxLines,
        python_execute_audit_enabled: pythonExecuteAuditEnabled,
      });
      await configQuery.refetch();
      setStatus(uiText(displayLanguage, "Settings saved.", "設定已儲存。"));
    } catch (err) {
      setError(err instanceof Error ? err.message : uiText(displayLanguage, "Save failed", "儲存失敗"));
    } finally {
      setSaving(false);
    }
  }

  function toggleDefaultAction(
    value: string,
    selected: string[],
    setSelected: (next: string[]) => void,
    oppositeSelected: string[],
    setOppositeSelected: (next: string[]) => void,
  ) {
    const isSelected = selected.includes(value);
    setSelected(isSelected ? selected.filter((item) => item !== value) : [...selected, value]);
    if (!isSelected) setOppositeSelected(oppositeSelected.filter((item) => item !== value));
  }

  return (
    <section className="settings-page">
      <aside className="settings-nav">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            className={`settings-nav-item ${activeSection === section.key ? "active" : ""}`}
            onClick={() => setActiveSection(section.key)}
          >
            <strong>{section.title}</strong>
            <span>{section.copy}</span>
          </button>
        ))}
      </aside>

      <div className="settings-content">
        <SectionCard
          title={activeMeta.title}
          copy={activeMeta.copy}
          aside={<span className="status-badge">{authStatusLabel}</span>}
        >
          {activeSection === "basic" && (
            <div className="form-grid">
              <label className="field">
                <span>{uiText(displayLanguage, "Language", "語言")}</span>
                <select value={language} onChange={(event) => setLanguage(event.target.value as UiPreferences["language"])}>
                  <option value="en-US">English</option>
                  <option value="zh-TW">繁體中文</option>
                </select>
              </label>
              <label className="field">
                <span>{uiText(displayLanguage, "Default scan mode", "預設掃描模式")}</span>
                <select value={defaultCheckMode} onChange={(event) => setDefaultCheckMode(event.target.value as UiPreferences["defaultCheckMode"])}>
                  <option value="quick">{uiText(displayLanguage, "Quick Recon", "快速偵察")}</option>
                  <option value="standard">{uiText(displayLanguage, "Standard Scan", "標準掃描")}</option>
                  <option value="deep">{uiText(displayLanguage, "Deep Scan", "深度掃描")}</option>
                  <option value="continuous">{uiText(displayLanguage, "Continuous Scan", "持續掃描")}</option>
                </select>
              </label>
              <label className="field">
                <span>{uiText(displayLanguage, "Default report format", "預設報告格式")}</span>
                <select value={reportFormat} onChange={(event) => setReportFormat(event.target.value as UiPreferences["reportFormat"])}>
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                </select>
              </label>
              <label className="check-row">
                <input checked={showTechnicalLogs} onChange={(event) => setShowTechnicalLogs(event.target.checked)} type="checkbox" />
                <span>{uiText(displayLanguage, "Show raw event entry by default", "預設顯示原始事件項目")}</span>
              </label>
              <div className="inline-panel field-wide">
                <strong>{uiText(displayLanguage, "Local only", "僅本機")}</strong>
                <p className="inline-note">{uiText(displayLanguage, "UI preferences are stored in this browser. Runtime settings are saved to the backend.", "介面偏好會儲存在此瀏覽器中，執行設定會儲存到後端。")}</p>
              </div>
            </div>
          )}

          {activeSection === "ai" && (
            <div className="form-grid">
              <label className="field">
                <span>{uiText(displayLanguage, "Provider", "提供者")}</span>
                <input value={provider} onChange={(event) => setProvider(event.target.value)} />
                <small>{uiText(displayLanguage, "Backend provider id, for example openai or llamacpp.", "後端提供者 ID，例如 openai 或 llamacpp。")}</small>
              </label>
              <label className="field">
                <span>{uiText(displayLanguage, "Model", "模型")}</span>
                <input value={model} onChange={(event) => setModel(event.target.value)} />
                <small>{uiText(displayLanguage, "Use the model name configured for your backend.", "使用後端已設定的模型名稱。")}</small>
              </label>
              <label className="field field-wide">
                <span>{uiText(displayLanguage, "Base URL", "基礎 URL")}</span>
                <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
                <small>{uiText(displayLanguage, "Leave blank to use the backend default.", "留空會使用後端預設值。")}</small>
              </label>
            </div>
          )}

          {activeSection === "checks" && (
            <div className="form-grid">
              <label className="field">
                <span>{uiText(displayLanguage, "Max rounds", "最大輪數")}</span>
                <input type="number" value={maxRounds} onChange={(event) => setMaxRounds(Number(event.target.value))} />
              </label>
              <label className="field">
                <span>{uiText(displayLanguage, "Rounds per cycle", "每週期輪數")}</span>
                <input type="number" value={persistentRounds} onChange={(event) => setPersistentRounds(Number(event.target.value))} />
              </label>
              <label className="field">
                <span>{uiText(displayLanguage, "Max cycles", "最大週期數")}</span>
                <input type="number" value={persistentCycles} onChange={(event) => setPersistentCycles(Number(event.target.value))} />
              </label>
              <label className="check-row field-wide">
                <input checked={showThinking} onChange={(event) => setShowThinking(event.target.checked)} type="checkbox" />
                <span>{uiText(displayLanguage, "Show model reasoning output", "顯示模型推理輸出")}</span>
              </label>
              <article className="stat">
                <span className="stat-label">{uiText(displayLanguage, "MCP services", "MCP 服務")}</span>
                <strong>{mcpQuery.data?.total_services ?? 0}</strong>
              </article>
              <article className="stat">
                <span className="stat-label">{uiText(displayLanguage, "Runnable", "可執行")}</span>
                <strong>{mcpQuery.data?.running_services ?? 0}</strong>
              </article>
              <article className="stat">
                <span className="stat-label">{uiText(displayLanguage, "Tools", "工具")}</span>
                <strong>{mcpQuery.data?.tool_count ?? 0}</strong>
              </article>
              <article className="stat">
                <span className="stat-label">nmap</span>
                <strong>{uiText(displayLanguage, "Runtime check", "執行期檢查")}</strong>
              </article>
            </div>
          )}

          {activeSection === "boundary" && (
            <div className="form-grid">
              <label className="field">
                <span>{uiText(displayLanguage, "Default port only", "預設限定連接埠")}</span>
                <input value={defaultOnlyPort} onChange={(event) => setDefaultOnlyPort(event.target.value)} inputMode="numeric" placeholder="443" />
                <small>{uiText(displayLanguage, "Blank means set it per scan.", "留空表示每次掃描再設定。")}</small>
              </label>
              <label className="field">
                <span>{uiText(displayLanguage, "Default host only", "預設限定主機")}</span>
                <input value={defaultOnlyHost} onChange={(event) => setDefaultOnlyHost(event.target.value)} placeholder="example.com" />
              </label>
              <label className="field field-wide">
                <span>{uiText(displayLanguage, "Default path only", "預設限定路徑")}</span>
                <input value={defaultOnlyPath} onChange={(event) => setDefaultOnlyPath(event.target.value)} placeholder="/admin" />
              </label>
              <label className="field">
                <span>{uiText(displayLanguage, "Default block host", "預設封鎖主機")}</span>
                <input value={defaultBlockedHost} onChange={(event) => setDefaultBlockedHost(event.target.value)} placeholder="staging.example.com" />
              </label>
              <label className="field">
                <span>{uiText(displayLanguage, "Default block path", "預設封鎖路徑")}</span>
                <input value={defaultBlockedPath} onChange={(event) => setDefaultBlockedPath(event.target.value)} placeholder="/internal" />
              </label>
              <div className="field field-wide">
                <span>{uiText(displayLanguage, "Default allow actions", "預設允許動作")}</span>
                <div className="action-choice-grid">
                  {actions.map((action) => (
                    <button
                      key={`settings-allow-${action.value}`}
                      type="button"
                      className={`action-choice ${defaultAllowActions.includes(action.value) ? "selected-item" : ""}`}
                      onClick={() => toggleDefaultAction(action.value, defaultAllowActions, setDefaultAllowActions, defaultBlockActions, setDefaultBlockActions)}
                    >
                      <strong>{formatActionLabel(action.value)}</strong>
                      <span>{action.copy}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="field field-wide">
                <span>{uiText(displayLanguage, "Default block actions", "預設封鎖動作")}</span>
                <div className="action-choice-grid">
                  {actions.map((action) => (
                    <button
                      key={`settings-block-${action.value}`}
                      type="button"
                      className={`action-choice action-choice-block ${defaultBlockActions.includes(action.value) ? "selected-item" : ""}`}
                      onClick={() => toggleDefaultAction(action.value, defaultBlockActions, setDefaultBlockActions, defaultAllowActions, setDefaultAllowActions)}
                    >
                      <strong>{formatActionLabel(action.value)}</strong>
                      <span>{action.copy}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="scope-summary field-wide">
                <strong>{uiText(displayLanguage, "Allow", "允許")}</strong>
                <span>{formatActionList(defaultAllowActions)}</span>
                <strong>{uiText(displayLanguage, "Block", "封鎖")}</strong>
                <span>{formatActionList(defaultBlockActions)}</span>
              </div>
            </div>
          )}

          {activeSection === "data" && (
            <div className="form-grid">
              <label className="field field-wide">
                <span>{uiText(displayLanguage, "Output directory", "輸出目錄")}</span>
                <input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
              </label>
              <div className="inline-panel field-wide">
                <strong>{uiText(displayLanguage, "Reports", "報告")}</strong>
                <p className="inline-note">{uiText(displayLanguage, "If not overridden, reports are written under the VulnClaw sessions report directory.", "若未覆寫，報告會寫入 VulnClaw sessions 報告目錄。")}</p>
              </div>
            </div>
          )}

          {activeSection === "python" && (
            <div className="form-grid">
              <label className="check-row">
                <input checked={pythonExecuteEnabled} onChange={(event) => setPythonExecuteEnabled(event.target.checked)} type="checkbox" />
                <span>{uiText(displayLanguage, "Enable local script helper", "啟用本機腳本助手")}</span>
              </label>
              <label className="check-row">
                <input checked={pythonExecuteAuditEnabled} onChange={(event) => setPythonExecuteAuditEnabled(event.target.checked)} type="checkbox" />
                <span>{uiText(displayLanguage, "Record local script audit", "記錄本機腳本稽核")}</span>
              </label>
              <div className="field field-wide">
                <span>{uiText(displayLanguage, "Execution guard", "執行防護")}</span>
                <div className="mode-grid settings-mode-grid">
                  {modes.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      className={`mode-card settings-mode-card ${pythonExecuteMode === mode.value ? "selected-item" : ""}`}
                      onClick={() => setPythonExecuteMode(mode.value)}
                    >
                      <strong>{mode.label}</strong>
                      <span>{mode.copy}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span>{uiText(displayLanguage, "Max output lines", "最大輸出行數")}</span>
                <input type="number" value={pythonExecuteMaxLines} onChange={(event) => setPythonExecuteMaxLines(Number(event.target.value))} />
              </label>
            </div>
          )}

          {activeSection === "diagnostics" && (
            <div className="diagnostics-grid">
              <div className="inline-panel field-wide">
                <strong>{uiText(displayLanguage, "Need raw task inputs?", "需要原始任務輸入嗎？")}</strong>
                <p className="inline-note">{uiText(displayLanguage, "Open the task console for SSE events, raw command parameters, and boundary debugging.", "開啟任務主控台可查看 SSE 事件、原始命令參數與邊界除錯資訊。")}</p>
                <button className="secondary-btn" onClick={onOpenAdvanced} type="button">
                  {uiText(displayLanguage, "Open task console", "開啟任務主控台")}
                </button>
              </div>
              <article className="stat">
                <span className="stat-label">{uiText(displayLanguage, "MCP services", "MCP 服務")}</span>
                <strong>{mcpQuery.data?.total_services ?? 0}</strong>
              </article>
              <article className="stat">
                <span className="stat-label">{uiText(displayLanguage, "Running", "執行中")}</span>
                <strong>{mcpQuery.data?.running_services ?? 0}</strong>
              </article>
              <article className="stat">
                <span className="stat-label">{uiText(displayLanguage, "Tools", "工具")}</span>
                <strong>{mcpQuery.data?.tool_count ?? 0}</strong>
              </article>
              <div className="list list-scroll diagnostics-list">
                {mcpQuery.data?.services.map((service) => (
                  <div key={service.name} className="list-item">
                    <strong>{service.name}</strong>
                    <span>
                      {uiText(displayLanguage, "Status", "狀態")}: {formatMcpHealth(service.health_status)} - {uiText(displayLanguage, "Mode", "模式")}: {formatMcpExecutionMode(service.execution_mode)} - {uiText(displayLanguage, "Tools", "工具")}: {service.tool_count}
                    </span>
                    <span className="muted-inline">
                      {uiText(displayLanguage, "Calls", "呼叫")} {service.call_count} - {uiText(displayLanguage, "Success", "成功")} {service.success_count} - {uiText(displayLanguage, "Failed", "失敗")} {service.failure_count}
                    </span>
                    {service.error && <span className="danger-inline">{service.error}</span>}
                  </div>
                ))}
                {!mcpQuery.data?.services.length && <div className="empty-state">{uiText(displayLanguage, "No MCP diagnostics yet.", "尚無 MCP 診斷資料。")}</div>}
              </div>
            </div>
          )}

          <div className="button-row">
            <button className="primary-btn" disabled={saving || activeSection === "diagnostics"} onClick={handleSave} type="button">
              {saving ? uiText(displayLanguage, "Saving...", "儲存中...") : saveButtonLabel}
            </button>
          </div>

          {status && <div className="success-box">{status}</div>}
          {error && <div className="error-box">{error}</div>}
        </SectionCard>
      </div>
    </section>
  );
}
