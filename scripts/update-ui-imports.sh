#!/bin/bash

# Update imports from local ui/ directory to @journey/components
# Keep toaster, user-menu, sidebar, organization-selector, multi-select-input, user-search-input as local

echo "Updating imports from components/ui/ to @journey/components..."

# Find all .ts and .tsx files excluding components/ui/ directory
find packages/ui/src -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/components/ui/*" | while read file; do
  # Update imports for base components (not toaster, user-menu, etc.)
  perl -i -pe 's|from\s+['"'"'"](\.\./)+components/ui/(button|card|form|input|label|separator|radio-group|tooltip|checkbox)['"'"'"]|from '"'"'@journey/components'"'"'|g' "$file"

  # Update imports with destructured exports
  perl -i -pe 's|}\s+from\s+['"'"'"](\.\./)+components/ui/(button|card|form|input|label|separator|radio-group|tooltip|checkbox)['"'"'"]|} from '"'"'@journey/components'"'"'|g' "$file"

  echo "Updated: $file"
done

echo "Done!"
