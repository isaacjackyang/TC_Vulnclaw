"""VulnClaw Report Generator — generate structured penetration test reports."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from jinja2 import Template

from vulnclaw.agent.context import SessionState, VulnerabilityFinding

# ── Report Template ─────────────────────────────────────────────────

REPORT_TEMPLATE = """\
# 滲透測試報告

## 1. 專案概述

| 項目 | 詳情 |
|------|------|
| **測試目標** | {{ target }} |
| **測試時間** | {{ started_at }} |
| **報告產生時間** | {{ generated_at }} |
| **測試工具** | VulnClaw v{{ version }} |
| **任務限制** | {{ task_constraints_summary }} |

## 2. 執行摘要

{% if verified_count > 0 %}
- **已驗證漏洞**: {{ verified_count }} 個（其中高風險 {{ critical_count }} 個 Critical, {{ high_count }} 個 High）
{% else %}
- **已驗證漏洞**: 0 個
{% endif %}
- **誤報排除**: {{ rejected_count }} 個
- **待驗證**: {{ pending_count }} 個（未在報告中顯示）
- **候選項**: {{ candidate_count }} 個
- **待驗證項**: {{ pending_verification_count }} 個
- **需人工覆核**: {{ manual_review_count }} 個
- **攻擊面**: {{ attack_surface_summary }}
{% if constraint_violation_events or constraint_violations %}
- **限制違規已阻擋**: {{ constraint_violations|length }} 次
{% endif %}

{% if rejected_count > 0 %}
### 已排除的誤報

以下漏洞假設經 PoC 驗證失敗，已排除，不計入報告：

{% for f in rejected_findings %}
- {{ f.title }} — {{ f.verification_note }}
{% endfor %}
{% endif %}

### 風險等級分布

| 等級 | 數量 |
|------|------|
| Critical | {{ critical_count }} |
| High | {{ high_count }} |
| Medium | {{ medium_count }} |
| Low/Info | {{ low_count }} |

{% if verified_findings %}
### 關鍵建議

{% for rec in key_recommendations %}
{{ loop.index }}. {{ rec }}
{% endfor %}
{% else %}
### 漏洞發現

**本次測試未發現有效漏洞。**

可能原因：
- 目標系統安全設定較完整
- 滲透深度不足（資訊收集輪數不足）
- 漏洞利用條件未滿足

建議：
- 增加滲透測試輪數
- 嘗試更多漏洞類型
- 檢查是否需要特殊認證或存取權限
{% endif %}

## 3. 詳細發現

{% for finding in findings %}
### 3.{{ loop.index }} {{ finding.title }} — [{{ finding.severity }}]
{% if finding.verification_status == "pending" %}
> ⚠️ **待驗證** — 此漏洞由自動偵測發現，尚未通過 PoC 驗證。請手動審查。
{% elif finding.verification_status == "rejected" %}
> ❌ **已排除（誤報）** — {{ finding.verification_note or "經驗證為誤報" }}
{% elif finding.lifecycle_status == "needs_manual_review" %}
> 🔎 **需人工覆核** — 目前已有間接證據，但仍需人工覆核後再升級為正式漏洞。
{% endif %}

- **漏洞類型**: {{ finding.vuln_type or "未分類" }}
- **生命週期**: {{ finding.lifecycle_status or "pending_verification" }}
- **證據等級**: {{ finding.evidence_level or "L1" }}
- **CVE**: {{ finding.cve or "N/A" }}
- **影響範圍**: {{ finding.description or "無" }}
{% if finding.evidence %}
- **驗證證據**: {{ finding.evidence }}
{% endif %}
{% if finding.poc_script %}
- **PoC 腳本**: 見附件 `{{ finding.poc_script }}`
{% endif %}
- **修復建議**: {{ finding.remediation or "請依漏洞類型採取相應修復措施" }}
{% if finding.verified and finding.verified_at %}
- **驗證時間**: {{ finding.verified_at }}
{% endif %}

{% endfor %}

{% if llm_attack_summary %}
## 4. 攻擊路徑摘要

{{ llm_attack_summary }}

{% elif step_summary and step_summary.total_steps > 0 %}
## 4. 攻擊路徑摘要

{% for phase_name, phase_data in step_summary.phases.items() %}
### {{ phase_name }}（共 {{ phase_data.count }} 步）

| 狀態 | 數量 |
|------|------|
| ✅ 成功 | {{ phase_data.success_count }} |
| ❌ 失敗 | {{ phase_data.failure_count }} |

**關鍵動作**: {{ phase_data.actions[:5]|join(', ') }}

{% if phase_data.key_results %}
**主要發現**:
{% for result in phase_data.key_results %}
- {{ result }}
{% endfor %}
{% endif %}

---
{% endfor %}

**總計**: {{ step_summary.total_steps }} 步

{% if step_summary.key_findings %}
### 關鍵發現時間線

{% for finding in step_summary.key_findings %}
- {{ finding }}
{% endfor %}
{% endif %}

{% elif findings %}
## 4. 攻擊路徑

{% for step in executed_steps %}
{{ loop.index }}. {{ step }}
{% endfor %}
{% endif %}

{% if constraint_violation_events or constraint_violations %}
## 5. 限制違規稽核

{% if constraint_violation_events %}
{% for item in constraint_violation_events %}
- [{{ item.source or "unknown" }}] {{ item.summary }}
{% endfor %}
{% else %}
{% for item in constraint_violations %}
- {{ item }}
{% endfor %}
{% endif %}
{% endif %}

## 6. 附件

- PoC 腳本: 見 `pocs/` 目錄
- 流量封包: 見 `captures/` 目錄
- 截圖證據: 見 `screenshots/` 目錄

---

> 🦞 報告由 VulnClaw 自動產生 | {{ generated_at }}
> **原則**: 未經驗證的漏洞 = 誤報 = 不寫入報告
"""


def generate_report(
    session: SessionState,
    output_path: Optional[str] = None,
    llm_attack_summary: str = "",
    report_format: str = "markdown",
    target_state_context: Optional[dict[str, Any]] = None,
) -> Path:
    """Generate a penetration test report from session state.

    Only verified findings are rendered into the main detailed findings section.
    Pending, candidate, and rejected findings remain in summary/governance views.
    """
    from vulnclaw import __version__

    all_findings = session.findings
    verified_findings = session.get_verified_findings()
    pending_findings = session.get_pending_findings()
    rejected_findings = session.get_rejected_findings()
    candidate_findings = (
        session.get_candidate_findings() if hasattr(session, "get_candidate_findings") else []
    )
    pending_verification_findings = (
        session.get_pending_verification_findings()
        if hasattr(session, "get_pending_verification_findings")
        else []
    )
    manual_review_findings = (
        session.get_manual_review_findings()
        if hasattr(session, "get_manual_review_findings")
        else []
    )

    severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Info": 0}
    for finding in verified_findings:
        sev = finding.severity
        if sev in severity_counts:
            severity_counts[sev] += 1
        else:
            severity_counts["Medium"] += 1

    seen_vuln_types = set()
    recommendations = []
    for finding in verified_findings:
        if finding.severity in ("Critical", "High"):
            vt = finding.vuln_type or "未分類"
            if vt in seen_vuln_types:
                continue
            seen_vuln_types.add(vt)
            rec = finding.remediation or f"請優先修復 {vt} 風險: {finding.title}"
            recommendations.append(rec)

    if not recommendations:
        recommendations.append("請優先覆核攻擊面並補齊驗證鏈路，確認高風險入口已完成修復。")

    if output_path is None:
        from vulnclaw.config.settings import SESSIONS_DIR

        safe_target = (session.target or "unknown").replace("/", "_").replace(":", "_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = str(SESSIONS_DIR / f"report_{timestamp}_{safe_target}.md")

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    from vulnclaw.report.poc_builder import generate_pocs

    pocs_dir = output.parent / "pocs"
    generate_pocs(session, pocs_dir)

    from vulnclaw.report.filter import ReportContentFilter

    if not llm_attack_summary:
        llm_attack_summary = _generate_attack_summary_from_session(session)
        if llm_attack_summary:
            print("[*] LLM attack summary generated for report section 4")
    filtered_summary = ReportContentFilter.filter(llm_attack_summary) if llm_attack_summary else ""

    context = {
        "target": session.target or "unknown",
        "started_at": session.started_at,
        "generated_at": datetime.now().isoformat(),
        "version": __version__,
        "critical_count": severity_counts["Critical"],
        "high_count": severity_counts["High"],
        "medium_count": severity_counts["Medium"],
        "low_count": severity_counts["Low"] + severity_counts["Info"],
        "task_constraints_summary": _format_task_constraints_summary(session),
        "attack_surface_summary": _summarize_attack_surface(session),
        "constraint_violations": list(getattr(session, "constraint_violations", [])),
        "constraint_violation_events": [
            item.model_dump(mode="json") if hasattr(item, "model_dump") else item
            for item in getattr(session, "constraint_violation_events", [])
        ],
        "key_recommendations": recommendations,
        "verified_findings": [_build_report_finding(finding) for finding in verified_findings],
        "findings": [_build_report_finding(finding) for finding in verified_findings],
        "executed_steps": session.executed_steps,
        "total_findings_submitted": len(all_findings),
        "verified_count": len(verified_findings),
        "rejected_count": len(rejected_findings),
        "pending_count": len(pending_findings),
        "candidate_count": len(candidate_findings),
        "pending_verification_count": len(pending_verification_findings),
        "manual_review_count": len(manual_review_findings),
        "rejected_findings": rejected_findings,
        "step_summary": session.get_step_summary(),
        "llm_attack_summary": filtered_summary,
    }

    template = Template(REPORT_TEMPLATE)
    report_content = template.render(**context)
    if verified_findings:
        report_content += "\n\n" + _render_verified_finding_details_clean(
            verified_findings,
            heading="## 6. 已驗證漏洞定位與重現資訊",
        )
    if target_state_context:
        report_content += "\n\n" + _render_target_state_context(target_state_context)

    if report_format.lower() == "html":
        html_content = Template(
            """<!doctype html><html><head><meta charset="utf-8"><title>VulnClaw Report</title></head><body><pre>{{ content }}</pre></body></html>"""
        ).render(content=report_content)
        output = output.with_suffix(".html") if output.suffix.lower() != ".html" else output
        output.write_text(html_content, encoding="utf-8")
    else:
        output.write_text(report_content, encoding="utf-8")

    return output


def generate_report_from_file(session_path: str) -> Path:
    """Generate a report from a saved session JSON file."""
    session = SessionState.load(Path(session_path))
    return generate_report(session)


def generate_report_from_target_state(
    target_state: dict[str, Any],
    report_format: str = "markdown",
    output_path: str | None = None,
) -> Path:
    """Generate a report from a target-state snapshot."""
    raw = dict(target_state)
    target_state_context = {
        "resume_meta": raw.pop("resume_meta", None),
        "resume_summary": raw.pop("resume_summary", None),
        "recon_meta": raw.pop("recon_meta", None),
        "runtime_meta": raw.pop("runtime_meta", None),
        "finding_meta": raw.pop("finding_meta", None),
    }
    session = SessionState(**raw)
    return generate_report(
        session,
        output_path=output_path,
        report_format=report_format,
        target_state_context=target_state_context,
    )


def _summarize_attack_surface(session: SessionState) -> str:
    """Summarize the attack surface from recon data, including subdomains."""
    parts = []
    recon = session.recon_data

    if "subdomains" in recon and recon["subdomains"]:
        parts.append(f"子域名: {', '.join(recon['subdomains'][:10])}")
    if "ports" in recon:
        parts.append(f"开放端口: {recon['ports']}")
    if "services" in recon:
        parts.append(f"服务: {recon['services']}")
    if "technologies" in recon:
        parts.append(f"技术栈: {recon['technologies']}")
    if "waf" in recon:
        parts.append(f"WAF: {recon['waf']}")
    if "domains" in recon:
        parts.append(f"关联域名: {', '.join(recon['domains'][:5])}")

    return "; ".join(parts) if parts else "未收集"


# ── Persistent Pentest Cycle Report ──────────────────────────────────

CYCLE_REPORT_TEMPLATE = """\
# 持續性滲透測試 — 週期報告

## 週期資訊

| 項目 | 詳情 |
|------|------|
| **測試目標** | {{ target }} |
| **目前週期** | 第 {{ cycle_num }} 週期 |
| **每週期輪數** | {{ rounds_per_cycle }} |
| **本週期新增已驗證漏洞** | {{ new_findings }} 個 |
| **累計已驗證漏洞** | {{ total_findings }} 個 |
| **累計執行步驟** | {{ total_steps }} 個 |
| **報告產生時間** | {{ generated_at }} |

{% if cycle_findings %}
## 本週期漏洞發現

{% for finding in cycle_findings %}
### {{ loop.index }}. {{ finding.title }} — [{{ finding.severity }}]
{% if finding.verification_status == "pending" %}
> ⚠️ **待驗證** — 此漏洞由自動偵測發現，尚未通過 PoC 驗證。
{% elif finding.lifecycle_status == "needs_manual_review" %}
> 🔎 **需人工覆核** — 目前已有間接證據，但仍需人工覆核後再升級為正式漏洞。
{% endif %}
- **漏洞類型**: {{ finding.vuln_type or "未分類" }}
- **生命週期**: {{ finding.lifecycle_status or "pending_verification" }}
- **證據等級**: {{ finding.evidence_level or "L1" }}
- **CVE**: {{ finding.cve or "N/A" }}
- **影響範圍**: {{ finding.description or "無" }}
{% if finding.evidence %}
- **驗證證據**: {{ finding.evidence }}
{% endif %}
- **修復建議**: {{ finding.remediation or "請依漏洞類型採取相應修復措施" }}
{% if finding.verified_at %}
- **驗證時間**: {{ finding.verified_at }}
{% endif %}

{% endfor %}
{% else %}
## 本週期漏洞發現

本週期未發現新漏洞。
{% endif %}

## 累計漏洞彙總

| # | 漏洞標題 | 等級 | 類型 | 證據/URL | 狀態 |
|---|---------|------|------|---------|------|
{% for finding in all_findings %}
{% set ev = (finding.evidence or finding.description or "")[:80] %}
| {{ loop.index }} | {{ finding.title }} | {{ finding.severity }} | {{ finding.vuln_type or "—" }} | {{ ev if ev else "—" }} | {% if finding.verification_status == "verified" %}✅ 已驗證{% elif finding.lifecycle_status == "needs_manual_review" %}🔎 需人工覆核{% elif finding.verification_status == "pending" %}⚠️ 待驗證{% else %}❌ 已排除{% endif %} |
{% endfor %}

{% if not all_findings %}
暫未發現漏洞
{% endif %}

## 風險等級分布

| 等級 | 數量 |
|------|------|
| Critical | {{ critical_count }} |
| High | {{ high_count }} |
| Medium | {{ medium_count }} |
| Low/Info | {{ low_count }} |

{% if llm_attack_summary %}
## 攻擊路徑摘要

{{ llm_attack_summary }}

{% elif step_summary and step_summary.total_steps > 0 %}
## 攻擊路徑摘要

{% for phase_name, phase_data in step_summary.phases.items() %}
### {{ phase_name }}（共 {{ phase_data.count }} 步）

| 狀態 | 數量 |
|------|------|
| ✅ 成功 | {{ phase_data.success_count }} |
| ❌ 失敗 | {{ phase_data.failure_count }} |

**關鍵動作**: {{ phase_data.actions[:5]|join(', ') }}

{% if phase_data.key_results %}
**主要發現**:
{% for result in phase_data.key_results %}
- {{ result }}
{% endfor %}
{% endif %}

---
{% endfor %}

**總計**: {{ step_summary.total_steps }} 步

{% if step_summary.key_findings %}
### 關鍵發現時間線

{% for finding in step_summary.key_findings %}
- {{ finding }}
{% endfor %}
{% endif %}

{% elif recent_steps %}
## 攻擊路徑摘要

{% for step in recent_steps %}
{{ loop.index }}. {{ step }}
{% endfor %}
{% endif %}

## 關鍵建議

{% for rec in recommendations %}
{{ loop.index }}. {{ rec }}
{% endfor %}

---

> 🦞 持續性滲透測試週期報告 | VulnClaw | {{ generated_at }}
> **原則**: 未經驗證的漏洞 = 誤報 = 不寫入報告
"""


def _generate_attack_summary_from_session(session: SessionState) -> str:
    """Generate a readable attack-path summary using VulnClaw's configured LLM."""
    try:
        from openai import OpenAI

        from vulnclaw.agent.think_filter import strip_think_tags
        from vulnclaw.config.settings import llm_auth_ready, load_config, provider_requires_api_key

        config = load_config()
        if not llm_auth_ready(config.llm.provider, config.llm.api_key):
            return ""

        api_key = config.llm.api_key
        if not api_key and not provider_requires_api_key(config.llm.provider):
            api_key = "local-llamacpp"

        client = OpenAI(
            api_key=api_key,
            base_url=config.llm.base_url,
        )

        steps = session.executed_steps[-40:] if session.executed_steps else []
        notes = session.notes[-25:] if session.notes else []
        findings = session.findings[-20:] if session.findings else []

        steps_text = (
            "\n".join(f"{idx + 1}. {step}" for idx, step in enumerate(steps))
            if steps
            else "No step records"
        )
        notes_text = "\n".join(f"- {note}" for note in notes) if notes else "No key observations"
        findings_text = (
            "\n".join(
                f"- [{finding.severity}] {finding.title} | Evidence: {(finding.evidence or '')[:200]}"
                for finding in findings
            )
            if findings
            else "No findings"
        )

        prompt = (
            f"Target: {session.target or 'unknown'}\n"
            f"Phase: {getattr(session.phase, 'value', str(session.phase))}\n\n"
            f"=== Executed Steps ===\n{steps_text}\n\n"
            f"=== Key Observations ===\n{notes_text}\n\n"
            f"=== Findings ===\n{findings_text}\n\n"
            "Please write a readable Traditional Chinese attack-path summary. Requirements:\n"
            "1. Clearly explain how the testing progressed, not generic filler.\n"
            "2. Mention URLs, paths, parameters, stack, and verification actions when available.\n"
            "3. Explicitly call out false positives or findings that failed to reproduce.\n"
            "4. Output 2-5 short natural-language paragraphs in Traditional Chinese only. No markdown headings. No thinking tags.\n"
            "5. Do not invent steps that were never executed.\n"
        )

        response = client.chat.completions.create(
            **_build_report_summary_llm_kwargs(
                config,
                [{"role": "user", "content": prompt}],
            )
        )
        if response and response.choices:
            raw = response.choices[0].message.content or ""
            return strip_think_tags(raw).strip()
    except Exception as exc:
        print(f"[!] LLM attack summary generation failed: {exc}")
        return ""
    return ""


def _build_report_summary_llm_kwargs(config: Any, messages: list[dict[str, Any]]) -> dict[str, Any]:
    """Build Chat Completions kwargs for report summary generation."""
    from vulnclaw.agent.llm_client import build_chat_completion_kwargs

    class _AgentShim:
        def __init__(self, config: Any) -> None:
            self.config = config

    return build_chat_completion_kwargs(
        _AgentShim(config),
        messages,
        max_tokens=min(config.llm.max_tokens, 1200),
        temperature=0.2,
    )


def generate_persistent_cycle_report(
    session: SessionState,
    cycle_num: int,
    total_findings: int,
    new_findings: int,
    total_steps: int,
    rounds_per_cycle: int,
    output_path: Optional[str] = None,
    llm_attack_summary: str = "",  # ★ LLM 產生的攻擊路徑摘要
) -> Path:
    """Generate a cycle report for persistent pentest.

    只包含已驗證 (verified=True) 的漏洞。

    Args:
        session: Current session state with findings.
        cycle_num: Current cycle number (1-based).
        total_findings: Total findings so far (cumulative).
        new_findings: New findings in this cycle.
        total_steps: Total executed steps so far (cumulative).
        rounds_per_cycle: Rounds per cycle.
        output_path: Output file path. If None, auto-generate.

    Returns:
        Path to the generated report file.
    """
    from vulnclaw import __version__

    # ★ 包含所有 findings（包括 pending 和 confirmed，不只是 verified）
    all_findings = session.findings
    verified_findings = session.get_verified_findings()
    manual_review_findings = (
        session.get_manual_review_findings()
        if hasattr(session, "get_manual_review_findings")
        else []
    )

    # Count verified findings by severity only (pending doesn't count as real result)
    severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Info": 0}
    for finding in verified_findings:
        sev = finding.severity
        if sev in severity_counts:
            severity_counts[sev] += 1
        else:
            severity_counts["Medium"] += 1

    # ★ 本週期新增已驗證 findings（只統計 verified）
    cycle_findings = verified_findings[-new_findings:] if new_findings > 0 else []

    # Generate recommendations from verified high/critical findings only
    # Deduplicate by vuln_type: only one recommendation per vulnerability type
    seen_vuln_types = set()
    recommendations = []
    for finding in verified_findings:
        if finding.severity in ("Critical", "High"):
            vt = finding.vuln_type or "未分類"
            if vt in seen_vuln_types:
                continue
            seen_vuln_types.add(vt)
            rec = finding.remediation or f"修復 {vt} 漏洞: {finding.title}"
            recommendations.append(rec)
    if not recommendations:
        recommendations.append("暫無高風險發現，建議持續深入測試")

    if output_path is None:
        from vulnclaw.config.settings import SESSIONS_DIR

        safe_target = (session.target or "unknown").replace("/", "_").replace(":", "_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = str(
            SESSIONS_DIR / f"persistent_cycle{cycle_num:03d}_{timestamp}_{safe_target}.md"
        )

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    from vulnclaw.report.poc_builder import generate_pocs

    pocs_dir = output.parent / "pocs"
    generate_pocs(session, pocs_dir)

    # Recent steps (last 20 to avoid bloat)
    recent_steps = session.executed_steps[-20:]

    # ★ 攻擊路徑摘要（過濾 LLM 原始輸出中的 think 標籤 / 除錯標記）
    step_summary = session.get_step_summary()
    from vulnclaw.report.filter import ReportContentFilter

    if not llm_attack_summary:
        llm_attack_summary = _generate_attack_summary_from_session(session)
    filtered_summary = ReportContentFilter.filter(llm_attack_summary) if llm_attack_summary else ""

    context = {
        "target": session.target or "未指定",
        "cycle_num": cycle_num,
        "rounds_per_cycle": rounds_per_cycle,
        "new_findings": len(cycle_findings),
        "total_findings": len(all_findings),
        "total_steps": total_steps,
        "generated_at": datetime.now().isoformat(),
        "version": __version__,
        "cycle_findings": cycle_findings,
        "all_findings": all_findings,  # ★ 包含所有 findings（包括 pending）
        "critical_count": severity_counts["Critical"],
        "high_count": severity_counts["High"],
        "medium_count": severity_counts["Medium"],
        "low_count": severity_counts["Low"] + severity_counts["Info"],
        "recent_steps": recent_steps,
        "recommendations": recommendations,
        "manual_review_count": len(manual_review_findings),
        "step_summary": step_summary,
        "llm_attack_summary": filtered_summary,
    }

    # Render report
    template = Template(CYCLE_REPORT_TEMPLATE)
    report_content = template.render(**context)
    if verified_findings:
        report_content += "\n\n" + _render_verified_finding_details_clean(
            verified_findings,
            heading="## 已驗證漏洞定位與重現資訊",
        )
    output.write_text(report_content, encoding="utf-8")

    return output


def _render_target_state_context(target_state_context: dict[str, Any]) -> str:
    """Render extra governance context for target-state based reports."""
    resume_meta = target_state_context.get("resume_meta") or {}
    recon_meta = target_state_context.get("recon_meta") or {}
    runtime_meta = target_state_context.get("runtime_meta") or {}
    resume_summary = target_state_context.get("resume_summary") or ""

    lines = ["## 6. 目標歷史治理上下文"]

    if resume_meta:
        lines.extend(
            [
                "",
                f"- 恢復策略: {resume_meta.get('resume_strategy', 'unknown')}",
                f"- 策略原因: {resume_meta.get('resume_strategy_reason', 'N/A')}",
            ]
        )
        if resume_meta.get("priority_targets"):
            lines.append(f"- 恢復優先目標: {', '.join(resume_meta['priority_targets'][:5])}")
        if resume_meta.get("priority_recon_assets"):
            lines.append(
                f"- 恢復優先偵察資產: {', '.join(resume_meta['priority_recon_assets'][:5])}"
            )
        if resume_meta.get("blocked_targets"):
            lines.append(f"- 已阻擋目標: {', '.join(resume_meta['blocked_targets'][:5])}")
        if resume_meta.get("failed_targets"):
            lines.append(f"- 歷史失敗目標: {', '.join(resume_meta['failed_targets'][:5])}")
        if resume_meta.get("recent_failed_steps"):
            lines.append("- 最近失敗路徑/步驟:")
            for item in resume_meta["recent_failed_steps"][:5]:
                lines.append(f"  - {item}")

    top_assets = _top_recon_assets_for_report(recon_meta)
    if top_assets:
        lines.extend(["", "### 高價值偵察資產"])
        for item in top_assets[:8]:
            lines.append(f"- {item}")

    if runtime_meta.get("current_attack_path"):
        lines.extend(["", f"- 最近攻擊路徑: {runtime_meta['current_attack_path']}"])

    if resume_summary:
        lines.extend(["", "### 恢復摘要", "```text", resume_summary.strip(), "```"])

    return "\n".join(lines)


def _top_recon_assets_for_report(recon_meta: dict[str, Any]) -> list[str]:
    ranked: list[tuple[float, str]] = []
    for category, items in recon_meta.items():
        if not isinstance(items, dict):
            continue
        for value, meta in items.items():
            confidence = float(meta.get("confidence", 0))
            ranked.append((confidence, f"{category}:{value} (conf={confidence:.2f})"))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [label for _, label in ranked]


def _extract_location_summary_clean(finding: VulnerabilityFinding) -> str:
    text = " ".join(part for part in [finding.evidence or "", finding.description or ""] if part)
    urls = re.findall(r'https?://[^\s<>"\')\]]+', text)
    paths = re.findall(r"(?:/[\w%&=?\-]+)+", text)

    items: list[str] = []
    seen: set[str] = set()
    for value in urls + paths:
        if value not in seen:
            seen.add(value)
            items.append(value)
        if len(items) >= 4:
            break
    return " | ".join(items)


def _build_repro_summary_clean(finding: VulnerabilityFinding) -> str:
    parts: list[str] = []
    if finding.poc_script:
        parts.append(f"執行 PoC 腳本: {finding.poc_script}")
    if finding.verification_note:
        parts.append(f"驗證說明: {finding.verification_note}")
    elif finding.evidence:
        parts.append(f"根據已驗證證據重現: {finding.evidence[:160]}")
    if finding.verified_at:
        parts.append(f"驗證時間: {finding.verified_at}")
    return "；".join(parts) if parts else "暫無可用重現說明"


def _render_verified_finding_details_clean(
    findings: list[VulnerabilityFinding], heading: str
) -> str:
    lines = [heading, ""]
    for idx, finding in enumerate(findings, 1):
        location = _extract_location_summary_clean(finding) or "未定位 / 未擷取到 URL"
        lines.append(f"### {idx}. {finding.title} [{finding.severity}]")
        lines.append(f"- 漏洞類型: {finding.vuln_type or '未分類'}")
        lines.append(f"- 生命週期: {finding.lifecycle_status or 'verified'}")
        lines.append(f"- 證據等級: {finding.evidence_level or 'L4'}")
        lines.append(f"- 位置 / URL: {location}")
        if finding.evidence:
            lines.append(f"- 驗證證據: {finding.evidence}")
        lines.append(f"- 重現 / PoC: {_build_repro_summary_clean(finding)}")
        lines.append("")
    return "\n".join(lines).rstrip()


def _extract_location_summary(finding: VulnerabilityFinding) -> str:
    text = " ".join(part for part in [finding.evidence or "", finding.description or ""] if part)
    urls = re.findall(r'https?://[^\s<>"\')\]]+', text)
    paths = re.findall(r"(?:/[\w%&=?\-]+)+", text)

    items: list[str] = []
    seen: set[str] = set()
    for value in urls + paths:
        if value not in seen:
            seen.add(value)
            items.append(value)
        if len(items) >= 4:
            break
    return " | ".join(items)


def _build_repro_summary(finding: VulnerabilityFinding) -> str:
    parts: list[str] = []
    if finding.poc_script:
        parts.append(f"執行 PoC 腳本: {finding.poc_script}")
    if finding.verification_note:
        parts.append(f"驗證說明: {finding.verification_note}")
    elif finding.evidence:
        parts.append(f"根據已驗證證據重現: {finding.evidence[:160]}")
    if finding.verified_at:
        parts.append(f"驗證時間: {finding.verified_at}")
    return "；".join(parts) if parts else "暫無可用重現說明"


def _format_task_constraints_summary(session: SessionState) -> str:
    constraints = getattr(session, "task_constraints", None)
    if constraints is None or constraints.is_empty():
        return "未指定"

    parts: list[str] = []
    if constraints.allowed_ports:
        parts.append(f"仅端口 {','.join(str(p) for p in constraints.allowed_ports)}")
    if constraints.blocked_ports:
        parts.append(f"禁端口 {','.join(str(p) for p in constraints.blocked_ports)}")
    if constraints.allowed_hosts:
        parts.append(f"仅主机 {','.join(constraints.allowed_hosts)}")
    if constraints.allowed_paths:
        parts.append(f"仅路径 {','.join(constraints.allowed_paths)}")
    if constraints.allowed_actions:
        parts.append(f"仅动作 {','.join(constraints.allowed_actions)}")
    if constraints.blocked_actions:
        parts.append(f"禁动作 {','.join(constraints.blocked_actions)}")
    return "；".join(parts) if parts else "已启用约束"


def _build_report_finding(finding: VulnerabilityFinding) -> dict[str, Any]:
    return {
        "title": finding.title,
        "severity": finding.severity,
        "vuln_type": finding.vuln_type,
        "description": finding.description,
        "evidence": finding.evidence,
        "cve": finding.cve,
        "remediation": finding.remediation,
        "poc_script": finding.poc_script,
        "verified": finding.verified,
        "verified_at": finding.verified_at,
        "verification_status": finding.verification_status,
        "verification_note": finding.verification_note,
        "lifecycle_status": finding.lifecycle_status,
        "evidence_level": finding.evidence_level,
        "location_summary": _extract_location_summary(finding),
        "repro_summary": _build_repro_summary(finding),
    }


def _render_verified_finding_details(findings: list[VulnerabilityFinding], heading: str) -> str:
    lines = [heading, ""]
    for idx, finding in enumerate(findings, 1):
        location = _extract_location_summary(finding) or "未定位 / 未擷取到 URL"
        lines.append(f"### {idx}. {finding.title} [{finding.severity}]")
        lines.append(f"- 漏洞類型: {finding.vuln_type or '未分類'}")
        lines.append(f"- 位置 / URL: {location}")
        if finding.evidence:
            lines.append(f"- 驗證證據: {finding.evidence}")
        lines.append(f"- 重現 / PoC: {_build_repro_summary(finding)}")
        lines.append("")
    return "\n".join(lines).rstrip()
