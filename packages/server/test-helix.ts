// Quick test script for Helix DB connection
import { HelixDB } from 'helix-ts';

async function main() {
  const client = new HelixDB('http://localhost:6969');

  try {
    // Test health check query
    console.log('Testing Helix connection...');
    const result = await client.query('HealthCheck', { dummy: 'test' });
    console.log('HealthCheck result:', JSON.stringify(result, null, 2));

    // Test creating a user
    console.log('\nCreating test user...');
    const userResult = await client.query('UpsertUser', {
      external_id: 'test-user-001',
      created_at: new Date().toISOString(),
      metadata: JSON.stringify({ name: 'Test User' })
    });
    console.log('UpsertUser result:', JSON.stringify(userResult, null, 2));

    // Get the user back
    console.log('\nFetching user...');
    const getResult = await client.query('GetUserByExternalId', {
      external_id: 'test-user-001'
    });
    console.log('GetUserByExternalId result:', JSON.stringify(getResult, null, 2));

    // Get counts
    console.log('\nGetting user count...');
    const countResult = await client.query('GetUserCount', {});
    console.log('GetUserCount result:', JSON.stringify(countResult, null, 2));

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
