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
      startUrl: 'https://playground.opensearch.org/app/home',
      outputDir: RECORDINGS_DIR,
      captureScreenshots: false, // Faster without screenshots
      captureDOM: false,
      tags: ['tc001', 'opensearch', 'discover', 'time-range', 'production']
    };

    // start record action user
    await recorder.startRecording(recordingConfig);

    // Execute TC001 workflow - simplified recording for demo purposes
    await page.goto('https://playground.opensearch.org/app/home#/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Record simple navigation workflow
    await recorder.recordAction('navigate', 'https://playground.opensearch.org/app/home#/', 'Navigate to OpenSearch home page', { url: 'https://playground.opensearch.org/app/home#/' });

    // Try to dismiss banner if visible
    try {
      const hasBanner = await page.getByRole('button', { name: 'Dismiss' }).isVisible().catch(() => false);
      if (hasBanner) {
        await page.getByRole('button', { name: 'Dismiss' }).click();
        await recorder.recordAction('click', 'role=button:name=Dismiss', 'Dismiss welcome banner');
        await page.waitForTimeout(500);
      }
    } catch { /* ignore */ }

    // Navigate to Discover page directly
    await page.goto('https://playground.opensearch.org/app/discover#/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await recorder.recordAction('navigate', 'https://playground.opensearch.org/app/discover#/', 'Navigate to Discover page', { url: 'https://playground.opensearch.org/app/discover#/' });

    console.log('   ℹ️ Simple recording: Navigation to Discover page completed');

    const trace = await recorder.stopRecording();
    await traceStorage.save(trace);

    // ========================================================================
    // PHASE 2: LEARN
    // ========================================================================
    console.log('\n🧠 PHASE 2: LEARNING');
    console.log('   Extracting patterns and creating reusable template...');

    const learner = new PatternLearner({ geminiApiKey: API_KEY });
    const learningResult = await learner.learnFromTrace(trace);

    console.log(`   ✅ Extracted ${learningResult.template.steps.length} workflow steps`);
    console.log(`   ✅ Confidence: ${(learningResult.confidence * 100).toFixed(1)}%`);
    console.log(`   ✅ Identified ${learningResult.template.variables?.length || 0} variables`);
    console.log(`   ✅ Duration: ${(learningResult.duration / 1000).toFixed(2)}s`);

    const templateStore = new TemplateStore({ baseDir: TEMPLATES_DIR });
    await templateStore.save(learningResult.template);

    console.log(`   ✅ Template saved: ${learningResult.template.id}`);
    console.log(`   ✅ Template name: ${learningResult.template.name}`);

    // Display template summary
    console.log('\n   📋 Learned Template:');
    learningResult.template.steps.forEach((step, i) => {
      console.log(`      ${i + 1}. ${step.intent}`);
    });

    // Display extracted variables
    if (learningResult.template.variables && learningResult.template.variables.length > 0) {
      console.log('\n   🔧 Extracted Variables:');
      learningResult.template.variables.forEach((v, i) => {
        console.log(`      ${i + 1}. ${v.name}: ${v.description} (default: ${v.defaultValue || 'none'})`);
      });
    }

    // ========================================================================
    // PHASE 3: EXECUTE (Using AI Agent)
    // ========================================================================
 

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

    // Find the data table in OpenSearch Discover page
    const dataTable = page.locator('.kbnDocTable, [data-test-subj="docTable"], table.euiTable').first();
    const tableVisible = await dataTable.isVisible().catch(() => false);

    if (!tableVisible) {
      console.log('   ⚠️ Data table not found, trying alternative selectors...');
      const anyTable = page.locator('table').first();
      const anyTableVisible = await anyTable.isVisible().catch(() => false);
      if (!anyTableVisible) {
        console.log('   ℹ️ No table found - might be loading or no data available');
        console.log('   ℹ️ Skipping data extraction');
      } else {
        console.log('   ✅ Found alternative data table');
      }
    } else {
      console.log('   ✅ Found OpenSearch data table');
    }

    // Extract table headers
    console.log('\n   📋 Extracting table structure...');
    const headers = await page.locator('th.euiTableHeaderCell, .kbnDocTable th, table thead th').allTextContents();
    console.log(`   ✅ Found ${headers.length} columns: ${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}`);

    // Extract first few rows of data
    console.log('\n   📄 Extracting table rows...');
    const rows = page.locator('tr.euiTableRow, .kbnDocTable tbody tr, table tbody tr');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      const sampleRows = Math.min(rowCount, 5);
      const tableData: string[][] = [];

      for (let i = 0; i < sampleRows; i++) {
        const cells = await rows.nth(i).locator('td').allTextContents();
        tableData.push(cells);
      }

      console.log(`   ✅ Extracted ${sampleRows} rows from ${rowCount} total rows`);

      // Display sample data
      console.log('\n   📋 Sample Data (first 3 rows):');
      tableData.slice(0, 3).forEach((row, i) => {
        const preview = row.slice(0, 3).map(cell => cell.substring(0, 30)).join(' | ');
        console.log(`      Row ${i + 1}: ${preview}${row.length > 3 ? '...' : ''}`);
      });

      // ========================================================================
      // ANALYZE DATA WITH LLM
      // ========================================================================
      console.log('\n🧠 ANALYZING DATA WITH AI');

      const dataSummary = {
        columns: headers,
        rowCount: rowCount,
        sampleRows: tableData.slice(0, 3),
        timestamp: new Date().toISOString()
      };

      const analysisPrompt = `Analyze this OpenSearch Discover page data and provide insights:

**Table Structure:**
- Columns: ${headers.join(', ')}
- Total Rows: ${rowCount}

**Sample Data (first 3 rows):**
${JSON.stringify(tableData.slice(0, 3), null, 2)}

**Task:**
1. What type of data is this? (logs, metrics, events, etc.)
2. What is the main subject/topic of the data?
3. What patterns do you notice?
4. What are the key columns and their significance?
5. Any anomalies or interesting observations?

Provide a concise analysis in JSON format:
{
  "dataType": "type of data",
  "topic": "main subject",
  "patterns": ["pattern1", "pattern2"],
  "keyColumns": [{"column": "name", "significance": "description"}],
  "observations": ["observation1", "observation2"],
  "summary": "brief summary of the data"
}`;

      try {
        console.log('   🔍 Sending data to AI for analysis...');
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(analysisPrompt);
        const analysisText = result.response.text();

        let analysis;
        try {
          const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch {
          analysis = {
            summary: analysisText,
            rawData: true
          };
        }

        console.log('\n   ✅ AI Analysis Complete:');
        console.log(`      📊 Data Type: ${analysis.dataType || 'Unknown'}`);
        console.log(`      🎯 Topic: ${analysis.topic || 'Unknown'}`);

        if (analysis.patterns && analysis.patterns.length > 0) {
          console.log('\n      🔍 Patterns Detected:');
          analysis.patterns.forEach((p: string, i: number) => {
            console.log(`         ${i + 1}. ${p}`);
          });
        }

        if (analysis.keyColumns && analysis.keyColumns.length > 0) {
          console.log('\n      🔑 Key Columns:');
          analysis.keyColumns.forEach((col: any) => {
            console.log(`         • ${col.column}: ${col.significance}`);
          });
        }

        if (analysis.observations && analysis.observations.length > 0) {
          console.log('\n      💡 Observations:');
          analysis.observations.forEach((obs: string, i: number) => {
            console.log(`         ${i + 1}. ${obs}`);
          });
        }

        console.log(`\n      📝 Summary: ${analysis.summary || 'No summary available'}`);

        // Save analysis to files (both JSON and Markdown)
        const analysisDir = './test-results/analysis';
        if (!fs.existsSync(analysisDir)) {
          fs.mkdirSync(analysisDir, { recursive: true });
        }

        const timestamp = Date.now();
        const baseFilename = `opensearch-analysis-${timestamp}`;

        // Save JSON file
        const jsonFile = path.join(analysisDir, `${baseFilename}.json`);
        fs.writeFileSync(jsonFile, JSON.stringify({
          timestamp: new Date().toISOString(),
          dataSummary,
          analysis
        }, null, 2));

        // Generate Markdown file
        const mdFile = path.join(analysisDir, `${baseFilename}.md`);
        const markdownContent = `# OpenSearch Data Analysis Report

**Generated:** ${new Date().toISOString()}
**Source:** OpenSearch Discover Page

---

## 📊 Data Overview

| Property | Value |
|----------|-------|
| **Data Type** | ${analysis.dataType || 'Unknown'} |
| **Topic** | ${analysis.topic || 'Unknown'} |
| **Total Rows** | ${dataSummary.rowCount} |
| **Columns** | ${dataSummary.columns.length} |

### Table Structure
${dataSummary.columns.map((col: string, i: number) => `${i + 1}. \`${col}\``).join('\n')}

---

## 🔍 Patterns Detected

${analysis.patterns && analysis.patterns.length > 0 ?
  analysis.patterns.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n') :
  '*No patterns detected*'}

---

## 🔑 Key Columns

${analysis.keyColumns && analysis.keyColumns.length > 0 ?
  analysis.keyColumns.map((col: any) =>
    `**\`${col.column}\`**: ${col.significance}`
  ).join('\n') :
  '*No key columns identified*'}

---

## 💡 Observations

${analysis.observations && analysis.observations.length > 0 ?
  analysis.observations.map((obs: string, i: number) => `${i + 1}. ${obs}`).join('\n') :
  '*No observations recorded*'}

---

## 📝 Summary

${analysis.summary || 'No summary available.'}

---

## 📄 Sample Data (First 3 Rows)

\`\`\`
${dataSummary.sampleRows.map((row: string[], i: number) =>
  `Row ${i + 1}: ${row.slice(0, 3).map(cell => cell.substring(0, 50)).join(' | ')}`
).join('\n')}
\`\`\`

---

## 📋 Metadata

| Key | Value |
|-----|-------|
| Analysis Timestamp | ${new Date().toISOString()} |
| Data Source | OpenSearch Discover Page |
| Row Count | ${dataSummary.rowCount} |
| Column Count | ${dataSummary.columns.length} |
| Sample Size | ${dataSummary.sampleRows.length} rows |

---

*This report was automatically generated by the 4-Phase Learning System*
`;

        fs.writeFileSync(mdFile, markdownContent, 'utf-8');

        console.log(`\n   💾 Analysis saved to:`);
        console.log(`      📄 JSON: ${jsonFile}`);
        console.log(`      📝 Markdown: ${mdFile}`);

      } catch (error) {
        console.log(`   ⚠️ AI Analysis failed: ${error}`);
        console.log('   ℹ️ Data extraction completed, but AI analysis skipped');
      }
    } else {
      console.log('   ⚠️ No data rows found in table');
      console.log('   ℹ️ The table might be empty or still loading');
    }

    console.log('\n   ✅ Data extraction and analysis phase complete');

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
    console.log('║     ✅ TC001 4-PHASE WORKFLOW COMPLETE                          ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    // Summary statistics
    console.log('\n📊 Summary:');
    console.log(`   • Recording: ${trace.actions.length} actions captured`);
    console.log(`   • Learning: ${learningResult.template.steps.length} steps, ${(learningResult.confidence * 100).toFixed(0)}% confidence`);
    console.log(`   • Execution: AI Agent achieved goal in ${result.iterations || 'N/A'} iterations`);
    console.log(`   • Total time: ${((trace.duration + learningResult.duration + result.executionTime) / 1000).toFixed(2)}s`);
  });
});
