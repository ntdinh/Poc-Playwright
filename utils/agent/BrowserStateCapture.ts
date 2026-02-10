import { Page } from '@playwright/test';
import { BrowserState, ConsoleLog, DOMElement } from './types';
import { Logger } from '../Logger';

// Local interface for evaluate callback (matches exported DOMElement structure)
interface DOMElementData {
  tag: string;
  id?: string;
  classes?: string[];
  accessibleName?: string;
  role?: string;
  text?: string;
  selector: string;
  visible: boolean;
  enabled: boolean;
}

/**
 * Captures browser state for LLM analysis
 *
 * This utility extracts:
 * - Screenshot (visual representation)
 * - Accessible DOM tree (interactive elements)
 * - Console logs (errors, warnings)
 * - Page metadata (URL, title)
 */
export class BrowserStateCapture {
  private consoleLogs: ConsoleLog[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupConsoleListener();
  }

  /**
   * Setup console listener to capture logs
   */
  private setupConsoleListener(): void {
    this.page.on('console', msg => {
      const log: ConsoleLog = {
        level: msg.type() as 'error' | 'warning' | 'info' | 'log',
        message: msg.text(),
        timestamp: Date.now()
      };
      this.consoleLogs.push(log);

      // Keep only last 50 logs to manage memory
      if (this.consoleLogs.length > 50) {
        this.consoleLogs = this.consoleLogs.slice(-50);
      }
    });
  }

  /**
   * Capture current browser state
   */
  async capture(): Promise<BrowserState> {
    Logger.debug('Capturing browser state...');

    const screenshot = await this.captureScreenshot();
    const domTree = await this.captureDOMTree();
    const pageText = await this.capturePageText();

    const state: BrowserState = {
      screenshot,
      url: this.page.url(),
      title: await this.page.title(),
      domTree,
      consoleLogs: [...this.consoleLogs],
      pageText,
      timestamp: Date.now()
    };

    Logger.debug(`Captured state: ${state.url}, ${domTree.length} interactive elements`);

    return state;
  }

  /**
   * Capture screenshot as base64
   */
  private async captureScreenshot(): Promise<string> {
    try {
      const buffer = await this.page.screenshot({
        fullPage: false,
        type: 'png'
      });
      return buffer.toString('base64');
    } catch (error) {
      Logger.warn('Failed to capture screenshot:', error);
      return '';
    }
  }

  /**
   * Capture all visible text on page (for no-data detection)
   */
  private async capturePageText(): Promise<string> {
    try {
      const text = await this.page.evaluate(() => {
        // @ts-ignore - runs in browser context
        return document.body?.innerText || '';
      });
      return text.toLowerCase();
    } catch (error) {
      Logger.warn('Failed to capture page text:', error);
      return '';
    }
  }

  /**
   * Capture accessible DOM tree
   * Focuses on interactive elements that are useful for testing
   */
  private async captureDOMTree(): Promise<DOMElement[]> {
    const elements = await this.page.evaluate(() => {
      const result: DOMElementData[] = [];

      // Define interactive tags and roles to capture
      const interactiveTags = new Set([
        'a', 'button', 'input', 'select', 'textarea',
        'form', 'label', '[role="button"]', '[role="link"]',
        '[role="menuitem"]', '[role="tab"]', '[role="option"]'
      ]);

      // Helper to get element selector
      function getSelector(el: Element): string {
        // Try to get stable selector
        if (el.id) {
          return `#${el.id}`;
        }

        // Get data attributes
        const dataId = el.getAttribute('data-testid');
        if (dataId) {
          return `[data-testid="${dataId}"]`;
        }

        const dataCy = el.getAttribute('data-cy');
        if (dataCy) {
          return `[data-cy="${dataCy}"]`;
        }

        // Use aria attributes
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) {
          return `[aria-label="${ariaLabel}"]`;
        }

        // Fallback: use CSS path (simplified)
        return el.tagName.toLowerCase();
      }

      // Helper to get accessible name
      function getAccessibleName(el: Element): string | undefined {
        // Try aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        // Try aria-labelledby
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          const ref = document.getElementById(labelledBy);
          if (ref) return ref.textContent?.trim();
        }

        // Try text content for buttons/links
        if (el.tagName === 'BUTTON' || el.tagName === 'A') {
          const text = el.textContent?.trim();
          if (text) return text;
        }

        // Try placeholder for inputs
        if (el.getAttribute('placeholder')) {
          return el.getAttribute('placeholder')!;
        }

        // Try title attribute
        if (el.getAttribute('title')) {
          return el.getAttribute('title')!;
        }

        return undefined;
      }

      // Walk the DOM and collect interactive elements
      function walk(node: Element, depth: number = 0) {
        if (depth > 20) return; // Prevent infinite loops

        const isVisible = isElementVisible(node);
        const isEnabled = !(node as HTMLInputElement).disabled;

        // Get role
        let role = node.getAttribute('role');
        if (!role) {
          // Infer role from tag
          const tagName = node.tagName.toLowerCase();
          if (tagName === 'button') role = 'button';
          else if (tagName === 'a') role = 'link';
          else if (tagName === 'input') role = (node as HTMLInputElement).type || 'textbox';
          else if (tagName === 'select') role = 'combobox';
          else if (tagName === 'textarea') role = 'textbox';
        }

        // Get selector
        const selector = getSelector(node);

        // Get classes
        const classes = node.className
          ? typeof node.className === 'string'
            ? node.className.split(' ').filter(c => c)
            : Array.from(node.classList)
          : undefined;

        // Get text content (truncated)
        let text: string | undefined;
        if (['button', 'a', 'label', 'option'].includes(node.tagName.toLowerCase())) {
          text = node.textContent?.trim().substring(0, 100) || undefined;
        }

        const element: DOMElementData = {
          tag: node.tagName.toLowerCase(),
          id: node.id || undefined,
          classes,
          accessibleName: getAccessibleName(node),
          role: role || undefined,
          text,
          selector,
          visible: isVisible,
          enabled: isEnabled
        };

        result.push(element);

        // Recurse into children
        for (const child of Array.from(node.children)) {
          // Only walk into interactive containers or direct interactive children
          const childTag = child.tagName.toLowerCase();
          const childRole = child.getAttribute('role');

          if (interactiveTags.has(childTag) || childRole) {
            walk(child, depth + 1);
          }
        }
      }

      function isElementVisible(el: Element): boolean {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
      }

      // Start from body
      walk(document.body);

      return result;
    });

    return elements;
  }

  /**
   * Get recent console logs by level
   */
  getConsoleLogs(level?: 'error' | 'warning' | 'info' | 'log'): ConsoleLog[] {
    if (level) {
      return this.consoleLogs.filter(log => log.level === level);
    }
    return this.consoleLogs;
  }

  /**
   * Clear captured console logs
   */
  clearConsoleLogs(): void {
    this.consoleLogs = [];
  }

  /**
   * Format state as text description for LLM
   */
  static formatStateForLLM(state: BrowserState): string {
    const lines = [
      `# Current Browser State`,
      `**URL:** ${state.url}`,
      `**Title:** ${state.title}`,
      ``,
      `## Interactive Elements (${state.domTree.length})`
    ];

    // Add visible, enabled elements
    const interactiveElements = state.domTree
      .filter(el => el.visible && el.enabled)
      .slice(0, 50); // Limit to prevent token overflow

    for (const el of interactiveElements) {
      const name = el.accessibleName || el.text || el.id || el.selector;
      lines.push(`- [${el.role || el.tag}] ${name} → ${el.selector}`);
    }

    // Add errors if any
    const errors = state.consoleLogs.filter(l => l.level === 'error');
    if (errors.length > 0) {
      lines.push('');
      lines.push('## Console Errors');
      errors.forEach(e => lines.push(`- ${e.message}`));
    }

    return lines.join('\n');
  }
}
