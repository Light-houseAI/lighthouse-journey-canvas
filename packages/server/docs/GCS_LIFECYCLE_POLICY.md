# GCS Lifecycle Policy Configuration

## Overview

This document describes the Google Cloud Storage lifecycle policy configuration required for automatic cleanup of soft-deleted files.

## Problem

When files are deleted through the application:

1. Files are moved to the `deleted/` prefix in GCS
2. User's storage quota is updated in the database
3. However, files remain in GCS indefinitely, incurring storage costs

## Solution

Configure a GCS lifecycle policy to automatically delete files in the `deleted/` prefix after a retention period.

## Configuration

### Using gcloud CLI

```bash
# Create lifecycle policy configuration file
cat > lifecycle-config.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "matchesPrefix": ["deleted/"],
          "age": 30
        }
      }
    ]
  }
}
EOF

# Apply to bucket
gsutil lifecycle set lifecycle-config.json gs://YOUR_BUCKET_NAME
```

### Using Terraform

```hcl
resource "google_storage_bucket" "file_uploads" {
  name     = "your-bucket-name"
  location = "US"

  lifecycle_rule {
    condition {
      matches_prefix = ["deleted/"]
      age            = 30
    }
    action {
      type = "Delete"
    }
  }
}
```

### Using Google Cloud Console

1. Navigate to Cloud Storage > Buckets
2. Select your bucket
3. Go to "Lifecycle" tab
4. Click "Add Rule"
5. Configure:
   - **Action**: Delete object
   - **Condition**:
     - Matches prefix: `deleted/`
     - Age: 30 days
6. Click "Create"

## Retention Period

**Recommended: 30 days**

This provides:

- Time to recover from accidental deletions
- Audit trail for compliance
- Balance between storage costs and data retention

You can adjust this based on your requirements:

- **Shorter (7-14 days)**: Lower storage costs, less recovery time
- **Longer (60-90 days)**: More recovery time, higher storage costs

## Verification

To verify the lifecycle policy is applied:

```bash
# Check lifecycle configuration
gsutil lifecycle get gs://YOUR_BUCKET_NAME

# List files in deleted/ prefix
gsutil ls gs://YOUR_BUCKET_NAME/deleted/

# Check file age
gsutil ls -l gs://YOUR_BUCKET_NAME/deleted/
```

## Monitoring

Set up monitoring to track:

1. Number of files in `deleted/` prefix
2. Storage usage in `deleted/` prefix
3. Lifecycle policy execution

```bash
# Get storage usage by prefix
gsutil du -s gs://YOUR_BUCKET_NAME/deleted/
```

## Related Database Changes

The lifecycle policy works with the database soft-delete mechanism:

1. **user_files table**: Tracks file metadata with `deletedAt` timestamp
2. **Storage quota**: Updated immediately when file is soft-deleted
3. **GCS**: File moved to `deleted/` prefix and cleaned up after retention period

## Migration Notes

For existing files in the `deleted/` prefix:

- The lifecycle policy will apply retroactively based on file creation time
- Files older than the retention period will be deleted in the next lifecycle sweep (typically daily)
- No manual cleanup required

## Environment Variables

No additional environment variables needed. The policy is configured at the bucket level.

## Testing

To test the lifecycle policy:

1. **In development**: Use a shorter retention period (e.g., 1 day)
2. **Delete a test file** through the application
3. **Wait for retention period** to elapse
4. **Verify deletion** using `gsutil ls`

```bash
# Set 1-day retention for testing
cat > lifecycle-test.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "matchesPrefix": ["deleted/"],
          "age": 1
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle-test.json gs://YOUR_TEST_BUCKET_NAME
```

## Rollback

To remove the lifecycle policy:

```bash
# Remove all lifecycle rules
gsutil lifecycle set /dev/null gs://YOUR_BUCKET_NAME
```

## Cost Impact

Estimated savings with 30-day retention:

- Average file size: 1MB (PDF)
- Files deleted per month: 100
- Storage cost: ~$0.020/GB/month
- Savings: ~$2/month per 100 files

## Security Considerations

1. **Access control**: Ensure only authorized users can delete files
2. **Audit logging**: Enable Cloud Audit Logs for bucket operations
3. **Backup**: Consider backing up critical files before deletion
4. **Recovery**: Implement file recovery mechanism if needed (e.g., copy to separate bucket before deletion)

## References

- [GCS Lifecycle Management Documentation](https://cloud.google.com/storage/docs/lifecycle)
- [gsutil lifecycle command](https://cloud.google.com/storage/docs/gsutil/commands/lifecycle)
- [Terraform google_storage_bucket resource](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/storage_bucket)
