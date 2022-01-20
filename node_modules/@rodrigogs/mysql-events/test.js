/* eslint-disable padded-blocks,no-unused-expressions,no-await-in-loop */

const chai = require('chai');
const mysql = require('mysql');
const MySQLEvents = require('./lib');

const { expect } = chai;

const DATABASE_PORT = process.env.DATABASE_PORT || 3306;
const IS_POOL = process.env.IS_POOL || false;
const TEST_SCHEMA_1 = 'testSchema1';
const TEST_SCHEMA_2 = 'testSchema2';
const TEST_TABLE_1 = 'testTable1';
const TEST_TABLE_2 = 'testTable2';
const TEST_COLUMN_1 = 'column1';
const TEST_COLUMN_2 = 'column2';

const delay = (timeout = 500) => new Promise((resolve) => {
  setTimeout(resolve, timeout);
});

let _serverId = 0;
const getServerId = () => {
  return _serverId += 1;
};

const getConnection = () => {
  const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    port: DATABASE_PORT,
  });

  return new Promise((resolve, reject) => connection.connect((err) => {
    if (err) return reject(err);
    resolve(connection);
  }));
};

const executeQuery = (conn, query) => {
  return new Promise((resolve, reject) => conn.query(query, (err, results) => {
    if (err) return reject(err);
    resolve(results);
  }));
};

const closeConnection = conn => new Promise((resolve, reject) => conn.end((err) => {
  if (err) return reject(err);
  resolve();
}));

const grantPrivileges = async () => {
  const conn = await getConnection();
  try {
    await executeQuery(conn, 'GRANT REPLICATION SLAVE, REPLICATION CLIENT, SELECT ON *.* TO \'root\'@\'localhost\'');
  } catch (err) {
    throw err;
  } finally {
    await closeConnection(conn);
  }
};

const createSchemas = async () => {
  console.log('Creating connection...');
  const conn = await getConnection();
  try {
    await executeQuery(conn, `CREATE DATABASE IF NOT EXISTS ${TEST_SCHEMA_1};`);
    await executeQuery(conn, `CREATE DATABASE IF NOT EXISTS ${TEST_SCHEMA_2};`);
  } catch (err) {
    throw err;
  } finally {
    await closeConnection(conn);
  }
};

const dropSchemas = async () => {
  const conn = await getConnection();
  try {
    await executeQuery(conn, `DROP DATABASE IF EXISTS ${TEST_SCHEMA_1};`);
    await executeQuery(conn, `DROP DATABASE IF EXISTS ${TEST_SCHEMA_2};`);
  } catch (err) {
    throw err;
  } finally {
    await closeConnection(conn);
  }
};

const createTables = async () => {
  const conn = await getConnection();
  try {
    await executeQuery(conn, `CREATE TABLE IF NOT EXISTS ${TEST_SCHEMA_1}.${TEST_TABLE_1} (${TEST_COLUMN_1} varchar(255), ${TEST_COLUMN_2} varchar(255));`);
    await executeQuery(conn, `CREATE TABLE IF NOT EXISTS ${TEST_SCHEMA_1}.${TEST_TABLE_2} (${TEST_COLUMN_1} varchar(255), ${TEST_COLUMN_2} varchar(255));`);
    await executeQuery(conn, `CREATE TABLE IF NOT EXISTS ${TEST_SCHEMA_2}.${TEST_TABLE_1} (${TEST_COLUMN_1} varchar(255), ${TEST_COLUMN_2} varchar(255));`);
    await executeQuery(conn, `CREATE TABLE IF NOT EXISTS ${TEST_SCHEMA_2}.${TEST_TABLE_2} (${TEST_COLUMN_1} varchar(255), ${TEST_COLUMN_2} varchar(255));`);
  } catch (err) {
    throw err;
  } finally {
    await closeConnection(conn);
  }
};

const dropTables = async () => {
  const conn = await getConnection();
  try {
    await executeQuery(conn, `DROP TABLE IF EXISTS ${TEST_SCHEMA_1}.${TEST_TABLE_1};`);
    await executeQuery(conn, `DROP TABLE IF EXISTS ${TEST_SCHEMA_1}.${TEST_TABLE_2};`);
    await executeQuery(conn, `DROP TABLE IF EXISTS ${TEST_SCHEMA_2}.${TEST_TABLE_1};`);
    await executeQuery(conn, `DROP TABLE IF EXISTS ${TEST_SCHEMA_2}.${TEST_TABLE_2};`);
  } catch (err) {
    throw err;
  } finally {
    await closeConnection(conn);
  }
};

beforeAll(async () => {
  console.log(`Runnning tests on port ${DATABASE_PORT}...`);

  chai.should();
  await createSchemas();
  await grantPrivileges();
});

beforeEach(async () => {
  await createTables();
});

afterEach(async () => {
  await dropTables();
});

afterAll(async () => {
  await dropSchemas();
});

describe(`MySQLEvents using ${IS_POOL ? 'connection pool' : 'single connection'} on port ${DATABASE_PORT}`, () => {

  it('should expose EVENTS enum', async () => {
    MySQLEvents.EVENTS.should.be.an('object');
    MySQLEvents.EVENTS.should.have.ownPropertyDescriptor('BINLOG');
    MySQLEvents.EVENTS.BINLOG.should.be.equal('binlog');
    MySQLEvents.EVENTS.should.have.ownPropertyDescriptor('TRIGGER_ERROR');
    MySQLEvents.EVENTS.TRIGGER_ERROR.should.be.equal('triggerError');
    MySQLEvents.EVENTS.should.have.ownPropertyDescriptor('CONNECTION_ERROR');
    MySQLEvents.EVENTS.CONNECTION_ERROR.should.be.equal('connectionError');
    MySQLEvents.EVENTS.should.have.ownPropertyDescriptor('ZONGJI_ERROR');
    MySQLEvents.EVENTS.ZONGJI_ERROR.should.be.equal('zongjiError');
  });

  it('should expose STATEMENTS enum', async () => {
    MySQLEvents.STATEMENTS.should.be.an('object');
    MySQLEvents.STATEMENTS.should.have.ownPropertyDescriptor('ALL');
    MySQLEvents.STATEMENTS.ALL.should.be.equal('ALL');
    MySQLEvents.STATEMENTS.should.have.ownPropertyDescriptor('INSERT');
    MySQLEvents.STATEMENTS.INSERT.should.be.equal('INSERT');
    MySQLEvents.STATEMENTS.should.have.ownPropertyDescriptor('UPDATE');
    MySQLEvents.STATEMENTS.UPDATE.should.be.equal('UPDATE');
    MySQLEvents.STATEMENTS.should.have.ownPropertyDescriptor('DELETE');
    MySQLEvents.STATEMENTS.DELETE.should.be.equal('DELETE');
  });

  it('should connect and disconnect from MySQL using a pre existing connection', async () => {
    let connection;
    if (IS_POOL) {
      connection = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'root',
        port: DATABASE_PORT,
      });
    } else {
      connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'root',
        port: DATABASE_PORT,
      });
    }

    const instance = new MySQLEvents(connection);

    await instance.start();

    await delay();

    await instance.stop();
  }, 10000);

  it('should connect and disconnect from MySQL using a dsn', async () => {
    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    });

    await instance.start();

    await delay();

    await instance.stop();
  }, 10000);

  it('should connect and disconnect from MySQL using a connection string', async () => {
    const instance = new MySQLEvents(`mysql://root:root@localhost:${DATABASE_PORT}/${TEST_SCHEMA_1}`);

    await instance.start();

    await delay();

    await instance.stop();
  }, 10000);

  it('should catch an event using an INSERT trigger', async () => {
    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    }, {
      serverId: getServerId(),
      startAtEnd: true,
      excludedSchemas: {
        mysql: true,
      },
    });

    await instance.start();

    const triggerEvents = [];
    instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}.${TEST_TABLE_1}`,
      statement: MySQLEvents.STATEMENTS.INSERT,
      onEvent: event => triggerEvents.push(event),
    });

    instance.on(MySQLEvents.EVENTS.TRIGGER_ERROR, console.error);
    instance.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error);
    instance.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);

    await delay(5000);

    await executeQuery(instance.connection, `INSERT INTO ${TEST_SCHEMA_1}.${TEST_TABLE_1} VALUES ('test1', 'test2');`);

    await delay(5000);

    if (!triggerEvents.length) throw new Error('No trigger was caught');

    triggerEvents[0].should.be.an('object');

    triggerEvents[0].should.have.ownPropertyDescriptor('type');
    triggerEvents[0].type.should.be.a('string').equals('INSERT');

    triggerEvents[0].should.have.ownPropertyDescriptor('timestamp');
    triggerEvents[0].timestamp.should.be.a('number');

    triggerEvents[0].should.have.ownPropertyDescriptor('table');
    triggerEvents[0].table.should.be.a('string').equals(TEST_TABLE_1);

    triggerEvents[0].should.have.ownPropertyDescriptor('schema');
    triggerEvents[0].schema.should.be.a('string').equals(TEST_SCHEMA_1);

    triggerEvents[0].should.have.ownPropertyDescriptor('nextPosition');
    triggerEvents[0].nextPosition.should.be.a('number');

    triggerEvents[0].should.have.ownPropertyDescriptor('affectedRows');
    triggerEvents[0].affectedRows.should.be.an('array').to.have.lengthOf(1);
    triggerEvents[0].affectedRows[0].should.be.an('object');
    triggerEvents[0].affectedRows[0].should.have.ownPropertyDescriptor('after');
    triggerEvents[0].affectedRows[0].after.should.be.an('object');
    triggerEvents[0].affectedRows[0].after.should.have.ownPropertyDescriptor(TEST_COLUMN_1);
    triggerEvents[0].affectedRows[0].after[TEST_COLUMN_1].should.be.a('string').equals('test1');
    triggerEvents[0].affectedRows[0].after.should.have.ownPropertyDescriptor(TEST_COLUMN_2);
    triggerEvents[0].affectedRows[0].after[TEST_COLUMN_2].should.be.a('string').equals('test2');
    triggerEvents[0].affectedRows[0].should.have.ownPropertyDescriptor('before');
    expect(triggerEvents[0].affectedRows[0].before).to.be.an('undefined');

    await instance.stop();
  }, 15000);

  it('should catch an event using an UPDATE trigger', async () => {
    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    }, {
      serverId: getServerId(),
      startAtEnd: true,
      excludedSchemas: {
        mysql: true,
      },
    });

    await instance.start();

    const triggerEvents = [];
    instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}.${TEST_TABLE_1}`,
      statement: MySQLEvents.STATEMENTS.UPDATE,
      onEvent: event => triggerEvents.push(event),
    });

    instance.on(MySQLEvents.EVENTS.TRIGGER_ERROR, console.error);
    instance.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error);
    instance.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);

    await delay(5000);

    await executeQuery(instance.connection, `INSERT INTO ${TEST_SCHEMA_1}.${TEST_TABLE_1} VALUES ('test1', 'test2');`);
    await executeQuery(instance.connection, `UPDATE ${TEST_SCHEMA_1}.${TEST_TABLE_1} SET ${TEST_COLUMN_1} = 'test3', ${TEST_COLUMN_2} = 'test4';`);

    await delay(5000);

    if (!triggerEvents.length) throw new Error('No trigger was caught');

    triggerEvents[0].should.be.an('object');

    triggerEvents[0].should.have.ownPropertyDescriptor('type');
    triggerEvents[0].type.should.be.a('string').equals('UPDATE');

    triggerEvents[0].should.have.ownPropertyDescriptor('timestamp');
    triggerEvents[0].timestamp.should.be.a('number');

    triggerEvents[0].should.have.ownPropertyDescriptor('table');
    triggerEvents[0].table.should.be.a('string').equals(TEST_TABLE_1);

    triggerEvents[0].should.have.ownPropertyDescriptor('schema');
    triggerEvents[0].schema.should.be.a('string').equals(TEST_SCHEMA_1);

    triggerEvents[0].should.have.ownPropertyDescriptor('nextPosition');
    triggerEvents[0].nextPosition.should.be.a('number');

    triggerEvents[0].should.have.ownPropertyDescriptor('affectedRows');
    triggerEvents[0].affectedRows.should.be.an('array').to.have.lengthOf(1);
    triggerEvents[0].affectedRows[0].should.be.an('object');

    triggerEvents[0].affectedRows[0].should.have.ownPropertyDescriptor('after');
    triggerEvents[0].affectedRows[0].after.should.be.an('object');
    triggerEvents[0].affectedRows[0].after.should.have.ownPropertyDescriptor(TEST_COLUMN_1);
    triggerEvents[0].affectedRows[0].after[TEST_COLUMN_1].should.be.a('string').equals('test3');
    triggerEvents[0].affectedRows[0].after.should.have.ownPropertyDescriptor(TEST_COLUMN_2);
    triggerEvents[0].affectedRows[0].after[TEST_COLUMN_2].should.be.a('string').equals('test4');

    triggerEvents[0].affectedRows[0].should.have.ownPropertyDescriptor('before');
    triggerEvents[0].affectedRows[0].before.should.be.an('object');
    triggerEvents[0].affectedRows[0].before.should.have.ownPropertyDescriptor(TEST_COLUMN_1);
    triggerEvents[0].affectedRows[0].before[TEST_COLUMN_1].should.be.a('string').equals('test1');
    triggerEvents[0].affectedRows[0].before.should.have.ownPropertyDescriptor(TEST_COLUMN_2);
    triggerEvents[0].affectedRows[0].before[TEST_COLUMN_2].should.be.a('string').equals('test2');

    await instance.stop();
  }, 15000);

  it('should catch an event using a DELETE trigger', async () => {
    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    }, {
      serverId: getServerId(),
      startAtEnd: true,
      excludedSchemas: {
        mysql: true,
      },
    });

    await instance.start();

    const triggerEvents = [];
    instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}.${TEST_TABLE_1}`,
      statement: MySQLEvents.STATEMENTS.DELETE,
      onEvent: event => triggerEvents.push(event),
    });

    await delay(5000);

    await executeQuery(instance.connection, `INSERT INTO ${TEST_SCHEMA_1}.${TEST_TABLE_1} VALUES ('test1', 'test2');`);
    await executeQuery(instance.connection, `DELETE FROM ${TEST_SCHEMA_1}.${TEST_TABLE_1} WHERE ${TEST_COLUMN_1} = 'test1' AND ${TEST_COLUMN_2} = 'test2';`);

    await delay(5000);

    if (!triggerEvents.length) throw new Error('No trigger was caught');

    triggerEvents[0].should.be.an('object');

    triggerEvents[0].should.have.ownPropertyDescriptor('type');
    triggerEvents[0].type.should.be.a('string').equals('DELETE');

    triggerEvents[0].should.have.ownPropertyDescriptor('timestamp');
    triggerEvents[0].timestamp.should.be.a('number');

    triggerEvents[0].should.have.ownPropertyDescriptor('table');
    triggerEvents[0].table.should.be.a('string').equals(TEST_TABLE_1);

    triggerEvents[0].should.have.ownPropertyDescriptor('schema');
    triggerEvents[0].schema.should.be.a('string').equals(TEST_SCHEMA_1);

    triggerEvents[0].should.have.ownPropertyDescriptor('nextPosition');
    triggerEvents[0].nextPosition.should.be.a('number');

    triggerEvents[0].should.have.ownPropertyDescriptor('affectedRows');
    triggerEvents[0].affectedRows.should.be.an('array').to.have.lengthOf(1);
    triggerEvents[0].affectedRows[0].should.be.an('object');

    triggerEvents[0].affectedRows[0].should.have.ownPropertyDescriptor('after');
    expect(triggerEvents[0].affectedRows[0].after).to.be.an('undefined');

    triggerEvents[0].affectedRows[0].should.have.ownPropertyDescriptor('before');
    triggerEvents[0].affectedRows[0].before.should.be.an('object');
    triggerEvents[0].affectedRows[0].before.should.have.ownPropertyDescriptor(TEST_COLUMN_1);
    triggerEvents[0].affectedRows[0].before[TEST_COLUMN_1].should.be.a('string').equals('test1');
    triggerEvents[0].affectedRows[0].before.should.have.ownPropertyDescriptor(TEST_COLUMN_2);
    triggerEvents[0].affectedRows[0].before[TEST_COLUMN_2].should.be.a('string').equals('test2');

    await instance.stop();
  }, 15000);

  it('should catch events using an ALL trigger', async () => {
    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    }, {
      serverId: getServerId(),
      startAtEnd: true,
      excludedSchemas: {
        mysql: true,
      },
    });

    await instance.start();

    const triggerEvents = [];
    instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}.${TEST_TABLE_1}`,
      statement: MySQLEvents.STATEMENTS.ALL,
      onEvent: event => triggerEvents.push(event),
    });

    await delay(5000);

    await executeQuery(instance.connection, `INSERT INTO ${TEST_SCHEMA_1}.${TEST_TABLE_1} VALUES ('test1', 'test2');`);
    await executeQuery(instance.connection, `UPDATE ${TEST_SCHEMA_1}.${TEST_TABLE_1} SET ${TEST_COLUMN_1} = 'test3', ${TEST_COLUMN_2} = 'test4';`);
    await executeQuery(instance.connection, `DELETE FROM ${TEST_SCHEMA_1}.${TEST_TABLE_1} WHERE ${TEST_COLUMN_1} = 'test3' AND ${TEST_COLUMN_2} = 'test4';`);

    await delay(1000);

    expect(triggerEvents).to.be.an('array').that.is.not.empty;

    triggerEvents[0].should.have.ownPropertyDescriptor('type');
    triggerEvents[0].type.should.be.a('string').equals('INSERT');

    triggerEvents[1].should.have.ownPropertyDescriptor('type');
    triggerEvents[1].type.should.be.a('string').equals('UPDATE');

    triggerEvents[2].should.have.ownPropertyDescriptor('type');
    triggerEvents[2].type.should.be.a('string').equals('DELETE');

    await instance.stop();
  }, 15000);

  it('should remove a previously added event trigger', async () => {
    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    });

    instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}.${TEST_TABLE_1}`,
      statement: MySQLEvents.STATEMENTS.ALL,
      onEvent: () => {},
    });

    instance.expressions[`${TEST_SCHEMA_1}.${TEST_TABLE_1}`].statements[MySQLEvents.STATEMENTS.ALL].should.be.an('array').that.is.not.empty;

    instance.expressions[`${TEST_SCHEMA_1}.${TEST_TABLE_1}`].statements[MySQLEvents.STATEMENTS.ALL][0].should.be.an('object');
    instance.expressions[`${TEST_SCHEMA_1}.${TEST_TABLE_1}`].statements[MySQLEvents.STATEMENTS.ALL][0].name.should.be.a('string').equals('Test');
    instance.expressions[`${TEST_SCHEMA_1}.${TEST_TABLE_1}`].statements[MySQLEvents.STATEMENTS.ALL][0].onEvent.should.be.a('function');

    instance.removeTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}.${TEST_TABLE_1}`,
      statement: MySQLEvents.STATEMENTS.ALL,
    });

    expect(instance.expressions[`${TEST_SCHEMA_1}.${TEST_TABLE_1}`].statements[MySQLEvents.STATEMENTS.ALL][0]).to.be.an('undefined');

    await instance.stop();
  }, 10000);

  it('should throw an error when adding duplicated trigger name for a statement', async () => {
    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    });

    instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}.${TEST_TABLE_1}`,
      statement: MySQLEvents.STATEMENTS.ALL,
      onEvent: () => {},
    });

    expect(() => instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}.${TEST_TABLE_1}`,
      statement: MySQLEvents.STATEMENTS.ALL,
      onEvent: () => {},
    })).to.throw(Error);
  });

  it('should emit an event when a trigger produces an error', async () => {
    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    }, {
      serverId: getServerId(),
      startAtEnd: true,
      excludedSchemas: {
        mysql: true,
      },
    });

    await instance.start();

    await delay();

    let error = null;
    instance.on(MySQLEvents.EVENTS.TRIGGER_ERROR, (err) => {
      error = err;
    });

    instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}.${TEST_TABLE_1}`,
      statement: MySQLEvents.STATEMENTS.ALL,
      onEvent: () => {
        throw new Error('Error');
      },
    });

    await delay(5000);

    await executeQuery(instance.connection, `INSERT INTO ${TEST_SCHEMA_1}.${TEST_TABLE_1} VALUES ('test1', 'test2');`);

    await delay(1000);

    expect(error).to.be.an('object');
    error.trigger.should.be.an('object');
    error.error.should.be.an('Error');
  }, 10000);

  it('should receive events from multiple schemas', async () => {
    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    }, {
      serverId: getServerId(),
      startAtEnd: true,
      excludedSchemas: {
        mysql: true,
      },
    });

    await instance.start();

    const triggeredEvents = [];
    instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}`,
      statement: MySQLEvents.STATEMENTS.UPDATE,
      onEvent: event => triggeredEvents.push(event),
    });
    instance.addTrigger({
      name: 'Test2',
      expression: `${TEST_SCHEMA_2}`,
      statement: MySQLEvents.STATEMENTS.ALL,
      onEvent: event => triggeredEvents.push(event),
    });

    await delay(5000);

    await executeQuery(instance.connection, `INSERT INTO ${TEST_SCHEMA_1}.${TEST_TABLE_1} VALUES ('test1', 'test2');`);
    await executeQuery(instance.connection, `UPDATE ${TEST_SCHEMA_1}.${TEST_TABLE_1} SET ${TEST_COLUMN_1} = 'test3', ${TEST_COLUMN_2} = 'test4';`);

    await executeQuery(instance.connection, `INSERT INTO ${TEST_SCHEMA_2}.${TEST_TABLE_1} VALUES ('test1', 'test2');`);
    await executeQuery(instance.connection, `UPDATE ${TEST_SCHEMA_2}.${TEST_TABLE_1} SET ${TEST_COLUMN_1} = 'test3', ${TEST_COLUMN_2} = 'test4';`);

    await delay(1000);

    if (!triggeredEvents.length) throw new Error('No trigger was caught');
  }, 20000);

  it('should pause and resume connection', async () => {
    const connection = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
    });

    const instance = new MySQLEvents({
      host: 'localhost',
      user: 'root',
      password: 'root',
      port: DATABASE_PORT,
      isPool: IS_POOL,
    }, {
      serverId: getServerId(),
      startAtEnd: true,
      excludedSchemas: {
        mysql: true,
      },
    });

    await instance.start();

    const triggeredEvents = [];
    instance.addTrigger({
      name: 'Test',
      expression: `${TEST_SCHEMA_1}`,
      statement: MySQLEvents.STATEMENTS.ALL,
      onEvent: event => triggeredEvents.push(event),
    });

    await delay(5000);

    await executeQuery(connection, `INSERT INTO ${TEST_SCHEMA_1}.${TEST_TABLE_1} VALUES ('test1', 'test2');`);
    await executeQuery(connection, `UPDATE ${TEST_SCHEMA_1}.${TEST_TABLE_1} SET ${TEST_COLUMN_1} = 'test3', ${TEST_COLUMN_2} = 'test4';`);

    await delay(1000);

    if (!triggeredEvents.length) throw new Error('No trigger was caught');
    triggeredEvents.splice(0);

    instance.pause();
    await delay(300);

    await executeQuery(connection, `INSERT INTO ${TEST_SCHEMA_1}.${TEST_TABLE_1} VALUES ('test3', 'test4');`);
    await executeQuery(connection, `UPDATE ${TEST_SCHEMA_1}.${TEST_TABLE_1} SET ${TEST_COLUMN_1} = 'test4', ${TEST_COLUMN_2} = 'test5';`);

    await delay(1000);

    if (triggeredEvents.length) throw new Error('Connection should be stopped');

    instance.resume();

    await delay(1000);

    if (!triggeredEvents.length) throw new Error('No trigger was caught');
  }, 20000);

});
