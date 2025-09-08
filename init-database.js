// Quick database initialization script
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function initDatabase() {
  try {
    console.log('Creating database tables...');
    
    // Create sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);
    `);
    
    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR UNIQUE,
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        role VARCHAR NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create other essential tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS database_servers (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        host VARCHAR NOT NULL,
        port VARCHAR NOT NULL,
        version VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'online',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('✅ Database tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    process.exit(1);
  }
}

initDatabase();