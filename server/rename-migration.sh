#!/bin/bash

# Usage: ./rename-migration.sh "old_name" "new_description"
# Example: ./rename-migration.sh "20250829195432_fluffy_elephant" "add_user_preferences_table"

if [ $# -ne 2 ]; then
    echo "Usage: $0 <old_migration_name> <new_description>"
    echo "Example: $0 '20250829195432_fluffy_elephant' 'add_user_preferences_table'"
    exit 1
fi

OLD_NAME="$1"
NEW_DESC="$2"

# Extract timestamp from old name
TIMESTAMP=$(echo "$OLD_NAME" | grep -o '^[0-9]\{14\}')

if [ -z "$TIMESTAMP" ]; then
    echo "Error: Could not extract timestamp from $OLD_NAME"
    exit 1
fi

NEW_NAME="${TIMESTAMP}_${NEW_DESC}"

# Rename the migration file
if [ -f "migrations/${OLD_NAME}.sql" ]; then
    mv "migrations/${OLD_NAME}.sql" "migrations/${NEW_NAME}.sql"
    echo "✅ Renamed migration file: ${OLD_NAME}.sql → ${NEW_NAME}.sql"
    
    # Update the journal file
    sed -i.bak "s/\"${OLD_NAME}\"/\"${NEW_NAME}\"/g" migrations/meta/_journal.json
    echo "✅ Updated _journal.json"
    echo ""
    echo "⚠️  IMPORTANT: Review the journal changes before committing!"
    echo "   Check: migrations/meta/_journal.json"
else
    echo "❌ Migration file not found: migrations/${OLD_NAME}.sql"
    exit 1
fi