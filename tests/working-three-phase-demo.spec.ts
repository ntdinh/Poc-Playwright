/**
 * Working 3-Phase Demo - Record + Learn + Execute with AI Agent
 *
 * Simplified demo that works:
 * Phase 1: Record a simple workflow
 * Phase 2: Learn patterns from it
 * Phase 3: Use AI Agent to execute (since full template execution is complex)
 */

import { test, expect } from '@playwright/test';
import {
  ActionRecorder,
  TraceStorage,
  PatternLearner,
  TemplateStore,
  createTestAgent,
  TestGoal,
  AgentConfig
} from '../utils/agent';

const API_KEY = process.env.GEMINI_API_KEY || '';
const RECORDINGS_DIR = './test-results/recordings/demo';
const TEMPLATES_DIR = './test-results/templates/demo';

const agentConfig: Partial<AgentConfig> = {
  geminiApiKey: API_KEY,
  geminiModel: 'gemini-2.0-flash',
  maxIterations: 15,
  debug: true
};

test.describe('Working 3-Phase Demo', () => {
  test('should demonstrate record, learn, and AI agent execution', async ({ page }) => {
    test.setTimeout(180000);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     3-PHASE LEARNING SYSTEM - WORKING DEMO                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // ========================================================================
    // PHASE 1: RECORD - Simple navigation workflow
    // ========================================================================
    console.log('\n📹 PHASE 1: RECORDING');
    console.log('   Recording simple navigation workflow...');

    const recorder = new ActionRecorder(page);
    const traceStorage = new TraceStorage({ baseDir: RECORDINGS_DIR });

    const recordingConfig = {
      sessionId: crypto.randomUUID(),
      workflowName: 'OpenSearch Home Navigation',
      description: 'Navigate to OpenSearch home and interact with UI',
      goal: 'Navigate to OpenSearch home and perform initial actions',
      startUrl: 'https://playground.opensearch.org/app/home#/',
      outputDir: RECORDINGS_DIR,
      captureScreenshots: false, // Faster without screenshots
      captureDOM: false,
      tags: ['demo', 'opensearch', 'navigation']
    };

    await recorder.startRecording(recordingConfig);

    // Navigate and interact
    await page.goto('https://playground.opensearch.org/app/home#/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Record navigation
    await recorder.recordAction('navigate', 'https://playground.opensearch.org/app/home#/', 'Navigate to OpenSearch home');

    // Try to dismiss banner if present
    try {
      const hasBanner = await page.getByRole('button', { name: 'Dismiss' }).isVisible().catch(() => false);
      if (hasBanner) {
        await page.getByRole('button', { name: 'Dismiss' }).click();
        await recorder.recordAction('click', 'role=button:name=Dismiss', 'Dismiss welcome banner');
      }
    } catch { /* ignore */ }

    // Record final state
    await page.waitForTimeout(1000);
    await recorder.recordAction('wait', '', 'Wait for page to stabilize', { duration: 1000 });

    const trace = await recorder.stopRecording();
    await traceStorage.save(trace);

    console.log(`   ✅ Recorded ${trace.actions.length} actions`);
    console.log(`   ✅ Trace ID: ${trace.id}`);
    console.log(`   ✅ Duration: ${(trace.duration / 1000).toFixed(2)}s`);

    // ========================================================================
    // PHASE 2: LEARN - Extract patterns
    // ========================================================================
    console.log('\n🧠 PHASE 2: LEARNING');
    console.log('   Extracting semantic patterns from recording...');

    const learner = new PatternLearner({ geminiApiKey: API_KEY });
    const learningResult = await learner.learnFromTrace(trace);

    console.log(`   ✅ Template: ${learningResult.template.name}`);
    console.log(`   ✅ Steps: ${learningResult.template.steps.length}`);
    console.log(`   ✅ Confidence: ${(learningResult.confidence * 100).toFixed(1)}%`);
    console.log(`   ✅ Variables: ${learningResult.template.variables?.length || 0}`);

    const templateStore = new TemplateStore({ baseDir: TEMPLATES_DIR });
    await templateStore.save(learningResult.template);

    console.log(`   ✅ Template saved: ${learningResult.template.id}`);

    // ========================================================================
    // PHASE 3: EXECUTE - Using AI Agent (proven working)
    // ========================================================================
    console.log('\n🚀 PHASE 3: EXECUTION (AI Agent)');
    console.log('   Executing goal using AI-powered autonomous agent...');

    const goal: TestGoal = {
      id: 'demo-execution',
      description: 'Navigate to Discover page and verify Download CSV button is visible',
      startUrl: 'https://playground.opensearch.org/app/home',
      successCriteria: [
        'URL contains /discover',
        'Download CSV button is visible'
      ],
      maxIterations: 15
    };

    console.log(`   🎯 Goal: ${goal.description}`);
    console.log(`   📍 Start: ${goal.startUrl}`);

    const agent = createTestAgent(page, agentConfig);
    const result = await agent.executeGoal(goal);

    console.log(`\n   ✅ Execution: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ✅ Duration: ${(result.executionTime / 1000).toFixed(2)}s`);
    console.log(`   ✅ Actions: ${result.actions.length}`);

    // Show actions taken
    console.log('\n   📋 Actions Taken:');
    result.actions.forEach((action, i) => {
      console.log(`      ${i + 1}. [${action.type}] ${action.description}`);
    });

    // Verify
    expect(result.success).toBe(true);
    expect(page.url()).toContain('/discover');

    const downloadCsvBtn = page.getByRole('button', { name: 'Download as CSV' });
    await expect(downloadCsvBtn).toBeVisible();

    // Show performance
    const perf = agent.getPerformanceMonitor().getSummary();
    console.log('\n   ⚡ Performance:');
    if (perf.state_capture) {
      console.log(`      State capture: avg ${perf.state_capture.avg.toFixed(0)}ms`);
    }
    if (perf.llm_decision) {
      console.log(`      LLM decision: avg ${perf.llm_decision.avg.toFixed(0)}ms`);
    }
    if (perf.action_execution) {
      console.log(`      Action execution: avg ${perf.action_execution.avg.toFixed(0)}ms`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     ✅ 3-PHASE DEMO COMPLETE                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   • Recording: ${trace.actions.length} actions captured`);
    console.log(`   • Learning: ${learningResult.template.steps.length} steps, ${(learningResult.confidence * 100).toFixed(0)}% confidence`);
    console.log(`   • Total time: ${((trace.duration + learningResult.duration + result.executionTime) / 1000).toFixed(2)}s`);
  });
});
