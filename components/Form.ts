import { Locator, Page, expect } from '@playwright/test';
import { BaseComponent } from './BaseComponent';
import { Input } from './Input';
import { Button } from './Button';
import { Logger } from '../utils/Logger';

/**
 * Form Field configuration for dynamic form handling.
 */
export interface FormField {
  name: string;
  label?: string;
  type: 'text' | 'email' | 'password' | 'number' | 'checkbox' | 'radio' | 'select' | 'textarea' | 'file';
  locator?: Locator;
  required?: boolean;
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

/**
 * Form data structure.
 */
export interface FormData {
  [fieldName: string]: string | boolean | number;
}

/**
 * Form Component - Reusable form component with validation support.
 *
 * Handles various form types including:
 * - Simple forms with inputs
 * - Multi-step forms
 * - Forms with validation
 * - Dynamic forms
 *
 * Example usage:
 * const form = new Form(page, page.locator('form[name="login"]'));
 * await form.fillField('username', 'testuser');
 * await form.fillField('password', 'password123');
 * await form.submit();
 *
 * Or with predefined fields:
 * const form = new Form(page, page.locator('form'), {
 *   fields: [
 *     { name: 'username', type: 'text', locator: page.locator('#username') },
 *     { name: 'password', type: 'password', locator: page.locator('#password') }
 *   ]
 * });
 */
export class Form extends BaseComponent {
  private formLocator: Locator;
  private submitButtonLocator?: Locator;
  private cancelButtonLocator?: Locator;
  private fields?: Map<string, FormField>;

  constructor(
    page: Page,
    rootLocator: Locator,
    options?: {
      submitSelector?: string | Locator;
      cancelSelector?: string | Locator;
      fields?: FormField[];
    }
  ) {
    super(page, rootLocator);
    this.formLocator = rootLocator;

    // Set up submit button
    if (options?.submitSelector) {
      this.submitButtonLocator =
        typeof options.submitSelector === 'string'
          ? rootLocator.locator(options.submitSelector)
          : options.submitSelector;
    } else {
      // Default: find submit button within form
      this.submitButtonLocator = rootLocator.getByRole('button', { name: /submit|save|continue|next/i }).first();
    }

    // Set up cancel button
    if (options?.cancelSelector) {
      this.cancelButtonLocator =
        typeof options.cancelSelector === 'string'
          ? rootLocator.locator(options.cancelSelector)
          : options.cancelSelector;
    }

    // Set up fields map if provided
    if (options?.fields) {
      this.fields = new Map();
      for (const field of options.fields) {
        this.fields.set(field.name, field);
      }
    }
  }

  /**
   * Fill a form field by name.
   * Automatically detects field type and uses appropriate method.
   */
  async fillField(fieldName: string, value: string | boolean | number): Promise<void> {
    await this.waitForVisible();

    const field = this.fields?.get(fieldName);
    const locator = field?.locator || this.getFieldLocator(fieldName);

    Logger.debug(`Filling field "${fieldName}" with value: ${value}`);

    // Handle different field types
    const fieldType = field?.type || await this.guessFieldType(locator);

    switch (fieldType) {
      case 'checkbox':
        await locator.setChecked(Boolean(value));
        break;
      case 'radio':
        await locator.check();
        break;
      case 'select':
        await locator.selectOption(value.toString());
        break;
      case 'file':
        await locator.setInputFiles(value.toString());
        break;
      default:
        await locator.fill(value.toString());
    }
  }

  /**
   * Fill multiple fields at once.
   */
  async fillFields(data: FormData): Promise<void> {
    for (const [fieldName, value] of Object.entries(data)) {
      await this.fillField(fieldName, value);
    }
  }

  /**
   * Get the value of a field.
   */
  async getFieldValue(fieldName: string): Promise<string | boolean> {
    await this.waitForVisible();

    const field = this.fields?.get(fieldName);
    const locator = field?.locator || this.getFieldLocator(fieldName);

    const fieldType = field?.type || await this.guessFieldType(locator);

    switch (fieldType) {
      case 'checkbox':
      case 'radio':
        return await locator.isChecked();
      case 'select':
        return await locator.inputValue();
      default:
        return await locator.inputValue();
    }
  }

  /**
   * Clear a field.
   */
  async clearField(fieldName: string): Promise<void> {
    await this.waitForVisible();

    const field = this.fields?.get(fieldName);
    const locator = field?.locator || this.getFieldLocator(fieldName);

    await locator.clear();
    Logger.debug(`Cleared field "${fieldName}"`);
  }

  /**
   * Clear all fields in the form.
   */
  async clearAllFields(): Promise<void> {
    await this.waitForVisible();

    const inputs = this.formLocator.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');

    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      await inputs.nth(i).clear();
    }

    Logger.debug('Cleared all form fields');
  }

  /**
   * Submit the form.
   */
  async submit(): Promise<void> {
    await this.waitForVisible();

    if (this.submitButtonLocator) {
      await this.basePage.click(this.submitButtonLocator);
      Logger.info('Form submitted via submit button');
    } else {
      // Try pressing Enter on form
      await this.formLocator.press('Enter');
      Logger.info('Form submitted via Enter key');
    }
  }

  /**
   * Cancel the form.
   */
  async cancel(): Promise<void> {
    await this.waitForVisible();

    if (this.cancelButtonLocator) {
      await this.basePage.click(this.cancelButtonLocator);
      Logger.info('Form cancelled');
    } else {
      throw new Error('Cancel button not found');
    }
  }

  /**
   * Reset the form to default values.
   */
  async reset(): Promise<void> {
    await this.waitForVisible();

    const resetButton = this.formLocator.getByRole('button', { name: /reset|clear/i });
    const count = await resetButton.count();

    if (count > 0) {
      await resetButton.first().click();
      Logger.info('Form reset');
    } else {
      await this.clearAllFields();
      Logger.info('Form cleared (no reset button found)');
    }
  }

  /**
   * Check if a field is required.
   */
  async isFieldRequired(fieldName: string): Promise<boolean> {
    const field = this.fields?.get(fieldName);
    const locator = field?.locator || this.getFieldLocator(fieldName);

    const required = await locator.getAttribute('required');
    return required !== null;
  }

  /**
   * Check if a field is visible.
   */
  async isFieldVisible(fieldName: string): Promise<boolean> {
    const field = this.fields?.get(fieldName);
    const locator = field?.locator || this.getFieldLocator(fieldName);

    return await this.basePage.isVisible(locator);
  }

  /**
   * Check if a field is enabled.
   */
  async isFieldEnabled(fieldName: string): Promise<boolean> {
    const field = this.fields?.get(fieldName);
    const locator = field?.locator || this.getFieldLocator(fieldName);

    return await this.basePage.isEnabled(locator);
  }

  /**
   * Get validation error message for a field.
   */
  async getFieldError(fieldName: string): Promise<string> {
    const field = this.fields?.get(fieldName);
    let errorLocator: Locator;

    if (field?.locator) {
      // Try common error locator patterns near the field
      errorLocator = field.locator.page().getByText(/error|invalid|required/i, { exact: false });
    } else {
      const locator = this.getFieldLocator(fieldName);
      // Try to find error message near the field
      errorLocator = this.formLocator
        .locator(`.error, .validation-error, [data-testid*="${fieldName}-error"], [data-error*="${fieldName}"]`)
        .filter({ hasText: /./ });
    }

    const text = await errorLocator.first().textContent();
    return text || '';
  }

  /**
   * Check if field has validation error.
   */
  async hasFieldError(fieldName: string): Promise<boolean> {
    const error = await this.getFieldError(fieldName);
    return error.length > 0;
  }

  /**
   * Get all form errors.
   */
  async getFormErrors(): Promise<string[]> {
    const errorSelectors = [
      '.error',
      '.validation-error',
      '[data-error]',
      '.field-error',
      '.input-error',
    ];

    const errors: string[] = [];

    for (const selector of errorSelectors) {
      const errorElements = this.formLocator.locator(selector);
      const count = await errorElements.count();

      for (let i = 0; i < count; i++) {
        const text = await errorElements.nth(i).textContent();
        if (text && text.trim().length > 0) {
          errors.push(text.trim());
        }
      }
    }

    return errors;
  }

  /**
   * Check if form has any errors.
   */
  async hasErrors(): Promise<boolean> {
    const errors = await this.getFormErrors();
    return errors.length > 0;
  }

  /**
   * Validate form against predefined field rules.
   */
  async validate(): Promise<{ valid: boolean; errors: Record<string, string> }> {
    const errors: Record<string, string> = {};

    if (!this.fields) {
      return { valid: true, errors: {} };
    }

    for (const [fieldName, field] of this.fields) {
      const value = await this.getFieldValue(fieldName);
      const valueStr = String(value);

      // Check required fields
      if (field.required && !valueStr) {
        errors[fieldName] = `${field.label || fieldName} is required`;
        continue;
      }

      // Skip validation if field is empty and not required
      if (!valueStr) continue;

      // Apply validation rules
      if (field.validation) {
        const { pattern, minLength, maxLength, min, max } = field.validation;

        if (pattern && !pattern.test(valueStr)) {
          errors[fieldName] = `${field.label || fieldName} format is invalid`;
        }

        if (minLength && valueStr.length < minLength) {
          errors[fieldName] = `${field.label || fieldName} must be at least ${minLength} characters`;
        }

        if (maxLength && valueStr.length > maxLength) {
          errors[fieldName] = `${field.label || fieldName} must be at most ${maxLength} characters`;
        }

        if (min !== undefined && Number(value) < min) {
          errors[fieldName] = `${field.label || fieldName} must be at least ${min}`;
        }

        if (max !== undefined && Number(value) > max) {
          errors[fieldName] = `${field.label || fieldName} must be at most ${max}`;
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Get form data as an object.
   */
  async getData(): Promise<FormData> {
    await this.waitForVisible();

    const data: FormData = {};

    if (this.fields) {
      for (const [fieldName] of this.fields) {
        data[fieldName] = await this.getFieldValue(fieldName);
      }
    } else {
      // Auto-detect all input fields
      const inputs = this.formLocator.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
      const count = await inputs.count();

      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const name = await input.getAttribute('name');

        if (name) {
          const type = await input.getAttribute('type');
          if (type === 'checkbox' || type === 'radio') {
            data[name] = await input.isChecked();
          } else {
            data[name] = await input.inputValue();
          }
        }
      }
    }

    return data;
  }

  /**
   * Assert form is valid (no errors).
   */
  async assertValid(): Promise<void> {
    const hasErrors = await this.hasErrors();
    expect(hasErrors).toBeFalsy();

    const validation = await this.validate();
    expect(validation.valid).toBeTruthy();
  }

  /**
   * Assert form has errors.
   */
  async assertHasErrors(): Promise<void> {
    const hasErrors = await this.hasErrors();
    expect(hasErrors).toBeTruthy();
  }

  /**
   * Assert specific field has error.
   */
  async assertFieldHasError(fieldName: string): Promise<void> {
    const hasError = await this.hasFieldError(fieldName);
    expect(hasError).toBeTruthy();
  }

  /**
   * Wait for form to be submitted (URL change or success message).
   */
  async waitForSubmit(timeout: number = 10000): Promise<void> {
    // This is a basic implementation - override for specific use cases
    await this.page.waitForTimeout(500);
    Logger.debug('Waiting for form submission...');
  }

  /**
   * Helper method to get field locator by name.
   */
  private getFieldLocator(fieldName: string): Locator {
    // Try different strategies to find the field
    return this.formLocator.locator(
      `[name="${fieldName}"], [id="${fieldName}"], [data-testid="${fieldName}"], [data-field="${fieldName}"]`
    ).first();
  }

  /**
   * Guess field type from element attributes.
   */
  private async guessFieldType(locator: Locator): Promise<FormField['type']> {
    const tag = await locator.evaluate((el) => el.tagName.toLowerCase());
    const typeAttr = await locator.getAttribute('type');

    if (tag === 'input') {
      switch (typeAttr) {
        case 'checkbox':
          return 'checkbox';
        case 'radio':
          return 'radio';
        case 'file':
          return 'file';
        case 'email':
          return 'email';
        case 'password':
          return 'password';
        case 'number':
          return 'number';
        default:
          return 'text';
      }
    }

    if (tag === 'select') {
      return 'select';
    }

    if (tag === 'textarea') {
      return 'textarea';
    }

    return 'text';
  }

  /**
   * Multi-step form support.
   */
  async goToStep(stepNumber: number): Promise<void> {
    // Common patterns: "Next", "Continue", "Step X" buttons
    const stepButton = this.formLocator.getByRole('button', {
      name: new RegExp(`step ${stepNumber}|${stepNumber}`, 'i'),
    });

    const count = await stepButton.count();
    if (count > 0) {
      await stepButton.first().click();
      Logger.debug(`Navigated to step ${stepNumber}`);
    } else {
      Logger.warn(`Step button for step ${stepNumber} not found`);
    }
  }

  /**
   * Get current step number (for multi-step forms).
   */
  async getCurrentStep(): Promise<number> {
    const stepIndicator = this.formLocator.locator(
      '[data-step], .step-indicator, .form-step, .wizard-step'
    );

    const activeStep = stepIndicator.locator('.active, [data-active="true"], .current');

    const stepAttr = await activeStep.getAttribute('data-step');
    if (stepAttr) {
      return parseInt(stepAttr, 10);
    }

    // Try to parse from text content
    const text = await activeStep.textContent();
    const match = text?.match(/step\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Upload file to a file input field.
   */
  async uploadFile(fieldName: string, filePath: string): Promise<void> {
    const field = this.fields?.get(fieldName);
    const locator = field?.locator || this.getFieldLocator(fieldName);

    await locator.setInputFiles(filePath);
    Logger.debug(`Uploaded file to field "${fieldName}": ${filePath}`);
  }

  /**
   * Select option from a dropdown/select field.
   */
  async selectOption(fieldName: string, option: string | { label?: string; value?: string }): Promise<void> {
    const field = this.fields?.get(fieldName);
    const locator = field?.locator || this.getFieldLocator(fieldName);

    if (typeof option === 'string') {
      await locator.selectOption(option);
    } else {
      await locator.selectOption(option);
    }

    Logger.debug(`Selected option in field "${fieldName}": ${JSON.stringify(option)}`);
  }

  /**
   * Get selected option from a select field.
   */
  async getSelectedOption(fieldName: string): Promise<string> {
    const field = this.fields?.get(fieldName);
    const locator = field?.locator || this.getFieldLocator(fieldName);

    return await locator.inputValue();
  }
}
