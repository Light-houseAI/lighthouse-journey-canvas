# Vector Database Synchronization

This document explains how to handle vector database synchronization issues when using the actual DATABASE_URL (production/development environment).

## Problem

The vector database can become out of sync with the profile data when:
- Profile data is updated directly in the database
- Vector entries become stale from previous operations
- Data imports or migrations occur
- Manual profile changes are made

When this happens, semantic search returns experience IDs that don't exist in the current profile data, causing the `addProjectToExperience` tool to fail.

## Solutions

### 1. Automatic Sync (Recommended)

The system now includes automatic vector database sync detection. When the `addProjectToExperience` tool encounters a missing experience ID from semantic search, it will:

1. Check if the vector database is out of sync
2. Automatically sync the vector database with current profile data
3. Ask the user to retry their request

This happens automatically in production/development (not in test environment).

### 2. Manual Sync Script

You can manually check and sync the vector database using the provided script:

#### Check sync status for a specific user:
```bash
npm run db:sync-vector -- --check --userId=123
```

#### Sync vector database for a specific user:
```bash
npm run db:sync-vector -- --sync --userId=123
```

#### Force sync (even if already in sync):
```bash
npm run db:sync-vector -- --sync --userId=123 --force
```

#### Check all users (use with caution):
```bash
npm run db:sync-vector -- --check --all
```

#### Sync all users (use with caution):
```bash
npm run db:sync-vector -- --sync --all
```

### 3. Programmatic API

You can also use the sync methods programmatically:

#### Check if a user's vector database is in sync:
```typescript
import { profileVectorManager } from './server/services/ai/profile-vector-manager.js';

const syncStatus = await profileVectorManager.checkVectorProfileSync(userId, profileData);
console.log(syncStatus.inSync); // true/false
console.log(syncStatus.missingIds); // Experience IDs in profile but not in vectors
console.log(syncStatus.staleIds); // Experience IDs in vectors but not in current profile
```

#### Sync vector database with profile data:
```typescript
import { profileVectorManager } from './server/services/ai/profile-vector-manager.js';

// Only sync if out of sync
await profileVectorManager.syncVectorWithProfile(userId, profileData);

// Force sync regardless of current status
await profileVectorManager.syncVectorWithProfile(userId, profileData, { force: true });
```

## How It Works

### Sync Check Process
1. Retrieves all experience vectors for the user
2. Compares vector experience IDs with current profile experience IDs
3. Identifies missing IDs (in profile but not in vectors)
4. Identifies stale IDs (in vectors but not in current profile)
5. Returns sync status and ID lists

### Sync Process
1. Checks current sync status
2. If already in sync and not forced, skips sync
3. Clears all existing vectors for the user (in batches to prevent timeouts)
4. Imports fresh profile data to vector database
5. Verifies sync was successful

## Best Practices

1. **Use Automatic Sync**: Let the system handle sync automatically when ID mismatches are detected
2. **Regular Monitoring**: Periodically check sync status for critical users
3. **Batch Operations**: When syncing multiple users, do it during low-traffic periods
4. **Force Sync Sparingly**: Only use `--force` when you know the data has changed significantly
5. **Test Environment**: The sync is automatically skipped in test environment to prevent interference

## Troubleshooting

### Script Errors
- Ensure DATABASE_URL is set correctly
- Check that the user ID exists in the profiles table
- Verify vector database connection is working

### Performance Issues
- Large profiles with many experiences may take longer to sync
- Vector clearing is done in batches to prevent timeouts
- Consider running syncs during off-peak hours

### Sync Verification Failed
If sync verification fails after completion:
- Check for concurrent updates to profile data
- Verify vector database write permissions
- Try running sync again with `--force`

## Example Output

### Check Command
```bash
$ npm run db:sync-vector -- --check --userId=123

🔍 Vector sync check for user 123:
  - Profile experiences: 4
  - Vector experiences: 6
  - Missing from vectors: 1
  - Stale in vectors: 3
  - In sync: false

📊 Summary:
  - Users checked: 1
  - Users in sync: 0
  - Users out of sync: 1
```

### Sync Command
```bash
$ npm run db:sync-vector -- --sync --userId=123

🔄 Starting vector database sync for user 123...
🧹 Clearing existing vectors for user 123...
🧹 Clearing vector batch 1 for user 123...
✅ Deleted batch 1: 6 vectors (total: 6)
📥 Importing fresh profile data for user 123...
✅ Vector database sync completed for user 123
🎉 Vector database sync verification successful

📊 Summary:
  - Users synced: 1
  - Users failed: 0
```