/**
 * Recording Types - Phase 1: Recording
 *
 * Types for capturing user actions and traces that will be used
 * by the Pattern Learner (Phase 2) to generate templates.
 */

import { DOMElement } from '../types';

/**
 * A single action recorded during human demonstration
 * Combines Playwright's captured action with context
 */
export interface RecordedAction {
  /** Sequential index in the trace */
  index: number;
  /** Timestamp when action occurred */
  timestamp: number;
  /** Action type from Playwright */
  type: 'click' | 'fill' | 'select' | 'navigate' | 'check' | 'uncheck' | 'press' | 'hover';
  /** The selector used (Playwright format) */
  selector: string;
  /** User-friendly description of the action */
  description: string;
  /** Value filled (for fill actions) */
  value?: string;
  /** Option selected (for select actions) */
  option?: string;
  /** URL navigated to (for navigate actions) */
  url?: string;
  /** Key pressed (for press actions) */
  key?: string;
  /** Screenshot BEFORE action (for context) */
  beforeScreenshot?: string;
  /** Screenshot AFTER action (for result) */
  afterScreenshot?: string;
  /** DOM snapshot at action time */
  domSnapshot?: DOMElement[];
  /** Page URL at action time */
  pageUrl: string;
  /** Element text content for semantic understanding */
  elementText?: string;
  /** Element role for semantic understanding */
  elementRole?: string;
  /** Element accessible name for semantic understanding */
  accessibleName?: string;
}

/**
 * A complete trace recorded from human demonstration
 * Represents one full workflow execution
 */
export interface RecordedTrace {
  /** Unique trace identifier */
  id: string;
  /** Human-readable name for this trace */
  name: string;
  /** Description of what this workflow does */
  description: string;
  /** The goal/intent of this workflow */
  goal: string;
  /** Starting URL */
  startUrl: string;
  /** All actions in sequence */
  actions: RecordedAction[];
  /** Final screenshot */
  finalScreenshot?: string;
  /** Timestamp when recording started */
  startTime: number;
  /** Timestamp when recording ended */
  endTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** Success status */
  success: boolean;
  /** Tags for categorization */
  tags: string[];
  /** Domain/application this trace belongs to */
  domain?: string;
  /** Version of the application */
  appVersion?: string;
}

/**
 * Recording session configuration
 */
export interface RecordingConfig {
  /** Session identifier */
  sessionId: string;
  /** Name of the workflow being recorded */
  workflowName: string;
  /** Description of the workflow */
  description?: string;
  /** Goal of the workflow */
  goal: string;
  /** Output directory for recordings */
  outputDir: string;
  /** Whether to capture screenshots */
  captureScreenshots: boolean;
  /** Whether to capture DOM snapshots */
  captureDOM: boolean;
  /** Tags for this recording */
  tags?: string[];
}

/**
 * Recording session state
 */
export interface RecordingSession {
  /** Session configuration */
  config: RecordingConfig;
  /** Current actions recorded */
  actions: RecordedAction[];
  /** Start time */
  startTime: number;
  /** Current page URL */
  currentUrl: string;
  /** Is recording active? */
  isRecording: boolean;
}

/**
 * Action validation result
 */
export interface ActionValidation {
  /** Is the action valid? */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Warnings about the action */
  warnings?: string[];
}

/**
 * Trace export format
 */
export interface TraceExport {
  /** Export format version */
  version: string;
  /** Export timestamp */
  exportedAt: number;
  /** The trace data */
  trace: RecordedTrace;
  /** Metadata */
  metadata: {
    playwrightVersion: string;
    os: string;
    browser?: string;
  };
}
