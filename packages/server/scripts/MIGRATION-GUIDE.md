# Profile to Hierarchy Migration Guide

This guide explains how to migrate existing profile data to the new hierarchy node structure.

## Overview

The migration system consists of:
- **Main Migration Script**: `migrate-profiles-to-hierarchy.ts` - Performs the actual migration
- **Test Script**: `test-migration.ts` - Validates the migration setup before running
- **Safety Features**: Dry-run mode, duplicate detection, error handling

## Quick Start

### 1. Test the Migration Setup
```bash
# Run the test script to validate everything is working
tsx server/scripts/test-migration.ts
```

### 2. Dry Run (Recommended First Step)
```bash
# Safe dry run - shows what would be migrated without making changes
tsx server/scripts/migrate-profiles-to-hierarchy.ts
```

### 3. Live Migration
```bash
# Perform the actual migration
tsx server/scripts/migrate-profiles-to-hierarchy.ts --live
```

## Migration Script Options

### Basic Usage
```bash
# Dry run (default - safe to run anytime)
tsx server/scripts/migrate-profiles-to-hierarchy.ts

# Live migration
tsx server/scripts/migrate-profiles-to-hierarchy.ts --live
```

### Advanced Options
```bash
# Custom batch size (process 5 profiles at a time)
tsx server/scripts/migrate-profiles-to-hierarchy.ts --live --batch-size=5

# Force migrate ALL profiles (even users who already have hierarchy nodes)
tsx server/scripts/migrate-profiles-to-hierarchy.ts --live --force-all

# Show help
tsx server/scripts/migrate-profiles-to-hierarchy.ts --help
```

## What Gets Migrated

### Profile Experiences → Job Nodes
- **Title** → `meta.title`
- **Company** → `meta.company` 
- **Location** → `meta.location`
- **Employment Type** → `meta.employmentType`
- **Start/End Dates** → `meta.startDate/endDate`
- **Description** → `meta.description`
- **Responsibilities** → `meta.responsibilities`

### Profile Education → Education Nodes
- **School** → `meta.institution`
- **Degree** → `meta.degree`
- **Field** → `meta.field`
- **Start/End Dates** → `meta.startDate/endDate`
- **Location** → `meta.location`
- **Description** → `meta.description`

### Skills
- **Skipped** - Skills are no longer part of the hierarchy system

## Safety Features

### 1. Duplicate Prevention
- By default, skips users who already have hierarchy nodes
- Use `--force-all` to override this behavior

### 2. Dry Run Mode
- Default mode shows what would be migrated
- No actual changes made to database
- Safe to run multiple times

### 3. Error Handling
- Continues processing even if individual profiles fail
- Detailed error reporting at the end
- Batch processing prevents database overload

### 4. Migration Tracking
- Nodes created by migration have `migratedFromProfile: true` flag
- Can be used to identify migrated data later

## Expected Output

### Dry Run Example
```
🚀 Starting Profile to Hierarchy Migration
==================================================
Mode: 🧪 DRY RUN
Batch Size: 10
Skip users with existing nodes: true
==================================================

📊 Found 25 profiles to process

📦 Processing batch 1/3 (10 profiles)

👤 Processing profile 1 for user 5
   📝 Converting 3 experiences to job nodes
     🧪 [DRY RUN] Would create job node: Software Engineer at TechCorp
     🧪 [DRY RUN] Would create job node: Developer at StartupCo
   🎓 Converting 1 education entries to education nodes
     🧪 [DRY RUN] Would create education node: BS Computer Science at State University
   ✅ Created 4 nodes for profile 1

...

==================================================
📈 MIGRATION SUMMARY
==================================================
⏱️  Duration: 2.34 seconds
📊 Profiles processed: 20
⏭️  Profiles skipped: 5
❌ Profiles with errors: 0
🔗 Total nodes created: 67
💼 Job nodes created: 45
🎓 Education nodes created: 22

🧪 This was a DRY RUN - no actual changes were made
💡 Run with --live to perform the actual migration
==================================================
```

## Troubleshooting

### Common Issues

1. **"Hierarchy container initialization failed"**
   - Ensure the server dependencies are properly installed
   - Check database connection settings

2. **"No profiles found to migrate"**
   - Verify profiles exist in the database
   - Check if all users already have hierarchy nodes

3. **"Node creation failed"**
   - Check database permissions
   - Verify hierarchy tables exist and are properly set up

### Recovery
- Migration is idempotent - safe to run multiple times
- Failed profiles are logged and can be retried individually
- Original profile data remains unchanged

## Best Practices

1. **Always test first**: Run the test script before migration
2. **Start with dry run**: Review what will be migrated
3. **Use small batches**: Start with `--batch-size=5` for large datasets
4. **Monitor progress**: Migration provides detailed logging
5. **Backup first**: Consider backing up the database before live migration

## Post-Migration

After successful migration:

1. **Verify data**: Check a few users in the UI to ensure nodes appear correctly
2. **Test onboarding**: Ensure new user onboarding still works
3. **Monitor logs**: Watch for any issues with the new hierarchy system
4. **Clean up**: Once confident, the old profile tables can be removed

## Support

If you encounter issues:
1. Check the error logs in the migration summary
2. Run the test script to validate setup
3. Try a smaller batch size
4. Use dry-run mode to debug specific profiles