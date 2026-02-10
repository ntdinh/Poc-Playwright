# 4-Phase Learning System

An intelligent automation system that learns from human demonstrations and autonomously executes complex workflows using AI.

## Overview

```
Human → Playwright Recorder → AI Pattern Learner → AI Agent Executor → Data Analysis
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    4-PHASE LEARNING SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: RECORD                    PHASE 2: LEARN                           │
│  ┌─────────────────────┐          ┌─────────────────────┐                  │
│  │ Human records       │─────────>│ AI extracts         │                  │
│  │ workflow manually   │          │ patterns & creates  │                  │
│  │ with Playwright     │          │ reusable template   │                  │
│  └─────────────────────┘          └─────────────────────┘                  │
│           │                                  │                               │
│           ▼                                  ▼                               │
│  PHASE 3: EXECUTE                  PHASE 4: ANALYZE                         │
│  ┌─────────────────────┐          ┌─────────────────────┐                  │
│  │ AI Agent autonomously│         │ Extract & analyze   │                  │
│  │ executes goal using │─────────>│ table data with AI  │                  │
│  │ learned patterns    │          │ Generate reports    │                  │
│  └─────────────────────┘          └─────────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Workflow

### Phase 1: Record 📹

Human demonstrates the workflow once:

```typescript
const recorder = new ActionRecorder(page);
await recorder.startRecording(config);

// Human performs actions:
// - Navigate to OpenSearch
// - Click Discover link
// - Set time range
// - Verify button visible

const trace = await recorder.stopRecording();
```

**Output:** Recorded trace with captured actions

---

### Phase 2: Learn 🧠

AI analyzes the trace and extracts patterns:

```typescript
const learner = new PatternLearner({ geminiApiKey: API_KEY });
const result = await learner.learnFromTrace(trace);
```

**Features:**
- Semantic intent extraction using LLM
- Pattern generalization
- Variable detection (e.g., timeRange, baseUrl)
- Template generation with 90-95% confidence

**Output:** Reusable workflow template

---

### Phase 3: Execute 🚀

AI Agent autonomously achieves the goal:

```typescript
const agent = createTestAgent(page, agentConfig);
const result = await agent.executeGoal({
  description: "Navigate to Discover page and verify Download CSV button",
  startUrl: "https://playground.opensearch.org/app/home",
  successCriteria: ["URL contains /discover", "Download CSV button visible"]
});
```

**Features:**
- **State Capture:** Understands current page state
- **LLM Decision:** Decides next action intelligently
- **Smart Retry:** Auto-fixes issues (e.g., increases time range when no data)
- **Rate Limiting:** 15 req/min to avoid throttling
- **Decision Cache:** Caches decisions for performance

**Output:** Goal achieved in ~5 iterations

---

### Phase 4: Analyze 📊

Extract and analyze data from the page:

```typescript
// 1. Extract table data
const headers = await page.locator('th').allTextContents();
const rows = await page.locator('tr').count();

// 2. AI analyzes patterns
const analysis = await analyzeWithAI(data);

// 3. Generate reports
saveJSON(analysis);
saveMarkdown(analysis);
```

**Features:**
- Automatic table detection
- AI-powered pattern recognition
- Anomaly detection
- JSON + Markdown report generation

**Output:** Analysis reports in `test-results/analysis/`

---

## File Structure

```
test-results/
├── recordings/opensearch/traces/
│   └── {uuid}.json              # Phase 1: Recorded actions
├── templates/opensearch/templates/
│   └── {uuid}.json              # Phase 2: Learned template
└── analysis/
    ├── opensearch-analysis-{ts}.json  # Phase 4: Raw data
    └── opensearch-analysis-{ts}.md    # Phase 4: Human-readable report
```

## Running the Test

```bash
# Run the 4-phase demonstration
npm test -- opensearch-three-phase.spec.ts --headed --workers=1
```

**Expected Output:**

```
╔══════════════════════════════════════════════════════════════════╗
║     OPENSEARCH TC001 - 4-PHASE LEARNING DEMONSTRATION         ║
╚══════════════════════════════════════════════════════════════════╝

📹 PHASE 1: RECORDING
   ✅ Recorded 2 actions

🧠 PHASE 2: LEARNING
   ✅ Extracted 3 workflow steps, 90% confidence

🚀 PHASE 3: EXECUTION
   ✅ AI Agent achieved goal in 5 iterations

📊 PHASE 4: DATA EXTRACTION & ANALYSIS
   ✅ Extracted 50 rows
   ✅ AI Analysis complete
   💾 Saved: test-results/analysis/opensearch-analysis-{ts}.md
```

## Key Components

| Component | File | Description |
|-----------|------|-------------|
| `ActionRecorder` | `utils/agent/recording/` | Captures user actions |
| `PatternLearner` | `utils/agent/learning/` | Extracts patterns from traces |
| `TemplateStore` | `utils/agent/learning/` | Stores learned templates |
| `TestAgent` | `utils/agent/TestAgent.ts` | Autonomous AI executor |
| `LLMDecisionEngine` | `utils/agent/LLMDecisionEngine.ts` | LLM-based decision making |
| `RateLimiter` | `utils/agent/RateLimiter.ts` | API rate limiting |
| `DecisionCache` | `utils/agent/DecisionCache.ts` | Decision caching |

## Performance

| Metric | Average |
|--------|---------|
| Phase 1 (Recording) | ~20-30s |
| Phase 2 (Learning) | ~10-15s |
| Phase 3 (Execution) | ~35-40s |
| Phase 4 (Analysis) | ~5-10s |
| **Total Time** | **~60-80s** |

## AI Model

- **Provider:** Google Gemini
- **Model:** `gemini-2.0-flash`
- **Rate Limit:** 15 requests/minute
- **Features:** Pattern recognition, semantic understanding, data analysis

## Report Sample

See generated analysis reports:
- `test-results/analysis/opensearch-analysis-{timestamp}.md`

Report includes:
- 📊 Data Overview (type, topic, row count)
- 🔍 Patterns Detected
- 🔑 Key Columns with descriptions
- 💡 Observations & anomalies
- 📝 Summary
- 📄 Sample data preview

## Use Cases

- **Log Analysis:** Navigate dashboards and extract log patterns
- **Data Collection:** Automated data gathering from various sources
- **Regression Testing:** Learn and replay complex UI workflows
- **Documentation:** Auto-generate analysis reports from data

## Future Enhancements

- [ ] Multi-trace learning for better generalization
- [ ] Template versioning and A/B testing
- [ ] Distributed execution for parallel workflows
- [ ] Custom report templates
- [ ] Integration with more data sources
