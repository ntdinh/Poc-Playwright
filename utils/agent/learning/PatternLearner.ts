/**
 * PatternLearner - Phase 2: Learning
 *
 * Learns reusable patterns from recorded traces using LLM.
 * Combines multiple traces to find common patterns and create generalized templates.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { RecordedTrace } from '../recording/RecordedAction';
import { SemanticExtractor, SemanticExtractionResult } from './SemanticExtractor';
import { WorkflowTemplate, TemplateStep, GeneralizationRule, TemplateVariable } from './WorkflowTemplate';
import { Logger } from '../../Logger';

/**
 * Pattern Learner Options
 */
export interface PatternLearnerOptions {
  /** Gemini API key */
  geminiApiKey: string;
  /** Model to use */
  model?: string;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Learning result
 */
export interface LearningResult {
  /** Generated template */
  template: WorkflowTemplate;
  /** Confidence in the template (0-1) */
  confidence: number;
  /** Which traces were used */
  sourceTraceIds: string[];
  /** Processing time in ms */
  duration: number;
  /** Any warnings or notes */
  notes?: string[];
}

/**
 * Pattern comparison result
 */
export interface PatternComparison {
  /** Similarity score (0-1) */
  similarity: number;
  /** Common steps */
  commonSteps: number[];
  /** Different steps */
  differentSteps: {
    trace1Index: number;
    trace2Index: number;
  }[];
  /** Potential generalizations */
  generalizations: string[];
}

/**
 * Pattern Learner - Creates generalized templates from demonstrations
 *
 * This is the core learning component that:
 * 1. Analyzes multiple traces of the same workflow
 * 2. Finds common patterns
 * 3. Generalizes specific actions into reusable templates
 */
export class PatternLearner {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private semanticExtractor: SemanticExtractor;
  private options: PatternLearnerOptions;

  constructor(options: PatternLearnerOptions) {
    this.options = {
      model: 'gemini-2.0-flash',
      debug: false,
      ...options
    };

    this.genAI = new GoogleGenerativeAI(this.options.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: this.options.model
    });

    this.semanticExtractor = new SemanticExtractor({
      geminiApiKey: this.options.geminiApiKey,
      model: this.options.model
    });
  }

  /**
   * Learn a template from a single trace
   */
  async learnFromTrace(trace: RecordedTrace): Promise<LearningResult> {
    const startTime = Date.now();
    Logger.info(`🎓 Learning from trace: ${trace.name}`);

    // Extract semantics
    const semantics = await this.semanticExtractor.extractFromTrace(trace);

    // Build template using LLM
    const template = await this.buildTemplateFromSemantics(trace, semantics);

    Logger.info(`✅ Learned template: ${template.name}`);
    Logger.info(`   Steps: ${template.steps.length}`);
    Logger.info(`   Variables: ${template.variables?.length || 0}`);
    Logger.info(`   Confidence: ${(semantics.confidence * 100).toFixed(1)}%`);

    return {
      template,
      confidence: semantics.confidence,
      sourceTraceIds: [trace.id],
      duration: Date.now() - startTime
    };
  }

  /**
   * Learn a template from multiple traces (finds common patterns)
   */
  async learnFromMultipleTraces(traces: RecordedTrace[]): Promise<LearningResult> {
    if (traces.length === 0) {
      throw new Error('At least one trace is required');
    }

    const startTime = Date.now();

    if (traces.length === 1) {
      return this.learnFromTrace(traces[0]);
    }

    Logger.info(`🎓 Learning from ${traces.length} traces...`);

    // Extract semantics from all traces
    const allSemantics: SemanticExtractionResult[] = [];
    for (const trace of traces) {
      const semantics = await this.semanticExtractor.extractFromTrace(trace);
      allSemantics.push(semantics);
    }

    // Compare patterns and find commonalities
    const comparison = await this.comparePatterns(traces, allSemantics);

    // Build generalized template
    const template = await this.buildGeneralizedTemplate(traces, allSemantics, comparison);

    const avgConfidence = allSemantics.reduce((sum, s) => sum + s.confidence, 0) / allSemantics.length;

    Logger.info(`✅ Learned generalized template from ${traces.length} traces`);
    Logger.info(`   Steps: ${template.steps.length}`);
    Logger.info(`   Variables: ${template.variables?.length || 0}`);
    Logger.info(`   Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    return {
      template,
      confidence: avgConfidence,
      sourceTraceIds: traces.map(t => t.id),
      duration: Date.now() - startTime
    };
  }

  /**
   * Compare patterns between traces
   */
  async comparePatterns(
    traces: RecordedTrace[],
    semantics: SemanticExtractionResult[]
  ): Promise<PatternComparison> {
    Logger.debug(`Comparing patterns between ${traces.length} traces...`);

    // For now, use simple comparison
    // In future, could use more sophisticated pattern matching

    const commonSteps: number[] = [];
    const differentSteps: { trace1Index: number; trace2Index: number }[] = [];
    const generalizations: string[] = [];

    // Find common intents
    if (semantics.length >= 2) {
      const intents0 = semantics[0].intents;
      const intents1 = semantics[1].intents;

      for (let i = 0; i < Math.min(intents0.length, intents1.length); i++) {
        if (intents0[i].intent === intents1[i].intent) {
          commonSteps.push(i);
        } else {
          differentSteps.push({ trace1Index: i, trace2Index: i });
        }
      }
    }

    // Suggest generalizations
    for (const semantic of semantics) {
      for (const rule of semantic.generalizationRules) {
        if (!generalizations.includes(rule.name)) {
          generalizations.push(rule.name);
        }
      }
    }

    return {
      similarity: commonSteps.length / Math.max(...traces.map(t => t.actions.length)),
      commonSteps,
      differentSteps,
      generalizations
    };
  }

  /**
   * Build template from semantics
   */
  private async buildTemplateFromSemantics(
    trace: RecordedTrace,
    semantics: SemanticExtractionResult
  ): Promise<WorkflowTemplate> {
    const prompt = this.buildTemplatePrompt(trace, semantics);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseTemplateResponse(text, trace);
    } catch (error) {
      Logger.error(`Failed to build template: ${error}`);
      // Fallback: create basic template
      return this.createBasicTemplate(trace, semantics);
    }
  }

  /**
   * Build generalized template from multiple traces
   */
  private async buildGeneralizedTemplate(
    traces: RecordedTrace[],
    semantics: SemanticExtractionResult[],
    comparison: PatternComparison
  ): Promise<WorkflowTemplate> {
    const prompt = this.buildGeneralizedTemplatePrompt(traces, semantics, comparison);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Use the first trace as base for metadata
      return this.parseTemplateResponse(text, traces[0], traces.map(t => t.id));
    } catch (error) {
      Logger.error(`Failed to build generalized template: ${error}`);
      // Fallback: create template from first trace
      return this.createBasicTemplate(traces[0], semantics[0], traces.map(t => t.id));
    }
  }

  /**
   * Build prompt for template generation
   */
  private buildTemplatePrompt(
    trace: RecordedTrace,
    semantics: SemanticExtractionResult
  ): string {
    const actionsStr = trace.actions.map((a, i) =>
      `${i + 1}. ${a.description} (${a.type}) on ${a.selector}`
    ).join('\n');

    const intentsStr = semantics.intents.map((intent, i) =>
      `${i + 1}. Intent: ${intent.intent}
   Action: ${intent.actionType}
   Pattern: ${intent.selectorPattern}
   Pre: ${intent.preconditions?.join(', ') || 'none'}
   Post: ${intent.postconditions?.join(', ') || 'none'}`
    ).join('\n');

    return `You are a workflow template generator. Create a reusable template from a recorded workflow.

# Original Workflow
Name: ${trace.name}
Goal: ${trace.goal}
Domain: ${trace.domain || 'Unknown'}

# Recorded Actions
${actionsStr}

# Semantic Analysis
${intentsStr}

# Generalization Rules Found
${semantics.generalizationRules.map(r => `- ${r.name}: ${r.from} → ${r.to}`).join('\n')}

# Your Task
Create a generalized, reusable workflow template based on the analysis above.

# Template Requirements
1. Each step should have a clear semantic intent
2. Use generalized selector patterns (wildcards for dynamic parts)
3. Include preconditions and postconditions
4. Extract variables that might change between executions
5. Make steps optional where appropriate
6. Include alternatives for common failure paths

# Response Format (JSON only)
{
  "name": "Navigate to OpenSearch Discover Page",
  "description": "Generalized workflow for navigating to the Discover page in OpenSearch Dashboard",
  "steps": [
    {
      "index": 0,
      "intent": "Expand the navigation menu to access menu items",
      "actionType": "click",
      "selectorPattern": "role=button:name=Toggle * navigation",
      "preconditions": [
        {
          "type": "elementVisible",
          "selector": "role=button:name=Toggle primary navigation",
          "description": "Navigation toggle button is visible"
        }
      ],
      "postconditions": [
        {
          "type": "elementVisible",
          "selector": "role=link:name=Discover",
          "description": "Discover link becomes visible"
        }
      ],
      "optional": true,
      "maxRetries": 2,
      "description": "Click navigation toggle to expand menu"
    }
  ],
  "variables": [
    {
      "name": "navigationButtonName",
      "defaultValue": "Toggle primary navigation",
      "type": "string",
      "description": "The name of the navigation toggle button",
      "required": false
    }
  ],
  "preconditions": [
    {
      "type": "urlContains",
      "value": "/app/home",
      "description": "User is on home page"
    }
  ],
  "expectedOutcomes": [
    "User is on Discover page",
    "URL contains /discover"
  ]
}
`;
  }

  /**
   * Build prompt for generalized template
   */
  private buildGeneralizedTemplatePrompt(
    traces: RecordedTrace[],
    semantics: SemanticExtractionResult[],
    comparison: PatternComparison
  ): string {
    const tracesSummary = traces.map((t, i) =>
      `Trace ${i + 1}: ${t.name} (${t.actions.length} actions)`
    ).join('\n');

    return `You are creating a generalized workflow template from multiple similar workflows.

# Input Workflows
${tracesSummary}

# Pattern Analysis
- Similarity: ${(comparison.similarity * 100).toFixed(1)}%
- Common steps: ${comparison.commonSteps.join(', ')}
- Different steps: ${comparison.differentSteps.map(d => `T1:${d.trace1Index}, T2:${d.trace2Index}`).join(', ')}
- Suggested generalizations: ${comparison.generalizations.join(', ')}

# Your Task
Create a SINGLE generalized template that covers all input workflows.
Focus on the common pattern, handle differences with optional steps or alternatives.

Use the same response format as the single-trace template generation.
`;
  }

  /**
   * Parse template response from LLM
   */
  private parseTemplateResponse(
    response: string,
    baseTrace: RecordedTrace,
    sourceTraceIds: string[] = [baseTrace.id]
  ): WorkflowTemplate {
    try {
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      const template: WorkflowTemplate = {
        id: crypto.randomUUID(),
        name: parsed.name || baseTrace.name,
        description: parsed.description || baseTrace.description,
        goal: baseTrace.goal,
        steps: parsed.steps || this.createBasicSteps(baseTrace),
        variables: parsed.variables,
        preconditions: parsed.preconditions,
        expectedOutcomes: parsed.expectedOutcomes,
        domain: baseTrace.domain,
        tags: baseTrace.tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: '1.0.0',
        sourceTraceIds,
        generalizationRules: parsed.generalizationRules
      };

      return template;
    } catch (error) {
      Logger.error(`Failed to parse template response: ${error}`);
      return this.createBasicTemplate(baseTrace, { intents: [], generalizationRules: [], confidence: 0.5 }, sourceTraceIds);
    }
  }

  /**
   * Create basic template from trace (fallback)
   */
  private createBasicTemplate(
    trace: RecordedTrace,
    semantics: SemanticExtractionResult,
    sourceTraceIds: string[] = [trace.id]
  ): WorkflowTemplate {
    return {
      id: uuidv4(),
      name: trace.name,
      description: trace.description,
      goal: trace.goal,
      steps: this.createBasicSteps(trace),
      tags: trace.tags,
      domain: trace.domain,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      sourceTraceIds
    };
  }

  /**
   * Create basic steps from trace actions
   */
  private createBasicSteps(trace: RecordedTrace): TemplateStep[] {
    return trace.actions.map((action, index) => ({
      index,
      intent: action.description,
      actionType: action.type,
      selectorPattern: action.selector,
      description: action.description
    }));
  }
}

/**
 * Factory function to create a PatternLearner
 */
export function createPatternLearner(apiKey: string): PatternLearner {
  return new PatternLearner({ geminiApiKey: apiKey });
}
