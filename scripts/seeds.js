require('dotenv').config()
const { Pool } = require('pg')
const bcrypt = require('bcrypt')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD
})

const seed = async () => {
  const client = await pool.connect()

  try {
    console.log('Seeding database...\n')

    await client.query('TRUNCATE TABLE invitations  RESTART IDENTITY CASCADE')
    await client.query('TRUNCATE TABLE tasks        RESTART IDENTITY CASCADE')
    await client.query('TRUNCATE TABLE projects     RESTART IDENTITY CASCADE')
    await client.query('TRUNCATE TABLE users        RESTART IDENTITY CASCADE')
    await client.query('TRUNCATE TABLE organisations RESTART IDENTITY CASCADE')

     
    const password = await bcrypt.hash('password123', 10)

    // Organisations
    await client.query(`
      INSERT INTO organisations (id, name, slug, plan, max_members)
      VALUES
        (1, 'Acme Corp',    'acme-corp',    'pro',  50),
        (2, 'Startup Labs', 'startup-labs', 'free',  5)
    `)
    console.log('organisations seeded')

    // Users
    await client.query(`
      INSERT INTO users (id, organisation_id, name, email, password, role)
      VALUES
        (1, 1, 'Brian Ochieng', 'brian@acme.com',           $1, 'owner'),
        (2, 1, 'Aisha Kamau',   'aisha@acme.com',           $1, 'admin'),
        (3, 1, 'Carlos Mendez', 'carlos@acme.com',          $1, 'member'),
        (4, 2, 'Fatima Hassan', 'fatima@startuplabs.com',   $1, 'owner')
    `, [password])
    console.log('users seeded')

    // Projects
    await client.query(`
      INSERT INTO projects (id, organisation_id, name, description, status, color, created_by)
      VALUES
        (1, 1, 'Website Redesign', 'Redesign the company website', 'active', '#4F46E5', 1),
        (2, 1, 'Mobile App',       'Build iOS and Android apps',   'active', '#059669', 2),
        (3, 2, 'MVP Launch',       'Get the MVP live',             'active', '#DC2626', 4)
    `)
    console.log('projects seeded')

    // Tasks
    await client.query(`
      INSERT INTO tasks (organisation_id, project_id, title, status, priority, assigned_to, created_by, due_date)
      VALUES
        (1, 1, 'Design homepage mockup',         'done',        'high',   2, 1, NOW() - INTERVAL '2 days'),
        (1, 1, 'Implement responsive navigation', 'in_progress', 'high',   3, 1, NOW() + INTERVAL '3 days'),
        (1, 1, 'Write copy for about page',       'todo',        'medium', NULL, 2, NOW() + INTERVAL '7 days'),
        (1, 2, 'Set up React Native project',     'done',        'urgent', 3, 2, NOW() - INTERVAL '5 days'),
        (1, 2, 'Build login screen',              'in_progress', 'high',   3, 2, NOW() + INTERVAL '7 days'),
        (2, 3, 'Set up landing page',             'todo',        'urgent', 4, 4, NOW() + INTERVAL '2 days')
    `)
    console.log(' tasks seeded')

    // Synchronize SERIAL sequences with the seeded data
await client.query(`
  SELECT setval('organisations_id_seq', COALESCE((SELECT MAX(id) FROM organisations), 1), true);
  SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true);
  SELECT setval('projects_id_seq', COALESCE((SELECT MAX(id) FROM projects), 1), true);
  SELECT setval('tasks_id_seq', COALESCE((SELECT MAX(id) FROM tasks), 1), true);
  SELECT setval('invitations_id_seq', COALESCE((SELECT MAX(id) FROM invitations), 1), true);
`);

console.log('SERIAL sequences synchronized');

    console.log('\nDatabase seeded!')
    console.log('\nLogin with any of these:')
    console.log('  brian@acme.com           / password123  (owner  - Acme Corp)')
    console.log('  aisha@acme.com           / password123  (admin  - Acme Corp)')
    console.log('  carlos@acme.com          / password123  (member - Acme Corp)')
    console.log('  fatima@startuplabs.com   / password123  (owner  - Startup Labs)\n')

  } catch (error) {
    console.error('Seeding failed:', error.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()