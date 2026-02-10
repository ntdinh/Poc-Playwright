/**
 * TemplateStore - Phase 2: Learning
 *
 * Handles persistent storage of workflow templates.
 * Templates can be saved, loaded, searched, and managed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkflowTemplate, TemplateMatch } from './WorkflowTemplate';
import { Logger } from '../../Logger';

/**
 * Template Storage Options
 */
export interface TemplateStoreOptions {
  /** Base directory for template storage */
  baseDir: string;
  /** Create directory if not exists */
  createIfNotExists?: boolean;
}

/**
 * Template Index
 */
interface TemplateIndex {
  version: string;
  lastUpdated: number;
  templates: {
    id: string;
    name: string;
    goal: string;
    domain?: string;
    tags: string[];
    stepCount: number;
    successRate?: number;
    version: string;
    createdAt: number;
    updatedAt: number;
    file: string;
  }[];
}

/**
 * Template Store - Manages persistence of workflow templates
 *
 * Usage:
 * ```typescript
 * const store = new TemplateStore({ baseDir: './templates' });
 *
 * // Save a template
 * await store.save(template);
 *
 * // Load a template
 * const template = await store.load('template-id');
 *
 * // List all templates
 * const templates = await store.list();
 *
 * // Find templates matching a goal
 * const matches = await store.findByGoal('navigate to discover page');
 * ```
 */
export class TemplateStore {
  private options: TemplateStoreOptions;
  private indexPath: string;
  private templatesDir: string;

  constructor(options: TemplateStoreOptions) {
    this.options = {
      createIfNotExists: true,
      ...options
    };

    this.templatesDir = path.join(this.options.baseDir, 'templates');
    this.indexPath = path.join(this.options.baseDir, 'template-index.json');

    this.ensureDirectories();
  }

  /**
   * Save a template to storage
   */
  async save(template: WorkflowTemplate): Promise<string> {
    const filePath = this.getTemplatePath(template.id);

    // Save template file
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2));

    // Update index
    await this.updateIndex({
      id: template.id,
      name: template.name,
      goal: template.goal,
      domain: template.domain,
      tags: template.tags,
      stepCount: template.steps.length,
      successRate: template.successRate,
      version: template.version,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      file: path.basename(filePath)
    });

    Logger.info(`💾 Saved template: ${template.name} (${template.steps.length} steps)`);
    Logger.info(`   File: ${filePath}`);

    return filePath;
  }

  /**
   * Load a template by ID
   */
  async load(templateId: string): Promise<WorkflowTemplate | null> {
    const filePath = this.getTemplatePath(templateId);

    if (!fs.existsSync(filePath)) {
      Logger.warn(`Template not found: ${templateId}`);
      return null;
    }

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      Logger.error(`Failed to load template ${templateId}: ${error}`);
      return null;
    }
  }

  /**
   * Delete a template by ID
   */
  async delete(templateId: string): Promise<boolean> {
    const filePath = this.getTemplatePath(templateId);

    if (!fs.existsSync(filePath)) {
      Logger.warn(`Template not found: ${templateId}`);
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      await this.removeFromIndex(templateId);

      Logger.info(`🗑️ Deleted template: ${templateId}`);
      return true;
    } catch (error) {
      Logger.error(`Failed to delete template ${templateId}: ${error}`);
      return false;
    }
  }

  /**
   * List all templates
   */
  async list(): Promise<TemplateIndex['templates']> {
    const index = this.loadIndex();
    return index.templates;
  }

  /**
   * Find templates by goal (fuzzy search)
   */
  async findByGoal(goal: string): Promise<TemplateMatch[]> {
    const index = this.loadIndex();
    const matches: TemplateMatch[] = [];

    for (const templateInfo of index.templates) {
      const similarity = this.calculateSimilarity(goal, templateInfo.goal);

      if (similarity > 0.3) {
        const template = await this.load(templateInfo.id);
        if (template) {
          matches.push({
            template,
            matchScore: similarity,
            requiredVariables: template.variables || [],
            matchReasons: this.getMatchReasons(goal, templateInfo.goal)
          });
        }
      }
    }

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches;
  }

  /**
   * Find templates by domain
   */
  async findByDomain(domain: string): Promise<WorkflowTemplate[]> {
    const index = this.loadIndex();
    const matchingIds = index.templates
      .filter(t => t.domain === domain)
      .map(t => t.id);

    const templates: WorkflowTemplate[] = [];
    for (const id of matchingIds) {
      const template = await this.load(id);
      if (template) {
        templates.push(template);
      }
    }

    return templates;
  }

  /**
   * Find templates by tag
   */
  async findByTag(tag: string): Promise<WorkflowTemplate[]> {
    const index = this.loadIndex();
    const matchingIds = index.templates
      .filter(t => t.tags.includes(tag))
      .map(t => t.id);

    const templates: WorkflowTemplate[] = [];
    for (const id of matchingIds) {
      const template = await this.load(id);
      if (template) {
        templates.push(template);
      }
    }

    return templates;
  }

  /**
   * Find templates by name
   */
  async findByName(name: string): Promise<WorkflowTemplate | null> {
    const index = this.loadIndex();
    const match = index.templates.find(t =>
      t.name.toLowerCase() === name.toLowerCase()
    );

    if (match) {
      return this.load(match.id);
    }

    return null;
  }

  /**
   * Update template statistics
   */
  async updateStats(
    templateId: string,
    stats: {
      success?: boolean;
      incrementAttempts?: boolean;
    }
  ): Promise<void> {
    const template = await this.load(templateId);
    if (!template) return;

    if (stats.incrementAttempts) {
      template.attemptCount = (template.attemptCount || 0) + 1;
    }

    if (stats.success) {
      template.successCount = (template.successCount || 0) + 1;
    }

    // Recalculate success rate
    if (template.attemptCount && template.attemptCount > 0) {
      template.successRate = (template.successCount || 0) / template.attemptCount;
    }

    template.updatedAt = Date.now();

    await this.save(template);
  }

  /**
   * Get best template for a goal
   */
  async getBestTemplate(goal: string): Promise<TemplateMatch | null> {
    const matches = await this.findByGoal(goal);

    if (matches.length === 0) {
      return null;
    }

    // Prefer templates with higher success rate
    const withSuccessRate = matches.filter(m => m.template.successRate !== undefined);

    if (withSuccessRate.length > 0) {
      return withSuccessRate.sort((a, b) =>
        (b.template.successRate || 0) - (a.template.successRate || 0)
      )[0];
    }

    return matches[0];
  }

  /**
   * Export template as JSON string
   */
  async exportAsJSON(templateId: string): Promise<string | null> {
    const template = await this.load(templateId);
    if (!template) return null;

    return JSON.stringify(template, null, 2);
  }

  /**
   * Import template from JSON string
   */
  async importFromJSON(jsonString: string): Promise<WorkflowTemplate | null> {
    try {
      const template: WorkflowTemplate = JSON.parse(jsonString);

      // Validate required fields
      if (!template.id || !template.name || !template.goal) {
        throw new Error('Invalid template: missing required fields');
      }

      // Save to storage
      await this.save(template);

      return template;
    } catch (error) {
      Logger.error(`Failed to import template: ${error}`);
      return null;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalTemplates: number;
    totalSteps: number;
    domains: { [key: string]: number };
    tags: { [key: string]: number };
    averageSuccessRate: number;
  }> {
    const index = this.loadIndex();

    const domains: { [key: string]: number } = {};
    const tags: { [key: string]: number } = {};
    let totalSteps = 0;
    let totalSuccessRate = 0;
    let successRateCount = 0;

    for (const template of index.templates) {
      totalSteps += template.stepCount;

      if (template.domain) {
        domains[template.domain] = (domains[template.domain] || 0) + 1;
      }

      for (const tag of template.tags) {
        tags[tag] = (tags[tag] || 0) + 1;
      }

      if (template.successRate !== undefined) {
        totalSuccessRate += template.successRate;
        successRateCount++;
      }
    }

    return {
      totalTemplates: index.templates.length,
      totalSteps,
      domains,
      tags,
      averageSuccessRate: successRateCount > 0 ? totalSuccessRate / successRateCount : 0
    };
  }

  /**
   * Clear all templates (use with caution!)
   */
  async clear(): Promise<void> {
    const files = fs.readdirSync(this.templatesDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(this.templatesDir, file));
      }
    }

    this.saveIndex({
      version: '1.0.0',
      lastUpdated: Date.now(),
      templates: []
    });

    Logger.info('🗑️ Cleared all templates');
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Exact match
    if (s1 === s2) return 1.0;

    // Contains match
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Word overlap
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Get reasons for template match
   */
  private getMatchReasons(goal: string, templateGoal: string): string[] {
    const reasons: string[] = [];
    const g = goal.toLowerCase();
    const tg = templateGoal.toLowerCase();

    if (g === tg) {
      reasons.push('Exact goal match');
    } else if (g.includes(tg) || tg.includes(g)) {
      reasons.push('Similar goal');
    }

    const goalWords = new Set(g.split(/\s+/));
    const templateWords = new Set(tg.split(/\s+/));

    const common = [...goalWords].filter(w => templateWords.has(w));
    if (common.length > 0) {
      reasons.push(`Common keywords: ${common.join(', ')}`);
    }

    return reasons;
  }

  /**
   * Get file path for a template
   */
  private getTemplatePath(templateId: string): string {
    return path.join(this.templatesDir, `${templateId}.json`);
  }

  /**
   * Ensure directories exist
   */
  private ensureDirectories(): void {
    if (this.options.createIfNotExists && !fs.existsSync(this.options.baseDir)) {
      fs.mkdirSync(this.options.baseDir, { recursive: true });
    }

    if (this.options.createIfNotExists && !fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  /**
   * Load index file
   */
  private loadIndex(): TemplateIndex {
    if (!fs.existsSync(this.indexPath)) {
      return {
        version: '1.0.0',
        lastUpdated: Date.now(),
        templates: []
      };
    }

    try {
      const data = fs.readFileSync(this.indexPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      Logger.warn(`Failed to load index, creating new one: ${error}`);
      return {
        version: '1.0.0',
        lastUpdated: Date.now(),
        templates: []
      };
    }
  }

  /**
   * Save index file
   */
  private saveIndex(index: TemplateIndex): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Update index with a new template
   */
  private async updateIndex(templateInfo: TemplateIndex['templates'][0]): Promise<void> {
    const index = this.loadIndex();

    // Remove existing entry with same ID
    index.templates = index.templates.filter(t => t.id !== templateInfo.id);

    // Add new entry
    index.templates.push(templateInfo);
    index.lastUpdated = Date.now();

    this.saveIndex(index);
  }

  /**
   * Remove template from index
   */
  private async removeFromIndex(templateId: string): Promise<void> {
    const index = this.loadIndex();
    index.templates = index.templates.filter(t => t.id !== templateId);
    index.lastUpdated = Date.now();
    this.saveIndex(index);
  }
}

/**
 * Factory function to create a TemplateStore
 */
export function createTemplateStore(baseDir: string): TemplateStore {
  return new TemplateStore({ baseDir });
}
