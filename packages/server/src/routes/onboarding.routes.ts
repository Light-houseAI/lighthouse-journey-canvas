import { Router } from "express";

import { CONTROLLER_TOKENS } from '../core/container-tokens.js';
import { containerMiddleware,requireAuth } from "../middleware/index.js";

const router: any = Router();

// Apply auth middleware to all routes
router.use(requireAuth, containerMiddleware);

// Onboarding routes - Using UserOnboardingController which has all the required methods
router.post('/interest', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.USER_ONBOARDING_CONTROLLER
  );
  return controller.updateInterest(req, res);
});

router.post('/extract-profile', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.USER_ONBOARDING_CONTROLLER
  );
  return controller.extractProfile(req, res);
});

router.post('/save-profile', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.USER_ONBOARDING_CONTROLLER
  );
  return controller.saveProfile(req, res);
});

router.post('/complete', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.USER_ONBOARDING_CONTROLLER
  );
  return controller.completeOnboarding(req, res);
});

export default router;
