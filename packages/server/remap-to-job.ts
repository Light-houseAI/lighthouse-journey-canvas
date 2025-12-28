import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function remapSessionsToJob() {
  try {
    const PROJECT_NODE_ID = 'b13b1607-eed4-4125-aa27-4528ce2f3318'; // Research on AI Toolkits
    const JOB_NODE_ID = '548077f0-c820-4b87-beff-8f820d3d7871'; // System Software Engineer

    console.log('🔄 Remapping sessions from "Research on AI Toolkits" to "System Software Engineer"...\n');

    // Update all sessions mapped to the project node
    const updateQuery = `
      UPDATE session_mappings
      SET node_id = $1
      WHERE node_id = $2
      RETURNING desktop_session_id, workflow_name;
    `;

    const result = await pool.query(updateQuery, [JOB_NODE_ID, PROJECT_NODE_ID]);

    console.log(`✅ Successfully remapped ${result.rows.length} sessions:\n`);
    for (const row of result.rows) {
      console.log(`- ${row.workflow_name || row.desktop_session_id}`);
    }

    console.log('\n🎉 Done! Refresh your browser to see the sessions under "System Software Engineer"');
    console.log('   The Workflow Analysis button should now appear!\n');

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

remapSessionsToJob();
