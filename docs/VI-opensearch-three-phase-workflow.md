# OpenSearch Three-Phase Workflow - Giải thích luồng chạy

## Tổng quan

Test `opensearch-three-phase.spec.ts` minh họa **5-phase workflow** sử dụng AI Agent để tự động hóa việc test trên OpenSearch Dashboard.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    5-PHASE WORKFLOW                                   │
├──────────────────────────────────────────────────────────────────────┤
│  Phase 1: RECORD  → Phase 2: LEARN → Phase 3: EXECUTE (AI Agent)   │
│  Phase 4: DATA EXTRACTION → Phase 5: MULTI-INDEX PROCESSING         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Luồng chạy chi tiết

### Phase 3: EXECUTE (AI Agent) - Phase chính

```
START
  ↓
Navigate to OpenSearch Home
  ↓
[AI Agent] Auto-navigate với Gemini LLM
  ├── Toggle navigation menu
  ├── Click Discover link
  ├── Dismiss popup (nếu có)
  └── Auto-fix time range (2 → 4 → 6 months)
  ↓
GOAL ACHIEVED: URL contains /discover, Download CSV button visible
  ↓
```

**Công nghệ AI:**
- **LLM**: Google Gemini 2.0 Flash
- **Rate Limiting**: 15 req/min (tránh 429 errors)
- **Decision Cache**: Cache quyết định để deterministic behavior
- **Vision Analysis**: Phân tích screenshot để hiểu page layout

---

### Phase 4: DATA EXTRACTION

```
Đang ở Discover page
  ↓
Extract table data
  ├── Headers: [, Time, _source]
  ├── Row count: 50 records
  └── Sample rows: 10 rows first
```

---

### Phase 5: MULTI-INDEX PROCESSING

```
Loop qua 3 indices:
┌─────────────────────────────────────────────────────────────┐
│ 1. opensearch_dashboards_sample_data_ecommerce              │
│    ├── switchIndex() → 4 strategies fallback               │
│    ├── extractTableData() → 50 records                      │
│    └── Auto-fix time range nếu no data                      │
├─────────────────────────────────────────────────────────────┤
│ 2. opensearch_dashboards_sample_data_flights                │
│    ├── switchIndex() → dropdown handling                    │
│    ├── extractTableData() → 50 records                      │
│    └── Auto-fix time range nếu no data                      │
├─────────────────────────────────────────────────────────────┤
│ 3. opensearch_dashboards_sample_data_logs                   │
│    ├── switchIndex() → scroll + click strategies            │
│    ├── extractTableData() → 50 records                      │
│    └── Auto-fix time range nếu no data                      │
└─────────────────────────────────────────────────────────────┘
  ↓
Generate Consolidated Markdown Report
  ├── test-results/analysis/multi-index-consolidated-{timestamp}.md
  └── Summary: 150 records from 3 indices
```

---

## Cải tiến `switchIndex()` - Multi-index switching

**Vấn đề**: Sau 2 lần switch index thành công, lần thứ 3 fail do dropdown state không clean.

**Giải pháp**:
1. **Pre-step cleanup**: Press `Escape` để đóng dropdowns đang mở
2. **4 strategies mở dropdown**:
   - `[data-test-subj="indexPatternSwitchLink"]`
   - `button.euiButtonEmpty` filter
   - `role=button` với regex
   - Manual search qua tất cả buttons
3. **3 strategies click index**:
   - `getByText()` với `exact: false`
   - Filtered locator (button, option, li, div[role="menuitem"], span)
   - XPath với 4 variations
4. **Scroll into view**: Element có thể bị ẩn, cần scroll trước khi click
5. **Error cleanup**: Press `Escape` khi fail để reset state

---

## Chạy test

```bash
# Chạy với headed mode
npm test -- opensearch-three-phase.spec.ts --headed --workers=1

# Chạy headless
npm test -- opensearch-three-phase.spec.ts --workers=1
```

> **Lưu ý**: Luôn dùng `--workers=1` để tránh rate limit từ Gemini API

---

## Kết quả đầu ra

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

## Files liên quan

| File | Mô tả |
|------|-------|
| [tests/opensearch-three-phase.spec.ts](../tests/opensearch-three-phase.spec.ts) | Main test file |
| [utils/agent/TestAgent.ts](../utils/agent/TestAgent.ts) | Agent implementation |
| [utils/agent/LLMDecisionEngine.ts](../utils/agent/LLMDecisionEngine.ts) | LLM integration |
| [utils/agent/RateLimiter.ts](../utils/agent/RateLimiter.ts) | Rate limiting |
| [utils/agent/DecisionCache.ts](../utils/agent/DecisionCache.ts) | Decision caching |
