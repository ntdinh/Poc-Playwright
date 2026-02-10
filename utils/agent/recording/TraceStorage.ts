/**
 * TraceStorage - Phase 1: Recording
 *
 * Handles persistent storage of recorded traces.
 * Traces are saved to disk and can be loaded for Pattern Learning (Phase 2).
 */

import * as fs from 'fs';
import * as path from 'path';
import { RecordedTrace, TraceExport } from './RecordedAction';
import { Logger } from '../../Logger';

/**
 * Trace Storage Options
 */
export interface TraceStorageOptions {
  /** Base directory for trace storage */
  baseDir: string;
  /** Create directory if not exists */
  createIfNotExists?: boolean;
}

/**
 * Trace Storage Index
 */
interface TraceIndex {
  version: string;
  lastUpdated: number;
  traces: {
    id: string;
    name: string;
    goal: string;
    domain?: string;
    tags: string[];
    actionCount: number;
    recordedAt: number;
    file: string;
  }[];
}

/**
 * Trace Storage - Manages persistence of recorded traces
 *
 * Usage:
 * ```typescript
 * const storage = new TraceStorage({ baseDir: './recordings' });
 *
 * // Save a trace
 * await storage.save(trace);
 *
 * // Load a trace
 * const trace = await storage.load('trace-id');
 *
 * // List all traces
 * const traces = await storage.list();
 *
 * // Search traces
 * const results = await storage.search({ goal: 'navigate to discover' });
 * ```
 */
export class TraceStorage {
  private options: TraceStorageOptions;
  private indexPath: string;
  private tracesDir: string;

  constructor(options: TraceStorageOptions) {
    this.options = {
      createIfNotExists: true,
      ...options
    };

    this.tracesDir = path.join(this.options.baseDir, 'traces');
    this.indexPath = path.join(this.options.baseDir, 'index.json');

    this.ensureDirectories();
  }

  /**
   * Save a trace to storage
   */
  async save(trace: RecordedTrace): Promise<string> {
    const filePath = this.getTracePath(trace.id);

    // Create export with metadata
    const exportData: TraceExport = {
      version: '1.0.0',
      exportedAt: Date.now(),
      trace,
      metadata: {
        playwrightVersion: await this.getPlaywrightVersion(),
        os: process.platform,
        browser: undefined
      }
    };

    // Save trace file
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));

    // Update index
    await this.updateIndex({
      id: trace.id,
      name: trace.name,
      goal: trace.goal,
      domain: trace.domain,
      tags: trace.tags,
      actionCount: trace.actions.length,
      recordedAt: trace.startTime,
      file: path.basename(filePath)
    });

    Logger.info(`💾 Saved trace: ${trace.name} (${trace.actions.length} actions)`);
    Logger.info(`   File: ${filePath}`);

    return filePath;
  }

  /**
   * Load a trace by ID
   */
  async load(traceId: string): Promise<RecordedTrace | null> {
    const filePath = this.getTracePath(traceId);

    if (!fs.existsSync(filePath)) {
      Logger.warn(`Trace not found: ${traceId}`);
      return null;
    }

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const exported: TraceExport = JSON.parse(data);

      return exported.trace;
    } catch (error) {
      Logger.error(`Failed to load trace ${traceId}: ${error}`);
      return null;
    }
  }

  /**
   * Delete a trace by ID
   */
  async delete(traceId: string): Promise<boolean> {
    const filePath = this.getTracePath(traceId);

    if (!fs.existsSync(filePath)) {
      Logger.warn(`Trace not found: ${traceId}`);
      return false;
    }

    try {
      fs.unlinkSync(filePath);

      // Update index
      await this.removeFromIndex(traceId);

      Logger.info(`🗑️ Deleted trace: ${traceId}`);
      return true;
    } catch (error) {
      Logger.error(`Failed to delete trace ${traceId}: ${error}`);
      return false;
    }
  }

  /**
   * List all traces
   */
  async list(): Promise<TraceIndex['traces']> {
    const index = this.loadIndex();
    return index.traces;
  }

  /**
   * Search traces by criteria
   */
  async search(criteria: {
    goal?: string;
    domain?: string;
    tags?: string[];
    name?: string;
    minActions?: number;
  }): Promise<RecordedTrace[]> {
    const index = this.loadIndex();
    const matchingIds = index.traces.filter(t => {
      if (criteria.goal && !t.goal.toLowerCase().includes(criteria.goal.toLowerCase())) {
        return false;
      }
      if (criteria.domain && t.domain !== criteria.domain) {
        return false;
      }
      if (criteria.tags && !criteria.tags.every(tag => t.tags.includes(tag))) {
        return false;
      }
      if (criteria.name && !t.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      if (criteria.minActions && t.actionCount < criteria.minActions) {
        return false;
      }
      return true;
    }).map(t => t.id);

    // Load matching traces
    const traces: RecordedTrace[] = [];
    for (const id of matchingIds) {
      const trace = await this.load(id);
      if (trace) {
        traces.push(trace);
      }
    }

    return traces;
  }

  /**
   * Get traces by domain
   */
  async getByDomain(domain: string): Promise<RecordedTrace[]> {
    return this.search({ domain });
  }

  /**
   * Get traces by tag
   */
  async getByTag(tag: string): Promise<RecordedTrace[]> {
    return this.search({ tags: [tag] });
  }

  /**
   * Export trace as JSON string
   */
  async exportAsJSON(traceId: string): Promise<string | null> {
    const trace = await this.load(traceId);
    if (!trace) return null;

    const exportData: TraceExport = {
      version: '1.0.0',
      exportedAt: Date.now(),
      trace,
      metadata: {
        playwrightVersion: await this.getPlaywrightVersion(),
        os: process.platform
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import trace from JSON string
   */
  async importFromJSON(jsonString: string): Promise<RecordedTrace | null> {
    try {
      const exported: TraceExport = JSON.parse(jsonString);

      // Validate
      if (!exported.trace || !exported.trace.id) {
        throw new Error('Invalid trace format');
      }

      // Save to storage
      await this.save(exported.trace);

      return exported.trace;
    } catch (error) {
      Logger.error(`Failed to import trace: ${error}`);
      return null;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalTraces: number;
    totalActions: number;
    domains: { [key: string]: number };
    tags: { [key: string]: number };
  }> {
    const index = this.loadIndex();

    const domains: { [key: string]: number } = {};
    const tags: { [key: string]: number } = {};
    let totalActions = 0;

    for (const trace of index.traces) {
      totalActions += trace.actionCount;

      if (trace.domain) {
        domains[trace.domain] = (domains[trace.domain] || 0) + 1;
      }

      for (const tag of trace.tags) {
        tags[tag] = (tags[tag] || 0) + 1;
      }
    }

    return {
      totalTraces: index.traces.length,
      totalActions,
      domains,
      tags
    };
  }

  /**
   * Clear all traces (use with caution!)
   */
  async clear(): Promise<void> {
    const files = fs.readdirSync(this.tracesDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(this.tracesDir, file));
      }
    }

    // Clear index
    this.saveIndex({
      version: '1.0.0',
      lastUpdated: Date.now(),
      traces: []
    });

    Logger.info('🗑️ Cleared all traces');
  }

  /**
   * Get file path for a trace
   */
  private getTracePath(traceId: string): string {
    return path.join(this.tracesDir, `${traceId}.json`);
  }

  /**
   * Ensure directories exist
   */
  private ensureDirectories(): void {
    if (this.options.createIfNotExists && !fs.existsSync(this.options.baseDir)) {
      fs.mkdirSync(this.options.baseDir, { recursive: true });
    }

    if (this.options.createIfNotExists && !fs.existsSync(this.tracesDir)) {
      fs.mkdirSync(this.tracesDir, { recursive: true });
    }
  }

  /**
   * Load index file
   */
  private loadIndex(): TraceIndex {
    if (!fs.existsSync(this.indexPath)) {
      return {
        version: '1.0.0',
        lastUpdated: Date.now(),
        traces: []
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
        traces: []
      };
    }
  }

  /**
   * Save index file
   */
  private saveIndex(index: TraceIndex): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Update index with a new trace
   */
  private async updateIndex(traceInfo: TraceIndex['traces'][0]): Promise<void> {
    const index = this.loadIndex();

    // Remove existing entry with same ID
    index.traces = index.traces.filter(t => t.id !== traceInfo.id);

    // Add new entry
    index.traces.push(traceInfo);
    index.lastUpdated = Date.now();

    this.saveIndex(index);
  }

  /**
   * Remove trace from index
   */
  private async removeFromIndex(traceId: string): Promise<void> {
    const index = this.loadIndex();
    index.traces = index.traces.filter(t => t.id !== traceId);
    index.lastUpdated = Date.now();
    this.saveIndex(index);
  }

  /**
   * Get Playwright version
   */
  private async getPlaywrightVersion(): Promise<string> {
    try {
      const pkgPath = path.join(process.cwd(), 'node_modules', '@playwright', 'test', 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return pkg.version;
      }
    } catch {
      // Ignore
    }
    return 'unknown';
  }
}

/**
 * Factory function to create a TraceStorage
 */
export function createTraceStorage(baseDir: string): TraceStorage {
  return new TraceStorage({ baseDir });
}
