# VulnClaw 修改紀錄

本文整理本次對 VulnClaw 專案所做的修改，涵蓋本地 llama.cpp 接入、繁體中文輸出、報告模板、前後端設定顯示、測試與驗證結果。

## 1. 本地 llama.cpp 接入

### 新增 llama.cpp Provider

修改檔案：

- `vulnclaw/config/schema.py`
- `vulnclaw/config/settings.py`

新增 `llamacpp` 作為 OpenAI-compatible provider：

- Provider ID: `llamacpp`
- Base URL: `http://127.0.0.1:8080/v1`
- Default model: `local-model`
- Label: `llama.cpp (local)`
- API Key: 不需要

新增設定輔助函式：

- `provider_requires_api_key(provider_name: str) -> bool`
- `llm_auth_ready(provider_name: str, api_key: str) -> bool`

用途是區分一般雲端模型 provider 與本地免 API key provider。`llamacpp` 會被視為免 API key 且可用。

### OpenAI SDK 初始化相容 llama.cpp

修改檔案：

- `vulnclaw/agent/core.py`
- `vulnclaw/report/generator.py`

OpenAI Python SDK 即使連本地 OpenAI-compatible endpoint，也仍要求 `api_key` 欄位存在。因此對免 API key provider 加入 dummy key：

```python
local-llamacpp
```

這避免使用本地 llama.cpp 時，SDK 因為空 API key 先報錯。

報告摘要生成 `_generate_attack_summary_from_session()` 也同步改成支援免 API key provider，避免 `llamacpp` 設定下跳過 LLM 攻擊路徑摘要。

### CLI / TUI / Doctor 支援免 API Key 狀態

修改檔案：

- `vulnclaw/cli/main.py`
- `vulnclaw/cli/tui.py`

原本 CLI、`doctor`、TUI 會用 `bool(config.llm.api_key)` 判斷模型是否可用。現在改為使用：

```python
llm_auth_ready(config.llm.provider, config.llm.api_key)
```

效果：

- `llamacpp` 沒有 API key 也會被視為 ready
- `vulnclaw doctor` 會顯示 `API Key: not required`
- `vulnclaw run` / `vulnclaw persistent` 不會因為本地 provider 沒 key 被擋住
- TUI 模型狀態會正確顯示可用

### Web UI 設定頁支援本地 endpoint 狀態

修改檔案：

- `vulnclaw/web/schemas.py`
- `vulnclaw/web/services/config_service.py`
- `frontend/src/types/api.ts`
- `frontend/src/pages/SettingsPage.tsx`

後端 `ConfigView` 新增欄位：

- `requires_api_key`
- `auth_ready`

前端設定頁 badge 顯示邏輯更新為：

- 有 key 且 provider 需要 key：`API key set`
- provider 不需要 key 且可用：`Local endpoint ready`
- provider 需要 key 但未設定：`No API key`

Provider 說明文字也補上 `llamacpp` 範例。

### 本機 VulnClaw 設定已切到 llama.cpp

目前本機設定：

```text
llm.provider = llamacpp
llm.base_url = http://127.0.0.1:8080/v1
llm.model = Qwen3.6-27B-MTP-UD-Q5_K_XL.gguf
```

曾確認本機 llama.cpp server：

- `GET http://127.0.0.1:8080/v1/models` 有回應
- 模型 ID: `Qwen3.6-27B-MTP-UD-Q5_K_XL.gguf`
- `POST /v1/chat/completions` 端點可通

## 2. README 文件更新

修改檔案：

- `README.md`
- `README_EN.md`

新增 llama.cpp provider 使用說明。

中文 README 增加：

```bash
# 本地 llama.cpp:
# ./llama-server -m ./models/your-model.gguf --host 127.0.0.1 --port 8080
vulnclaw config provider llamacpp
```

Provider 表新增：

```markdown
| llama.cpp | `provider llamacpp` | local-model |
```

英文 README 也同步補上 Local llama.cpp 使用方式。

## 3. 全部輸出改為繁體中文

### Agent System Prompt 語言政策

修改檔案：

- `vulnclaw/agent/prompts.py`

新增 `LANGUAGE_POLICY`，並加入 `build_system_prompt()` 的 prompt 組裝流程。

語言政策內容要求：

- 所有面向使用者的自然語言輸出一律使用繁體中文
- 報告、摘要、建議事項、風險描述、修復說明、攻擊路徑敘事都必須使用繁體中文
- 即使參考資料、工具輸出或歷史紀錄包含簡體中文，也要在最終回答中轉寫為繁體中文
- 專有名詞、CVE、HTTP 標頭、URL、檔案路徑、指令、程式碼、payload 和錯誤訊息可以保留原文

同時將輸出規範、報告生成階段、每輪輸出要求、結果持久化提示改成繁體中文。

### 自動掃描 Round Context 改繁中

修改檔案：

- `vulnclaw/agent/prompt_context.py`

自動掃描每一輪 context 結尾新增繁中輸出要求：

```text
請使用繁體中文輸出所有面向使用者的自然語言內容。
```

攻擊路徑敘事 prompt 也改成繁體中文，包括：

- 目標
- 目前階段
- 已執行步驟
- 關鍵觀察/結果
- 漏洞發現
- 純繁體中文、不含 `<thinking>` 標籤

### 報告模板全部改繁體中文

修改檔案：

- `vulnclaw/report/generator.py`

一般報告 `REPORT_TEMPLATE` 已改為繁體中文，包括：

- `滲透測試報告`
- `專案概述`
- `執行摘要`
- `誤報排除`
- `風險等級分布`
- `關鍵建議`
- `漏洞發現`
- `詳細發現`
- `攻擊路徑摘要`
- `限制違規稽核`
- `附件`
- `已驗證漏洞定位與重現資訊`

Persistent 週期報告 `CYCLE_REPORT_TEMPLATE` 已改為繁體中文，包括：

- `持續性滲透測試 — 週期報告`
- `週期資訊`
- `本週期漏洞發現`
- `累計漏洞彙總`
- `風險等級分布`
- `攻擊路徑摘要`
- `關鍵建議`

報告附加段落也轉繁中：

- 目標歷史治理上下文
- 恢復策略
- 恢復優先目標
- 高價值偵察資產
- 最近攻擊路徑
- 恢復摘要
- 執行 PoC 腳本
- 驗證說明
- 根據已驗證證據重現
- 暫無可用重現說明

### LLM 報告摘要 Prompt 改繁中

修改檔案：

- `vulnclaw/report/generator.py`

原本要求：

```text
Please write a readable Chinese attack-path summary.
```

已改為：

```text
Please write a readable Traditional Chinese attack-path summary.
```

並要求輸出：

- 2-5 段自然語言
- 只使用繁體中文
- 不使用 markdown headings
- 不含 thinking tags
- 不編造未執行的步驟

## 4. 測試更新

修改檔案：

- `tests/test_config.py`
- `tests/test_agent.py`
- `tests/test_report.py`

### llama.cpp 測試

新增或更新測試內容：

- Provider preset 包含 `llamacpp`
- `LLMProvider` enum 包含 `LLAMACPP`
- `list_providers()` 回傳 `requires_api_key`
- `provider_requires_api_key("llamacpp") is False`
- `llm_auth_ready("llamacpp", "") is True`
- `AgentCore` 在 `llamacpp` 無 API key 時會使用 dummy key `local-llamacpp`

### 繁中報告測試

原本測試期待簡體中文報告文字，例如：

- `任务约束`
- `约束违规审计`
- `证据等级`
- `已验证漏洞定位与复现信息`
- `需人工复核`

已改成繁體中文期待：

- `任務限制`
- `限制違規稽核`
- `證據等級`
- `已驗證漏洞定位與重現資訊`
- `需人工覆核`

`test_all_phases_render` 也更新，不再硬性要求舊簡中 phase 名稱必須原樣出現在 prompt，而是確認：

- phase prompt 比基礎 prompt 更完整
- prompt 中包含 `繁體中文` 語言政策

## 5. 驗證結果

已執行：

```powershell
python -m ruff check vulnclaw\report\generator.py vulnclaw\agent\prompts.py vulnclaw\agent\prompt_context.py tests\test_report.py tests\test_agent.py
```

結果：

```text
All checks passed!
```

已執行完整測試：

```powershell
python -m pytest -q
```

結果：

```text
377 passed, 1 skipped
```

前端曾執行：

```powershell
npm run build
```

結果成功。

## 6. 本次涉及檔案總覽

目前有修改的檔案：

- `README.md`
- `README_EN.md`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/types/api.ts`
- `tests/test_agent.py`
- `tests/test_config.py`
- `tests/test_report.py`
- `vulnclaw/agent/core.py`
- `vulnclaw/agent/prompt_context.py`
- `vulnclaw/agent/prompts.py`
- `vulnclaw/cli/main.py`
- `vulnclaw/cli/tui.py`
- `vulnclaw/config/schema.py`
- `vulnclaw/config/settings.py`
- `vulnclaw/report/generator.py`
- `vulnclaw/web/schemas.py`
- `vulnclaw/web/services/config_service.py`

變更統計：

```text
17 files changed, 352 insertions(+), 220 deletions(-)
```

## 7. 注意事項

1. `llamacpp` provider 預設 model 是 `local-model`，但本機已依 `/v1/models` 回傳結果設定為實際模型：

   ```text
   Qwen3.6-27B-MTP-UD-Q5_K_XL.gguf
   ```

2. 若之後更換 llama.cpp 載入模型，建議重新設定：

   ```powershell
   vulnclaw config set llm.model <你的模型ID>
   ```

3. 若 llama.cpp server 改 port，需同步改：

   ```powershell
   vulnclaw config set llm.base_url http://127.0.0.1:<port>/v1
   ```

4. 報告模板已改繁中，但工具原始輸出、CVE、URL、payload、程式碼、錯誤訊息會保留原文，避免影響技術精確度。

5. 內部知識庫與部分既有 prompt 仍可能保留簡中內容作為參考資料，但最終輸出政策已強制要求繁體中文。

## 8. Web UI 繁體中文語言設定修正

這次修正的問題是：`Preferences -> Local UI defaults` 裡的語言原本只會儲存在瀏覽器 `localStorage`，但主 UI 沒有訂閱或使用這個設定，所以選 Chinese 之後畫面不會改變。

### 修改檔案

- `frontend/src/utils/preferences.ts`
  - 將語言型別從 `zh-CN | en-US` 改成 `zh-TW | en-US`。
  - 預設語言改成 `zh-TW`。
  - 舊設定值 `zh-CN` 會自動遷移並視為 `zh-TW`，避免原本已存的 Chinese 設定失效。

- `frontend/src/utils/i18n.ts`
  - 新增輕量 i18n helper：
    - `useUiLanguage()`：訂閱 UI 偏好設定更新。
    - `isTraditionalChinese()`：判斷目前是否為繁中。
    - `uiText()`：依目前語言回傳英文或繁中文字串。

- `frontend/src/utils/taskLabels.ts`
  - 任務命令、動作、階段、狀態、事件、風險等級、MCP 狀態、續跑建議、邊界摘要都加入繁中顯示。

- `frontend/src/App.tsx`
  - 主導覽、頁面標題、快速動作、側邊欄動作、toast、停止任務確認對話框改成依語言切換。
  - Preferences 儲存語言後，App 會收到事件並重新渲染。

- `frontend/src/components/AppShell.tsx`
  - 後端無法連線提示、重試按鈕、快速動作 aria label 改成繁中。

- `frontend/src/components/Topbar.tsx`
  - 狀態列的 `Target`、`No target selected`、`Idle` 改成可切繁中。

- `frontend/src/components/Sidebar.tsx`
  - 品牌副標 `Attack surface mapping` 改成 `攻擊面測繪`。
  - 主導覽 aria label 改成繁中。

- `frontend/src/components/ActiveTaskBanner.tsx`
  - 活動任務 banner 的標題、事件等待文案、階段、結果、邊界、報告、停止、進度 aria label 改成繁中。

- `frontend/src/components/ConfirmDialog.tsx`
  - 確認對話框的提示、取消、預設確認按鈕改成可切繁中。

- `frontend/src/pages/SettingsPage.tsx`
  - `Preferences / Local UI defaults` 改成 `偏好設定 / 本機介面預設值`。
  - 語言選項從 `Chinese` 改成 `繁體中文`，值改為 `zh-TW`。
  - 設定頁的分區、欄位、說明、按鈕、儲存狀態、錯誤 fallback、MCP 診斷文字都改成依語言切換。

- `frontend/src/pages/HomePage.tsx`
  - 首頁掃描工作台主要文字改成繁中，包含歡迎文字、掃描模式、目標、連接埠、進階設定、範圍摘要、任務狀態、原始事件開關與深度掃描確認對話框。

### 驗證

在 `frontend` 目錄執行：

```powershell
npm run build
```

結果：

```text
tsc -b && vite build
build completed successfully
```

### 使用方式

1. 開啟 Web UI。
2. 到 `設定 -> 偏好設定`。
3. 語言選 `繁體中文`。
4. 按 `儲存偏好設定`。
5. 主導覽、設定頁、掃描工作台、狀態標籤會立即更新為繁體中文。

## 9. 這次新增的備份打包處理

依照要求，已新增處理腳本並準備將所有目前修改/新增的檔案打包成 `修改檔.7z`。

### 新增處理腳本

- `scripts/package_modified_files.py`
  - 使用 `py7zr` 建立真正的 `.7z` 壓縮檔。
  - 輸出檔案：`修改檔.7z`
  - 若舊的 `修改檔.7z` 已存在，會先刪除再重新建立。
  - 打包前會檢查清單內檔案是否存在，避免備份漏檔。

### 這次打包檔案清單

- `README.md`
- `README_EN.md`
- `frontend/src/App.tsx`
- `frontend/src/components/ActiveTaskBanner.tsx`
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/ConfirmDialog.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/Topbar.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/types/api.ts`
- `frontend/src/utils/i18n.ts`
- `frontend/src/utils/preferences.ts`
- `frontend/src/utils/taskLabels.ts`
- `tests/test_agent.py`
- `tests/test_config.py`
- `tests/test_report.py`
- `vulnclaw/agent/core.py`
- `vulnclaw/agent/prompt_context.py`
- `vulnclaw/agent/prompts.py`
- `vulnclaw/cli/main.py`
- `vulnclaw/cli/tui.py`
- `vulnclaw/config/schema.py`
- `vulnclaw/config/settings.py`
- `vulnclaw/report/generator.py`
- `vulnclaw/web/schemas.py`
- `vulnclaw/web/services/config_service.py`
- `scripts/package_modified_files.py`
- `修改vulnclaw.md`

### 打包指令

```powershell
python scripts/package_modified_files.py
```

### 備註

本機沒有偵測到 `7z/7za/7zr` 命令列工具，因此改用 Python `py7zr` 套件建立 `.7z` 檔案。

### 實際執行結果

已安裝 `py7zr` 並執行：

```powershell
python scripts\package_modified_files.py
```

輸出：

```text
Created F:\Documents\GitHub\VulnClaw\修改檔.7z
Packed 29 files
```

### 壓縮檔驗證

已確認 `修改檔.7z` 存在，並使用 `py7zr` 讀取內容清單：

```text
29 files
contains scripts/package_modified_files.py
contains 修改vulnclaw.md
```

## 10. 新增 Windows 一鍵啟動腳本

依照要求，新增 `start.cmd`，用來在 Windows 上同時啟動 VulnClaw CLI/REPL 與 Web UI。

### 新增檔案

- `start.cmd`

### 功能

- 自動切換到專案根目錄。
- 批次檔內容採 ASCII 訊息，避免 Windows `cmd.exe` 在不同系統碼頁下把 UTF-8 中文解析壞。
- 支援 dry-run 驗證：

```powershell
.\start.cmd --dry-run
```

- 設定 Web UI 預設網址：

```text
http://127.0.0.1:7788
```

- 檢查 `python` 是否存在。
- 若 `frontend/dist/index.html` 不存在，會嘗試：
  - 檢查 `npm`。
  - 若 `frontend/node_modules` 不存在，先執行 `npm install`。
  - 執行 `npm run build` 建置 Web UI。
- 開啟一個新命令視窗執行：

```powershell
python -m vulnclaw.cli.main web --host 127.0.0.1 --port 7788
```

- 開啟另一個新命令視窗執行：

```powershell
python -m vulnclaw.cli.main
```

- 等待 3 秒後自動用預設瀏覽器開啟：

```text
http://127.0.0.1:7788
```

### 使用方式

在專案根目錄雙擊：

```text
start.cmd
```

或在 PowerShell / CMD 執行：

```powershell
.\start.cmd
```

### 打包更新

已更新 `scripts/package_modified_files.py`，將 `start.cmd` 加入 `修改檔.7z` 備份清單。

### 實際打包結果

已重新執行：

```powershell
python scripts\package_modified_files.py
```

輸出：

```text
Created F:\Documents\GitHub\VulnClaw\修改檔.7z
Packed 30 files
```

已驗證 `修改檔.7z` 內包含：

```text
start.cmd
scripts/package_modified_files.py
修改vulnclaw.md
```

### start.cmd 驗證

已執行：

```powershell
cmd /d /c "call start.cmd --dry-run"
```

輸出：

```text
[DRY-RUN] Root: F:\Documents\GitHub\VulnClaw\
[DRY-RUN] Web UI: http://127.0.0.1:7788
[DRY-RUN] Backend command: python -m vulnclaw.cli.main web --host 127.0.0.1 --port 7788
[DRY-RUN] CLI command: python -m vulnclaw.cli.main
```

## 11. README.md 簡中轉繁中

依照要求，已將 `README.md` 從簡體中文轉為繁體中文，並額外潤飾成較自然的台灣繁中用語。

### 修改檔案

- `README.md`

### 轉換方式

- 使用 OpenCC `s2twp` 進行簡體中文到台灣繁體中文詞彙轉換。
- 轉換後再人工修正 OpenCC 較不自然或未統一的詞彙。

### 主要用語修正

- `项目` / `項目` -> `專案`
- `信息` -> `資訊`
- `默认` / `默認` -> `預設`
- `运行` -> `執行`
- `用户` -> `使用者`
- `端口` / `埠` -> `連接埠`
- `配置` -> `設定`
- `提供商` -> `提供者`
- `自定义` / `自定義` -> `自訂`
- `工作臺` -> `工作台`
- `权限` / `許可權` -> `權限`
- `脚本` / `指令碼` -> `腳本`
- `当前` / `當前` -> `目前`

### 檢查結果

- 已用 `rg` 掃描常見簡中字與不自然詞殘留。
- 已用 `git diff --check -- README.md` 檢查 Markdown diff，未發現 whitespace error。
- `README_EN.md` 未修改，仍保留英文版。
