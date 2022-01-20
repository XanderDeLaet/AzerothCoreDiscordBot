const debug = require('debuggler')();
const ZongJi = require('@rodrigogs/zongji');
const EventEmitter = require('events');
const eventHandler = require('./eventHandler');
const connectionHandler = require('./connectionHandler');

const EVENTS = require('./EVENTS.enum');
const STATEMENTS = require('./STATEMENTS.enum');

/**
 * @param {Object|Connection|String} connection
 * @param {Object} options
 */
class MySQLEvents extends EventEmitter {
  constructor(connection, options = {}) {
    super();

    this.connection = connection;
    this.options = options;

    this.isStarted = false;
    this.isPaused = false;

    this.zongJi = null;
    this.expressions = {};
  }

  /**
   * @return {{BINLOG, TRIGGER_ERROR, CONNECTION_ERROR, ZONGJI_ERROR}}
   * @constructor
   */
  static get EVENTS() {
    return EVENTS;
  }

  /**
   * @return {{ALL: string, INSERT: string, UPDATE: string, DELETE: string}}
   */
  static get STATEMENTS() {
    return STATEMENTS;
  }

  /**
   * @param {Object} event binlog event object.
   * @private
   */
  _handleEvent(event) {
    if (!this.zongJi) return;

    event.binlogName = this.zongJi.binlogName;
    event = eventHandler.normalizeEvent(event);
    const triggers = eventHandler.findTriggers(event, this.expressions);

    Promise.all(triggers.map(async (trigger) => {
      try {
        await trigger.onEvent(event);
      } catch (error) {
        this.emit(EVENTS.TRIGGER_ERROR, { trigger, error });
      }
    })).then(() => debug('triggers executed'));
  }

  /**
   * @private
   */
  _handleZongJiEvents() {
    this.zongJi.on('error', err => this.emit(EVENTS.ZONGJI_ERROR, err));
    this.zongJi.on('binlog', (event) => {
      this.emit(EVENTS.BINLOG, event);
      this._handleEvent(event);
    });
  }

  /**
   * @private
   */
  _handleConnectionEvents() {
    this.connection.on('error', err => this.emit(EVENTS.CONNECTION_ERROR, err));
  }

  /**
   * @param {Object} [options = {}]
   * @return {Promise<void>}
   */
  async start(options = {}) {
    if (this.isStarted) return;
    debug('connecting to mysql');
    this.connection = await connectionHandler(this.connection);

    debug('initializing zongji');
    this.zongJi = new ZongJi(this.connection, Object.assign({}, this.options, options));

    debug('connected');
    this.emit('connected');
    this._handleConnectionEvents();
    this._handleZongJiEvents();
    this.zongJi.start(this.options);
    this.isStarted = true;
    this.emit(EVENTS.STARTED);
  }

  /**
   * @return {Promise<void>}
   */
  async stop() {
    if (!this.isStarted) return;
    debug('disconnecting from mysql');

    this.zongJi.stop();
    delete this.zongJi;

    await new Promise((resolve, reject) => {
      this.connection.end((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    debug('disconnected');
    this.emit('disconnected');
    this.isStarted = false;
    this.emit(EVENTS.STOPPED);
  }

  /**
   *
   */
  pause() {
    if (!this.isStarted || this.isPaused) return;
    debug('pausing connection');

    this.zongJi.connection.pause();
    this.isPaused = true;
    this.emit(EVENTS.PAUSED);
  }

  /**
   *
   */
  resume() {
    if (!this.isStarted || !this.isPaused) return;
    debug('resuming connection');

    this.zongJi.connection.resume();
    this.isPaused = false;
    this.emit(EVENTS.RESUMED);
  }

  /**
   * @param {String} name
   * @param {String} expression
   * @param {String} [statement = 'ALL']
   * @param {Function} [onEvent]
   * @return {void}
   */
  addTrigger({
    name,
    expression,
    statement = STATEMENTS.ALL,
    onEvent,
  }) {
    if (!name) throw new Error('Missing trigger name');
    if (!expression) throw new Error('Missing trigger expression');
    if (typeof onEvent !== 'function') throw new Error('onEvent argument should be a function');

    this.expressions[expression] = this.expressions[expression] || {};
    this.expressions[expression].statements = this.expressions[expression].statements || {};
    this.expressions[expression].statements[statement] = this.expressions[expression].statements[statement] || [];

    const triggers = this.expressions[expression].statements[statement];
    if (triggers.find(st => st.name === name)) {
      throw new Error(`There's already a trigger named "${name}" for expression "${expression}" with statement "${statement}"`);
    }

    triggers.push({
      name,
      onEvent,
    });
  }

  /**
   * @param {String} name
   * @param {String} expression
   * @param {String} [statement = 'ALL']
   * @return {void}
   */
  removeTrigger({
    name,
    expression,
    statement = STATEMENTS.ALL,
  }) {
    const exp = this.expressions[expression];
    if (!exp) return;

    const triggers = exp.statements[statement];
    if (!triggers) return;

    const named = triggers.find(st => st.name === name);
    if (!named) return;

    const index = triggers.indexOf(named);
    triggers.splice(index, 1);
  }
}

module.exports = MySQLEvents;
