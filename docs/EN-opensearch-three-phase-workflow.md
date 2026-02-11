# OpenSearch Three-Phase Workflow - Execution Flow

## Overview

The test `opensearch-three-phase.spec.ts` demonstrates a **5-phase workflow** using AI Agent to automate testing on OpenSearch Dashboard.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    5-PHASE WORKFLOW                                   │
├──────────────────────────────────────────────────────────────────────┤
│  Phase 1: RECORD  → Phase 2: LEARN → Phase 3: EXECUTE (AI Agent)   │
│  Phase 4: DATA EXTRACTION → Phase 5: MULTI-INDEX PROCESSING         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Flow

### Phase 3: EXECUTE (AI Agent) - Main Phase

```
START
  ↓
Navigate to OpenSearch Home
  ↓
[AI Agent] Auto-navigate with Gemini LLM
  ├── Toggle navigation menu
  ├── Click Discover link
  ├── Dismiss popup (if any)
  └── Auto-fix time range (2 → 4 → 6 months)
  ↓
GOAL ACHIEVED: URL contains /discover, Download CSV button visible
  ↓
```

**AI Technology:**
- **LLM**: Google Gemini 2.0 Flash
- **Rate Limiting**: 15 req/min (avoid 429 errors)
- **Decision Cache**: Cache decisions for deterministic behavior
- **Vision Analysis**: Screenshot analysis to understand page layout

---

### Phase 4: DATA EXTRACTION

```
On Discover page
  ↓
Extract table data
  ├── Headers: [, Time, _source]
  ├── Row count: 50 records
  └── Sample rows: first 10 rows
```

---

### Phase 5: MULTI-INDEX PROCESSING

```
Loop through 3 indices:
┌─────────────────────────────────────────────────────────────┐
│ 1. opensearch_dashboards_sample_data_ecommerce              │
│    ├── switchIndex() → 4 fallback strategies               │
│    ├── extractTableData() → 50 records                      │
│    └── Auto-fix time range if no data                       │
├─────────────────────────────────────────────────────────────┤
│ 2. opensearch_dashboards_sample_data_flights                │
│    ├── switchIndex() → dropdown handling                    │
│    ├── extractTableData() → 50 records                      │
│    └── Auto-fix time range if no data                       │
├─────────────────────────────────────────────────────────────┤
│ 3. opensearch_dashboards_sample_data_logs                   │
│    ├── switchIndex() → scroll + click strategies            │
│    ├── extractTableData() → 50 records                      │
│    └── Auto-fix time range if no data                       │
└─────────────────────────────────────────────────────────────┘
  ↓
Generate Consolidated Markdown Report
  ├── test-results/analysis/multi-index-consolidated-{timestamp}.md
  └── Summary: 150 records from 3 indices
```

---

## `switchIndex()` Improvements - Multi-index Switching

**Problem**: After 2 successful index switches, the 3rd one fails due to unclean dropdown state.

**Solution**:
1. **Pre-step cleanup**: Press `Escape` to close any open dropdowns
2. **4 dropdown opening strategies**:
   - `[data-test-subj="indexPatternSwitchLink"]`
   - `button.euiButtonEmpty` filter
   - `role=button` with regex
   - Manual search through all buttons
3. **3 index clicking strategies**:
   - `getByText()` with `exact: false`
   - Filtered locator (button, option, li, div[role="menuitem"], span)
   - XPath with 4 variations
4. **Scroll into view**: Element may be hidden, needs scroll before click
5. **Error cleanup**: Press `Escape` on failure to reset state

---

## Running the Test

```bash
# Run with headed mode
npm test -- opensearch-three-phase.spec.ts --headed --workers=1

# Run headless
npm test -- opensearch-three-phase.spec.ts --workers=1
```

> **Note**: Always use `--workers=1` to avoid rate limiting from Gemini API

---

## Output

```
test-results/analysis/multi-index-consolidated-{timestamp}.md
```

| Metric | Value |
|--------|-------|
| Total Indices | 3 |
| Successful | 3 |
| Failed | 0 |
| Total Records | 150 |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        TestAgent                             │
├──────────────────────────────────────────────────────────────┤
│  ├── LLMDecisionEngine (Gemini 2.0 Flash)                   │
│  │   ├── RateLimiter (15 req/min)                           │
│  │   ├── DecisionCache                                      │
│  │   └── PerformanceMonitor                                 │
│  ├── ActionExecutor (Playwright actions)                    │
│  ├── BrowserStateCapture (DOM + Screenshot)                 │
│  └── GoalValidator (LLM-based validation)                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Related Files

| File | Description |
|------|-------------|
| [tests/opensearch-three-phase.spec.ts](../tests/opensearch-three-phase.spec.ts) | Main test file |
| [utils/agent/TestAgent.ts](../utils/agent/TestAgent.ts) | Agent implementation |
| [utils/agent/LLMDecisionEngine.ts](../utils/agent/LLMDecisionEngine.ts) | LLM integration |
| [utils/agent/RateLimiter.ts](../utils/agent/RateLimiter.ts) | Rate limiting |
| [utils/agent/DecisionCache.ts](../utils/agent/DecisionCache.ts) | Decision caching |
