import { test, expect } from '@playwright/test';
import { createTestAgent, TestGoal, GoalValidator } from '../utils/agent';
import { AgentConfigPresets, getConfigForEnvironment } from '../utils/agent/agentConfig';
import { Logger } from '../utils/Logger';

test.describe('OpenSearch Agent Tests', () => {
 
  const agentConfig = {
    ...getConfigForEnvironment(),
    maxIterations: 20,
    debug: true
  };

   
  test('@agent @opensearch @smoke @adaptive AGENT007: Verify Download CSV button - Auto-adaptive POC', async ({ page }) => {
    test.setTimeout(240000);

    // Clean & simple goal - agent handles adaptation automatically!
    const goal: TestGoal = {
      id: 'opensearch-verify-download-csv',
      description: 'Navigate to Discover page, verify Download CSV button is visible',
      startUrl: 'https://playground.opensearch.org/app/home',
      successCriteria: [
        'URL contains /discover',
        'Element [role="button"][name="Download as CSV"] is visible'
      ],
      maxIterations: 25
    };

    const agent = createTestAgent(page, agentConfig);
    const result = await agent.executeGoal(goal);

    expect(result.success, `❌ Goal not achieved: ${result.error}`).toBe(true);

    // Double-check
    const downloadCsvButton = page.getByRole('button', { name: 'Download as CSV' });
    await expect(downloadCsvButton).toBeVisible();
    Logger.info(`✅ Double-verified: Download CSV button is visible`);
  });
});

/**
 * Helper: Create goals using the GoalValidator helper
 *
 * You can use helper methods to create common success criteria
 */
test.describe('Goal Creation Helpers', () => {
  test('Demonstrate goal creation helpers', async ({ page }) => {
    // Using helper methods for cleaner goal definition
    const goal: TestGoal = {
      id: 'helper-demo',
      description: 'Demo goal using helpers',
      startUrl: 'https://playground.opensearch.org/app/home',
      successCriteria: [
        GoalValidator.Criteria.elementVisible('[role="link"][name="Discover"]'),
        GoalValidator.Criteria.urlContains('/app/home'),
        GoalValidator.Criteria.noErrors()
      ]
    };

    // The goal is now defined using reusable helpers
    expect(goal.successCriteria).toHaveLength(3);
  });
});
