/**
 * Privacy Consent Routes
 *
 * Endpoints for storing and managing user privacy consent records.
 * Used by desktop app to record privacy agreement acceptance.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Storage } from '@google-cloud/storage';

const router = Router();

// Validation schema for consent submission
const consentSchema = z.object({
  consentType: z.string().min(1),
  accepted: z.boolean(),
  acceptedAt: z.string().datetime(),
  deviceId: z.string().optional(),
  appVersion: z.string().optional(),
  platform: z.string().optional(),
  consentDetails: z.record(z.any()).optional(),
});

// Initialize GCS client (uses default credentials from environment)
let storage: Storage | null = null;
let bucket: any = null;

function initializeGCS() {
  if (!storage) {
    try {
      storage = new Storage();
      const bucketName = process.env.GCP_BUCKET_NAME || process.env.GOOGLE_CLOUD_BUCKET;
      if (bucketName) {
        bucket = storage.bucket(bucketName);
        console.log(`[PRIVACY] GCS initialized with bucket: ${bucketName}`);
      } else {
        console.warn('[PRIVACY] GCS bucket not configured - consent will only be logged');
      }
    } catch (error) {
      console.warn('[PRIVACY] Could not initialize GCS:', error);
    }
  }
  return { storage, bucket };
}

/**
 * POST /api/v2/privacy/consent
 * Store privacy consent record
 *
 * This endpoint does NOT require authentication since consent
 * is collected before the user logs in.
 */
router.post('/consent', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const consentData = consentSchema.parse(req.body);

    // Generate unique consent ID
    const consentId = `consent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Build consent record
    const consentRecord = {
      id: consentId,
      ...consentData,
      createdAt: new Date().toISOString(),
      ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
    };

    console.log(`[PRIVACY] Recording consent: ${consentId}`, {
      type: consentData.consentType,
      accepted: consentData.accepted,
      deviceId: consentData.deviceId,
      platform: consentData.platform,
    });

    // Try to store in GCS
    const { bucket: gcsBucket } = initializeGCS();

    if (gcsBucket) {
      try {
        const fileName = `privacy-consents/${consentData.consentType}/${new Date().toISOString().split('T')[0]}/${consentId}.json`;
        const file = gcsBucket.file(fileName);

        await file.save(JSON.stringify(consentRecord, null, 2), {
          contentType: 'application/json',
          metadata: {
            consentType: consentData.consentType,
            deviceId: consentData.deviceId || 'unknown',
            platform: consentData.platform || 'unknown',
          },
        });

        console.log(`[PRIVACY] Consent stored in GCS: ${fileName}`);

        return res.status(201).json({
          success: true,
          consentId,
          storedIn: 'gcs',
          message: 'Privacy consent recorded successfully',
        });
      } catch (gcsError: any) {
        console.error('[PRIVACY] Failed to store consent in GCS:', gcsError.message);
        // Fall through to return success anyway - we logged it
      }
    }

    // If GCS fails or not configured, still return success
    // The consent was logged and can be retrieved from logs
    return res.status(201).json({
      success: true,
      consentId,
      storedIn: 'logs',
      message: 'Privacy consent recorded (logs only)',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid consent data',
        details: error.errors,
      });
    }

    console.error('[PRIVACY] Error recording consent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record consent',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/privacy/consent/:deviceId
 * Check if a device has accepted privacy agreement
 * (For future use - e.g., syncing consent status across reinstalls)
 */
router.get('/consent/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const { bucket: gcsBucket } = initializeGCS();

    if (!gcsBucket) {
      return res.status(200).json({
        found: false,
        message: 'GCS not configured',
      });
    }

    // Search for consent files for this device
    const prefix = 'privacy-consents/privacy_agreement/';
    const [files] = await gcsBucket.getFiles({ prefix });

    // Find any consent for this device
    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        if (metadata.metadata?.deviceId === deviceId) {
          const [content] = await file.download();
          const consent = JSON.parse(content.toString());
          return res.status(200).json({
            found: true,
            consent: {
              accepted: consent.accepted,
              acceptedAt: consent.acceptedAt,
              consentType: consent.consentType,
            },
          });
        }
      } catch {
        // Skip files we can't read
        continue;
      }
    }

    return res.status(200).json({
      found: false,
      message: 'No consent record found for this device',
    });
  } catch (error: any) {
    console.error('[PRIVACY] Error checking consent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check consent',
      message: error.message,
    });
  }
});

export default router;
