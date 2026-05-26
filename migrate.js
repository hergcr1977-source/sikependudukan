const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_NtSlHg3WCxj0@ep-crimson-flower-a10t3t7z-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });
  
  await client.connect();
  
  // List all tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log('Tables:', tables.rows.map(r => r.table_name));
  
  // Check SuratPengantar table columns
  const result1 = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'SuratPengantar' AND table_schema = 'public'
  `);
  console.log('SuratPengantar columns (case-sensitive):', result1.rows.map(r => r.column_name));
  
  // Add ketuaRW column
  try {
    await client.query('ALTER TABLE "SuratPengantar" ADD COLUMN IF NOT EXISTS "ketuaRW" TEXT');
    console.log('Migration executed successfully!');
  } catch (e) {
    console.log('Migration error:', e.message);
  }
  
  // Verify
  const result2 = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'SuratPengantar' AND table_schema = 'public'
  `);
  console.log('After migration:', result2.rows.map(r => r.column_name));
  
  await client.end();
}

run().catch(console.error);
