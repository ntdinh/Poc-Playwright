# Plan: Adaptive Time Range - Auto-Detect No Data Strategy

## Overview
Chuyển từ **prompt-based adaptive** (cần định nghĩa trong goal description) sang **context-based adaptive** (tự động detect không có dữ liệu).

## Current Implementation (Hiện tại)

```typescript
// Trong LLMDecisionEngine.ts - buildPrompt()
const needsAdaptiveTimeRange = goal.description.toLowerCase().includes('adaptive') ||
                               goal.description.toLowerCase().includes('increase') ||
                               goal.successCriteria.some(c => c.toLowerCase().includes('no data'));

const adaptiveTimeInstruction = (isOpenSearchPage && needsTimePicker && needsAdaptiveTimeRange) ? `
# IMPORTANT - Adaptive Time Range Strategy
...
` : '';
```

**Vấn đề**: Cần phải define từ khóa trong goal description/successCriteria.

## Proposed Solution (Giải pháp đề xuất)

### Core Concept
1. **State-based detection**: Detect "no data" từ actual browser state (screenshot + DOM)
2. **Automatic adaptation**: Tự động thêm adaptive instruction khi detect no data
3. **Time range tracking**: Track giá trị time range hiện tại để increment

### Architecture Changes

```
┌─────────────────────────────────────────────────────────────┐
│                    TestAgent Loop                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Capture State                                       │  │
│  │ 2. Detect No Data State  ← NEW!                       │  │
│  │ 3. Build Prompt (with adaptive if needed)             │  │
│  │ 4. Get LLM Decision                                    │  │
│  │ 5. Execute Action                                      │  │
│  │ 6. Update Time Range Tracker  ← NEW!                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create `NoDataDetector` Module
**File**: `utils/agent/NoDataDetector.ts`

```typescript
export class NoDataDetector {
  /**
   * Detect if current state indicates "no data" scenario
   * Uses multiple strategies:
   * 1. Text analysis (DOM + screenshot via LLM)
   * 2. DOM pattern matching
   * 3. State heuristics
   */
  static async detectNoData(state: BrowserState): Promise<{
    hasNoData: boolean;
    confidence: number;
    reasons: string[];
  }> {
    // Check for "No results", "No data found", etc.
    // Check for empty table/grid
    // Check for zero count indicators
  }
}
```

**Detection Strategies**:
1. **Text-based**: "No results", "No data found", "No matches", "0 items"
2. **DOM-based**: Empty table body, empty grid container
3. **Visual-based** (optional): Use LLM to analyze screenshot for empty states

### Step 2: Create `TimeRangeTracker` Module
**File**: `utils/agent/TimeRangeTracker.ts`

```typescript
export interface TimeRangeState {
  currentValue: number;  // Current time value (e.g., 2, 4, 6)
  unit: string;          // "months" or "years"
  attempts: number;      // How many times we've tried
  lastUpdateTime: number;
}

export class TimeRangeTracker {
  private state: TimeRangeState = {
    currentValue: 2,
    unit: 'months',
    attempts: 0,
    lastUpdateTime: Date.now()
  };

  /**
   * Get next time range value to try
   * Progression: 2 → 4 → 6 → 12 → 24 → ...
   */
  getNextValue(): number {
    const progression = [2, 4, 6, 12, 24, 36, 48, 60];
    const currentIndex = progression.indexOf(this.state.currentValue);

    if (currentIndex === -1 || currentIndex === progression.length - 1) {
      // Double the current value if not in predefined progression
      return this.state.currentValue * 2;
    }

    return progression[currentIndex + 1];
  }

  /**
   * Update tracker with new value
   */
  update(newValue: number): void {
    this.state.currentValue = newValue;
    this.state.attempts++;
    this.state.lastUpdateTime = Date.now();
  }

  /**
   * Reset tracker (for new tests)
   */
  reset(): void {
    this.state = { currentValue: 2, unit: 'months', attempts: 0, lastUpdateTime: Date.now() };
  }

  getCurrentState(): TimeRangeState {
    return { ...this.state };
  }
}
```

### Step 3: Modify `LLMDecisionEngine` to Support Context-Aware Prompts
**File**: `utils/agent/LLMDecisionEngine.ts`

**Changes**:

1. Add context parameter to `decide()`:
```typescript
async decide(
  state: BrowserState,
  goal: TestGoal,
  previousActions: AgentAction[] = [],
  iteration: number = 1,
  context?: DecisionContext  // NEW!
): Promise<LLMDecision>
```

2. Add `DecisionContext` interface:
```typescript
export interface DecisionContext {
  hasNoData?: boolean;
  currentNoDataAttempts?: number;
  suggestedTimeRange?: number;
  reasonForNoData?: string[];
}
```

3. Modify `buildPrompt()` to use context:
```typescript
private buildPrompt(
  goal: TestGoal,
  stateDescription: string,
  previousActions: AgentAction[],
  iteration: number,
  url: string,
  context?: DecisionContext  // NEW!
): string {
  // ... existing code ...

  // NEW: Automatic adaptive instruction based on context
  const adaptiveInstruction = this.buildAdaptiveInstruction(context, isOpenSearchPage, needsTimePicker);

  return `...${navInstruction}${timePickerInstruction}${adaptiveInstruction}...`;
}

private buildAdaptiveInstruction(
  context?: DecisionContext,
  isOpenSearchPage?: boolean,
  needsTimePicker?: boolean
): string {
  if (!isOpenSearchPage || !needsTimePicker || !context?.hasNoData) {
    return '';
  }

  return `
# IMPORTANT - Adaptive Time Range Required
The current state shows NO DATA available: ${context.reasonForNoData?.join(', ')}

You MUST increase the time range to find data:
- Current attempts: ${context.currentNoDataAttempts || 0}
- Suggested next value: ${context.suggestedTimeRange || 4} months

Actions to take:
1. Click "Date quick select" button
2. Fill time value with "${context.suggestedTimeRange || 4}"
3. Ensure "months" is selected
4. Click "Apply" button
5. Wait for page to update

Required JSON action:
{"actionType": "fill", "selector": "role=spinbutton:name=Time value", "value": "${context.suggestedTimeRange || 4}", "description": "Increase time range to ${context.suggestedTimeRange || 4} months (no data found)"}
{"actionType": "click", "selector": "role=button:name=Apply", "description": "Apply increased time range"}
`;
}
```

### Step 4: Modify `TestAgent` to Integrate Detection & Tracking
**File**: `utils/agent/TestAgent.ts`

**Changes**:

1. Add new properties:
```typescript
private noDataDetector: NoDataDetector;
private timeRangeTracker: TimeRangeTracker;
```

2. Modify execution loop:
```typescript
async executeGoal(goal: TestGoal): Promise<AgentResult> {
  // ... existing code ...

  // Reset tracker for new goal
  this.timeRangeTracker.reset();

  while (this.iteration < maxIterations) {
    this.iteration++;

    // 1. Capture state
    const state = await this.stateCapture.capture();

    // 2. NEW: Detect no data scenario
    const noDataState = await NoDataDetector.detectNoData(state);
    Logger.debug(`NoData detection: ${noDataState.hasNoData} (confidence: ${noDataState.confidence})`);

    if (noDataState.hasNoData) {
      const nextValue = this.timeRangeTracker.getNextValue();
      Logger.info(`No data detected (${noDataState.reasons.join(', ')}). Increasing time range to ${nextValue} months.`);
      this.timeRangeTracker.update(nextValue);
    }

    // 3. Validate goal
    const validation = await this.goalValidator.validate(state, goal);
    if (validation.achieved) {
      return { success: true, ... };
    }

    // 4. Build decision context
    const decisionContext: DecisionContext = {
      hasNoData: noDataState.hasNoData,
      currentNoDataAttempts: this.timeRangeTracker.getCurrentState().attempts,
      suggestedTimeRange: this.timeRangeTracker.getCurrentState().currentValue,
      reasonForNoData: noDataState.reasons
    };

    // 5. Get LLM decision WITH context
    const decision = await this.llmEngine.decide(
      state,
      goal,
      this.actions,
      this.iteration,
      decisionContext  // NEW!
    );

    // ... rest of execution ...
  }
}
```

### Step 5: Update Goal Definition (Simplify!)
**File**: `tests/opensearch-agent.spec.ts`

**Before** (with keyword-based):
```typescript
const goal: TestGoal = {
  id: 'opensearch-verify-download-csv-adaptive',
  description: 'Navigate to Discover page, set time range starting from 2 months. If NO DATA is found, automatically increase the time range (4 months, 6 months, 1 year, etc.) until data appears. Verify Download CSV button is visible at the end.',
  // ^^^ Verbose description required!
  successCriteria: [
    'URL contains /discover',
    'No "No results" or "No data" or empty state visible',
    'Element containing data rows or results is visible',
    'Element [role="button"][name="Download as CSV"] is visible'
  ]
};
```

**After** (clean & simple):
```typescript
const goal: TestGoal = {
  id: 'opensearch-verify-download-csv',
  description: 'Navigate to Discover page, set time range to find data, verify Download CSV button is visible',
  // ^^^ Clean, no adaptive keywords needed!
  successCriteria: [
    'URL contains /discover',
    'Element [role="button"][name="Download as CSV"] is visible'
  ]
};
```

## Benefits

1. ✅ **Cleaner goal definitions**: Không cần verbose description
2. ✅ **True autonomy**: Agent tự detect và adapt
3. ✅ **Reusable**: Works cho bất kỳ scenario nào có time range filtering
4. ✅ **Intelligent progression**: Smart time range increments (2→4→6→12→...)
5. ✅ **Debuggable**: Clear logs về khi nào và tại sao tăng time range

## Testing Strategy

### Phase 1: Unit Tests
```typescript
// tests/unit/no-data-detector.spec.ts
test('should detect "No results" text', async () => {
  const state = mockState({ text: 'No results found' });
  const result = await NoDataDetector.detectNoData(state);
  expect(result.hasNoData).toBe(true);
});

test('should detect empty table', async () => {
  const state = mockState({ domTree: emptyTableDOM });
  const result = await NoDataDetector.detectNoData(state);
  expect(result.hasNoData).toBe(true);
});
```

### Phase 2: Integration Tests
```typescript
test('should auto-increase time range when no data', async ({ page }) => {
  const goal: TestGoal = {
    description: 'Verify Download CSV button',  // No adaptive keywords!
    successCriteria: ['Element [role="button"][name="Download as CSV"] is visible']
  };

  const result = await agent.executeGoal(goal);
  expect(result.success).toBe(true);

  // Verify time range was increased
  const logs = result.actions.filter(a => a.description.includes('months'));
  expect(logs.length).toBeGreaterThan(0);
});
```

## Migration Path

### Option A: Parallel Implementation (Recommended)
1. Implement new modules alongside existing code
2. Add feature flag: `contextAwareAdaptive: true`
3. Test with existing tests
4. Gradually migrate tests to use new approach
5. Remove old keyword-based logic

### Option B: Direct Replacement
1. Implement new modules
2. Replace keyword-based detection
3. Update all existing tests

## Estimated Effort

| Task | Effort | Notes |
|------|--------|-------|
| NoDataDetector module | 4h | Core detection logic |
| TimeRangeTracker module | 2h | Simple state management |
| LLMDecisionEngine changes | 3h | Context parameter, prompt building |
| TestAgent integration | 3h | Loop modifications |
| Testing & debugging | 4h | Unit + integration tests |
| **Total** | **16h** | ~2 days |

## Open Questions

1. **LLM-based detection**: Should we use LLM to analyze screenshot for empty states? (slower but more accurate)
2. **Fallback strategy**: What if max time range (60 months) still has no data?
3. **Per-project config**: Different time range progressions for different apps?

---

**Status**: 📋 Ready for review
**Created**: 2026-02-10
**Next Step**: Review & approve plan → Start implementation
