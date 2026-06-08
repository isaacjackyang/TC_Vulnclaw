<div align="center">

# VulnClaw 🦞

> *AI 驅動的滲透測試 CLI 工具 — 說人話，打漏洞。*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![OpenAI Compatible](https://img.shields.io/badge/API-OpenAI_Compatible-green)](https://platform.openai.com/)
[![MCP](https://img.shields.io/badge/Toolchain-MCP-orange)](https://modelcontextprotocol.io/)
[![PyPI](https://img.shields.io/badge/PyPI-v0.2.9-blueviolet)](https://pypi.org/project/vulnclaw/)
[![Security](https://img.shields.io/badge/Scope-Authorized_Only-red)](#-安全宣告)
<br>

🌐 **English version**: [`README_EN.md`](README_EN.md)

**本專案是可獨立執行的 AI 滲透測試 Agent。**

<br>

基於 LLM Agent + MCP 工具鏈 + 滲透 Skill 編排，
配合 OpenAI / MiniMax / DeepSeek 等相容模型，
自然語言輸入 → 自動完成「資訊收集 → 漏洞發現 → 漏洞利用 → 報告生成」全流程。

[快速開始](#快速開始) · [架構設計](#️-架構) · [Skill 體系](#-內建-skill) · [版本路線](#️-版本路線)

</div>

---

## 它能做什麼

輸入自然語言，AI 自動執行滲透測試全流程：

```
使用者輸入：幫我對 http://target.example.com 進行滲透測試

VulnClaw 自動執行：
  Round 1:  資訊收集 → 指紋識別、連接埠掃描、目錄列舉
  Round 2:  漏洞發現 → 檢測注入點、已知 CVE、設定缺陷
  Round 3:  漏洞利用 → PoC 驗證、權限獲取
  Round 4:  報告生成 → 結構化報告 + Python PoC 腳本
```

<img width="1148" height="642" alt="image" src="https://github.com/user-attachments/assets/576e1cf6-25da-4969-864b-40e77d020dbf" />


適用於已授權的滲透測試、CTF 競賽、安全教學、紅隊演練等場景。

---

## 特性

- **自然語言驅動** — 用人話描述滲透意圖，自動識別階段和工具
- **13 個 LLM Provider** — OpenAI / MiniMax / DeepSeek / 智譜 / Moonshot / 千問 / SiliconFlow / 豆包 / 百川 / 階躍星辰 / 商湯 / 零一萬物，一鍵切換
- **MCP 工具鏈** — 已內建 12 個 MCP 服務設定和 23 個工具定義；目前 `fetch` / `memory` 以穩定的 `local` 模式執行，其餘 MCP 整合多仍處於預覽或占位階段，待完整 session 生命週期管理落地後再逐步恢復真實協議接入
- **AI Agent 核心** — OpenAI 相容協議 + Tool Calling + 自主滲透迴圈
- **20 個滲透 Skill** — 7 核心 + 13 專項 Skill（含 CTF Web/Crypto/Misc + osint-recon），含 138 個參考文件
- **編解碼/加解密工具** — 29 種操作（Base64/Hex/URL/AES/JWT/Morse 等），LLM 可精確呼叫，不再靠猜測
- **Python 程式碼執行** — 內建 `python_execute` 工具，適合 payload 構造和回應解析；目前仍屬高風險實驗能力，不應視為強隔離沙箱
- **持續性滲透測試** — 週期迴圈（預設 100 輪/週期 × 10 週期 = 1000 輪），每週期自動生成報告，直到手動終止
- **推理過程顯示控制** — `think on/off` 一鍵切換 LLM 思考過程的顯示/隱藏，預設關閉，乾淨輸出只看結論
- **沙盒模式提示詞** — 解鎖 AI 安全測試能力，CTF / 授權滲透場景專用
- **自動報告 & PoC** — 生成結構化 Markdown 報告和可執行的 Python PoC 腳本
- **Web UI 模式** — `vulnclaw web` 啟動本地 Web 介面，瀏覽器操作滲透測試全流程，預設 `127.0.0.1:7788`
- **安全知識庫** — 已內建知識庫模組與基礎種子資料，CLI 可維護；檢索增強正在逐步接入主流程

---

## 快速開始

### 安裝

```bash
# 從 PyPI 安裝（推薦）
pip install vulnclaw

# 從原始碼安裝
git clone https://github.com/Unclecheng-li/VulnClaw.git
cd VulnClaw
pip install -e .
```

### 四步啟動

```bash
# 1. 選擇提供者（自動填入 Base URL 和模型名）
vulnclaw config provider minimax   (或 openai/llamacpp/deepseek/zhipu/moonshot/qwen/siliconflow)

# 本地 llama.cpp:
# ./llama-server -m ./models/your-model.gguf --host 127.0.0.1 --port 8080
vulnclaw config provider llamacpp

# 1.2（可選）自訂 Base URL 或模型名
vulnclaw config set llm.base_url https://your-own-api.example.com/v1 
vulnclaw config set llm.model your-model-name

# 2. 設定 API Key
vulnclaw config set llm.api_key sk-your-key-here

# 3. 預設：開啟原 CLI / REPL
vulnclaw

# 4. 可選：開啟 TUI 工作台
vulnclaw tui
```

### 環境檢查

```bash
vulnclaw doctor
```

輸出示例：

```
🦞 VulnClaw 環境檢查

  Python: 3.14.4
  Node.js: v24.14.1
  npx: 已安裝
  nmap: 已安裝

LLM 設定:
  Provider: openai
  API Key: 已設定
  Base URL: https://api.openai.com/v1
  Model: gpt-4o

MCP 服務:
  fetch: 已啟用 [P0]
  memory: 已啟用 [P0]
  ...

✅ 環境就緒，執行 vulnclaw 開始
```

---

## CLI 命令速查

`vulnclaw --help` 檢視所有命令：

```bash
$ vulnclaw --help

🦞 VulnClaw — AI-powered penetration testing CLI

 Usage: vulnclaw [OPTIONS] COMMAND [ARGS]...

 Options:
   --version  Show version and exit.
   --help     Show this message and exit.

 Commands:
   run           🚀 一鍵全流程滲透測試
   persistent    🔄 持續性滲透測試（100輪/週期）
   recon         🔍 僅資訊收集階段
   scan          🔎 執行漏洞掃描階段
   exploit       💥 執行漏洞利用階段
   report        📝 從會話記錄生成報告
   repl          💬 啟動經典 REPL 互動介面
   config        ⚙️  管理設定（set/get/list/provider）
   init          🔧 初始化設定
   doctor        🏥  檢查執行環境
   tui           🖥️  開啟終端圖形化工作台
   web           🌐 啟動本地 Web UI
```

### 命令詳解

| 命令 | 說明 | 示例 |
|------|------|------|
| `vulnclaw` | 預設開啟原 CLI / REPL 互動介面 | `vulnclaw` |
| `vulnclaw tui` | 顯式開啟終端圖形化工作台 | `vulnclaw tui` / `vulnclaw tui --target target.com` |
| `vulnclaw repl` | 啟動經典 REPL 互動介面 | `vulnclaw repl` |
| `vulnclaw run <target>` | 一鍵全流程滲透測試 | `vulnclaw run 192.168.1.1` |
| `vulnclaw persistent <target>` | 持續性滲透（100輪/週期） | `vulnclaw persistent 192.168.1.1` |
| `vulnclaw recon <target>` | 僅資訊收集（不利用漏洞） | `vulnclaw recon target.com` |
| `vulnclaw scan <target>` | 漏洞掃描階段 | `vulnclaw scan target.com --ports 80,443` |
| `vulnclaw exploit <target>` | 漏洞利用階段 | `vulnclaw exploit target.com --cve CVE-2024-1234` |
| `vulnclaw report <session>` | 從會話 JSON 生成報告 | `vulnclaw report session_xxx.json` |
| `vulnclaw config set <key> <value>` | 設定項目 | `vulnclaw config set llm.api_key sk-xxx` |
| `vulnclaw config get <key>` | 檢視設定項目 | `vulnclaw config get llm.model` |
| `vulnclaw config list` | 列出所有設定 | `vulnclaw config list` |
| `vulnclaw config provider <name>` | 切換 LLM 提供者 | `vulnclaw config provider minimax` |
| `vulnclaw init` | 初始化設定檔案 | `vulnclaw init` |
| `vulnclaw doctor` | 檢查執行環境 | `vulnclaw doctor` |
| `vulnclaw web` | 啟動本地 Web UI | `vulnclaw web` / `vulnclaw web --port 8080` |

### TUI 工作台

`vulnclaw tui` 是可選的終端圖形化工作台入口。它會在終端中展示授權目標、檢查模式、執行概覽、安全邊界、命令預覽、歷史狀態、報告和內嵌環境診斷，讓使用者先確認範圍再啟動任務。

```bash
vulnclaw tui
vulnclaw tui --target https://target.example --mode quick --only-port 443
vulnclaw tui --dry-run --target https://target.example --mode deep --only-path /admin
```

預設 `vulnclaw` 仍然進入原 CLI / REPL 互動；只有顯式輸入 `vulnclaw tui` 才會進入 TUI。
執行概覽會讀取已選目標的歷史快照、風險數量、持久化約束和約束攔截次數，幫助使用者在繼續測試前確認上下文沒有衰減。
在 TUI 的“設定測試範圍”中可以直接編輯允許動作和禁止動作，例如只允許 `recon,scan`，或禁止 `exploit,post_exploitation`。

### 設定管理

```bash
# 檢視所有提供者並切換
vulnclaw config provider --list    # 檢視所有可用提供者
vulnclaw config provider minimax   # 切換到 MiniMax

# 手動設定（custom 模式）
vulnclaw config set llm.base_url https://your-api.com/v1
vulnclaw config set llm.model your-model-name
vulnclaw config set llm.api_key sk-your-key
```

---

## 使用方式

### 方式一：原 CLI / REPL 互動模式（預設）

```bash
$ vulnclaw
```

無引數啟動會進入原本的 🦞 互動介面，用自然語言對話：

```
🦞 vulnclaw> 對 192.168.1.100 進行滲透測試，這是我授權的靶場

[*] 進入自主滲透模式，按 Ctrl+C 可隨時中斷
── Round 1 ──
  [+] 目標: 192.168.1.100
  [+] 開放連接埠: 22, 80, 443, 8080
```

### 方式二：TUI 工作台（顯式啟用）

```bash
$ vulnclaw tui
```

TUI 會先展示目標、檢查模式、執行概覽和安全邊界，讓你確認授權範圍後再啟動任務：

```text
VulnClaw TUI 工作台

授權目標        https://example.com
檢查模式        快速摸底 / recon
執行概覽        歷史快照、風險數量、持久化約束、約束攔截
安全邊界        僅測試連接埠 443，禁止 exploit/persistent/post_exploitation

1 設定授權目標
2 選擇檢查模式
3 設定測試範圍
4 開始授權安全檢查
8 模型/API 設定
```

常用啟動方式：

```bash
vulnclaw tui
vulnclaw tui --target https://target.example --mode quick --only-port 443
vulnclaw tui --dry-run --target https://target.example --mode deep --only-path /admin
```

選單 3 “設定測試範圍”可編輯主機、連接埠、路徑、排除項、允許動作和禁止動作；這些邊界會進入啟動前確認和實際任務命令。
選單 7 “環境診斷入口”會在 TUI 內顯示 Python、Node/npx/uvx/nmap、LLM 設定和 MCP 服務/工具摘要；需要完整詳情時再執行 `vulnclaw doctor`。
選單 8 “模型/API 設定”可直接切換 Provider、Base URL、Model 和 API Key，儲存後工作台會立刻使用新設定。

### 方式三：經典 REPL 子命令

```bash
$ vulnclaw repl
```

進入經典 🦞 互動介面，用自然語言對話：

```
🦞 vulnclaw> 對 192.168.1.100 進行滲透測試，這是我授權的靶場

[*] 進入自主滲透模式，按 Ctrl+C 可隨時中斷
── Round 1 ──
  [+] 目標: 192.168.1.100
  [+] 開放連接埠: 22, 80, 443, 8080
  [+] Web 指紋: Apache/2.4.62
── Round 2 ──
  [+] 發現 /manager/html (Tomcat Manager)
  [+] 命中 CVE-202X-XXXX: Apache Tomcat 認證繞過
── Round 3 ──
  [+] 漏洞驗證成功

🦞 192.168.1.100 | 報告> 生成滲透報告
[+] 報告已儲存: ./reports/192.168.1.100_20260418.md
[+] PoC 腳本已儲存: ./pocs/CVE-202X-XXXX.py
```

#### 經典 REPL 內建命令

| 命令                  | 說明                                       |
| --------------------- | ------------------------------------------ |
| `target <host>`       | 設定滲透測試目標                           |
| `status`              | 檢視目前狀態（目標、階段、工具、推理顯示） |
| `tools`               | 列出目前可用 MCP 工具                      |
| `think`               | 切換推理過程顯示/隱藏                      |
| `think on` / `off`    | 精確控制推理過程顯示                       |
| `persistent`          | 啟動持續性滲透測試（100輪/週期，自動報告） |
| `persistent <host>`   | 對指定目標啟動持續性滲透                   |
| `clear`               | 清空目前會話                               |
| `help`                | 顯示幫助資訊                               |
| `exit` / `quit` / `q` | 退出 VulnClaw                              |

#### 自主滲透模式

VulnClaw 檢測到以下關鍵詞 + 目標時，自動進入多輪自主滲透迴圈：

| 觸發方式 | 示例 |
| -------- | ---- |
| 滲透指令 | `對 http://target.com 進行滲透測試` |
| CTF / 找 flag | `幫我對 http://ctf.site 找出flag` |
| 爆破 / 繞過 | `對 http://target.com 弱口令爆破` |
| **顯式觸發** | `目標：http://target.com，進入自主滲透模式` |

> 💡 在 REPL 中輸入 `Ctrl+C` 可隨時中斷自主迴圈。切換目標時自動重置會話上下文。

### 方式二：單命令模式

```bash
# 一鍵全流程滲透測試
vulnclaw run 192.168.1.100

# 持續性滲透測試（每週期100輪，最多10週期，自動生成報告）
vulnclaw persistent 192.168.1.100

# 自訂週期引數
vulnclaw persistent 192.168.1.100 --rounds 200 --cycles 5

# 僅資訊收集
vulnclaw recon 192.168.1.100

# 漏洞掃描（可指定連接埠）
vulnclaw scan 192.168.1.100 --ports 80,443,8080

# 漏洞利用（可指定 CVE）
vulnclaw exploit 192.168.1.100 --cve CVE-2024-1234 --cmd id

# 生成報告
vulnclaw report session.json
```

### 方式三：持續性滲透模式

適用於需要長時間深度滲透的場景。VulnClaw 以**週期迴圈**方式執行：

```
┌──────────────────────────────────────────────┐
│  Cycle 1 (100輪) → 自動報告 → 繼續          │
│  Cycle 2 (100輪) → 自動報告 → 繼續          │
│  Cycle 3 (100輪) → 自動報告 → 繼續          │
│  ...                                         │
│  直到 Ctrl+C 或達到最大週期數（預設10）      │
└──────────────────────────────────────────────┘
```

**特點**：
- **跨週期狀態保持** — 每個週期保留之前的所有發現、漏洞和步驟記錄
- **週期報告** — 每個週期結束自動生成獨立的 Markdown 報告（含新增漏洞和累計彙總）
- **靈活中斷** — Ctrl+C 隨時中斷，中斷時仍生成本週期報告
- **增量發現** — 報告區分"本週期新增"和"累計總計"，清晰追蹤進展
- **可設定** — 每週期輪數、最大週期數、是否自動報告均可設定

```bash
# CLI 方式
vulnclaw persistent 192.168.1.100              # 預設 100輪/週期 × 10週期
vulnclaw persistent 192.168.1.100 -r 200 -c 5  # 200輪/週期 × 5週期
vulnclaw persistent 192.168.1.100 --no-report   # 不自動生成報告

# TUI 方式
vulnclaw tui --target 192.168.1.100 --mode continuous

# REPL 方式
🦞 vulnclaw> target 192.168.1.100
🦞 vulnclaw> persistent
# 或直接
🦞 vulnclaw> persistent 192.168.1.100
```

### 方式四：Web UI 模式

透過瀏覽器操作滲透測試全流程，適合偏好圖形介面的使用者。

```bash
# 安裝 Web 依賴
pip install vulnclaw[web]

# 啟動 Web UI（預設 127.0.0.1:7788）
vulnclaw web

# 自訂連接埠
vulnclaw web --port 8080

# 僅檢查啟動資訊（不實際啟動服務）
vulnclaw web --dry-run
```

啟動後瀏覽器訪問 `http://127.0.0.1:7788` 即可使用。

> ⚠️ 預設僅繫結本地迴環地址。如需遠端訪問須顯式指定 `--host 0.0.0.0 --allow-remote`，請確保網路環境安全。

---

## LLM 提供者設定

VulnClaw 支援所有 OpenAI 相容協議的 API，內建 8 個提供者預設：

```bash
vulnclaw config provider --list    # 檢視所有提供者
vulnclaw config provider minimax   # 一鍵切換
```

| 提供者      | 命令                   | 預設模型              |
| ----------- | ---------------------- | --------------------- |
| OpenAI      | `provider openai`      | gpt-4o                |
| llama.cpp   | `provider llamacpp`    | local-model           |
| MiniMax     | `provider minimax`     | MiniMax-M3            |
| DeepSeek    | `provider deepseek`    | deepseek-v4-pro       |
| 智譜 GLM    | `provider zhipu`       | glm-4.7               |
| Kimi        | `provider moonshot`    | kimi-k2.6             |
| 通義千問    | `provider qwen`        | qwen3-max             |
| SiliconFlow | `provider siliconflow` | DeepSeek-V4-Flash     |
| 豆包        | `provider doubao`      | Doubao-Seed-2.0-Pro   |
| 百川        | `provider baichuan`    | Baichuan4-Turbo       |
| 階躍星辰    | `provider stepfun`     | step-3.5-flash        |
| 商湯        | `provider sensetime`   | SenseNova-6.7-Flash-Lite |
| 零一萬物    | `provider yi`          | yi-lightning          |
| 自訂        | `provider custom`      | 手動填寫              |

---

## 架構

```
┌─────────────────────────────────────────────┐
│                VulnClaw CLI                  │
│  ┌─────────┐  ┌─────────┐  ┌────────────┐  │
│  │  自然語言 │  │  任務編排 │  │ 報告 & PoC │  │
│  │  互動層  │  │  引擎    │  │   生成器   │  │
│  └────┬────┘  └────┬────┘  └─────┬──────┘  │
│       └─────────────┼─────────────┘        │
│               ┌─────▼──────┐                │
│               │ LLM Agent  │                │
│               │ (越獄+Skill)│               │
│               └─────┬──────┘                │
│               ┌─────▼──────┐                │
│               │ MCP 編排層  │                │
│               │ (11 服務)  │                │
│               └─────┬──────┘                │
│               ┌─────▼──────┐                │
│               │ 安全知識庫  │                │
│               └────────────┘                │
└─────────────────────────────────────────────┘
```

### 核心模組

| 模組           | 檔案                                             | 說明                                          |
| -------------- | ------------------------------------------------ | --------------------------------------------- |
| **CLI/TUI 入口** | `cli/main.py` + `cli/tui.py`                   | Typer 命令 + 預設原 CLI/REPL + 顯式 TUI       |
| **Agent 核心** | `agent/core.py`                                  | AgentCore 協調入口（核心重構後主要保留少量協調職責） |
| **動態提示詞** | `agent/prompts.py`                               | 基礎身份 + 核心契約 + Skill + MCP 工具列表    |
| **Prompt 組裝** | `agent/system_prompt.py` + `prompt_context.py`  | system prompt / round context / attack summary 組裝 |
| **輸入分析**   | `agent/input_analysis.py`                        | 目標識別、階段識別、使用者漏洞提示提取          |
| **反死迴圈 / CTF** | `agent/anti_loop.py` + `ctf_mode.py`        | 完成訊號、攻擊路徑、失敗目標、flag 狀態機      |
| **會話狀態**   | `agent/context.py`                               | 階段追蹤 + 漏洞發現 + 步驟記錄                |
| **Skill / KB 上下文** | `agent/skill_context.py` + `kb_context.py` | Skill 選擇與知識庫 prompt 注入                |
| **目標狀態繼承** | `target_state/store.py`                        | 同目標成果沉澱、恢復、快照、回滾、target 報告 |
| **MCP 編排**   | `mcp/registry.py` + `lifecycle.py` + `router.py` | 服務註冊 + 生命週期 + 自然語言→工具路由       |
| **Skill 排程** | `skills/loader.py` + `dispatcher.py`             | 目錄格式 Skill + 16 種意圖動態排程            |
| **編解碼工具** | `skills/crypto_tools.py`                         | 29 種編解碼/加解密操作，註冊為內建 Agent 工具  |
| **設定管理**   | `config/schema.py` + `settings.py`               | Pydantic 模型 + YAML 持久化 + 8 Provider 預設 |
| **報告生成**   | `report/generator.py` + `poc_builder.py`         | Markdown 報告 + Python PoC 模板               |
| **安全知識庫** | `kb/store.py` + `retriever.py`                   | JSON 儲存 + CVE/技術/工具檢索                 |

---

## MCP 工具鏈

| MCP 服務            | 工具數 | 用途                   | 優先順序 |
| ------------------- | ------ | ---------------------- | ------ |
| fetch               | 1      | HTTP 請求、API 測試    | P0     |
| memory              | 2      | 上下文記憶、狀態持久化 | P0     |
| chrome-devtools     | 4      | 瀏覽器自動化           | P0     |
| js-reverse          | 2      | JS 逆向工程            | P0     |
| burp                | 2      | HTTP 抓包、重放        | P0     |
| frida-mcp           | 2      | 移動端 Hook            | P1     |
| adb-mcp             | 3      | 安卓裝置控制           | P1     |
| jadx                | 2      | APK 反編譯             | P1     |
| ida-pro-mcp         | 2      | 二進位制逆向             | P1     |
| sequential-thinking | 1      | 複雜推理鏈             | P1     |
| context7            | 1      | 程式碼上下文檢索         | P1     |
| everything-search   | 1      | 本地檔案搜尋           | P2     |

> 共 12 個 MCP 服務、23 個工具定義。另有 3 個內建 Agent 工具（`load_skill_reference` + `crypto_decode` + `python_execute`），無需 MCP 即可呼叫。
>
> 目前 `fetch` / `memory` 以 `local` 模式穩定執行；其餘服務多為 `preview / placeholder`。後續會透過獨立的 session 生命週期管理層逐步恢復並擴充真實 MCP 協議接入。

---

## 內建 Skill

### 核心 Skill (7)

| Skill             | 說明               |
| ----------------- | ------------------ |
| pentest-flow      | 滲透測試全流程編排 |
| recon             | 資訊收集流程       |
| vuln-discovery    | 漏洞發現流程       |
| exploitation      | 漏洞利用流程       |
| post-exploitation | 後滲透流程         |
| reporting         | 報告生成流程       |
| waf-bypass        | WAF 繞過技巧庫     |

### 專項 Skill (12)

| Skill                     | 參考文件數 | 說明                                         |
| ------------------------- | ---------- | -------------------------------------------- |
| web-pentest               | 4          | Web 應用滲透                                 |
| android-pentest           | 9          | 安卓應用滲透                                 |
| client-reverse            | 20         | 客戶端逆向分析                               |
| web-security-advanced     | 33         | Web 安全進階（注入、繞過、利用鏈）           |
| ai-mcp-security           | 7          | AI/MCP 安全測試                              |
| intranet-pentest-advanced | 15         | 內網滲透進階                                 |
| pentest-tools             | 18         | 滲透工具速查                                 |
| rapid-checklist           | 3          | 快速檢查清單                                 |
| crypto-toolkit            | 3          | 編解碼/加解密（29 種操作，註冊為內建工具）   |
| **ctf-web**               | 8          | CTF Web 攻擊知識庫（PHP繞過/RCE/SSTI/反序列化） |
| **ctf-crypto**            | 6          | CTF 密碼學攻擊知識庫（RSA/AES/ECC/PRNG/格攻擊） |
| **ctf-misc**              | 6          | CTF 雜項知識庫（PyJail/BashJail/編碼鏈/VM逆向） |
| **osint-recon**           | 7          | OSINT 開源情報收集（四維模型：伺服器/網站/域名/人員） |

Skill 會根據使用者輸入自動排程，無需手動選擇。專項 Skill 含 `references/` 目錄下的詳細方法論文件，LLM 可透過 `load_skill_reference` 工具按需載入。

### 內建編解碼/加解密工具 (crypto_decode)

`crypto_decode` 註冊為 Agent 內建工具，LLM 在任何上下文中均可呼叫，不再靠猜測解碼結果：

| 類別     | 操作                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 編解碼   | base64, base32, base58, hex, url, html, unicode, rot13, caesar, morse（各有 encode/decode） |
| 雜湊     | md5, sha1, sha256, sha512                                                                |
| 加解密   | aes_encrypt, aes_decrypt（CBC 模式，PKCS7 填充）                                          |
| JWT      | jwt_decode, jwt_encode                                                                   |
| 自動識別 | auto_decode — 嘗試所有常見編碼，返回匹配結果                                              |

---

## 設定管理

### 命令列設定

```bash
vulnclaw config list                          # 檢視所有設定
vulnclaw config get llm.model                 # 檢視單項
vulnclaw config set llm.api_key sk-xx         # 設定 API Key
vulnclaw config set session.max_rounds 30     # 設定自主滲透最大輪數（預設 15）
vulnclaw config set session.stale_rounds_threshold 8  # 設定死迴圈檢測閾值（預設 5）
vulnclaw config set session.show_thinking false # 隱藏推理過程（也可在 REPL 中用 think off）
```

### 可設定項目

| 設定項                   | 預設值 | 說明                                     |
| ------------------------ | ------ | ---------------------------------------- |
| `llm.provider`           | openai | LLM 提供者（8 個內建 + custom）          |
| `llm.api_key`            | 空     | API Key                                  |
| `llm.base_url`           | 按 provider | API 基礎 URL，可自訂                |
| `llm.model`              | 按 provider | 模型名稱，可自訂                     |
| `llm.temperature`        | 0.1    | 取樣溫度                                 |
| `llm.max_tokens`         | 4096   | 單次最大輸出 token                       |
| `session.max_rounds`     | 15     | 自主滲透迴圈最大輪數（建議 10-50）       |
| `session.output_dir`     | ./vulnclaw-output | 報告輸出目錄                    |
| `session.report_format`  | markdown | 報告格式（markdown / html）            |
| `session.poc_language`   | python | PoC 生成語言（python / bash）            |
| `session.show_thinking`  | false  | 顯示 LLM 推理過程（think 標籤內容，預設關閉） |
| `session.persistent_rounds_per_cycle` | 100 | 持續性滲透每週期輪數 |
| `session.persistent_max_cycles` | 10 | 持續性滲透最大週期數（0=無限） |
| `session.persistent_auto_report` | true | 持續性滲透每週期自動生成報告 |
| `session.stale_rounds_threshold` | 5 | 死迴圈檢測閾值 — 連續無新發現輪數達到此值時觸發強制策略切換 |

### 環境變數

| 變數                          | 說明                   |
| ----------------------------- | ---------------------- |
| `VULNCLAW_LLM_PROVIDER`       | LLM 提供者名稱         |
| `VULNCLAW_LLM_API_KEY`        | API Key                |
| `VULNCLAW_LLM_BASE_URL`       | API 基礎 URL           |
| `VULNCLAW_LLM_MODEL`          | 模型名稱               |
| `VULNCLAW_SESSION__MAX_ROUNDS`| 自主滲透最大輪數       |
| `VULNCLAW_SESSION__STALE_ROUNDS_THRESHOLD` | 死迴圈檢測閾值 |

優先順序：**環境變數 > 設定檔案 > 內建預設值**

設定檔案位於 `~/.vulnclaw/config.yaml`。

---

## 版本路線

| 版本     | 目標                                                    | 狀態       |
| -------- | ------------------------------------------------------- | ---------- |
| v0.1 MVP | CLI + LLM Agent + 基礎 MCP + Skill + 報告 + 多 Provider | ✅ 已完成  |
| v0.1.1   | `python_execute` + 上下文壓縮 + 程式碼審計策略 + 反幻覺  | ✅ 已完成  |
| v0.1.2   | 3 個 CTF 專項 Skill + 3 個現有 Skill 更新 + 觸發詞擴充 | ✅ 已完成  |
| v0.1.3   | 四維資訊收集模型 + RECON_MIN_ROUNDS + 維度完成度自檢 + 社工條件觸發 + osint-recon Skill | ✅ 已完成 |
| v0.1.4   | 滲透問題診斷修復（findings 解析 / 資訊收集推進 / 摘要過濾 / nmap 安全閥） | ✅ 已完成 |
| **v0.2.9** | **目前版本：目標級成果繼承、target state 治理能力與架構文件同步** | ✅ **目前** |
| v0.3     | 逆向能力（IDA Pro）— Skill 已就緒                       | 📋 Skill ✅ |
| v0.4     | 知識庫增強（ChromaDB 向量檢索 + 語義 Skill 排程）       | 📋         |
| v1.0     | 正式釋出（PyPI + 文件 + CI/CD）                         | 📋         |

---

## 安全宣告

VulnClaw 僅用於**已授權的安全測試**。使用本工具前，請確保：

1. 你已獲得目標系統的**明確授權**
2. 測試範圍已與目標所有者**書面確認**
3. 你遵守當地**法律法規**

未經授權對系統進行滲透測試是違法行為。本工具作者不對濫用行為承擔責任。

---

## 許可證

[MIT License](LICENSE)

---

## 加入社群

與更多安全愛好者一起交流、分享與成長

| 社群交流群 | 開發者群聊 |
|:--:|:--:|
| 歡迎加入討論分享，獲取最新產品動態與使用技巧 | 加入我們，參與開源貢獻與技術深度探討 |
| ![VulnClaw 社群交流群](assets/社群交流群.jpg) | ![VulnClaw 開發者群聊](assets/VulnClaw開發者群聊.png) |
| **QQ 群號：954402631** | **QQ 群號：1065858551** |

---

<div align="center">

> 🦞 **VulnClaw** — 讓每一次滲透都有章可循。

</div>
