const { Client } = require('pg');
const faker = require('faker');
require("dotenv").config({ path: ".prod.env" });

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10),
});

const QUEUES = ['Product Support', 'Billing Support', 'Technical Support'];
const STATUSES = ['completed', 'dropped', 'queued', 'on going', 'missed'];
const CALL_TYPES = ['inbound', 'outbound'];
const AGENT_STATUSES = ['On Call', 'Available', 'Break'];

async function seedData(rows = 10000) {
  await client.connect();

  // Drop and recreate tables
  await client.query(`
    DROP TABLE IF EXISTS call_logs;
    DROP TABLE IF EXISTS queue_status;
    DROP TABLE IF EXISTS agent_status;
    DROP TABLE IF EXISTS agent_performance;
    DROP TABLE IF EXISTS agents;

    CREATE TABLE agents (
      agent_id INT PRIMARY KEY,
      agent_name VARCHAR(100)
    );

    CREATE TABLE agent_status (
      agent_id INT PRIMARY KEY,
      status VARCHAR(20),
      logged_in_at TIMESTAMP,
      on_break_since TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
    );

    CREATE TABLE agent_performance (
      agent_id INT PRIMARY KEY,
      calls_handled INT,
      aht FLOAT,
      break_time FLOAT,
      csat FLOAT,
      login_duration FLOAT,
      FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
    );

    CREATE TABLE queue_status (
      queue_name VARCHAR(50) PRIMARY KEY,
      waiting_calls INT,
      average_wait INT,
      longest_wait INT,
      sla_met FLOAT
    );

    CREATE TABLE call_logs (
      call_id UUID PRIMARY KEY,
      agent_id INT,
      queue VARCHAR(50),
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      duration INT,
      type VARCHAR(20),
      status VARCHAR(20),
      FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
    );
  `);

  // Utility: Random date within past 30 days
  function randomPastDate(days = 30) {
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - days);
    const timestamp = faker.datatype.number({
      min: past.getTime(),
      max: now.getTime(),
    });
    return new Date(timestamp);
  }

  // Create dummy agents
  const agents = Array.from({ length: 20 }, (_, i) => ({
    id: 1000 + i,
    name: faker.name.findName(),
  }));

  for (const agent of agents) {
    await client.query(
      `INSERT INTO agents (agent_id, agent_name) VALUES ($1, $2)`,
      [agent.id, agent.name]
    );
  }

  for (const agent of agents) {
    const status = AGENT_STATUSES[Math.floor(Math.random() * AGENT_STATUSES.length)];
    const loggedInAt = randomPastDate();
    const onBreakSince = status === 'Break' ? faker.date.between(loggedInAt, new Date()) : null;

    await client.query(
      `INSERT INTO agent_status (agent_id, status, logged_in_at, on_break_since)
       VALUES ($1, $2, $3, $4)`,
      [agent.id, status, loggedInAt, onBreakSince]
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

  for (let i = 0; i < rows; i++) {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const queue = QUEUES[Math.floor(Math.random() * QUEUES.length)];
    const type = CALL_TYPES[Math.floor(Math.random() * CALL_TYPES.length)];
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    const start = randomPastDate();
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
  console.log(`${rows} call logs inserted with data distributed over past 30 days.`);
}

seedData(10000);