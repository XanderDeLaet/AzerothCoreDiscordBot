const STATEMENTS = require('./STATEMENTS.enum');

const getEventType = (eventName) => {
  return {
    writerows: STATEMENTS.INSERT,
    updaterows: STATEMENTS.UPDATE,
    deleterows: STATEMENTS.DELETE,
  }[eventName];
};

const normalizeRow = (row) => {
  if (!row) return undefined;

  const columns = Object.getOwnPropertyNames(row);
  for (let i = 0, len = columns.length; i < len; i += 1) {
    const columnValue = row[columns[i]];

    if (columnValue instanceof Buffer && columnValue.length === 1) { // It's a boolean
      row[columns[i]] = (columnValue[0] > 0);
    }
  }

  return row;
};

const hasDifference = (beforeValue, afterValue) => {
  if ((beforeValue && afterValue) && beforeValue instanceof Date) {
    return beforeValue.getTime() !== afterValue.getTime();
  }

  return beforeValue !== afterValue;
};

const fixRowStructure = (type, row) => {
  if (type === STATEMENTS.INSERT) {
    row = {
      before: undefined,
      after: row,
    };
  }
  if (type === STATEMENTS.DELETE) {
    row = {
      before: row,
      after: undefined,
    };
  }

  return row;
};

const resolveAffectedColumns = (normalizedEvent, normalizedRows) => {
  const columns = Object.getOwnPropertyNames((normalizedRows.after || normalizedRows.before));
  for (let i = 0, len = columns.length; i < len; i += 1) {
    const columnName = columns[i];
    const beforeValue = (normalizedRows.before || {})[columnName];
    const afterValue = (normalizedRows.after || {})[columnName];

    if (hasDifference(beforeValue, afterValue)) {
      if (normalizedEvent.affectedColumns.indexOf(columnName) === -1) {
        normalizedEvent.affectedColumns.push(columnName);
      }
    }
  }
};

const dataNormalizer = (event) => {
  const type = getEventType(event.getEventName());
  const schema = event.tableMap[event.tableId].parentSchema;
  const table = event.tableMap[event.tableId].tableName;
  const { timestamp, nextPosition, binlogName } = event;

  const normalized = {
    type,
    schema,
    table,
    affectedRows: [],
    affectedColumns: [],
    timestamp,
    nextPosition,
    binlogName,
  };

  event.rows.forEach((row) => {
    row = fixRowStructure(type, row);

    const normalizedRows = {
      after: normalizeRow(row.after),
      before: normalizeRow(row.before),
    };

    normalized.affectedRows.push(normalizedRows);

    resolveAffectedColumns(normalized, normalizedRows);
  });

  return normalized;
};

module.exports = dataNormalizer;
