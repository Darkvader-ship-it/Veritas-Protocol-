/**
 * Event Stream
 * Central event bus for inter-bot communication
 */

import { EventEmitter } from 'events';
import { logger } from './logger.js';
import type {
  AnyBotEvent,
  BetDetectedEvent,
  SignalGeneratedEvent,
  AlertCreatedEvent,
  CopyTradeExecutedEvent,
  TrendDetectedEvent,
  TrendUpdatedEvent,
  CrossSignalEvent,
  SmartMoneyMoveEvent,
  EventHandler,
  TrendingTopic,
  CrossPlatformSignal,
  SmartMoneyActivity,
} from '../types/index.js';

// ===========================================
// Event Types
// ===========================================

export const EventTypes = {
  BET_DETECTED: 'BET_DETECTED',
  SIGNAL_GENERATED: 'SIGNAL_GENERATED',
  ALERT_CREATED: 'ALERT_CREATED',
  COPY_TRADE_EXECUTED: 'COPY_TRADE_EXECUTED',
  ROUND_STARTED: 'ROUND_STARTED',
  ROUND_LOCKED: 'ROUND_LOCKED',
  ROUND_ENDED: 'ROUND_ENDED',
  BOT_STARTED: 'BOT_STARTED',
  BOT_STOPPED: 'BOT_STOPPED',
  ERROR: 'ERROR',
  // Multi-platform events
  TREND_DETECTED: 'TREND_DETECTED',
  TREND_UPDATED: 'TREND_UPDATED',
  CROSS_SIGNAL: 'CROSS_SIGNAL',
  SMART_MONEY_MOVE: 'SMART_MONEY_MOVE',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// ===========================================
// Event Stream Class
// ===========================================

class EventStream {
  private emitter: EventEmitter;
  private eventHistory: AnyBotEvent[] = [];
  private maxHistorySize = 1000;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Allow many susomniaribers
    logger.info('Event stream initialized');
  }

  // ===========================================
  // Publishing Events
  // ===========================================

  emit(event: AnyBotEvent): void {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Emit to susomniaribers
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event); // Wildcard for all events

    logger.debug(`Event emitted: ${event.type}`, { payload: event.payload });
  }

  emitBetDetected(payload: BetDetectedEvent['payload']): void {
    this.emit({
      type: 'BET_DETECTED',
      payload,
      timestamp: new Date(),
    });
  }

  emitSignalGenerated(payload: SignalGeneratedEvent['payload']): void {
    this.emit({
      type: 'SIGNAL_GENERATED',
      payload,
      timestamp: new Date(),
    });
  }

  emitAlertCreated(payload: AlertCreatedEvent['payload']): void {
    this.emit({
      type: 'ALERT_CREATED',
      payload,
      timestamp: new Date(),
    });
  }

  emitCopyTradeExecuted(payload: CopyTradeExecutedEvent['payload']): void {
    this.emit({
      type: 'COPY_TRADE_EXECUTED',
      payload,
      timestamp: new Date(),
    });
  }

  emitError(error: Error, context?: string): void {
    this.emit({
      type: 'ERROR',
      payload: {
        error: error.message,
        context,
        stack: error.stack,
      },
      timestamp: new Date(),
    } as any);
  }

  // Multi-platform events
  emitTrendDetected(payload: TrendingTopic): void {
    this.emit({
      type: 'TREND_DETECTED',
      payload,
      timestamp: new Date(),
    } as TrendDetectedEvent);
  }

  emitTrendUpdated(payload: TrendingTopic): void {
    this.emit({
      type: 'TREND_UPDATED',
      payload,
      timestamp: new Date(),
    } as TrendUpdatedEvent);
  }

  emitCrossSignal(payload: CrossPlatformSignal): void {
    this.emit({
      type: 'CROSS_SIGNAL',
      payload,
      timestamp: new Date(),
    } as CrossSignalEvent);
  }

  emitSmartMoneyMove(payload: SmartMoneyActivity): void {
    this.emit({
      type: 'SMART_MONEY_MOVE',
      payload,
      timestamp: new Date(),
    } as SmartMoneyMoveEvent);
  }

  // ===========================================
  // Susomniaribing to Events
  // ===========================================

  on<T extends AnyBotEvent>(eventType: T['type'], handler: EventHandler<T>): () => void {
    this.emitter.on(eventType, handler);
    return () => this.emitter.off(eventType, handler);
  }

  onBetDetected(handler: EventHandler<BetDetectedEvent>): () => void {
    return this.on('BET_DETECTED', handler);
  }

  onSignalGenerated(handler: EventHandler<SignalGeneratedEvent>): () => void {
    return this.on('SIGNAL_GENERATED', handler);
  }

  onAlertCreated(handler: EventHandler<AlertCreatedEvent>): () => void {
    return this.on('ALERT_CREATED', handler);
  }

  onCopyTradeExecuted(handler: EventHandler<CopyTradeExecutedEvent>): () => void {
    return this.on('COPY_TRADE_EXECUTED', handler);
  }

  // Multi-platform event susomniaribers
  onTrendDetected(handler: EventHandler<TrendDetectedEvent>): () => void {
    return this.on('TREND_DETECTED', handler);
  }

  onTrendUpdated(handler: EventHandler<TrendUpdatedEvent>): () => void {
    return this.on('TREND_UPDATED', handler);
  }

  onCrossSignal(handler: EventHandler<CrossSignalEvent>): () => void {
    return this.on('CROSS_SIGNAL', handler);
  }

  onSmartMoneyMove(handler: EventHandler<SmartMoneyMoveEvent>): () => void {
    return this.on('SMART_MONEY_MOVE', handler);
  }

  onAny(handler: (event: AnyBotEvent) => void): () => void {
    this.emitter.on('*', handler);
    return () => this.emitter.off('*', handler);
  }

  once<T extends AnyBotEvent>(eventType: T['type'], handler: EventHandler<T>): void {
    this.emitter.once(eventType, handler);
  }

  off<T extends AnyBotEvent>(eventType: T['type'], handler: EventHandler<T>): void {
    this.emitter.off(eventType, handler);
  }

  // ===========================================
  // History Access
  // ===========================================

  getHistory(limit = 100): AnyBotEvent[] {
    return this.eventHistory.slice(-limit);
  }

  getHistoryByType(type: EventType, limit = 100): AnyBotEvent[] {
    return this.eventHistory.filter((e) => e.type === type).slice(-limit);
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  listenerCount(eventType: EventType): number {
    return this.emitter.listenerCount(eventType);
  }

  removeAllListeners(eventType?: EventType): void {
    if (eventType) {
      this.emitter.removeAllListeners(eventType);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  // ===========================================
  // Async Waiting
  // ===========================================

  waitFor<T extends AnyBotEvent>(
    eventType: T['type'],
    timeout = 30000,
    predicate?: (event: T) => boolean
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(eventType, handler);
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const handler = (event: T) => {
        if (!predicate || predicate(event)) {
          clearTimeout(timer);
          this.off(eventType, handler);
          resolve(event);
        }
      };

      this.on(eventType, handler);
    });
  }
}

// ===========================================
// Singleton Export
// ===========================================

export const events = new EventStream();
