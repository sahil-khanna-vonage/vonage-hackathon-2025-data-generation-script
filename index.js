const { Client } = require('pg');
const faker = require('faker');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'calls',
  password: 'sliyRR@fPdsf3',
  port: 5432,
});

const QUEUES = ['Product Support', 'Billing Support', 'Technical Support'];
const STATUSES = ['completed', 'dropped', 'queued', 'on going'];
const CALL_TYPES = ['inbound', 'outbound'];
const AGENT_STATUSES = ['On Call', 'Available', 'Break'];

async function seedData(rows = 100) {
  await client.connect();

  // Drop and recreate tables
  await client.query(`
    DROP TABLE IF EXISTS call_logs;
    DROP TABLE IF EXISTS queue_status;
    DROP TABLE IF EXISTS agent_status;
    DROP TABLE IF EXISTS agent_performance;

    CREATE TABLE agent_status (
      agent_id INT PRIMARY KEY,
      agent_name VARCHAR(100),
      status VARCHAR(20),
      logged_in_at TIMESTAMP,
      on_break_since TIMESTAMP
    );

    COMMENT ON COLUMN agent_status.agent_id IS 'The employee ID of the agent.';
    COMMENT ON COLUMN agent_status.agent_name IS 'Full name of the agent';
    COMMENT ON COLUMN agent_status.status IS 'Current status of the agent. Possible values are "On Call", "Available" and "Break"';
    COMMENT ON COLUMN agent_status.logged_in_at IS 'Timestamp when the agent logged in';
    COMMENT ON COLUMN agent_status.on_break_since IS 'Timestamp when the agent went on break';

    CREATE TABLE agent_performance (
      agent_id INT PRIMARY KEY,
      calls_handled INT,
      aht FLOAT,
      break_time FLOAT,
      csat FLOAT,
      login_duration FLOAT
    );

    COMMENT ON COLUMN agent_performance.agent_id IS 'The employee ID of the agent.';
    COMMENT ON COLUMN agent_performance.calls_handled IS 'Number of calls handled by the agent';
    COMMENT ON COLUMN agent_performance.aht IS 'Average Handle Time in minutes';
    COMMENT ON COLUMN agent_performance.break_time IS 'Total break time in minutes';
    COMMENT ON COLUMN agent_performance.csat IS 'Customer Satisfaction score as a percentage';
    COMMENT ON COLUMN agent_performance.login_duration IS 'Total login time in hours';

    CREATE TABLE queue_status (
      queue_name VARCHAR(50) PRIMARY KEY,
      waiting_calls INT,
      average_wait INT,
      longest_wait INT,
      sla_met FLOAT
    );

    COMMENT ON COLUMN queue_status.queue_name IS 'Name of the queue. Possble values are "Product Support", "Business Support" and "Technical Support"';
    COMMENT ON COLUMN queue_status.waiting_calls IS 'Current number of calls waiting in the queue';
    COMMENT ON COLUMN queue_status.average_wait IS 'Average wait time in seconds';
    COMMENT ON COLUMN queue_status.longest_wait IS 'Longest wait time in seconds';
    COMMENT ON COLUMN queue_status.sla_met IS 'Percentage of calls meeting SLA';

    CREATE TABLE call_logs (
      call_id UUID PRIMARY KEY,
      agent_id INT,
      queue VARCHAR(50),
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      duration INT,
      type VARCHAR(20),
      status VARCHAR(20)
    );

    COMMENT ON COLUMN call_logs.call_id IS 'The employee ID of the agent.';
    COMMENT ON COLUMN call_logs.agent_id IS 'Agent who handled the call';
    COMMENT ON COLUMN call_logs.queue IS 'Queue the call belonged to';
    COMMENT ON COLUMN call_logs.start_time IS 'Start time of the call';
    COMMENT ON COLUMN call_logs.end_time IS 'End time of the call';
    COMMENT ON COLUMN call_logs.duration IS 'Call duration in seconds';
    COMMENT ON COLUMN call_logs.type IS 'Type of call. Possble values are "inbound" and "outbound"';
    COMMENT ON COLUMN call_logs.status IS 'Call status. Possible values are "completed", "dropped", "queued", "on going")';
  `);

  // Create dummy agents
  const agents = Array.from({ length: 20 }, (_, i) => ({
    id: 1000 + i,
    name: faker.name.findName(),
  }));

  // Insert agent_status and agent_performance
  for (const agent of agents) {
    const status = AGENT_STATUSES[Math.floor(Math.random() * AGENT_STATUSES.length)];
    const loggedInAt = faker.date.recent(1);
    const onBreakSince = status === 'Break' ? faker.date.between(loggedInAt, new Date()) : null;

    await client.query(
      `INSERT INTO agent_status (agent_id, agent_name, status, logged_in_at, on_break_since)
       VALUES ($1, $2, $3, $4, $5)`,
      [agent.id, agent.name, status, loggedInAt, onBreakSince]
    );

    await client.query(
      `INSERT INTO agent_performance (agent_id, calls_handled, aht, break_time, csat, login_duration)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        agent.id,
        faker.datatype.number({ min: 20, max: 100 }),
        faker.datatype.float({ min: 3, max: 10, precision: 0.1 }),
        faker.datatype.float({ min: 10, max: 60, precision: 0.1 }),
        faker.datatype.float({ min: 60, max: 100, precision: 0.1 }),
        faker.datatype.float({ min: 4, max: 10, precision: 0.1 }),
      ]
    );
  }

  // Insert queue_status
  for (const queue of QUEUES) {
    await client.query(
      `INSERT INTO queue_status (queue_name, waiting_calls, average_wait, longest_wait, sla_met)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        queue,
        faker.datatype.number({ min: 0, max: 10 }),
        faker.datatype.number({ min: 10, max: 120 }),
        faker.datatype.number({ min: 20, max: 300 }),
        faker.datatype.float({ min: 70, max: 100, precision: 0.1 }),
      ]
    );
  }

  // Insert call_logs
  for (let i = 0; i < rows; i++) {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const queue = QUEUES[Math.floor(Math.random() * QUEUES.length)];
    const type = CALL_TYPES[Math.floor(Math.random() * CALL_TYPES.length)];
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    const start = faker.date.recent();
    const duration = faker.datatype.number({ min: 30, max: 900 });
    const end = new Date(start.getTime() + duration * 1000);

    await client.query(
      `INSERT INTO call_logs (call_id, agent_id, queue, start_time, end_time, duration, type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        faker.datatype.uuid(),
        agent.id,
        queue,
        start,
        end,
        duration,
        type,
        status,
      ]
    );
  }

  await client.end();
  console.log(`${rows} call logs inserted along with agent, queue, and performance data.`);
}

seedData(1000); // Change this number if needed
