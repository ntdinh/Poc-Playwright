import { Locator, Page, expect } from '@playwright/test';
import { BaseComponent } from './BaseComponent';
import { Logger } from '../utils/Logger';

/**
 * Navigation item configuration.
 */
export interface NavItem {
  name: string;
  label?: string;
  locator?: Locator;
  url?: string;
  submenu?: NavItem[];
}

/**
 * Navigation Component - Reusable navigation/menu component.
 *
 * Supports various navigation patterns:
 * - Top navigation bars
 * - Side navigation menus
 * - Dropdown/submenu navigation
 * - Breadcrumb navigation
 * - Tab navigation
 * - Mobile hamburger menus
 *
 * Example usage:
 * const nav = new Navigation(page, page.locator('nav'));
 * await nav.clickItem('Dashboard');
 * await nav.clickItem('User Management');
 * await nav.assertActive('Dashboard');
 *
 * Or with predefined items:
 * const nav = new Navigation(page, page.locator('nav'), {
 *   items: [
 *     { name: 'dashboard', label: 'Dashboard', url: '/dashboard' },
 *     { name: 'users', label: 'User Management', url: '/users' },
 *     { name: 'admin', label: 'Admin', submenu: [
 *       { name: 'settings', label: 'Settings' },
 *       { name: 'logs', label: 'Logs' }
 *     ]}
 *   ]
 * });
 */
export class Navigation extends BaseComponent {
  private navLocator: Locator;
  private items?: Map<string, NavItem>;
  private itemLocator?: (name: string) => Locator;

  constructor(
    page: Page,
    rootLocator: Locator,
    options?: {
      items?: NavItem[];
      itemSelector?: string;
    }
  ) {
    super(page, rootLocator);
    this.navLocator = rootLocator;

    // Set up items map if provided
    if (options?.items) {
      this.items = new Map();
      for (const item of options.items) {
        this.items.set(item.name, item);
      }
    }

    // Set up item locator function
    if (options?.itemSelector) {
      this.itemLocator = (name: string) => {
        // Try to find by text content
        return rootLocator.getByRole('link', { name }).or(
          rootLocator.locator(options.itemSelector!).filter({ hasText: name })
        );
      };
    }
  }

  /**
   * Click a navigation item by name.
   * Handles both regular items and submenu items.
   */
  async clickItem(itemName: string, options?: { waitForNavigation?: boolean }): Promise<void> {
    await this.waitForVisible();
    Logger.debug(`Clicking navigation item: ${itemName}`);

    const item = this.items?.get(itemName);
    const locator = item?.locator || this.getItemLocator(itemName);

    // Handle submenu items
    if (itemName.includes('/')) {
      const parts = itemName.split('/');
      const parentName = parts[0];
      const childName = parts[1];

      // First open the parent submenu
      await this.openSubmenu(parentName);

      // Then click the child item
      const childLocator = this.getItemLocator(childName);
      await this.basePage.click(childLocator);
      Logger.info(`Clicked submenu item: ${itemName}`);
      return;
    }

    await this.basePage.click(locator);

    if (options?.waitForNavigation !== false) {
      await this.page.waitForLoadState('networkidle');
    }

    Logger.info(`Clicked navigation item: ${itemName}`);
  }

  /**
   * Open a submenu/dropdown.
   */
  async openSubmenu(parentName: string): Promise<void> {
    await this.waitForVisible();

    const parentItem = this.items?.get(parentName);
    const parentLocator = parentItem?.locator || this.getItemLocator(parentName);

    // Check if item has submenu indicator
    const hasSubmenu =
      parentItem?.submenu ||
      (await parentLocator.locator('+ ul, .submenu, [role="menu"]').count() > 0);

    if (!hasSubmenu) {
      Logger.warn(`Item "${parentName}" does not have a submenu`);
      return;
    }

    // Hover or click to open submenu
    await parentLocator.hover();

    // Wait for submenu to become visible
    const submenu = parentLocator.locator('+ ul, .submenu, [role="menu"]').first();
    await submenu.waitFor({ state: 'visible', timeout: 3000 });

    Logger.debug(`Opened submenu for: ${parentName}`);
  }

  /**
   * Get navigation item locator.
   */
  private getItemLocator(name: string): Locator {
    if (this.itemLocator) {
      return this.itemLocator(name);
    }

    // Default: try multiple strategies
    return this.navLocator
      .getByRole('link', { name })
      .or(this.navLocator.getByRole('button', { name }))
      .or(this.navLocator.locator('[data-nav]', { hasText: name }))
      .or(this.navLocator.locator('.nav-item', { hasText: name }))
      .first();
  }

  /**
   * Check if a navigation item exists.
   */
  async hasItem(itemName: string): Promise<boolean> {
    try {
      const locator = this.getItemLocator(itemName);
      await locator.waitFor({ state: 'attached', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a navigation item is visible.
   */
  async isItemVisible(itemName: string): Promise<boolean> {
    const locator = this.getItemLocator(itemName);
    return await this.basePage.isVisible(locator);
  }

  /**
   * Check if a navigation item is active/selected.
   */
  async isItemActive(itemName: string): Promise<boolean> {
    const locator = this.getItemLocator(itemName);

    try {
      const isActive =
        (await locator.getAttribute('class'))?.includes('active') ||
        (await locator.getAttribute('aria-current')) === 'page' ||
        (await locator.getAttribute('data-active')) === 'true';

      return isActive || false;
    } catch {
      return false;
    }
  }

  /**
   * Get the active navigation item name.
   */
  async getActiveItem(): Promise<string | null> {
    const activeLocator = this.navLocator.locator('.active, [aria-current="page"], [data-active="true"]');

    const count = await activeLocator.count();
    if (count === 0) {
      return null;
    }

    const text = await activeLocator.first().textContent();
    return text?.trim() || null;
  }

  /**
   * Assert that a specific item is active.
   */
  async assertActive(itemName: string): Promise<void> {
    const isActive = await this.isItemActive(itemName);
    expect(isActive).toBeTruthy();
    Logger.debug(`Asserted "${itemName}" is active`);
  }

  /**
   * Navigate by URL (click item that leads to this URL).
   */
  async navigateByUrl(url: string | RegExp): Promise<void> {
    await this.waitForVisible();

    // Find link with matching href
    const links = this.navLocator.getByRole('link');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');

      if (href) {
        const matches =
          typeof url === 'string'
            ? href.includes(url) || href.endsWith(url)
            : url.test(href);

        if (matches) {
          await this.basePage.click(link);
          Logger.info(`Navigated to URL: ${href}`);
          return;
        }
      }
    }

    throw new Error(`No navigation item found for URL: ${url}`);
  }

  /**
   * Get all navigation item names.
   */
  async getItemNames(): Promise<string[]> {
    await this.waitForVisible();

    const items = this.navLocator.locator('[role="menuitem"], a, button, .nav-item');
    const count = await items.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await items.nth(i).textContent();
      if (text && text.trim().length > 0) {
        names.push(text.trim());
      }
    }

    return names;
  }

  /**
   * Breadcrumb navigation support.
   */
  async clickBreadcrumb(crumbName: string): Promise<void> {
    const breadcrumb = this.navLocator.locator('.breadcrumb, [aria-label="breadcrumb"], nav[aria-label*="Breadcrumb"]');
    const crumb = breadcrumb.getByRole('link', { name: crumbName });

    await this.basePage.click(crumb);
    Logger.info(`Clicked breadcrumb: ${crumbName}`);
  }

  /**
   * Tab navigation support.
   */
  async clickTab(tabName: string): Promise<void> {
    const tab = this.navLocator.locator('[role="tablist"]').getByRole('tab', { name: tabName });

    await this.basePage.click(tab);
    Logger.info(`Clicked tab: ${tabName}`);
  }

  /**
   * Get active tab name.
   */
  async getActiveTab(): Promise<string | null> {
    const activeTab = this.navLocator.locator('[role="tab"][aria-selected="true"], .tab.active');

    const count = await activeTab.count();
    if (count === 0) {
      return null;
    }

    const text = await activeTab.first().textContent();
    return text?.trim() || null;
  }

  /**
   * Mobile menu support (hamburger menu).
   */
  async openMobileMenu(): Promise<void> {
    const menuButton = this.navLocator.getByRole('button', {
      name: /menu|hamburger|navigation|toggle/i,
    });

    await this.basePage.click(menuButton);
    Logger.info('Opened mobile menu');
  }

  /**
   * Close mobile menu.
   */
  async closeMobileMenu(): Promise<void> {
    const closeButton = this.navLocator.getByRole('button', {
      name: /close|×|cancel/i,
    });

    const count = await closeButton.count();
    if (count > 0) {
      await this.basePage.click(closeButton.first());
      Logger.info('Closed mobile menu');
    } else {
      // Try pressing Escape
      await this.page.keyboard.press('Escape');
      Logger.info('Closed mobile menu via Escape key');
    }
  }

  /**
   * Search within navigation (for large menus).
   */
  async search(query: string): Promise<void> {
    const searchInput = this.navLocator.locator(
      'input[placeholder*="search" i], .search-input, [data-nav-search]'
    );

    const count = await searchInput.count();
    if (count === 0) {
      throw new Error('Navigation search input not found');
    }

    await searchInput.first().fill(query);
    Logger.debug(`Searched navigation for: ${query}`);
  }

  /**
   * Navigate using arrow keys (accessibility).
   */
  async navigateByArrowKeys(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    const keyMap = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };

    await this.page.keyboard.press(keyMap[direction]);
    Logger.debug(`Navigated using ${direction} arrow key`);
  }

  /**
   * Expand/collapse navigation section.
   */
  async toggleSection(sectionName: string): Promise<void> {
    const section = this.navLocator.locator('.nav-section, .menu-group').filter({ hasText: sectionName });
    const toggle = section.locator('[aria-expanded], .toggle, .expand-toggle').first();

    await this.basePage.click(toggle);
    Logger.info(`Toggled navigation section: ${sectionName}`);
  }

  /**
   * Check if navigation section is expanded.
   */
  async isSectionExpanded(sectionName: string): Promise<boolean> {
    const section = this.navLocator.locator('.nav-section, .menu-group').filter({ hasText: sectionName });
    const toggle = section.locator('[aria-expanded], .toggle, .expand-toggle').first();

    const ariaExpanded = await toggle.getAttribute('aria-expanded');
    if (ariaExpanded !== null) {
      return ariaExpanded === 'true';
    }

    // Check if section has 'expanded' class
    const expanded = await section.locator('.expanded, [data-expanded="true"]').count() > 0;
    return expanded;
  }

  /**
   * Get navigation item count.
   */
  async getItemCount(): Promise<number> {
    const items = this.navLocator.locator('[role="menuitem"], a, button, .nav-item');
    return await items.count();
  }

  /**
   * Wait for navigation to be ready.
   */
  async waitForReady(): Promise<void> {
    await this.waitForVisible();
    // Wait for first item to be attached
    const firstItem = this.navLocator.locator('[role="menuitem"], a, button, .nav-item').first();
    await firstItem.waitFor({ state: 'attached', timeout: 5000 });
    Logger.debug('Navigation is ready');
  }

  /**
   * Navigation history (if the component tracks it).
   */
  async getHistory(): Promise<string[]> {
    const historyLocator = this.navLocator.locator('.nav-history, .breadcrumb');
    const count = await historyLocator.count();

    if (count === 0) {
      return [];
    }

    const items = historyLocator.first().locator('a, span');
    const itemCount = await items.count();
    const history: string[] = [];

    for (let i = 0; i < itemCount; i++) {
      const text = await items.nth(i).textContent();
      if (text) {
        history.push(text.trim());
      }
    }

    return history;
  }

  /**
   * Quick navigation using keyboard shortcuts.
   */
  async useShortcut(shortcut: string): Promise<void> {
    // Common shortcuts: Alt+D for Dashboard, etc.
    const keys = shortcut.split('+');
    const modifiers = keys.slice(0, -1);
    const key = keys[keys.length - 1];

    // Press modifiers
    for (const modifier of modifiers) {
      await this.page.keyboard.down(modifier);
    }

    // Press and release the key
    await this.page.keyboard.press(key);

    // Release modifiers
    for (const modifier of modifiers.reverse()) {
      await this.page.keyboard.up(modifier);
    }

    Logger.debug(`Used navigation shortcut: ${shortcut}`);
  }
}
