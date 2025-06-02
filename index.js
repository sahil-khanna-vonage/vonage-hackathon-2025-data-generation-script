const { Client } = require("pg");
const faker = require("faker");
require("dotenv").config({ path: ".prod.env" });

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10),
});

const QUEUES = ["Product Support", "Billing Support", "Technical Support"];
const STATUSES = ["completed", "dropped", "queued", "on going", "missed"];
const CALL_TYPES = ["inbound", "outbound"];
const AGENT_STATUSES = ["On Call", "Available", "Break"];

async function seedData(repsPerCombinationPerDay = 5) {
  await client.connect();

  await client.query(`
    -- Drop dependent tables first
    DROP TABLE IF EXISTS call_logs;
    DROP TABLE IF EXISTS queue_status;
    DROP TABLE IF EXISTS agent_status;
    DROP TABLE IF EXISTS agent_performance;
    DROP TABLE IF EXISTS agents;

    -- Drop ENUM types if they exist
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_enum') THEN
        DROP TYPE queue_enum;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_enum') THEN
        DROP TYPE status_enum;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_type_enum') THEN
        DROP TYPE call_type_enum;
      END IF;
    END
    $$;

    -- Create ENUMs
    CREATE TYPE queue_enum AS ENUM ('Product Support', 'Billing Support', 'Technical Support');
    CREATE TYPE status_enum AS ENUM ('completed', 'dropped', 'queued', 'on going', 'missed');
    CREATE TYPE call_type_enum AS ENUM ('inbound', 'outbound');

    -- Tables
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
      queue_name queue_enum PRIMARY KEY,
      waiting_calls INT,
      average_wait INT,
      longest_wait INT,
      sla_met FLOAT
    );

    CREATE TABLE call_logs (
      call_id UUID PRIMARY KEY,
      agent_id INT,
      queue queue_enum,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      duration INT,
      type call_type_enum,
      status status_enum,
      FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
    );
  `);

  // Utility: Create agent data
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
    const status =
      AGENT_STATUSES[Math.floor(Math.random() * AGENT_STATUSES.length)];
    const loggedInAt = faker.date.recent(30);
    const onBreakSince =
      status === "Break" ? faker.date.between(loggedInAt, new Date()) : null;

    await client.query(
      `INSERT INTO agent_status (agent_id, status, logged_in_at, on_break_since) VALUES ($1, $2, $3, $4)`,
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

  // Generate call logs for last 30 days
  const MS_IN_DAY = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const dayStart = new Date(today.getTime() - dayOffset * MS_IN_DAY);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + MS_IN_DAY - 1);

    for (const queue of QUEUES) {
      for (const status of STATUSES) {
        for (const type of CALL_TYPES) {
          for (let i = 0; i < repsPerCombinationPerDay; i++) {
            const agent = agents[Math.floor(Math.random() * agents.length)];
            const start = faker.date.between(dayStart, dayEnd);
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
        }
      }
    }
  }

  await client.end();
  const totalRows =
    30 *
    QUEUES.length *
    STATUSES.length *
    CALL_TYPES.length *
    repsPerCombinationPerDay;
  console.log(
    `✅ Seeded ${totalRows} call logs with ENUMs over 30 days (each combo × ${repsPerCombinationPerDay})`
  );
}

seedData(100); // You can change this to any number you want
