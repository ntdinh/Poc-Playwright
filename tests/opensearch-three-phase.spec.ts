/**
 * OpenSearch Discover - Three-Phase Learning Workflow
 *
 * This test demonstrates the 3-phase learning system using the
 * OpenSearch Discover navigation and time range setting workflow.
 *
 * Based on: TC001 from opensearch-discover.spec.ts
 * - Navigate to OpenSearch home
 * - Dismiss welcome banner
 * - Toggle primary navigation
 * - Click Discover link
 * - Set time range to 2 months
 * - Verify Download CSV button
 */

import { test, expect } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import {
  // Phase 1: Recording
  ActionRecorder,
  TraceStorage,
  RecordingConfig,
  // Phase 2: Learning
  PatternLearner,
  TemplateStore,
  // Core
  createTestAgent,
  TestGoal,
  AgentConfig
} from '../utils/agent';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY = process.env.GEMINI_API_KEY || '';
const RECORDINGS_DIR = './test-results/recordings/opensearch';
const TEMPLATES_DIR = './test-results/templates/opensearch';

const agentConfig: Partial<AgentConfig> = {
  geminiApiKey: API_KEY,
  geminiModel: 'gemini-2.0-flash',
  maxIterations: 20,
  debug: true
};


// ============================================================================
// INTEGRATION TEST: Complete TC001 3-Phase Workflow
// ============================================================================

test.describe('Integration: Complete TC001 with 3-Phase Learning', () => {
  /**
   * Full end-to-end demonstration:
   * 1. Record the TC001 workflow
   * 2. Learn a template from it
   * 3. Execute using AI Agent (proven working approach)
   */
  test('should demonstrate complete 4-phase workflow for TC001', async ({ page }) => {
    test.setTimeout(300000);

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║     OPENSEARCH TC001 - 4-PHASE LEARNING DEMONSTRATION         ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    // ========================================================================
    // PHASE 1: RECORD
    // ========================================================================
    console.log('\n📹 PHASE 1: RECORDING');
    console.log('   Recording TC001 workflow demonstration...');

    const traceStorage = new TraceStorage({ baseDir: RECORDINGS_DIR });
    const recorder = new ActionRecorder(page);

    const recordingConfig: RecordingConfig = {
      sessionId: crypto.randomUUID(),
      workflowName: 'TC001: OpenSearch Discover with Time Range',
      description: 'Complete TC001 workflow - Navigate to Discover, set time range to 2 months',
      goal: 'Navigate to Discover page, set time range to 2 months, verify Download CSV button',
      // startUrl: 'https://playground.opensearch.org/app/home',
      outputDir: RECORDINGS_DIR,
      captureScreenshots: false, // Faster without screenshots
      captureDOM: false,
      tags: ['tc001', 'opensearch', 'discover', 'time-range', 'production']
    };

    // start record action user
    await recorder.startRecording(recordingConfig);

    const goal: TestGoal = {
      id: 'tc001-integration',
      description: 'Navigate to Discover page, set time range to 2 months, and verify Download CSV button is visible',
      startUrl: 'https://playground.opensearch.org/app/home',
      successCriteria: [
        'URL contains /discover',
        'Download as CSV button is visible'
      ],
      maxIterations: 20
    };

    console.log(`   🎯 Goal: ${goal.description}`);
    console.log(`   📍 Start: ${goal.startUrl}`);

    const agent = createTestAgent(page, agentConfig);
    const result = await agent.executeGoal(goal);

    console.log(`\n   ✅ Execution: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ✅ Iterations: ${result.iterations || 'N/A'}`);
    console.log(`   ✅ Duration: ${(result.executionTime / 1000).toFixed(2)}s`);
    console.log(`   ✅ Actions: ${result.actions.length}`);

    // Show actions taken
    console.log('\n   📋 Actions Taken:');
    result.actions.forEach((action, i) => {
      console.log(`      ${i + 1}. [${action.type}] ${action.description}`);
    });

    // Verify TC001 success criteria
    expect(result.success).toBe(true);
    expect(page.url()).toContain('/discover');

    const downloadCsvButton = page.getByRole('button', { name: 'Download as CSV' });
    await expect(downloadCsvButton).toBeVisible();

    // ========================================================================
    // PHASE 4: DATA EXTRACTION & ANALYSIS
    // ========================================================================
    console.log('\n📊 PHASE 4: DATA EXTRACTION & ANALYSIS');
    console.log('   Extracting table data and analyzing content...');

    // Wait for data table to load
    await page.waitForTimeout(2000);

    
 

    // ========================================================================
    // PHASE 5: MULTI-INDEX PROCESSING & CONSOLIDATION
    // ========================================================================
    console.log('\n🗂️ PHASE 5: MULTI-INDEX PROCESSING & CONSOLIDATION');
    console.log('   Processing multiple OpenSearch indices and consolidating into single report...');

    // Define indices to process
    const indicesToProcess = [
      'opensearch_dashboards_sample_data_ecommerce',
      'opensearch_dashboards_sample_data_flights',
      'opensearch_dashboards_sample_data_logs'
    ];

    console.log(`   📋 Indices to process: ${indicesToProcess.length}`);
    indicesToProcess.forEach((idx, i) => {
      console.log(`      ${i + 1}. ${idx}`);
    });

    // Storage for all consolidated data
    const allIndexData: Array<{
      indexName: string;
      success: boolean;
      rowCount: number;
      columns: string[];
      sampleRows: string[][];
      error?: string;
    }> = [];

    // Process each index and extract data
    for (let i = 0; i < indicesToProcess.length; i++) {
      const indexName = indicesToProcess[i];
      console.log(`\n${'='.repeat(70)}`);
      console.log(`  📂 INDEX ${i + 1}/${indicesToProcess.length}: "${indexName}"`);
      console.log(`${'='.repeat(70)}\n`);

      // Step 1: Switch to index
      const switchSuccess = await agent.switchIndex(indexName);
      if (!switchSuccess) {
        console.log(`  ⚠️  Failed to switch to "${indexName}", skipping...`);
        allIndexData.push({
          indexName,
          success: false,
          rowCount: 0,
          columns: [],
          sampleRows: [],
          error: 'Failed to switch index'
        });
        continue;
      }

      // Wait 2s after index switch for data to load
      console.log(`  ⏳ Waiting 2s for page to load after index switch...`);
      await page.waitForTimeout(2000);

      // Step 2: Extract data with auto-fix loop
      let tableData: Awaited<ReturnType<typeof agent.extractTableData>> | undefined;
      let attempts = 0;
      const maxAttempts = 5;
      const timeProgression = [2, 4, 6, 12, 24, 36];

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`  🔍 Attempt ${attempts}/${maxAttempts} for index "${indexName}"`);

        // Extract data from current page
        tableData = await agent.extractTableData();

        if (tableData.hasData) {
          console.log(`  ✅ DATA FOUND in index "${indexName}" with ${tableData.rowCount} records!`);
          break;
        }

        // No data - try auto-fix by changing time range directly
        console.log(`  ⚠️  No data in attempt ${attempts}, trying to change time range...`);

        const nextTimeRange = attempts < timeProgression.length
          ? timeProgression[attempts]
          : Math.min((timeProgression[timeProgression.length - 1] || 36) * 2, 60);

        // Use changeTimeRange method which handles all the internal state
        await agent.changeTimeRange(nextTimeRange);

        // Wait for data to load after time range change
        console.log(`  ⏳ Waiting 3s for data to load after time range change...`);
        await page.waitForTimeout(3000);
      }

      // Store result
      if (tableData && tableData.hasData) {
        allIndexData.push({
          indexName,
          success: true,
          rowCount: tableData.rowCount,
          columns: tableData.headers,
          sampleRows: tableData.sampleRows
        });
      } else {
        console.log(`  ❌ No data found for "${indexName}" after ${maxAttempts} attempts`);
        allIndexData.push({
          indexName,
          success: false,
          rowCount: 0,
          columns: [],
          sampleRows: [],
          error: 'No data found'
        });
      }
    }

    // ========================================================================
    // GENERATE CONSOLIDATED REPORT
    // ========================================================================
    console.log(`\n${'='.repeat(70)}`);
    console.log('  📊 GENERATING CONSOLIDATED REPORT');
    console.log(`${'='.repeat(70)}\n`);

    const timestamp = Date.now();
    const outputDir = './test-results/analysis';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const markdownFilename = `multi-index-consolidated-${timestamp}.md`;
    const markdownPath = path.join(outputDir, markdownFilename);

    // Build consolidated markdown report
    let markdownContent = `# OpenSearch Multi-Index Data Report

**Generated:** ${new Date().toISOString()}
**Source:** OpenSearch Dashboard - Multiple Indices Processing

---

## 📊 Summary

| Metric | Value |
|---------|-------|
| **Total Indices Processed** | ${indicesToProcess.length} |
| **Successful** | ${allIndexData.filter(d => d.success).length} |
| **Failed** | ${allIndexData.filter(d => !d.success).length} |
| **Total Records Extracted** | ${allIndexData.reduce((sum, d) => sum + (d.success ? d.rowCount : 0), 0)} |

---

## 📋 Per-Index Results

`;

    // Add each index section
    allIndexData.forEach((data, i) => {
      const status = data.success ? '✅ SUCCESS' : '❌ FAILED';
      markdownContent += `### ${i + 1}. ${data.indexName} - ${status}

`;

      if (data.success) {
        markdownContent += `- **Records:** ${data.rowCount}
- **Columns:** ${data.columns.length}
`;

        // Show column names
        data.columns.forEach((col, j) => {
          markdownContent += `  ${j + 1}. \`${col}\`\n`;
        });

        // Add sample data
        markdownContent += `
#### Sample Data (first 5 rows)

| Row | ${data.columns.slice(0, 3).join(' | ')}${data.columns.length > 3 ? ' | ...' : ''} |
|-----|${'---|'.repeat(data.columns.length > 3 ? data.columns.length : 3)}-----|
`;

        data.sampleRows.slice(0, 5).forEach((row, ri) => {
          const rowPreview = row.slice(0, 3).map(cell => cell?.substring(0, 40) || '').join(' | ');
          markdownContent += `| ${ri + 1} | ${rowPreview}${row.length > 3 ? ' | ...' : ''} |\n`;
        });

        markdownContent += `\n`;
      } else {
        markdownContent += `- **Error:** ${data.error || 'Unknown error'}
`;
      }

      markdownContent += `\n`;
    });

    // Add footer
    markdownContent += `
---

## 📋 Metadata

| Key | Value |
|-----|-------|
| Report Timestamp | ${new Date().toISOString()} |
| Total Indices | ${indicesToProcess.length} |
| Successful Indices | ${allIndexData.filter(d => d.success).length} |
| Failed Indices | ${allIndexData.filter(d => !d.success).length} |
| Total Records | ${allIndexData.reduce((sum, d) => sum + (d.success ? d.rowCount : 0), 0)} |
| Report Generated By | 4-Phase Learning System with AI Agent |

---

*This report was automatically generated by processing multiple OpenSearch indices with auto-fix and consolidation*
`;

    // Save consolidated report
    fs.writeFileSync(markdownPath, markdownContent, 'utf-8');

    console.log(`\n💾 Consolidated report saved to:`);
    console.log(`   📝 ${markdownPath}`);

    // Display summary in console
    console.log(`\n${'='.repeat(70)}`);
    console.log('  📊 MULTI-INDEX PROCESSING COMPLETE');
    console.log(`${'='.repeat(70)}\n`);

    console.log('   📊 Summary:');
    console.log(`   ├─ Total indices processed: ${indicesToProcess.length}`);
    console.log(`   ├─ Successful: ${allIndexData.filter(d => d.success).length}`);
    console.log(`   ├─ Failed: ${allIndexData.filter(d => !d.success).length}`);
    console.log(`   └─ Total records extracted: ${allIndexData.reduce((sum, d) => sum + (d.success ? d.rowCount : 0), 0)}`);

    console.log('\n   📋 Detailed Results:');
    allIndexData.forEach((data, i) => {
      const status = data.success ? '✅' : '❌';
      const records = data.success ? `${data.rowCount} records` : 'No data';
      console.log(`      ${i + 1}. [${status}] ${data.indexName}`);
      console.log(`         Records: ${records}`);
    });

    console.log(`\n   ✅ Multi-index consolidation complete: ${allIndexData.reduce((sum, d) => sum + (d.success ? d.rowCount : 0), 0)} records from ${allIndexData.filter(d => d.success).length} indices`);

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

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║     ✅ TC001 5-PHASE WORKFLOW COMPLETE                          ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    // Summary statistics
    // console.log('\n📊 Summary:');
    // console.log(`   Phase 1 • Recording: ${trace.actions.length} actions captured`);
    // console.log(`   Phase 2 • Learning: ${learningResult.template.steps.length} steps, ${(learningResult.confidence * 100).toFixed(0)}% confidence`);
    // console.log(`   Phase 3 • Execution: AI Agent achieved goal in ${result.iterations || 'N/A'} iterations`);
    // console.log(`   Phase 4 • Analysis: Data table extracted and analyzed`);
    // console.log(`   Phase 5 • Multi-Index: ${multiIndexResult.totalRecords} records from ${indicesToProcess.length} indices`);
    // console.log(`   • Total time: ${((trace.duration + learningResult.duration + result.executionTime) / 1000).toFixed(2)}s`);
  });
});
