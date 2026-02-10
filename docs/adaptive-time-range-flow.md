# Adaptive Time Range - Architecture & Data Flow

## Overview

Tự động phát hiện và xử lý khi không có dữ liệu (no data) trên OpenSearch Discover page bằng cách tăng time range.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TestAgent Loop                                  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Main Execution Loop                            │  │
│  │                                                                       │  │
│  │  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐         │  │
│  │  │ 1. Capture  │───▶│ 2. Detect    │───▶│ 3. Validate     │         │  │
│  │  │    State    │    │    No Data   │    │    Goal         │         │  │
│  │  └─────────────┘    └──────────────┘    └────────┬────────┘         │  │
│  │       │                    │                     │                   │  │
│  │       │                    ▼                     │                   │  │
│  │       │           ┌──────────────┐              │                   │  │
│  │       │           │ Has No Data? │              │                   │  │
│  │       │           └───────┬──────┘              │                   │  │
│  │       │                   │                     │                   │  │
│  │       │           ┌───────┴───────┐             │                   │  │
│  │       │           │               │             │                   │  │
│  │       │      YES  │               │  NO        │                   │  │
│  │       │    ◄──────┘               └─────►      │                   │  │
│  │       │           │                           │                   │  │
│  │       │           ▼                           ▼                   │  │
│  │       │    ┌─────────────┐              ┌──────────┐              │  │
│  │       │    │ Change Time │              │   LLM    │              │  │
│  │       │    │   Range     │              │ Decision │              │  │
│  │       │    │ (DIRECT)    │              │          │              │  │
│  │       │    └──────┬──────┘              └────┬─────┘              │  │
│  │       │           │                          │                     │  │
│  │       │           ▼                          ▼                     │  │
│  │       │    ┌─────────────┐            ┌──────────┐                │  │
│  │       │    │   Wait 3s   │            │ Execute  │                │  │
│  │       │    └─────────────┘            │  Action  │                │  │
│  │       │           │                    └──────────┘                │  │
│  │       │           └──────────────────────────┼─────────────────────┘  │
│  │       │                                      │                        │  │
│  │       └──────────────────────────────────────┼─────────────────────┘  │
│  │                                          │                            │
│  └──────────────────────────────────────────┼────────────────────────────┘
│                                             │
│                                             ▼
│                                    ┌──────────────┐
│                                    │ Goal Reached? │
│                                    └───────┬───────┘
│                                            │
│                                    ┌───────┴───────┐
│                                    │               │
│                                 YES │               │ NO
│                                    │               │
│                                    ▼               ▼
│                              ┌──────────┐    ┌──────────┐
│                              │ Return   │    │ Continue │
│                              │ Success  │    │ Loop     │
│                              └──────────┘    └──────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Flow

### 1. State Capture Phase

```
┌─────────────────────────────────────────────────────────────┐
│                    BrowserStateCapture                       │
│                                                               │
│  capture()                                                    │
│    ├── captureScreenshot() → base64 image                   │
│    ├── captureDOMTree()    → interactive elements           │
│    ├── capturePageText()   → ALL visible text (NEW!)        │
│    │                                                              │
│    └── Returns BrowserState {                                  │
│           screenshot: string,                                  │
│           url: string,                                         │
│           domTree: DOMElement[],                               │
│           pageText: string,  ← NEW: For no-data detection    │
│           ...                                                   │
│         }                                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2. No Data Detection Phase

```
┌─────────────────────────────────────────────────────────────┐
│                   detectNoData(state)                        │
│                                                               │
│  Keywords: ['no results', 'no data found', 'no matches',     │
│             '0 items', 'empty table', 'no data']             │
│                                                               │
│  ┌─────────────────────────────────────────────────┐         │
│  │ Check pageText (ALL visible text)               │         │
│  │   "No results found" → MATCH ✅                  │         │
│  └─────────────────────────────────────────────────┘         │
│                          OR                                  │
│  ┌─────────────────────────────────────────────────┐         │
│  │ Check domTree (buttons, labels, links)          │         │
│  │   element.text → "No data" → MATCH ✅            │         │
│  └─────────────────────────────────────────────────┘         │
│                                                               │
│  Returns: boolean (true if no data detected)                │
└─────────────────────────────────────────────────────────────┘
```

### 3. Time Range Change Phase (DIRECT EXECUTION)

```
┌─────────────────────────────────────────────────────────────┐
│              changeTimeRange(months: number)                 │
│                                                               │
│  When: hasNoData == true && iteration > 3                    │
│                                                               │
│  ┌─────────────────────────────────────────────────┐         │
│  │ 1. Click "Date quick select" button             │         │
│  │    → Opens time picker                          │         │
│  └─────────────────────────────────────────────────┘         │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────┐         │
│  │ 2. Fill spinbutton "Time value" with months     │         │
│  │    → e.g., "4", "6", "12"                       │         │
│  └─────────────────────────────────────────────────┘         │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────┐         │
│  │ 3. Select "months" from dropdown                │         │
│  │    → Ensure correct unit                        │         │
│  └─────────────────────────────────────────────────┘         │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────┐         │
│  │ 4. Click "Apply" button                          │         │
│  │    → Submit new time range                      │         │
│  └─────────────────────────────────────────────────┘         │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────┐         │
│  │ 5. Wait 3000ms for page update                  │         │
│  │    → Let data reload                            │         │
│  └─────────────────────────────────────────────────┘         │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────┐         │
│  │ 6. Continue to next iteration                   │         │
│  │    → Skip LLM decision for this round           │         │
│  └─────────────────────────────────────────────────┘         │
│                                                               │
│  Log output:                                                  │
│    🔄 No data detected (attempt 1). Increasing time range...  │
│    ⚡ Auto-executing time range change to 4 months            │
│      ✓ Opened date picker                                     │
│      ✓ Set time value to 4                                    │
│      ✓ Selected months as unit                                │
│      ✓ Applied time range                                     │
└─────────────────────────────────────────────────────────────┘
```

### 4. Time Range Progression

```
┌─────────────────────────────────────────────────────────────┐
│                   Time Range Tracking                        │
│                                                               │
│  Initial: 2 months                                           │
│                                                               │
│  Progression: [2, 4, 6, 12, 24, 36]                          │
│                                                               │
│  ┌──────────┬──────────┬─────────────┬──────────────────┐   │
│  │ Attempt  │ Detected  │ New Value   │ Log Message      │   │
│  ├──────────┼──────────┼─────────────┼──────────────────┤   │
│  │    1     │   YES    │     4       │ → 4 months       │   │
│  │    2     │   YES    │     6       │ → 6 months       │   │
│  │    3     │   YES    │    12       │ → 12 months      │   │
│  │    4     │   YES    │    24       │ → 24 months      │   │
│  │    5     │   YES    │    36       │ → 36 months      │   │
│  │   ...    │   YES    │   *2        │ Double until 60  │   │
│  └──────────┴──────────┴─────────────┴──────────────────┘   │
│                                                               │
│  Max: 60 months (5 years)                                     │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### TestAgent.ts

```typescript
// New properties for tracking
private currentTimeRange: number = 2;
private noDataAttempts: number = 0;

// Main execution loop with no-data handling
async executeGoal(goal: TestGoal): Promise<AgentResult> {
  while (this.iteration < maxIterations) {
    // 1. Capture state
    const state = await this.stateCapture.capture();

    // 2. Detect no data (NEW!)
    const hasNoData = this.detectNoData(state);
    if (hasNoData && this.iteration > 3) {
      // Auto-fix: Directly change time range
      await this.changeTimeRange(this.currentTimeRange);
      await this.page.waitForTimeout(3000);
      continue; // Skip LLM decision
    }

    // 3. Validate goal
    // 4. LLM decision (if no auto-fix needed)
    // 5. Execute action
  }
}

// No-data detection
private detectNoData(state: BrowserState): boolean {
  const keywords = ['no results', 'no data found', ...];
  return keywords.some(k => state.pageText?.includes(k));
}

// Direct time range change
private async changeTimeRange(months: number): Promise<void> {
  await this.page.getByRole('button', { name: 'Date quick select' }).click();
  await this.page.getByRole('spinbutton', { name: 'Time value' }).fill(String(months));
  await this.page.getByLabel('Time unit').selectOption('months');
  await this.page.getByRole('button', { name: 'Apply' }).click();
}
```

### BrowserStateCapture.ts

```typescript
async capture(): Promise<BrowserState> {
  return {
    screenshot: await this.captureScreenshot(),
    domTree: await this.captureDOMTree(),
    pageText: await this.capturePageText(),  // NEW!
    url: this.page.url(),
    title: await this.page.title(),
    consoleLogs: [...this.consoleLogs],
    timestamp: Date.now()
  };
}

private async capturePageText(): Promise<string> {
  // Captures ALL visible text on page
  return await this.page.evaluate(() => document.body?.innerText || '');
}
```

### types.ts

```typescript
export interface BrowserState {
  screenshot: string;
  url: string;
  title: string;
  domTree: DOMElement[];
  consoleLogs: ConsoleLog[];
  pageText?: string;  // NEW: For no-data detection
  timestamp: number;
}

export interface DecisionContext {
  hasNoData?: boolean;
  noDataAttempts?: number;
  suggestedTimeRange?: number;
  noDataReasons?: string[];
}

export interface TimeRangeState {
  currentValue: number;
  unit: string;
  attempts: number;
}
```

## Execution Example

### Scenario: OpenSearch Discover page with no data

```
TIME    ACTION                              STATE
─────────────────────────────────────────────────────────────
T+0s    Start test
        → Navigate to home page

T+2s    Iteration 1
        → Capture state
        → No data? NO (not on Discover yet)
        → LLM: Toggle navigation menu

T+4s    Iteration 2
        → Capture state
        → No data? NO
        → LLM: Dismiss popup

T+6s    Iteration 3
        → Capture state
        → No data? NO
        → LLM: Click Discover link

T+8s    Iteration 4
        → Capture state
        → pageText: "No results found"  ← DETECTED!
        → No data? YES
        → Change time range to 4 months  ← AUTO-EXECUTE
        → Wait 3s

T+12s   Iteration 5
        → Capture state
        → pageText: [has data now]
        → No data? NO
        → Validate goal? YES ✅
        → SUCCESS!
```

## Benefits

### Before (Keyword-based)
```typescript
// Verbose goal description required
const goal = {
  description: 'Navigate to Discover page, set time range starting from 2 months.
                 If NO DATA is found, automatically increase the time range
                 (4 months, 6 months, 1 year, etc.) until data appears...',
  successCriteria: [
    'No "No results" or "No data" or empty state visible',  // Manual check
    ...
  ]
};
```

### After (Auto-detect)
```typescript
// Clean goal - agent handles everything
const goal = {
  description: 'Navigate to Discover page, verify Download CSV button',
  successCriteria: [
    'URL contains /discover',
    'Element [role="button"][name="Download as CSV"] is visible'
  ]
};
```

## Performance

```
┌─────────────────────────────────────────────────────────────┐
│                  Performance Comparison                       │
│                                                               │
│  Before (LLM-based):                                         │
│    - Each attempt: ~5-10s (LLM call + execute)              │
│    - 3 attempts = ~15-30s                                    │
│                                                               │
│  After (Direct execution):                                   │
│    - Each attempt: ~3-5s (direct actions only)              │
│    - 3 attempts = ~9-15s                                     │
│                                                               │
│  Speed improvement: ~50% faster                              │
└─────────────────────────────────────────────────────────────┘
```

## Files Modified

| File | Changes |
|------|---------|
| `types.ts` | Added `pageText`, `DecisionContext`, `TimeRangeState` |
| `BrowserStateCapture.ts` | Added `capturePageText()` method |
| `TestAgent.ts` | Added `detectNoData()`, `changeTimeRange()`, auto-execution logic |
| `LLMDecisionEngine.ts` | Auto-detect Discover page for time picker |
| `opensearch-agent.spec.ts` | Simplified goal definition |

## Future Enhancements

1. **Configurable progressions**: Allow custom time range sequences per test
2. **Multi-source detection**: Use LLM vision to analyze screenshot for empty states
3. **Backtracking**: If data still not found after max attempts, try different strategies
4. **Per-page configs**: Different adaptive strategies for different pages/apps
