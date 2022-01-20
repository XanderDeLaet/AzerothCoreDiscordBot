const normalize = require('./dataNormalizer');
const STATEMENTS = require('./STATEMENTS.enum');

const parseExpression = (expression = '') => {
  const parts = expression.split('.');
  return {
    schema: parts[0],
    table: parts[1],
    column: parts[2],
    value: parts[3],
  };
};

const normalizeEvent = (event) => {
  const dataEvents = [
    'writerows',
    'updaterows',
    'deleterows',
  ];

  if (dataEvents.indexOf(event.getEventName()) !== -1) {
    return normalize(event);
  }

  return event;
};

/**
 * @param {Object} event
 * @param {Object} triggers
 * @return {Object[]}
 */
const findTriggers = (event, triggers) => {
  if (!event.type) return [];

  const triggerExpressions = Object.getOwnPropertyNames(triggers);
  const statements = [];

  for (let i = 0, len = triggerExpressions.length; i < len; i += 1) {
    const expression = triggerExpressions[i];
    const trigger = triggers[expression];

    const parts = parseExpression(expression);
    if (parts.schema !== '*' && parts.schema !== event.schema) continue;
    if (!(!parts.table || parts.table === '*') && parts.table !== event.table) continue;
    if (!(!parts.column || parts.column === '*') && event.affectedColumns.indexOf(parts.column) === -1) continue;

    if (trigger.statements[STATEMENTS.ALL]) statements.push(...trigger.statements[STATEMENTS.ALL]);
    if (trigger.statements[event.type]) statements.push(...trigger.statements[event.type]);
  }

  return statements;
};

/**
 * @type {{normalizeEvent: normalizeEvent, findTriggers: findTriggers}}
 */
const eventHandler = {
  normalizeEvent,
  findTriggers,
};

module.exports = eventHandler;
