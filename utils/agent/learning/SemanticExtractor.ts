/**
 * SemanticExtractor - Phase 2: Learning
 *
 * Extracts semantic meaning from recorded actions using LLM.
 * Converts raw Playwright actions into intent-based semantic actions.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { RecordedAction, RecordedTrace } from '../recording/RecordedAction';
import { SemanticIntent, GeneralizationRule } from './WorkflowTemplate';
import { Logger } from '../../Logger';

/**
 * Semantic Extractor Options
 */
export interface SemanticExtractorOptions {
  /** Gemini API key */
  geminiApiKey: string;
  /** Model to use */
  model?: string;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Semantic extraction result
 */
export interface SemanticExtractionResult {
  /** Extracted semantic intents */
  intents: SemanticIntent[];
  /** Generalization rules discovered */
  generalizationRules: GeneralizationRule[];
  /** Overall confidence (0-1) */
  confidence: number;
  /** Processing time in ms */
  duration: number;
}

/**
 * Semantic Extractor - Uses LLM to understand intent behind actions
 *
 * This is the key component that converts "what user did" into "why user did it"
 * and generalizes the pattern for reuse.
 */
export class SemanticExtractor {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private options: SemanticExtractorOptions;

  constructor(options: SemanticExtractorOptions) {
    this.options = {
      model: 'gemini-2.0-flash',
      debug: false,
      ...options
    };

    this.genAI = new GoogleGenerativeAI(this.options.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: this.options.model
    });
  }

  /**
   * Extract semantic intents from a recorded trace
   */
  async extractFromTrace(trace: RecordedTrace): Promise<SemanticExtractionResult> {
    const startTime = Date.now();
    Logger.info(`🧠 Extracting semantics from trace: ${trace.name}`);
    Logger.info(`   Actions: ${trace.actions.length}`);

    if (trace.actions.length === 0) {
      return {
        intents: [],
        generalizationRules: [],
        confidence: 0,
        duration: Date.now() - startTime
      };
    }

    // Build prompt for the LLM
    const prompt = this.buildExtractionPrompt(trace);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the LLM response
      const extraction = this.parseExtractionResponse(text, trace.actions);

      Logger.info(`✅ Extracted ${extraction.intents.length} semantic intents`);
      Logger.info(`   Found ${extraction.generalizationRules.length} generalization rules`);
      Logger.info(`   Confidence: ${(extraction.confidence * 100).toFixed(1)}%`);
      Logger.info(`   Duration: ${(Date.now() - startTime)}ms`);

      return {
        ...extraction,
        duration: Date.now() - startTime
      };

    } catch (error) {
      Logger.error(`❌ Semantic extraction failed: ${error}`);

      // Return fallback: convert actions to intents directly
      return {
        intents: this.fallbackExtraction(trace.actions),
        generalizationRules: [],
        confidence: 0.5,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Extract semantic intent from a single action
   */
  async extractFromAction(action: RecordedAction, context: {
    previousActions?: RecordedAction[];
    goal?: string;
  } = {}): Promise<SemanticIntent> {
    const prompt = this.buildSingleActionPrompt(action, context);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseIntentResponse(text, action);
    } catch (error) {
      Logger.error(`Failed to extract intent from action: ${error}`);

      // Fallback: basic intent from action type
      return {
        intent: action.description,
        actionType: action.type,
        selectorPattern: action.selector,
        confidence: 0.5
      };
    }
  }

  /**
   * Build prompt for trace-level semantic extraction
   */
  private buildExtractionPrompt(trace: RecordedTrace): string {
    const actionsSummary = trace.actions.map((a, i) =>
      `${i + 1}. [${a.type}] ${a.description}
     Selector: ${a.selector}
     Element: ${a.elementText || a.accessibleName || 'N/A'}`
    ).join('\n');

    return `You are a semantic analyzer for web automation workflows. Your task is to understand the INTENT behind a sequence of user actions and extract reusable patterns.

# Workflow Context
Name: ${trace.name}
Goal: ${trace.goal}
Domain: ${trace.domain || 'Unknown'}
Start URL: ${trace.startUrl}

# Recorded Actions
${actionsSummary}

# Your Task
Analyze the actions above and provide:

1. **Semantic Intents**: For each action or group of actions, describe the INTENT (why the user did this), not just what they did.

2. **Generalization Rules**: Identify patterns that can be generalized (e.g., specific IDs replaced with classes, text content generalized, etc.)

3. **Key Patterns**: What are the reusable patterns in this workflow?

# Response Format (JSON only)
{
  "intents": [
    {
      "index": 0,
      "intent": "Open the collapsed navigation menu to access menu items",
      "actionType": "click",
      "selectorPattern": "role=button:name=Toggle primary navigation",
      "preconditions": ["Navigation menu is collapsed"],
      "postconditions": ["Navigation menu expands"],
      "confidence": 0.95
    }
  ],
  "generalizationRules": [
    {
      "name": "Ignore specific IDs",
      "from": "[data-testid=\"specific-id-123\"]",
      "to": "[data-testid]",
      "type": "selector",
      "confidence": 0.9,
      "examples": ["[data-testid=\"nav-toggle\"]", "[data-testid=\"menu-btn\"]"]
    }
  ],
  "keyPatterns": [
    "Always expand navigation before clicking menu items",
    "Use aria-label for time picker buttons, not visible text"
  ],
  "overallConfidence": 0.9
}

# Important Notes
- Focus on WHY actions are performed, not just WHAT
- Identify patterns that would work across similar pages
- Note any workarounds or hacks used
- Consider accessibility attributes (aria-label, role) as stable selectors
- Avoid hardcoded IDs or dynamic content
`;
  }

  /**
   * Build prompt for single action semantic extraction
   */
  private buildSingleActionPrompt(action: RecordedAction, context: {
    previousActions?: RecordedAction[];
    goal?: string;
  }): string {
    const contextStr = context.goal
      ? `Goal: ${context.goal}\nPrevious actions: ${context.previousActions?.length || 0}`
      : 'No context provided';

    return `You are analyzing a single user action to understand its semantic intent.

# Context
${contextStr}

# Action
Type: ${action.type}
Description: ${action.description}
Selector: ${action.selector}
Element text: ${action.elementText || 'N/A'}
Accessible name: ${action.accessibleName || 'N/A'}

# Your Task
Describe the semantic INTENT of this action. Why did the user perform this action?

# Response Format (JSON only)
{
  "intent": "Open the navigation menu to access hidden menu items",
  "actionType": "click",
  "selectorPattern": "role=button:name=Toggle *",
  "preconditions": ["Menu is collapsed"],
  "postconditions": ["Menu becomes visible"],
  "confidence": 0.95
}
`;
  }

  /**
   * Parse LLM response into semantic extraction result
   */
  private parseExtractionResponse(response: string, originalActions: RecordedAction[]): {
    intents: SemanticIntent[];
    generalizationRules: GeneralizationRule[];
    confidence: number;
  } {
    try {
      // Extract JSON from response
      let jsonStr = response;

      // Remove markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      return {
        intents: parsed.intents || [],
        generalizationRules: parsed.generalizationRules || [],
        confidence: parsed.overallConfidence || 0.7
      };
    } catch (error) {
      Logger.warn(`Failed to parse extraction response: ${error}`);
      return {
        intents: [],
        generalizationRules: [],
        confidence: 0.5
      };
    }
  }

  /**
   * Parse intent response for single action
   */
  private parseIntentResponse(response: string, originalAction: RecordedAction): SemanticIntent {
    try {
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      return {
        intent: parsed.intent || originalAction.description,
        actionType: parsed.actionType || originalAction.type,
        selectorPattern: parsed.selectorPattern || originalAction.selector,
        preconditions: parsed.preconditions,
        postconditions: parsed.postconditions,
        confidence: parsed.confidence || 0.7
      };
    } catch (error) {
      return {
        intent: originalAction.description,
        actionType: originalAction.type,
        selectorPattern: originalAction.selector,
        confidence: 0.5
      };
    }
  }

  /**
   * Fallback extraction when LLM fails
   * Creates basic intents from actions without semantic analysis
   */
  private fallbackExtraction(actions: RecordedAction[]): SemanticIntent[] {
    return actions.map((action, index) => ({
      intent: action.description,
      actionType: action.type,
      selectorPattern: action.selector,
      confidence: 0.5
    }));
  }
}

/**
 * Factory function to create a SemanticExtractor
 */
export function createSemanticExtractor(apiKey: string): SemanticExtractor {
  return new SemanticExtractor({ geminiApiKey: apiKey });
}
