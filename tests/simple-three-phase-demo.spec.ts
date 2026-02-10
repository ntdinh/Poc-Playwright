/**
 * Simple 3-Phase Demo - Recording to Execution
 *
 * A simplified demonstration of the 3-phase learning system
 * using a simple workflow that's more reliable for demo purposes.
 */

import { test, expect } from '@playwright/test';
import {
  ActionRecorder,
  TraceStorage,
  PatternLearner,
  TemplateStore,
  TemplatePlanner,
  createTestAgent,
  LLMDecisionEngine,
  TestGoal,
  AgentConfig
} from '../utils/agent';

const API_KEY = process.env.GEMINI_API_KEY || '';
const RECORDINGS_DIR = './test-results/recordings/demo';
const TEMPLATES_DIR = './test-results/templates/demo';

const agentConfig: Partial<AgentConfig> = {
  geminiApiKey: API_KEY,
  geminiModel: 'gemini-2.0-flash',
  maxIterations: 10,
  debug: true
};

test.describe('Demo: Simple 3-Phase Workflow', () => {
  test('should demonstrate record → learn → execute with simple workflow', async ({ page }) => {
    test.setTimeout(180000);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     3-PHASE LEARNING SYSTEM - SIMPLE DEMO               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // ========================================================================
    // PHASE 1: RECORD (Simple workflow - just navigate to a page)
    // ========================================================================
    console.log('\n📹 PHASE 1: RECORDING');
    console.log('   Recording simple navigation workflow...');

    const recorder = new ActionRecorder(page);
    const traceStorage = new TraceStorage({ baseDir: RECORDINGS_DIR });

    const recordingConfig = {
      sessionId: crypto.randomUUID(),
      workflowName: 'Simple: Navigate and Verify',
      description: 'Navigate to a page and verify button exists',
      goal: 'Navigate to OpenSearch home and verify UI elements',
      startUrl: 'https://playground.opensearch.org/app/home',
      outputDir: RECORDINGS_DIR,
      captureScreenshots: true,
      captureDOM: false, // Faster without DOM capture
      tags: ['demo', 'simple']
    };

    await recorder.startRecording(recordingConfig);

    // Execute simple workflow
    await page.goto('https://playground.opensearch.org/app/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Record simple actions
    await recorder.recordAction('navigate', 'https://playground.opensearch.org/app/home', 'Go to home page', {
      url: 'https://playground.opensearch.org/app/home'
    });

    await recorder.recordAction('wait', '', 'Wait for page load', { duration: 2000 });

    // Try to dismiss if present
    try {
      await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 2000 });
      await recorder.recordAction('click', 'role=button:name=Dismiss', 'Dismiss banner');
    } catch { /* ignore */ }

    const trace = await recorder.stopRecording();
    await traceStorage.save(trace);

    console.log(`   ✅ Recorded ${trace.actions.length} actions`);
    console.log(`   ✅ Trace ID: ${trace.id}`);

    // ========================================================================
    // PHASE 2: LEARN
    // ========================================================================
    console.log('\n🧠 PHASE 2: LEARNING');
    console.log('   Extracting patterns from recording...');

    const learner = new PatternLearner({ geminiApiKey: API_KEY });
    const learningResult = await learner.learnFromTrace(trace);

    console.log(`   ✅ Template created: ${learningResult.template.name}`);
    console.log(`   ✅ Steps: ${learningResult.template.steps.length}`);
    console.log(`   ✅ Confidence: ${(learningResult.confidence * 100).toFixed(1)}%`);

    const templateStore = new TemplateStore({ baseDir: TEMPLATES_DIR });
    await templateStore.save(learningResult.template);

    console.log(`   ✅ Template ID: ${learningResult.template.id}`);

    // Display what was learned
    console.log('\n   📋 Learned Steps:');
    learningResult.template.steps.forEach((step, i) => {
      console.log(`      ${i + 1}. ${step.intent} (${step.actionType})`);
    });

    // ========================================================================
    // PHASE 3: EXECUTE
    // ========================================================================
    console.log('\n🚀 PHASE 3: EXECUTION');
    console.log('   Executing workflow using learned template...');

    const goal: TestGoal = {
      id: 'demo-goal',
      description: 'Navigate to OpenSearch home',
      startUrl: 'https://playground.opensearch.org/app/home',
      successCriteria: ['URL contains /app/home'],
      maxIterations: 10
    };

    const llmEngine = new LLMDecisionEngine(
      createTestAgent(page, agentConfig)['constructor'].createConfig(agentConfig),
      {}
    );
    const planner = new TemplatePlanner(page, llmEngine, templateStore);

    const execResult = await planner.executeTemplate(learningResult.template, goal);

    console.log(`   ✅ Execution: ${execResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ✅ Steps executed: ${execResult.executedSteps.length}`);
    console.log(`   ✅ Duration: ${(execResult.duration / 1000).toFixed(2)}s`);

    // ========================================================================
    // DEMONSTRATE LLM FALLBACK
    // ========================================================================
    console.log('\n🤖 BONUS: LLM FALLBACK DEMO');
    console.log('   Executing a goal WITHOUT a template (using LLM)...');

    const llmGoal: TestGoal = {
      id: 'llm-demo',
      description: 'Verify we are on the home page',
      startUrl: page.url(),
      successCriteria: ['URL contains /app'],
      maxIterations: 5
    };

    const agent = createTestAgent(page, agentConfig);
    const llmResult = await agent.executeGoal(llmGoal);

    console.log(`   ✅ LLM Execution: ${llmResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ✅ Iterations: ${llmResult.iterations}`);
    console.log(`   ✅ Duration: ${(llmResult.executionTime / 1000).toFixed(2)}s`);

    expect(llmResult.success).toBe(true);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     ✅ 3-PHASE DEMO COMPLETE                                ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  });

  /**
   * Alternative demo: Run existing AI agent to show LLM capabilities
   */
  test('should demonstrate LLM-based autonomous agent', async ({ page }) => {
    test.setTimeout(120000);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     LLM-BASED AUTONOMOUS AGENT DEMO                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const goal: TestGoal = {
      id: 'llm-agent-demo',
      description: 'Navigate to Discover page and verify Download CSV button',
      startUrl: 'https://playground.opensearch.org/app/home',
      successCriteria: [
        'URL contains /discover',
        'Download CSV button is visible'
      ],
      maxIterations: 15
    };

    console.log('\n🎯 Goal: ' + goal.description);
    console.log('📍 Start URL: ' + goal.startUrl);
    console.log('✓ Success: ' + goal.successCriteria.join(', '));

    const agent = createTestAgent(page, agentConfig);
    const result = await agent.executeGoal(goal);

    console.log('\n=== RESULT ===');
    console.log(`✅ Success: ${result.success ? 'YES' : 'NO'}`);
    console.log(`🔄 Iterations: ${result.iterations}`);
    console.log(`⏱️ Duration: ${(result.executionTime / 1000).toFixed(2)}s`);
    console.log(`📊 Actions: ${result.actions.length}`);

    console.log('\n📋 Actions Taken:');
    result.actions.forEach((action, i) => {
      console.log(`  ${i + 1}. [${action.type}] ${action.description}`);
    });

    // Show performance summary
    const perf = agent.getPerformanceMonitor().getSummary();
    if (perf.state_capture) {
      console.log('\n⚡ Performance:');
      console.log(`   State capture: avg ${perf.state_capture.avg.toFixed(0)}ms`);
      if (perf.llm_decision) {
        console.log(`   LLM decision: avg ${perf.llm_decision.avg.toFixed(0)}ms`);
      }
      if (perf.action_execution) {
        console.log(`   Action execution: avg ${perf.action_execution.avg.toFixed(0)}ms`);
      }
    }

    expect(result.success).toBe(true);
    expect(page.url()).toContain('/discover');

    const downloadBtn = page.getByRole('button', { name: 'Download as CSV' });
    await expect(downloadBtn).toBeVisible();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     ✅ LLM AGENT DEMO COMPLETE                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  });
});
