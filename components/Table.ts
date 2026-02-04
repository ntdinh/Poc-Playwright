import { Locator, Page, expect } from '@playwright/test';
import { BaseComponent } from './BaseComponent';
import { Logger } from '../utils/Logger';

/**
 * Table Component - Reusable table/data grid component.
 *
 * Supports various table structures including:
 * - Simple HTML tables (<table>)
 * - Data grids with custom structure
 * - Pagination
 * - Sorting
 * - Filtering
 *
 * Example usage:
 * const table = new Table(page, page.locator('table'));
 * await table.getRowCount();
 * await table.getCellText(1, 2); // Row 1, Column 2
 * await table.clickCell(1, 2);
 * await table.findRow('Username', 'john.doe');
 */
export class Table extends BaseComponent {
  private tableLocator: Locator;
  private headerRowLocator?: Locator;
  private bodyRowLocator?: Locator;

  constructor(
    page: Page,
    rootLocator: Locator,
    options?: {
      headerSelector?: string; // e.g., 'thead tr', '.header-row'
      bodySelector?: string; // e.g., 'tbody tr', '.data-row'
    }
  ) {
    super(page, rootLocator);
    this.tableLocator = rootLocator;

    // Set up header and body locators if provided
    if (options?.headerSelector) {
      this.headerRowLocator = rootLocator.locator(options.headerSelector);
    }
    if (options?.bodySelector) {
      this.bodyRowLocator = rootLocator.locator(options.bodySelector);
    }
  }

  /**
   * Get all rows in the table body.
   */
  private getRowsLocator(): Locator {
    if (this.bodyRowLocator) {
      return this.bodyRowLocator;
    }
    // Default to standard table rows (excluding header)
    return this.tableLocator.locator('tbody tr');
  }

  /**
   * Get the header row.
   */
  private getHeaderRowLocator(): Locator {
    if (this.headerRowLocator) {
      return this.headerRowLocator;
    }
    // Default to standard table header
    return this.tableLocator.locator('thead tr');
  }

  /**
   * Get the number of rows in the table (excluding header).
   */
  async getRowCount(): Promise<number> {
    await this.waitForVisible();
    const rows = this.getRowsLocator();
    const count = await rows.count();
    Logger.debug(`Table row count: ${count}`);
    return count;
  }

  /**
   * Get the number of columns in the table.
   */
  async getColumnCount(): Promise<number> {
    await this.waitForVisible();

    // Try to get column count from header row
    const header = this.getHeaderRowLocator();
    const headerCells = await header.locator('th, td').count();

    if (headerCells > 0) {
      Logger.debug(`Table column count from header: ${headerCells}`);
      return headerCells;
    }

    // Fallback: count cells in first data row
    const rows = this.getRowsLocator();
    const firstRowCells = await rows.first().locator('td, th').count();

    Logger.debug(`Table column count from first row: ${firstRowCells}`);
    return firstRowCells;
  }

  /**
   * Get all cell values in a specific row (1-indexed).
   */
  async getRowValues(rowIndex: number): Promise<string[]> {
    await this.waitForVisible();
    const rows = this.getRowsLocator();
    const row = rows.nth(rowIndex - 1);
    const cells = await row.locator('td, th').allTextContents();
    Logger.debug(`Row ${rowIndex} values: ${cells.join(', ')}`);
    return cells;
  }

  /**
   * Get text from a specific cell (1-indexed row and column).
   */
  async getCellText(rowIndex: number, columnIndex: number): Promise<string> {
    await this.waitForVisible();
    const rows = this.getRowsLocator();
    const row = rows.nth(rowIndex - 1);
    const cell = row.locator('td, th').nth(columnIndex - 1);
    const text = await cell.textContent();
    Logger.debug(`Cell (${rowIndex}, ${columnIndex}): ${text}`);
    return text || '';
  }

  /**
   * Click a specific cell (1-indexed row and column).
   */
  async clickCell(rowIndex: number, columnIndex: number): Promise<void> {
    await this.waitForVisible();
    const rows = this.getRowsLocator();
    const row = rows.nth(rowIndex - 1);
    const cell = row.locator('td, th').nth(columnIndex - 1);
    await this.basePage.click(cell);
    Logger.debug(`Clicked cell (${rowIndex}, ${columnIndex})`);
  }

  /**
   * Get cell locator for advanced operations.
   */
  getCellLocator(rowIndex: number, columnIndex: number): Locator {
    const rows = this.getRowsLocator();
    return rows.nth(rowIndex - 1).locator('td, th').nth(columnIndex - 1);
  }

  /**
   * Get the header text for all columns.
   */
  async getHeaders(): Promise<string[]> {
    await this.waitForVisible();
    const header = this.getHeaderRowLocator();
    const headers = await header.locator('th, td').allTextContents();
    Logger.debug(`Table headers: ${headers.join(', ')}`);
    return headers;
  }

  /**
   * Get header text for a specific column (1-indexed).
   */
  async getHeader(columnIndex: number): Promise<string> {
    const headers = await this.getHeaders();
    return headers[columnIndex - 1] || '';
  }

  /**
   * Find the column index by header name (case-insensitive).
   */
  async findColumnIndex(headerName: string): Promise<number> {
    const headers = await this.getHeaders();
    const index = headers.findIndex((h) => h.toLowerCase().trim() === headerName.toLowerCase());

    if (index === -1) {
      throw new Error(`Column "${headerName}" not found. Available headers: ${headers.join(', ')}`);
    }

    return index + 1; // 1-indexed
  }

  /**
   * Find a row by column value.
   * Returns the row index (1-indexed) or -1 if not found.
   */
  async findRow(
    columnName: string | number,
    value: string | RegExp,
    options?: { exact?: boolean }
  ): Promise<number> {
    await this.waitForVisible();

    // Get column index
    const columnIndex =
      typeof columnName === 'string' ? await this.findColumnIndex(columnName) : columnName;

    const rows = this.getRowsLocator();
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const cell = row.locator('td, th').nth(columnIndex - 1);
      const text = await cell.textContent();

      if (text) {
        if (value instanceof RegExp) {
          if (value.test(text.trim())) {
            Logger.debug(`Found row matching ${value} at row ${i + 1}`);
            return i + 1;
          }
        } else {
          const isMatch = options?.exact
            ? text.trim() === value
            : text.trim().toLowerCase().includes(value.toLowerCase());

          if (isMatch) {
            Logger.debug(`Found row with "${value}" at row ${i + 1}`);
            return i + 1;
          }
        }
      }
    }

    Logger.warn(`Row with value "${value}" not found in column "${columnName}"`);
    return -1;
  }

  /**
   * Check if a row with the given value exists.
   */
  async hasRow(columnName: string | number, value: string | RegExp): Promise<boolean> {
    const rowIndex = await this.findRow(columnName, value);
    return rowIndex !== -1;
  }

  /**
   * Click a row action button (e.g., Edit, Delete).
   * Assumes action buttons are in the last column.
   */
  async clickRowAction(rowIndex: number, buttonText: string): Promise<void> {
    await this.waitForVisible();
    const rows = this.getRowsLocator();
    const row = rows.nth(rowIndex - 1);
    const button = row.getByRole('button', { name: buttonText });
    await this.basePage.click(button);
    Logger.debug(`Clicked "${buttonText}" button in row ${rowIndex}`);
  }

  /**
   * Select a checkbox in a specific row (if table has checkboxes).
   */
  async selectRow(rowIndex: number): Promise<void> {
    await this.waitForVisible();
    const rows = this.getRowsLocator();
    const row = rows.nth(rowIndex - 1);
    const checkbox = row.getByRole('checkbox').first();
    await checkbox.check();
    Logger.debug(`Selected row ${rowIndex}`);
  }

  /**
   * Deselect a checkbox in a specific row.
   */
  async deselectRow(rowIndex: number): Promise<void> {
    await this.waitForVisible();
    const rows = this.getRowsLocator();
    const row = rows.nth(rowIndex - 1);
    const checkbox = row.getByRole('checkbox').first();
    await checkbox.uncheck();
    Logger.debug(`Deselected row ${rowIndex}`);
  }

  /**
   * Check if a row is selected.
   */
  async isRowSelected(rowIndex: number): Promise<boolean> {
    const rows = this.getRowsLocator();
    const row = rows.nth(rowIndex - 1);
    const checkbox = row.getByRole('checkbox').first();
    return await checkbox.isChecked();
  }

  /**
   * Click a column header to sort.
   */
  async clickHeader(columnName: string | number): Promise<void> {
    await this.waitForVisible();

    if (typeof columnName === 'string') {
      const header = this.getHeadersLocator().getByText(columnName);
      await this.basePage.click(header);
      Logger.debug(`Clicked header "${columnName}"`);
    } else {
      const header = this.getHeadersLocator().nth(columnName - 1);
      await this.basePage.click(header);
      Logger.debug(`Clicked header at column ${columnName}`);
    }
  }

  /**
   * Get the headers locator for advanced operations.
   */
  private getHeadersLocator(): Locator {
    return this.getHeaderRowLocator().locator('th, td');
  }

  /**
   * Wait for the table to have data (at least one row).
   */
  async waitForData(timeout: number = 10000): Promise<void> {
    await this.waitForVisible();
    const rows = this.getRowsLocator();
    await rows.waitFor({ state: 'visible', timeout });
    Logger.debug('Table has data');
  }

  /**
   * Wait for the table to be empty (no data rows).
   */
  async waitForEmpty(timeout: number = 10000): Promise<void> {
    await this.waitForVisible();
    const rows = this.getRowsLocator();
    await rows.waitFor({ state: 'hidden', timeout });
    Logger.debug('Table is empty');
  }

  /**
   * Scroll to a specific row.
   */
  async scrollToRow(rowIndex: number): Promise<void> {
    const rows = this.getRowsLocator();
    const row = rows.nth(rowIndex - 1);
    await row.scrollIntoViewIfNeeded();
    Logger.debug(`Scrolled to row ${rowIndex}`);
  }

  /**
   * Get all data from the table as a 2D array.
   */
  async getAllData(): Promise<string[][]> {
    await this.waitForVisible();
    const rowCount = await this.getRowCount();
    const data: string[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const rowValues = await this.getRowValues(i);
      data.push(rowValues);
    }

    return data;
  }

  /**
   * Get all data as an array of objects (key-value pairs).
   */
  async getDataAsObjects(): Promise<Record<string, string>[]> {
    const headers = await this.getHeaders();
    const allRows = await this.getAllData();

    return allRows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  }

  /**
   * Verify table contains specific text.
   */
  async assertContains(text: string): Promise<void> {
    await this.waitForVisible();
    await expect(this.tableLocator).toContainText(text);
  }

  /**
   * Verify table does NOT contain specific text.
   */
  async assertNotContains(text: string): Promise<void> {
    await this.waitForVisible();
    await expect(this.tableLocator).not.toContainText(text);
  }

  /**
   * Verify row count.
   */
  async assertRowCount(expectedCount: number): Promise<void> {
    const actualCount = await this.getRowCount();
    expect(actualCount).toBe(expectedCount);
  }

  /**
   * Pagination methods (if table has pagination).
   */

  /**
   * Click "Next" page button.
   */
  async nextPage(): Promise<void> {
    const nextButton = this.tableLocator.getByRole('button', { name: /next|›|→/i });
    await this.basePage.click(nextButton);
    Logger.debug('Clicked next page');
  }

  /**
   * Click "Previous" page button.
   */
  async previousPage(): Promise<void> {
    const prevButton = this.tableLocator.getByRole('button', { name: /previous|‹|←/i });
    await this.basePage.click(prevButton);
    Logger.debug('Clicked previous page');
  }

  /**
   * Go to a specific page number.
   */
  async goToPage(pageNumber: number): Promise<void> {
    const pageButton = this.tableLocator.getByRole('button', { name: pageNumber.toString() });
    await this.basePage.click(pageButton);
    Logger.debug(`Navigated to page ${pageNumber}`);
  }

  /**
   * Get current page number (from pagination info).
   */
  async getCurrentPage(): Promise<number> {
    const pageIndicator = this.tableLocator.locator('.pagination-info, .page-info').first();
    const text = await pageIndicator.textContent();

    // Parse patterns like "Page 1 of 10" or "1-10 of 100"
    const match = text?.match(/page\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Get total pages count.
   */
  async getTotalPages(): Promise<number> {
    const pageIndicator = this.tableLocator.locator('.pagination-info, .page-info').first();
    const text = await pageIndicator.textContent();

    // Parse patterns like "Page 1 of 10"
    const match = text?.match(/of\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Export table data as CSV string.
   */
  async toCSV(): Promise<string> {
    const headers = await this.getHeaders();
    const data = await this.getAllData();

    // Escape CSV values
    const escape = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headerRow = headers.map(escape).join(',');
    const dataRows = data.map((row) => row.map(escape).join(','));

    return [headerRow, ...dataRows].join('\n');
  }
}
