import { Locator, Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';
import { Logger } from '../utils/Logger';

/**
 * Date format options.
 */
export type DateFormat = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'DD-MM-YYYY' | 'ISO';

/**
 * DatePicker Component - Reusable date picker component.
 *
 * Supports various date picker implementations:
 * - HTML5 date inputs
 * - Custom date pickers (calendar popups)
 * - Date range pickers
 * - Time pickers
 *
 * Example usage:
 * const datePicker = new DatePicker(page, page.locator('#birthdate'));
 * await datePicker.selectDate('1990-01-15');
 * await datePicker.selectDate(new Date(1990, 0, 15));
 * await datePicker.selectToday();
 */
export class DatePicker extends BaseComponent {
  private inputLocator: Locator;
  private calendarLocator?: Locator;
  private dateFormat: DateFormat;

  constructor(
    page: Page,
    rootLocator: Locator,
    options?: {
      calendarSelector?: string;
      dateFormat?: DateFormat;
    }
  ) {
    super(page, rootLocator);
    this.inputLocator = rootLocator;
    this.dateFormat = options?.dateFormat || 'YYYY-MM-DD';

    // Set up calendar locator if provided
    if (options?.calendarSelector) {
      this.calendarLocator = page.locator(options.calendarSelector);
    }
  }

  /**
   * Select a date by string (YYYY-MM-DD format recommended).
   */
  async selectDate(dateString: string): Promise<void> {
    await this.waitForVisible();

    // Check if it's a native HTML5 date input
    const isNative = (await this.inputLocator.getAttribute('type')) === 'date';

    if (isNative) {
      await this.inputLocator.fill(dateString);
      Logger.info(`Selected date via native input: ${dateString}`);
    } else {
      await this.openCalendar();
      await this.selectDateInCalendar(dateString);
    }
  }

  /**
   * Select a date using Date object.
   */
  async selectDateByDate(date: Date): Promise<void> {
    const formatted = this.formatDate(date);
    await this.selectDate(formatted);
  }

  /**
   * Select today's date.
   */
  async selectToday(): Promise<void> {
    await this.selectDateByDate(new Date());
    Logger.info('Selected today\'s date');
  }

  /**
   * Select date by day, month, year.
   */
  async selectDateByParts(day: number, month: number, year: number): Promise<void> {
    const date = new Date(year, month - 1, day);
    await this.selectDateByDate(date);
  }

  /**
   * Open the calendar popup.
   */
  async openCalendar(): Promise<void> {
    await this.waitForVisible();

    // Check if calendar is already open
    if (this.calendarLocator && await this.isCalendarOpen()) {
      return;
    }

    // Click the input or calendar icon to open
    await this.inputLocator.click();

    // Wait for calendar to appear
    if (this.calendarLocator) {
      await this.calendarLocator.waitFor({ state: 'visible', timeout: 3000 });
    } else {
      // Auto-detect calendar
      const calendar = this.inputLocator.page().locator('.calendar, .datepicker, [role="dialog"], .p-datepicker');
      await calendar.first().waitFor({ state: 'attached', timeout: 3000 });
      this.calendarLocator = calendar.first();
    }

    Logger.debug('Opened calendar');
  }

  /**
   * Close the calendar popup.
   */
  async closeCalendar(): Promise<void> {
    if (this.calendarLocator) {
      // Try clicking outside or pressing Escape
      await this.page.keyboard.press('Escape');
      await this.calendarLocator.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      Logger.debug('Closed calendar');
    }
  }

  /**
   * Check if calendar is open.
   */
  async isCalendarOpen(): Promise<boolean> {
    if (!this.calendarLocator) {
      return false;
    }

    const isVisible = await this.calendarLocator.isVisible().catch(() => false);
    return isVisible;
  }

  /**
   * Select date from calendar UI.
   */
  private async selectDateInCalendar(dateString: string): Promise<void> {
    if (!this.calendarLocator) {
      throw new Error('Calendar locator not set. Cannot select date in calendar.');
    }

    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    // Navigate to the correct month/year if needed
    await this.navigateToMonthYear(month, year);

    // Select the day
    const dayLocator = this.calendarLocator.locator(
      `[data-date="${day}"], .day, [aria-label*="${day}"], td:has-text("${day}")`
    );

    await this.basePage.click(dayLocator);
    Logger.info(`Selected date in calendar: ${dateString}`);
  }

  /**
   * Navigate calendar to specific month/year.
   */
  private async navigateToMonthYear(targetMonth: number, targetYear: number): Promise<void> {
    if (!this.calendarLocator) {
      return;
    }

    // Get current month/year from calendar
    const currentDisplay = await this.getCurrentCalendarMonthYear();

    const monthDiff = targetMonth - currentDisplay.month;
    const yearDiff = targetYear - currentDisplay.year;

    // Calculate total months to navigate
    const totalMonths = yearDiff * 12 + monthDiff;

    if (totalMonths === 0) {
      return; // Already on target month/year
    }

    // Find next/previous buttons
    const nextButton = this.calendarLocator.locator('.next, [aria-label*="next"], [data-action="next"]');
    const prevButton = this.calendarLocator.locator('.prev, [aria-label*="previous"], [data-action="prev"]');

    // Navigate using next or previous button
    const button = totalMonths > 0 ? nextButton : prevButton;
    const iterations = Math.abs(totalMonths);

    for (let i = 0; i < iterations; i++) {
      await button.first().click();
      // Small delay between clicks
      await this.page.waitForTimeout(50);
    }

    Logger.debug(`Navigated calendar to month ${targetMonth + 1}, year ${targetYear}`);
  }

  /**
   * Get current month/year displayed in calendar.
   */
  private async getCurrentCalendarMonthYear(): Promise<{ month: number; year: number }> {
    if (!this.calendarLocator) {
      return { month: new Date().getMonth(), year: new Date().getFullYear() };
    }

    const monthYearLocator = this.calendarLocator.locator('.month, .year, .calendar-header, h3, h4').first();
    const text = await monthYearLocator.textContent();

    if (!text) {
      return { month: new Date().getMonth(), year: new Date().getFullYear() };
    }

    // Parse common formats: "January 2024", "Jan 2024", "01/2024"
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];

    const lowerText = text.toLowerCase();
    let month = new Date().getMonth();
    let year = new Date().getFullYear();

    // Extract month
    for (let i = 0; i < monthNames.length; i++) {
      if (lowerText.includes(monthNames[i])) {
        month = i % 12;
        break;
      }
    }

    // Extract year
    const yearMatch = text.match(/\d{4}/);
    if (yearMatch) {
      year = parseInt(yearMatch[0], 10);
    }

    return { month, year };
  }

  /**
   * Get the selected date value.
   */
  async getValue(): Promise<string> {
    const value = await this.inputLocator.inputValue();
    return value;
  }

  /**
   * Get the selected date as Date object.
   */
  async getDate(): Promise<Date | null> {
    const value = await this.getValue();

    if (!value) {
      return null;
    }

    return new Date(value);
  }

  /**
   * Clear the date input.
   */
  async clear(): Promise<void> {
    await this.inputLocator.clear();
    Logger.debug('Cleared date input');
  }

  /**
   * Type date into input (for non-calendar inputs).
   */
  async typeDate(dateString: string): Promise<void> {
    await this.inputLocator.click();
    await this.inputLocator.fill(dateString);
    Logger.info(`Typed date: ${dateString}`);
  }

  /**
   * Select a date range (for date range pickers).
   */
  async selectDateRange(startDate: string, endDate: string): Promise<void> {
    await this.selectDate(startDate);

    // Some date range pickers require clicking end date
    await this.page.waitForTimeout(100);
    await this.selectDate(endDate);

    Logger.info(`Selected date range: ${startDate} to ${endDate}`);
  }

  /**
   * Format date according to configured format.
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (this.dateFormat) {
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      case 'ISO':
        return date.toISOString();
      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Set the date format for input/display.
   */
  setDateFormat(format: DateFormat): void {
    this.dateFormat = format;
  }

  /**
   * Get minimum date allowed (from min attribute).
   */
  async getMinDate(): Promise<string | null> {
    return await this.inputLocator.getAttribute('min');
  }

  /**
   * Get maximum date allowed (from max attribute).
   */
  async getMaxDate(): Promise<string | null> {
    return await this.inputLocator.getAttribute('max');
  }

  /**
   * Check if date is within allowed range.
   */
  async isDateValid(dateString: string): Promise<boolean> {
    const minDate = await this.getMinDate();
    const maxDate = await this.getMaxDate();
    const date = new Date(dateString);

    if (minDate && date < new Date(minDate)) {
      return false;
    }

    if (maxDate && date > new Date(maxDate)) {
      return false;
    }

    return true;
  }

  /**
   * Select date by week and day of week.
   * For example, select the third Monday of the month.
   */
  async selectByWeekOccurrence(dayOfWeek: number, occurrence: number): Promise<void> {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), 1);

    // Find the first occurrence of the day
    let found = 0;
    while (date.getDay() !== dayOfWeek) {
      date.setDate(date.getDate() + 1);
    }

    // Move to the desired occurrence
    date.setDate(date.getDate() + (occurrence - 1) * 7);

    await this.selectDateByDate(date);
    Logger.info(`Selected ${occurrence}${this.getOrdinalSuffix(occurrence)} ${this.getDayName(dayOfWeek)}`);
  }

  /**
   * Select date relative to today (e.g., +7 days, -30 days).
   */
  async selectRelativeDate(days: number): Promise<void> {
    const date = new Date();
    date.setDate(date.getDate() + days);
    await this.selectDateByDate(date);
    Logger.info(`Selected date ${days > 0 ? '+' : ''}${days} days from today`);
  }

  /**
   * Get ordinal suffix for number.
   */
  private getOrdinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  /**
   * Get day name from day number (0 = Sunday, 6 = Saturday).
   */
  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  }

  /**
   * Check if date input is disabled.
   */
  async isDisabled(): Promise<boolean> {
    return !(await this.inputLocator.isEnabled());
  }

  /**
   * Check if date input is read-only.
   */
  async isReadOnly(): Promise<boolean> {
    const readonly = await this.inputLocator.getAttribute('readonly');
    return readonly !== null;
  }

  /**
   * Focus the date input.
   */
  async focus(): Promise<void> {
    await this.inputLocator.focus();
    Logger.debug('Focused date input');
  }

  /**
   * Blur the date input.
   */
  async blur(): Promise<void> {
    await this.inputLocator.blur();
    Logger.debug('Blurred date input');
  }

  /**
   * Get placeholder text.
   */
  async getPlaceholder(): Promise<string | null> {
    return await this.inputLocator.getAttribute('placeholder');
  }
}

/**
 * TimePicker Component - Reusable time picker component.
 */
export class TimePicker extends BaseComponent {
  private inputLocator: Locator;
  private is24Hour: boolean;

  constructor(
    page: Page,
    rootLocator: Locator,
    options?: {
      is24Hour?: boolean;
    }
  ) {
    super(page, rootLocator);
    this.inputLocator = rootLocator;
    this.is24Hour = options?.is24Hour ?? false;
  }

  /**
   * Select time by string (HH:MM or HH:MM AM/PM format).
   */
  async selectTime(timeString: string): Promise<void> {
    await this.waitForVisible();

    // Check if it's a native HTML5 time input
    const isNative = (await this.inputLocator.getAttribute('type')) === 'time';

    if (isNative) {
      await this.inputLocator.fill(timeString);
      Logger.info(`Selected time via native input: ${timeString}`);
    } else {
      await this.selectTimeInUI(timeString);
    }
  }

  /**
   * Select time using hour, minute, and optional AM/PM.
   */
  async selectTimeByParts(hour: number, minute: number, period?: 'AM' | 'PM'): Promise<void> {
    const hourStr = String(hour).padStart(2, '0');
    const minuteStr = String(minute).padStart(2, '0');

    if (this.is24Hour) {
      await this.selectTime(`${hourStr}:${minuteStr}`);
    } else {
      await this.selectTime(`${hourStr}:${minuteStr} ${period || 'AM'}`);
    }
  }

  /**
   * Select current time.
   */
  async selectNow(): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    if (this.is24Hour) {
      await this.selectTimeByParts(hour, minute);
    } else {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      await this.selectTimeByParts(displayHour, minute, period);
    }

    Logger.info('Selected current time');
  }

  /**
   * Select time in custom UI.
   */
  private async selectTimeInUI(timeString: string): Promise<void> {
    // Open time picker
    await this.inputLocator.click();

    // Parse time string
    const [time, period] = timeString.split(' ');
    const [hour, minute] = time.split(':');

    // Select hour
    const hourLocator = this.page.locator(`[data-hour="${hour}"], .hour:has-text("${hour}")`);
    await this.basePage.click(hourLocator);

    // Select minute
    const minuteLocator = this.page.locator(`[data-minute="${minute}"], .minute:has-text("${minute}")`);
    await this.basePage.click(minuteLocator);

    // Select period if applicable
    if (period && !this.is24Hour) {
      const periodLocator = this.page.locator(`[data-period="${period}"], .period:has-text("${period}")`);
      await this.basePage.click(periodLocator);
    }

    Logger.info(`Selected time: ${timeString}`);
  }

  /**
   * Get the selected time value.
   */
  async getValue(): Promise<string> {
    return await this.inputLocator.inputValue();
  }

  /**
   * Clear the time input.
   */
  async clear(): Promise<void> {
    await this.inputLocator.clear();
    Logger.debug('Cleared time input');
  }

  /**
   * Check if time input is disabled.
   */
  async isDisabled(): Promise<boolean> {
    return !(await this.inputLocator.isEnabled());
  }

  /**
   * Set 24-hour format.
   */
  set24HourFormat(is24Hour: boolean): void {
    this.is24Hour = is24Hour;
  }
}
