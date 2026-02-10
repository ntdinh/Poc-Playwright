/**
 * Recording Module - Phase 1
 *
 * Exports all recording-related functionality for capturing user demonstrations.
 */

export { ActionRecorder, createActionRecorder } from './ActionRecorder';
export { TraceStorage, createTraceStorage } from './TraceStorage';

export type {
  RecordedAction,
  RecordedTrace,
  RecordingConfig,
  RecordingSession,
  ActionValidation,
  TraceExport
} from './RecordedAction';
