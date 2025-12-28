import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkUserNodes() {
  try {
    const query = `
      SELECT
        id,
        type,
        meta,
        parent_id,
        created_at
      FROM timeline_nodes
      WHERE user_id = 330
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query);

    console.log(`\n📋 All nodes for User 330:\n`);
    for (const node of result.rows) {
      console.log(`ID: ${node.id}`);
      console.log(`Type: ${node.type}`);
      console.log(`Meta: ${JSON.stringify(node.meta, null, 2)}`);
      console.log(`Parent: ${node.parent_id || 'None'}`);
      console.log(`---\n`);
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkUserNodes();
