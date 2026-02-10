/**
 * ActionRecorder - Phase 1: Recording
 *
 * Records user actions during a demonstration session using Playwright.
 * Combines Playwright's native capabilities with enhanced context capture.
 */

import { Page, Locator } from '@playwright/test';
import { BrowserStateCapture } from '../BrowserStateCapture';
import {
  RecordedAction,
  RecordedTrace,
  RecordingConfig,
  RecordingSession,
  ActionValidation
} from './RecordedAction';
import { Logger } from '../../Logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Action Recorder - Records user actions with full context
 *
 * Usage:
 * ```typescript
 * const recorder = new ActionRecorder(page);
 *
 * // Start recording
 * await recorder.startRecording({
 *   sessionId: 'session-1',
 *   workflowName: 'Navigate to Discover',
 *   goal: 'Navigate to Discover page in OpenSearch',
 *   outputDir: './recordings',
 *   captureScreenshots: true,
 *   captureDOM: true
 * });
 *
 * // User performs actions...
 * // Each action is automatically captured
 *
 * // Stop and save
 * const trace = await recorder.stopRecording();
 * ```
 */
export class ActionRecorder {
  private page: Page;
  private stateCapture: BrowserStateCapture;
  private session?: RecordingSession;
  private actionIndex: number = 0;

  // Store listeners for cleanup
  private listeners: { event: string; handler: (...args: any[]) => void }[] = [];

  constructor(page: Page) {
    this.page = page;
    this.stateCapture = new BrowserStateCapture(page);
  }

  /**
   * Start recording a new session
   */
  async startRecording(config: RecordingConfig): Promise<void> {
    if (this.session?.isRecording) {
      throw new Error('Recording already in progress. Stop current recording first.');
    }

    Logger.info(`🎬 Starting recording session: ${config.workflowName}`);
    Logger.info(`   Goal: ${config.goal}`);

    // Ensure output directory exists
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }

    // Initialize session
    this.session = {
      config,
      actions: [],
      startTime: Date.now(),
      currentUrl: this.page.url(),
      isRecording: true
    };
    this.actionIndex = 0;

    // Setup event listeners for automatic capture
    this.setupEventListeners();

    // Capture initial state
    await this.captureInitialState();

    Logger.info('✅ Recording started. Perform your actions now.');
  }

  /**
   * Stop recording and return the trace
   */
  async stopRecording(): Promise<RecordedTrace> {
    if (!this.session?.isRecording) {
      throw new Error('No active recording session.');
    }

    Logger.info('⏹️ Stopping recording...');

    // Remove event listeners
    this.removeEventListeners();

    // Capture final state
    const finalScreenshot = this.session.config.captureScreenshots
      ? await this.captureScreenshot('final')
      : undefined;

    // Build trace
    const trace: RecordedTrace = {
      id: this.session.config.sessionId,
      name: this.session.config.workflowName,
      description: this.session.config.description || '',
      goal: this.session.config.goal,
      startUrl: this.session.currentUrl,
      actions: [...this.session.actions],
      finalScreenshot,
      startTime: this.session.startTime,
      endTime: Date.now(),
      duration: Date.now() - this.session.startTime,
      success: true,
      tags: this.session.config.tags || [],
      domain: this.extractDomain(this.page.url())
    };

    this.session.isRecording = false;

    Logger.info(`✅ Recording stopped. Captured ${trace.actions.length} actions.`);
    Logger.info(`   Duration: ${(trace.duration / 1000).toFixed(2)}s`);

    return trace;
  }

  /**
   * Manually record an action (for programmatic recording)
   * This is useful when you want to explicitly record an action
   * rather than relying on automatic event capture
   */
  async recordAction(
    type: RecordedAction['type'],
    selector: string,
    description: string,
    options?: {
      value?: string;
      option?: string;
      url?: string;
      key?: string;
    }
  ): Promise<void> {
    if (!this.session?.isRecording) {
      throw new Error('No active recording session.');
    }

    const index = this.actionIndex++;
    const timestamp = Date.now();
    const pageUrl = this.page.url();

    // Capture before screenshot
    const beforeScreenshot = this.session.config.captureScreenshots
      ? await this.captureScreenshot(`before-${index}`)
      : undefined;

    // Capture element details for semantic understanding
    const elementDetails = await this.captureElementDetails(selector);

    // Capture DOM snapshot if enabled
    const domSnapshot = this.session.config.captureDOM
      ? (await this.stateCapture.capture()).domTree
      : undefined;

    const action: RecordedAction = {
      index,
      timestamp,
      type,
      selector,
      description,
      value: options?.value,
      option: options?.option,
      url: options?.url,
      key: options?.key,
      beforeScreenshot,
      pageUrl,
      domSnapshot,
      elementText: elementDetails.text,
      elementRole: elementDetails.role,
      accessibleName: elementDetails.accessibleName
    };

    this.session.actions.push(action);

    Logger.debug(`📝 Recorded: ${description} (${type})`);
  }

  /**
   * Record a click action using a Playwright locator
   */
  async recordClick(locator: Locator, description?: string): Promise<void> {
    const selector = await this.extractSelector(locator);
    const elementText = await locator.textContent() || '';
    const accessibleName = await locator.getAttribute('aria-name') || '';

    const desc = description || `Click on ${elementText || accessibleName || selector}`;

    await this.recordAction('click', selector, desc);

    // Actually perform the click
    await locator.click();
  }

  /**
   * Record a fill action using a Playwright locator
   */
  async recordFill(locator: Locator, value: string, description?: string): Promise<void> {
    const selector = await this.extractSelector(locator);
    const elementText = await locator.getAttribute('placeholder') ||
                        await locator.getAttribute('name') ||
                        await locator.getAttribute('aria-label') || '';

    const desc = description || `Fill "${value}" into ${elementText || selector}`;

    await this.recordAction('fill', selector, desc, { value });

    // Actually perform the fill
    await locator.fill(value);
  }

  /**
   * Record a navigate action
   */
  async recordNavigate(url: string, description?: string): Promise<void> {
    const desc = description || `Navigate to ${url}`;

    await this.recordAction('navigate', url, desc, { url });

    // Actually perform the navigation
    await this.page.goto(url);
  }

  /**
   * Get current recording session (read-only)
   */
  getSession(): RecordingSession | undefined {
    return this.session ? { ...this.session, actions: [...this.session.actions] } : undefined;
  }

  /**
   * Get number of actions recorded so far
   */
  getActionCount(): number {
    return this.session?.actions.length || 0;
  }

  /**
   * Setup event listeners for automatic action capture
   */
  private setupEventListeners(): void {
    // Note: Playwright doesn't expose user action events directly
    // This is a placeholder for future enhancement using page.route() or custom handlers
    // For now, manual recording via recordAction/recordClick/recordFill is the primary method

    // Could add:
    // - page.on('console') for console logging
    // - page.on('request') for network requests
    // - page.on('response') for network responses
    // - page.on('load') for page loads
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    this.listeners.forEach(({ event, handler }) => {
      this.page.off(event, handler);
    });
    this.listeners = [];
  }

  /**
   * Capture initial state
   */
  private async captureInitialState(): Promise<void> {
    if (this.session?.config.captureScreenshots) {
      await this.captureScreenshot('initial');
    }
  }

  /**
   * Capture screenshot and return as base64
   */
  private async captureScreenshot(label: string): Promise<string | undefined> {
    if (!this.session) return undefined;

    try {
      const screenshotPath = path.join(
        this.session.config.outputDir,
        `${this.session.config.sessionId}-${label}.png`
      );

      await this.page.screenshot({ path: screenshotPath, fullPage: false });

      // Convert to base64 for storage
      const buffer = fs.readFileSync(screenshotPath);
      return buffer.toString('base64');
    } catch (error) {
      Logger.warn(`Failed to capture screenshot: ${error}`);
      return undefined;
    }
  }

  /**
   * Capture element details for semantic understanding
   */
  private async captureElementDetails(selector: string): Promise<{
    text: string;
    role?: string;
    accessibleName?: string;
  }> {
    try {
      const element = this.page.locator(selector).first();

      const text = await element.textContent().catch(() => '') || '';
      const role = await element.getAttribute('role').catch(() => undefined);
      const accessibleName = await element.getAttribute('aria-label').catch(() => undefined)
                          || await element.getAttribute('aria-name').catch(() => undefined);

      return { text, role, accessibleName };
    } catch (error) {
      Logger.debug(`Failed to capture element details for ${selector}: ${error}`);
      return { text: '' };
    }
  }

  /**
   * Extract selector string from Playwright Locator
   */
  private async extractSelector(locator: Locator): Promise<string> {
    // Get the selector string from the locator
    // This is a simplified version - might need enhancement for complex selectors
    return (locator as any)._selector;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Validate an action before recording
   */
  async validateAction(type: string, selector: string): Promise<ActionValidation> {
    const validation: ActionValidation = { valid: true };

    try {
      // Check if selector exists on page
      const element = this.page.locator(selector);
      const count = await element.count();

      if (count === 0) {
        validation.valid = false;
        validation.error = `Selector "${selector}" not found on page`;
        return validation;
      }

      if (count > 1) {
        validation.warnings = validation.warnings || [];
        validation.warnings.push(`Selector "${selector}" matches ${count} elements. Using first.`);
      }

      // Check if element is visible
      const isVisible = await element.first().isVisible();
      if (!isVisible) {
        validation.warnings = validation.warnings || [];
        validation.warnings.push(`Element "${selector}" is not visible`);
      }

    } catch (error) {
      validation.valid = false;
      validation.error = `Validation error: ${error}`;
    }

    return validation;
  }
}

/**
 * Factory function to create an ActionRecorder
 */
export function createActionRecorder(page: Page): ActionRecorder {
  return new ActionRecorder(page);
}
