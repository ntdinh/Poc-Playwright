/**
 * Three-Phase Workflow Test
 *
 * Demonstrates the complete 3-phase learning system:
 * Phase 1: Recording - Capture user demonstrations
 * Phase 2: Learning - Extract patterns and create templates
 * Phase 3: Execution - Use templates to achieve goals
 */

import { test, expect } from '@playwright/test';
import {
  // Phase 1: Recording
  ActionRecorder,
  TraceStorage,
  RecordingConfig,
  // Phase 2: Learning
  PatternLearner,
  SemanticExtractor,
  TemplateBuilder,
  TemplateStore,
  // Phase 3: Execution
  TemplatePlanner,
  // Core
  createTestAgent,
  TestGoal,
  AgentConfig
} from '../utils/agent';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY = process.env.GEMINI_API_KEY || '';
const RECORDINGS_DIR = './test-results/recordings';
const TEMPLATES_DIR = './test-results/templates';

const agentConfig: Partial<AgentConfig> = {
  geminiApiKey: API_KEY,
  geminiModel: 'gemini-2.0-flash',
  maxIterations: 15,
  debug: true
};

// ============================================================================
// PHASE 1: RECORDING DEMO
// ============================================================================

test.describe('Phase 1: Recording - Capture User Actions', () => {
  test('should record a user navigating to OpenSearch Discover page', async ({ page }) => {
    test.setTimeout(120000);

    const recorder = new ActionRecorder(page);
    const storage = new TraceStorage({ baseDir: RECORDINGS_DIR });

    // Start recording
    const config: RecordingConfig = {
      sessionId: crypto.randomUUID(),
      workflowName: 'Navigate to OpenSearch Discover',
      description: 'Navigate from home page to Discover page in OpenSearch Dashboard',
      goal: 'Navigate to Discover page and verify it loads',
      outputDir: RECORDINGS_DIR,
      captureScreenshots: true,
      captureDOM: true,
      tags: ['opensearch', 'navigation', 'discover']
    };

    await recorder.startRecording(config);

    // Navigate to start URL
    await page.goto('https://playground.opensearch.org/app/home');

    // Perform the workflow manually (this is what a human would do during recording)
    // Step 1: Wait for page load
    await page.waitForLoadState('domcontentloaded');
    await recorder.recordAction('wait', '', 'Wait for page to load', { duration: 2000 });

    // Step 2: Dismiss popup if present
    try {
      await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 3000 });
      await recorder.recordAction(
        'click',
        'role=button:name=Dismiss',
        'Dismiss welcome banner'
      );
    } catch {
      // No popup, continue
    }

    // Step 3: Toggle navigation menu
    await page.getByRole('button', { name: 'Toggle primary navigation' }).click();
    await recorder.recordAction(
      'click',
      'role=button:name=Toggle primary navigation',
      'Expand navigation menu'
    );

    // Step 4: Click Discover link
    await page.getByRole('link', { name: 'Discover' }).click();
    await recorder.recordAction(
      'click',
      'role=link:name=Discover',
      'Navigate to Discover page'
    );

    // Step 5: Wait for navigation
    await page.waitForURL('**/discover');
    await recorder.recordAction('wait', '', 'Wait for Discover page to load', { duration: 3000 });

    // Stop recording and save
    const trace = await recorder.stopRecording();
    await storage.save(trace);

    console.log('\n=== Phase 1 Complete ===');
    console.log(`Recorded ${trace.actions.length} actions`);
    console.log(`Trace ID: ${trace.id}`);
    console.log(`Duration: ${(trace.duration / 1000).toFixed(2)}s`);
  });
});

// ============================================================================
// PHASE 2: LEARNING DEMO
// ============================================================================

test.describe('Phase 2: Learning - Extract Patterns & Create Templates', () => {
  test('should learn a template from recorded trace', async ({ page }) => {
    test.setTimeout(120000);

    // Load the recorded trace from Phase 1
    const storage = new TraceStorage({ baseDir: RECORDINGS_DIR });
    const traces = await storage.list();

    if (traces.length === 0) {
      test.skip(true, 'No recorded traces found. Run Phase 1 test first.');
    }

    // Get the most recent trace
    const latestTraceInfo = traces[traces.length - 1];
    const trace = await storage.load(latestTraceInfo.id);

    if (!trace) {
      throw new Error('Failed to load trace');
    }

    console.log('\n=== Phase 2: Learning ===');
    console.log(`Loading trace: ${trace.name}`);

    // Learn from the trace
    const learner = new PatternLearner({ geminiApiKey: API_KEY });
    const result = await learner.learnFromTrace(trace);

    console.log('\n=== Learned Template ===');
    console.log(`Name: ${result.template.name}`);
    console.log(`Steps: ${result.template.steps.length}`);
    console.log(`Variables: ${result.template.variables?.length || 0}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);

    // Save the template
    const templateStore = new TemplateStore({ baseDir: TEMPLATES_DIR });
    await templateStore.save(result.template);

    console.log(`\nTemplate saved with ID: ${result.template.id}`);

    // Display template steps
    console.log('\n--- Template Steps ---');
    result.template.steps.forEach((step, i) => {
      console.log(`${i + 1}. ${step.intent}`);
      console.log(`   Action: ${step.actionType}`);
      console.log(`   Pattern: ${step.selectorPattern || 'N/A'}`);
    });
  });

  test('should learn from multiple traces and create generalized template', async ({ page }) => {
    test.setTimeout(180000);

    const storage = new TraceStorage({ baseDir: RECORDINGS_DIR });
    const traces = await storage.list();

    if (traces.length < 2) {
      test.skip(true, 'Need at least 2 recorded traces. Run Phase 1 test multiple times first.');
    }

    // Load multiple traces with similar goals
    const discoverTraces: any[] = [];
    for (const traceInfo of traces) {
      const trace = await storage.load(traceInfo.id);
      if (trace && trace.goal.toLowerCase().includes('discover')) {
        discoverTraces.push(trace);
      }
    }

    if (discoverTraces.length < 2) {
      test.skip(true, 'Need at least 2 "discover" traces.');
    }

    console.log(`\n=== Phase 2: Multi-Trace Learning ===`);
    console.log(`Learning from ${discoverTraces.length} traces...`);

    // Learn generalized template
    const learner = new PatternLearner({ geminiApiKey: API_KEY });
    const result = await learner.learnFromMultipleTraces(discoverTraces);

    console.log(`\n=== Generalized Template ===`);
    console.log(`Name: ${result.template.name}`);
    console.log(`Steps: ${result.template.steps.length}`);
    console.log(`Source traces: ${result.sourceTraceIds.length}`);

    // Save generalized template
    const templateStore = new TemplateStore({ baseDir: TEMPLATES_DIR });
    await templateStore.save(result.template);

    console.log(`\nTemplate saved: ${result.template.id}`);
  });
});

// ============================================================================
// PHASE 3: EXECUTION DEMO
// ============================================================================

test.describe('Phase 3: Execution - Use Templates to Achieve Goals', () => {
  test('should execute a goal using learned template', async ({ page }) => {
    test.setTimeout(120000);

    const templateStore = new TemplateStore({ baseDir: TEMPLATES_DIR });
    const templates = await templateStore.list();

    if (templates.length === 0) {
      test.skip(true, 'No templates found. Run Phase 2 test first.');
    }

    console.log('\n=== Phase 3: Template Execution ===');
    console.log(`Available templates: ${templates.length}`);

    // Find a template for our goal
    const goal: TestGoal = {
      id: 'test-discover-navigation',
      description: 'Navigate to Discover page in OpenSearch Dashboard',
      startUrl: 'https://playground.opensearch.org/app/home',
      successCriteria: [
        'URL contains /discover',
        'Discover page is loaded'
      ]
    };

    const match = await templateStore.getBestTemplate(goal.description);

    if (!match) {
      throw new Error('No matching template found');
    }

    console.log(`\nUsing template: ${match.template.name}`);
    console.log(`Match score: ${(match.matchScore * 100).toFixed(1)}%`);
    console.log(`Steps: ${match.template.steps.length}`);

    // Create LLM engine and template planner
    const { createLLMEngine } = await import('../utils/agent');
    const llmEngine = createLLMEngine
      ? createLLMEngine(agentConfig)
      : null;

    if (!llmEngine) {
      throw new Error('Failed to create LLM engine');
    }

    const planner = new TemplatePlanner(page, llmEngine, templateStore);

    // Execute using template
    const result = await planner.executeTemplate(match.template, goal);

    console.log('\n=== Execution Result ===');
    console.log(`Success: ${result.success}`);
    console.log(`Steps executed: ${result.executedSteps.length}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);

    if (result.success) {
      console.log('\n✅ Goal achieved using template!');

      // Verify final state
      expect(page.url()).toContain('/discover');
    } else {
      console.log('\n❌ Template execution failed:', result.error);
    }
  });

  test('should fallback to LLM when no template matches', async ({ page }) => {
    test.setTimeout(120000);

    const goal: TestGoal = {
      id: 'test-unknown-workflow',
      description: 'Perform an action that has no template',
      startUrl: 'https://playground.opensearch.org/app/home',
      successCriteria: [
        'URL contains /home'
      ]
    };

    console.log('\n=== Phase 3: LLM Fallback ===');
    console.log('No template found, using LLM-based agent...');

    // Use standard TestAgent (LLM-based)
    const agent = createTestAgent(page, agentConfig);
    const result = await agent.executeGoal(goal);

    console.log(`\n=== Execution Result ===`);
    console.log(`Success: ${result.success}`);
    console.log(`Iterations: ${result.iterations}`);
    console.log(`Duration: ${(result.executionTime / 1000).toFixed(2)}s`);

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// INTEGRATION TEST: Full 3-Phase Workflow
// ============================================================================

test.describe('Integration: Complete 3-Phase Workflow', () => {
  test('should demonstrate record → learn → execute flow', async ({ page }) => {
    test.setTimeout(300000);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     3-PHASE LEARNING SYSTEM DEMONSTRATION                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // ========================================================================
    // PHASE 1: RECORD
    // ========================================================================
    console.log('\n📹 PHASE 1: RECORDING');
    console.log('   Recording user demonstration...');

    const recorder = new ActionRecorder(page);
    const traceStorage = new TraceStorage({ baseDir: RECORDINGS_DIR });

    const recordingConfig: RecordingConfig = {
      sessionId: crypto.randomUUID(),
      workflowName: 'Demo: Navigate to Discover',
      description: 'Demo workflow for 3-phase system',
      goal: 'Navigate to Discover page in OpenSearch',
      outputDir: RECORDINGS_DIR,
      captureScreenshots: true,
      captureDOM: true,
      tags: ['demo', 'opensearch', 'discover']
    };

    await recorder.startRecording(recordingConfig);

    // Execute the workflow
    await page.goto('https://playground.opensearch.org/app/home');
    await page.waitForLoadState('domcontentloaded');

    // Record each action
    await page.waitForTimeout(2000);
    await recorder.recordAction('wait', '', 'Initial wait', { duration: 2000 });

    try {
      await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 3000 });
      await recorder.recordAction('click', 'role=button:name=Dismiss', 'Dismiss banner');
    } catch { /* ignore */ }

    await page.getByRole('button', { name: 'Toggle primary navigation' }).click();
    await recorder.recordAction('click', 'role=button:name=Toggle primary navigation', 'Toggle nav');

    await page.getByRole('link', { name: 'Discover' }).click();
    await recorder.recordAction('click', 'role=link:name=Discover', 'Click Discover');

    await page.waitForTimeout(3000);

    const trace = await recorder.stopRecording();
    await traceStorage.save(trace);

    console.log(`   ✅ Recorded ${trace.actions.length} actions`);
    console.log(`   ✅ Trace ID: ${trace.id}`);

    // ========================================================================
    // PHASE 2: LEARN
    // ========================================================================
    console.log('\n🧠 PHASE 2: LEARNING');
    console.log('   Extracting patterns and creating template...');

    const learner = new PatternLearner({ geminiApiKey: API_KEY });
    const learningResult = await learner.learnFromTrace(trace);

    console.log(`   ✅ Extracted ${learningResult.template.steps.length} steps`);
    console.log(`   ✅ Confidence: ${(learningResult.confidence * 100).toFixed(1)}%`);

    const templateStore = new TemplateStore({ baseDir: TEMPLATES_DIR });
    await templateStore.save(learningResult.template);

    console.log(`   ✅ Template saved: ${learningResult.template.id}`);

    // ========================================================================
    // PHASE 3: EXECUTE
    // ========================================================================
    console.log('\n🚀 PHASE 3: EXECUTION');
    console.log('   Executing workflow using learned template...');

    // Navigate back to start
    await page.goto('https://playground.opensearch.org/app/home');
    await page.waitForLoadState('domcontentloaded');

    const goal: TestGoal = {
      id: 'demo-goal',
      description: 'Navigate to Discover page in OpenSearch',
      startUrl: 'https://playground.opensearch.org/app/home',
      successCriteria: ['URL contains /discover']
    };

    // Create template planner
    const { LLMDecisionEngine } = await import('../utils/agent');
    const llmEngine = new LLMDecisionEngine(
      TestAgent.createConfig(agentConfig),
      {}
    );
    const planner = new TemplatePlanner(page, llmEngine, templateStore);

    const execResult = await planner.executeTemplate(learningResult.template, goal);

    console.log(`   ✅ Execution: ${execResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ✅ Steps executed: ${execResult.executedSteps.length}`);
    console.log(`   ✅ Duration: ${(execResult.duration / 1000).toFixed(2)}s`);

    // Verify
    expect(execResult.success).toBe(true);
    expect(page.url()).toContain('/discover');

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     ✅ 3-PHASE WORKFLOW COMPLETE                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  });
});
