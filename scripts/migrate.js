require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD
})

const migrate = async () => {
  const client = await pool.connect()

  try {
    console.log('Running migrations...\n')

    await client.query(`
      CREATE TABLE IF NOT EXISTS organisations (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        slug        VARCHAR(255) NOT NULL UNIQUE,
        plan        VARCHAR(50)  NOT NULL DEFAULT 'free',
        max_members INTEGER               DEFAULT 5,
        is_active   BOOLEAN      NOT NULL DEFAULT true,
        created_at  TIMESTAMP             DEFAULT NOW(),
        updated_at  TIMESTAMP             DEFAULT NOW()
      )
    `)
    console.log('organisations table ready')

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                  SERIAL PRIMARY KEY,
        organisation_id     INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        name                VARCHAR(100) NOT NULL,
        email               VARCHAR(255) NOT NULL UNIQUE,
        password            VARCHAR(255) NOT NULL,
        role                VARCHAR(50)  NOT NULL DEFAULT 'member'
                              CHECK (role IN ('owner', 'admin', 'member')),
        avatar_url          VARCHAR(500),
        is_active           BOOLEAN      NOT NULL DEFAULT true,
        reset_token         VARCHAR(255),
        reset_token_expires TIMESTAMP,
        last_login_at       TIMESTAMP,
        created_at          TIMESTAMP             DEFAULT NOW(),
        updated_at          TIMESTAMP             DEFAULT NOW()
      )
    `)
    console.log('users table ready')

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id              SERIAL PRIMARY KEY,
        organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        name            VARCHAR(255) NOT NULL,
        description     TEXT,
        status          VARCHAR(50)  NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'completed', 'archived', 'on_hold')),
        color           VARCHAR(7)            DEFAULT '#4F46E5',
        due_date        TIMESTAMP,
        created_by      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        created_at      TIMESTAMP             DEFAULT NOW(),
        updated_at      TIMESTAMP             DEFAULT NOW()
      )
    `)
    console.log('projects table ready')

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id              SERIAL PRIMARY KEY,
        organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        project_id      INTEGER      NOT NULL REFERENCES projects(id)      ON DELETE CASCADE,
        title           VARCHAR(500) NOT NULL,
        description     TEXT,
        status          VARCHAR(50)  NOT NULL DEFAULT 'todo'
                          CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),
        priority        VARCHAR(50)  NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        assigned_to     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        created_by      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        due_date        TIMESTAMP,
        completed_at    TIMESTAMP,
        position        INTEGER      NOT NULL DEFAULT 0,
        created_at      TIMESTAMP             DEFAULT NOW(),
        updated_at      TIMESTAMP             DEFAULT NOW()
      )
    `)
    console.log('tasks table ready')

    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id              SERIAL PRIMARY KEY,
        organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        email           VARCHAR(255) NOT NULL,
        role            VARCHAR(50)  NOT NULL DEFAULT 'member'
                          CHECK (role IN ('admin', 'member')),
        token           VARCHAR(255) NOT NULL UNIQUE,
        invited_by      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        expires_at      TIMESTAMP    NOT NULL,
        accepted_at     TIMESTAMP,
        created_at      TIMESTAMP             DEFAULT NOW()
      )
    `)
    console.log('invitations table ready')

    // Indexes — make queries fast
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_organisation_id     ON users(organisation_id);
      CREATE INDEX IF NOT EXISTS idx_users_email               ON users(email);
      CREATE INDEX IF NOT EXISTS idx_projects_organisation_id  ON projects(organisation_id);
      CREATE INDEX IF NOT EXISTS idx_projects_status           ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_organisation_id     ON tasks(organisation_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id          ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to         ON tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_tasks_status              ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority            ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_invitations_token         ON invitations(token);
      CREATE INDEX IF NOT EXISTS idx_invitations_email         ON invitations(email);
    `)
    console.log('indexes ready')

    console.log('\n All migrations complete!')

  } catch (error) {
    console.error('\n Migration failed:', error.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()