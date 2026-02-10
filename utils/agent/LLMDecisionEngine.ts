import { GoogleGenerativeAI } from '@google/generative-ai';
import { BrowserState, TestGoal, AgentAction, LLMDecision, AgentConfig, DecisionContext } from './types';
import { BrowserStateCapture } from './BrowserStateCapture';
import { ActionExecutor } from './ActionExecutor';
import { RateLimiter } from './RateLimiter';
import { DecisionCache } from './DecisionCache';
import { PerformanceMonitor } from './PerformanceOptimizer';
import { Logger } from '../Logger';
import { z } from 'zod';

/**
 * Options for LLM Decision Engine
 */
export interface LLMEngineOptions {
  rateLimiter?: RateLimiter;
  cache?: DecisionCache;
  perfMonitor?: PerformanceMonitor;
}

/**
 * Enhanced LLM Decision Engine using Gemini
 *
 * Analyzes browser state and decides on the next action to achieve the goal.
 * Uses vision capabilities to understand page screenshots.
 *
 * NEW: Integrated optimizations:
 * - Rate limiting for API calls
 * - Decision caching for consistency
 * - Performance monitoring
 */
export class LLMDecisionEngine {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private config: AgentConfig;
  private options: LLMEngineOptions;

  // Schema for structured output
  private actionSchema = z.object({
    actionType: z.enum(['navigate', 'click', 'fill', 'select', 'wait', 'verify', 'scroll']),
    selector: z.string().optional(),
    value: z.string().optional(),
    option: z.string().optional(),
    url: z.string().optional(),
    duration: z.number().optional(),
    description: z.string(),
    reasoning: z.string(),
    goalAchieved: z.boolean(),
    confidence: z.number().min(0).max(1)
  });

  constructor(config: AgentConfig, options: LLMEngineOptions = {}) {
    this.config = config;
    this.options = options;
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);

    // Use Gemini Flash for screenshot analysis
    this.model = this.genAI.getGenerativeModel({
      model: config.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    });
  }

  /**
   * Decide next action based on current state and goal
   * With optimizations: rate limiting, caching, performance tracking
   */
  async decide(
    state: BrowserState,
    goal: TestGoal,
    previousActions: AgentAction[] = [],
    iteration: number = 1,
    context?: DecisionContext
  ): Promise<LLMDecision> {
    Logger.info(`LLM deciding action (iteration ${iteration})...`);

    // Check cache first (if enabled)
    if (this.options.cache) {
      const cached = this.options.cache.get(state, goal.id, iteration, previousActions);
      if (cached) {
        Logger.info(`Using cached decision (confidence: ${cached.confidence})`);
        return cached;
      }
    }

    const stateDescription = BrowserStateCapture.formatStateForLLM(state);
    const prompt = this.buildPrompt(goal, stateDescription, previousActions, iteration, state.url, context);

    try {
      // Call Gemini with rate limiting (if enabled)
      const result = this.options.rateLimiter
        ? await this.options.rateLimiter.execute(() =>
            this.callGemini(prompt, state.screenshot)
          )
        : await this.callGemini(prompt, state.screenshot);

      // Parse structured response
      const decision = this.parseDecision(result);

      Logger.info(`LLM Decision: ${decision.action.type} - ${decision.action.description}`);
      Logger.debug(`Reasoning: ${decision.reasoning}`);
      Logger.debug(`Confidence: ${decision.confidence}`);

      // Cache the decision (if enabled)
      if (this.options.cache) {
        this.options.cache.set(state, goal.id, iteration, previousActions, decision);
      }

      return decision;
    } catch (error) {
      Logger.error(`LLM decision failed: ${error}`);

      // Fallback: return a wait action and continue
      return {
        action: ActionExecutor.createWaitAction(2000, 'Wait due to LLM error'),
        reasoning: `LLM error: ${error}. Waiting before retry.`,
        goalAchieved: false,
        confidence: 0.1
      };
    }
  }

  /**
   * Call Gemini API with prompt and optional image
   */
  private async callGemini(prompt: string, screenshotBase64?: string): Promise<string> {
    try {
      if (screenshotBase64) {
        // Vision mode: include screenshot
        const image = {
          inlineData: {
            data: screenshotBase64,
            mimeType: 'image/png'
          }
        };

        const result = await this.model.generateContent([prompt, image]);
        const response = await result.response;
        return response.text();
      } else {
        // Text-only mode
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      }
    } catch (error) {
      Logger.error('Gemini API call failed:', error);
      throw error;
    }
  }

  /**
   * Build the prompt for the LLM
   */
  private buildPrompt(
    goal: TestGoal,
    stateDescription: string,
    previousActions: AgentAction[],
    iteration: number,
    url: string,
    context?: DecisionContext
  ): string {
    const actionHistory = previousActions.length > 0
      ? previousActions.map((a, i) => `${i + 1}. ${a.description} (${a.type})`).join('\n')
      : 'None yet.';

    // Check if we're on OpenSearch Dashboard and navigation isn't expanded yet
    // Use URL to detect OpenSearch pages reliably
    const isOpenSearchPage = url.includes('opensearch.org');
    const hasNotToggledNav = !previousActions.some((a: AgentAction) =>
      a.description.includes('Toggle primary navigation') || a.description.includes('navigation menu')
    );
    const needsNavToggle = isOpenSearchPage && hasNotToggledNav;

    const navInstruction = needsNavToggle ? `
# IMPORTANT - OpenSearch Dashboard Navigation Pattern
This is an OpenSearch Dashboard page. The navigation menu is COLLAPSED by default.
You MUST click "Toggle primary navigation" button FIRST before accessing menu items like "Discover".

Workflow:
1. Try to click "Toggle primary navigation" button
2. If that fails (timeout), the navigation might already be expanded, so try clicking "Discover" directly
3. If Discover link also fails, wait and retry

Example actions:
{"actionType": "click", "selector": "role=button:name=Toggle primary navigation", "description": "Toggle navigation menu"}
{"actionType": "click", "selector": "role=link:name=Discover", "description": "Click Discover link"}

` : '';

    // Add time picker instruction if:
    // 1. Goal mentions time/months, OR
    // 2. We're on Discover page (OpenSearch always needs time range there)
    const needsTimePicker = goal.description.toLowerCase().includes('time') ||
                           goal.description.toLowerCase().includes('month') ||
                           goal.successCriteria.some(c => c.toLowerCase().includes('month') || c.toLowerCase().includes('time')) ||
                           url.includes('/discover'); // NEW: Auto-detect Discover page!

    const timePickerInstruction = (isOpenSearchPage && needsTimePicker) ? `
# IMPORTANT - OpenSearch Time Picker Workflow
To set time range on OpenSearch Discover page, follow these steps EXACTLY:

CRITICAL: There are TWO time-related buttons:
- "Date quick select" button (aria-label) - THIS is the one you MUST click to open the picker
- "Last 15 minutes" or similar (visible text showing current range) - DO NOT click this one!

The correct workflow:
1. Click "Date quick select" button (use aria-label "Date quick select", NOT the visible time range text)
2. Fill the spinbutton with the desired time value (e.g., "2")
3. Select "months" from the time unit dropdown
4. Click "Apply" button

Required actions (IN ORDER):
{"actionType": "click", "selector": "role=button:name=Date quick select", "description": "Open date picker"}
{"actionType": "fill", "selector": "role=spinbutton:name=Time value", "value": "2", "description": "Set time value to 2"}
{"actionType": "select", "selector": "[aria-label=\"Time unit\"]", "option": "months", "description": "Select months as time unit"}
{"actionType": "click", "selector": "role=button:name=Apply", "description": "Apply the time range"}
{"actionType": "wait", "duration": 3000, "description": "Wait for time range to apply and page to update"}

WARNING: If you see a button showing "Last 15 minutes" or similar, that is the CURRENT time range display.
Do NOT click it! Look for the button with aria-label="Date quick select" instead.

` : '';

    // Add adaptive time range instruction if goal mentions adaptive behavior
    const needsAdaptiveTimeRange = goal.description.toLowerCase().includes('adaptive') ||
                                   goal.description.toLowerCase().includes('increase') ||
                                   goal.description.toLowerCase().includes('automatically') ||
                                   goal.successCriteria.some(c => c.toLowerCase().includes('no data') || c.toLowerCase().includes('no results'));

    const adaptiveTimeInstruction = (isOpenSearchPage && needsTimePicker && needsAdaptiveTimeRange) ? `
# IMPORTANT - Adaptive Time Range Strategy
If NO DATA is found after applying time range, you MUST automatically increase the time range:

Detection of NO DATA:
- Look for messages like: "No results", "No data found", "No matches", empty table/grid
- If data grid is empty or shows zero results

Adaptive Strategy (try in order):
1. Start with 2 months (as mentioned in goal)
2. If NO DATA after applying: try 4 months
3. If still NO DATA: try 6 months
4. If still NO DATA: try 1 year (fill "12" in time value)
5. Continue increasing until data appears OR max iterations reached

Workflow for changing time range:
a) Click "Date quick select" button
b) Fill NEW time value (increase from current value)
c) Select "months" as time unit (if not already selected)
d) Click "Apply" button
e) Wait for page to update and check if data appears

Example iterations:
{"actionType": "fill", "selector": "role=spinbutton:name=Time value", "value": "2", "description": "Set time value to 2 months"}
{"actionType": "click", "selector": "role=button:name=Apply", "description": "Apply time range"}
[Check for data... if NO DATA]
{"actionType": "click", "selector": "role=button:name=Date quick select", "description": "Reopen date picker"}
{"actionType": "fill", "selector": "role=spinbutton:name=Time value", "value": "4", "description": "Increase to 4 months (no data found)"}
{"actionType": "click", "selector": "role=button:name=Apply", "description": "Apply new time range"}

CRITICAL: Keep trying different time ranges until data is found!

` : '';

    // NEW: Auto-detect no data and add adaptive instruction (POC - simple keyword detection)
    const autoAdaptiveInstruction = this.buildAutoAdaptiveInstruction(stateDescription, context, isOpenSearchPage, needsTimePicker);

    return `You are an autonomous testing agent. Your goal is to achieve the following test objective by navigating and interacting with a web application.

# Current Goal
${goal.description}

# Success Criteria
${goal.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}
${navInstruction}${timePickerInstruction}${adaptiveTimeInstruction}${autoAdaptiveInstruction}
# Current Browser State
${stateDescription}

# Action History (Previous Actions Taken)
${actionHistory}

# Iteration
This is iteration ${iteration} of ${this.config.maxIterations}. If goal is not achieved, continue trying.

# Instructions
Based on the current browser state and the goal, decide on the next action to take. Analyze the screenshot to understand the page layout and available interactive elements.

CRITICAL: Selector format MUST be exactly "role=TYPE:name=NAME" for clickable elements:
- Links: "role=link:name=LinkText"
- Buttons: "role=button:name=ButtonText"
- Inputs: "role=textbox:name=InputName" or "role=spinbutton:name=InputName"
- For select dropdowns, use: "[aria-label=\"LABEL_NAME\"]" with option value

For wait actions, omit the selector field entirely.

Examples:
1. Click Toggle primary navigation: {"actionType": "click", "selector": "role=button:name=Toggle primary navigation", "description": "Expand navigation menu"}
2. Click Discover link: {"actionType": "click", "selector": "role=link:name=Discover", "description": "Click Discover"}
3. Click Dismiss button: {"actionType": "click", "selector": "role=button:name=Dismiss", "description": "Dismiss popup"}
4. Wait 1 second: {"actionType": "wait", "duration": 1000, "description": "Wait"}

# Response Format
Respond ONLY with valid JSON (no markdown):

{
  "actionType": "click",
  "selector": "role=link:name=Discover",
  "description": "Click Discover link",
  "reasoning": "Need to navigate to Discover page",
  "goalAchieved": false,
  "confidence": 0.9
}
`;
  }

  /**
   * Parse LLM response into structured decision
   */
  private parseDecision(response: string): LLMDecision {
    try {
      // Extract JSON from response
      let jsonStr = response;

      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      // Parse JSON
      const parsed = JSON.parse(jsonStr);

      // Map to AgentAction
      const action: AgentAction = {
        type: parsed.actionType || parsed.type,
        selector: parsed.selector,
        value: parsed.value,
        option: parsed.option,
        url: parsed.url,
        duration: parsed.duration,
        description: parsed.description || `${parsed.actionType} action`
      };

      // Validate with Zod schema
      const validated = this.actionSchema.safeParse({
        actionType: action.type,
        selector: action.selector,
        value: action.value,
        option: action.option,
        url: action.url,
        duration: action.duration,
        description: action.description,
        reasoning: parsed.reasoning || 'No reasoning provided',
        goalAchieved: parsed.goalAchieved || false,
        confidence: parsed.confidence || 0.5
      });

      if (validated.success) {
        return {
          action,
          reasoning: parsed.reasoning || 'No reasoning provided',
          goalAchieved: parsed.goalAchieved || false,
          confidence: parsed.confidence || 0.5
        };
      }

      // If validation fails, use parsed values directly
      Logger.warn('LLM response validation failed, using raw values');
      return {
        action,
        reasoning: parsed.reasoning || 'No reasoning provided',
        goalAchieved: parsed.goalAchieved || false,
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      Logger.error(`Failed to parse LLM response: ${error}`);

      // Return a safe default action
      return {
        action: ActionExecutor.createWaitAction(2000, 'Wait - failed to parse LLM response'),
        reasoning: 'Failed to parse LLM response',
        goalAchieved: false,
        confidence: 0.1
      };
    }
  }

  /**
   * Build auto-adaptive instruction based on context
   * POC: Simple keyword detection for "no data" scenarios
   */
  private buildAutoAdaptiveInstruction(
    stateDescription: string,
    context?: DecisionContext,
    isOpenSearchPage?: boolean,
    needsTimePicker?: boolean
  ): string {
    // Only apply for OpenSearch time picker scenarios
    if (!isOpenSearchPage || !needsTimePicker) {
      return '';
    }

    // Check if context indicates no data
    if (context?.hasNoData) {
      const nextValue = context.suggestedTimeRange || 4;
      const attempt = context.noDataAttempts || 1;

      return `
# AUTO-DETECTED: No Data Found!
The system detected NO DATA in current results: ${context.noDataReasons?.join(', ') || 'empty state'}

You MUST increase the time range:
- Attempt #${attempt}
- Next value to try: ${nextValue} months

Required actions:
1. Click "Date quick select" button
2. Fill spinbutton with "${nextValue}"
3. Select "months" if not selected
4. Click "Apply" button
5. Wait for page to update

JSON example:
{"actionType": "click", "selector": "role=button:name=Date quick select", "description": "Reopen date picker for attempt ${attempt}"}
{"actionType": "fill", "selector": "role=spinbutton:name=Time value", "value": "${nextValue}", "description": "Increase time range to ${nextValue} months (no data found)"}
{"actionType": "click", "selector": "role=button:name=Apply", "description": "Apply increased time range"}

`;
    }

    // POC: Simple keyword detection in state description
    const noDataKeywords = ['no results', 'no data found', 'no matches', '0 items', 'empty', 'no data'];
    const hasNoData = noDataKeywords.some(keyword =>
      stateDescription.toLowerCase().includes(keyword)
    );

    if (hasNoData) {
      return `
# AUTO-DETECTED: No Data Found!
Detected "no data" state in current page. You should increase the time range to find data.

Suggested progression: 2 → 4 → 6 → 12 → 24 months

Actions:
1. Click "Date quick select"
2. Increase the time value
3. Click "Apply"
4. Wait and check if data appears

`;
    }

    return '';
  }

  /**
   * Validate goal achievement using LLM
   * This is useful for complex goal validation that requires understanding
   */
  async validateGoalWithLLM(state: BrowserState, goal: TestGoal): Promise<boolean> {
    Logger.info('Validating goal achievement with LLM...');

    const prompt = `You are validating whether a test goal has been achieved.

# Goal
${goal.description}

# Success Criteria
${goal.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

# Current Browser State
${BrowserStateCapture.formatStateForLLM(state)}

# Instructions
Analyze the current state and determine if ALL success criteria have been met.

Respond with ONLY "true" if all criteria are met, or "false" if any criteria are not met.
`;

    try {
      const result = await this.callGemini(prompt, state.screenshot);
      const cleaned = result.toLowerCase().trim();
      return cleaned === 'true' || cleaned.startsWith('true');
    } catch (error) {
      Logger.error(`LLM validation failed: ${error}`);
      return false;
    }
  }
}
