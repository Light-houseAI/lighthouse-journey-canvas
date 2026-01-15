import dotenv from 'dotenv';
import { Database, aql } from 'arangojs';

dotenv.config();

const db = new Database({
  url: process.env.ARANGO_URL!,
  databaseName: process.env.ARANGO_DATABASE!,
  auth: {
    username: process.env.ARANGO_USERNAME!,
    password: process.env.ARANGO_PASSWORD!,
  },
});

async function debug() {
  console.log('Connecting to:', process.env.ARANGO_URL, process.env.ARANGO_DATABASE);

  // Check sessions for user 32
  const sessionsCursor = await db.query(aql`
    FOR s IN sessions
      FILTER s.user_key == 'user_32'
      LIMIT 3
      RETURN { _key: s._key, user_key: s.user_key, external_id: s.external_id }
  `);
  const sessions = await sessionsCursor.all();
  console.log('\n=== Sessions for user_32 ===');
  console.log(JSON.stringify(sessions, null, 2));

  // Check activities and their session_keys
  const activitiesCursor = await db.query(aql`
    FOR a IN activities
      LIMIT 3
      RETURN { _key: a._key, session_key: a.session_key }
  `);
  const activities = await activitiesCursor.all();
  console.log('\n=== Sample activities ===');
  console.log(JSON.stringify(activities, null, 2));

  // Check USES edges
  const usesCursor = await db.query(aql`
    FOR e IN USES
      LIMIT 5
      RETURN e
  `);
  const usesEdges = await usesCursor.all();
  console.log('\n=== Sample USES edges ===');
  console.log(JSON.stringify(usesEdges, null, 2));

  // Check entities
  const entitiesCursor = await db.query(aql`
    FOR e IN entities
      LIMIT 5
      RETURN { _key: e._key, name: e.name, type: e.type }
  `);
  const entities = await entitiesCursor.all();
  console.log('\n=== Sample entities ===');
  console.log(JSON.stringify(entities, null, 2));

  // Check if activity session_keys match actual sessions
  const matchCursor = await db.query(aql`
    FOR a IN activities
      LET session = DOCUMENT(sessions, a.session_key)
      LIMIT 5
      RETURN {
        activity_key: a._key,
        session_key: a.session_key,
        session_found: session != null,
        session_user_key: session.user_key
      }
  `);
  const matches = await matchCursor.all();
  console.log('\n=== Activity-Session matches ===');
  console.log(JSON.stringify(matches, null, 2));

  // Count totals
  const countsCursor = await db.query(aql`
    RETURN {
      sessions: LENGTH(sessions),
      activities: LENGTH(activities),
      entities: LENGTH(entities),
      concepts: LENGTH(concepts),
      uses_edges: LENGTH(USES),
      relates_to_edges: LENGTH(RELATES_TO)
    }
  `);
  const counts = await countsCursor.next();
  console.log('\n=== Collection Counts ===');
  console.log(JSON.stringify(counts, null, 2));

  await db.close();
}

debug().catch(console.error);
