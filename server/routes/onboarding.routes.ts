import { Router } from "express";

import { UserOnboardingController } from '../controllers/user-onboarding-controller';
import { CONTROLLER_TOKENS } from '../core/container-tokens';
import { containerMiddleware,requireAuth } from "../middleware";

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth, containerMiddleware);

// Onboarding routes - Using UserOnboardingController which has all the required methods
router.post('/interest', async (req, res) => {
  const controller = req.scope.resolve<UserOnboardingController>(
    CONTROLLER_TOKENS.USER_ONBOARDING_CONTROLLER
  );
  await controller.updateInterest(req, res);
});

router.post('/extract-profile', async (req, res) => {
  const controller = req.scope.resolve<UserOnboardingController>(
    CONTROLLER_TOKENS.USER_ONBOARDING_CONTROLLER
  );
  await controller.extractProfile(req, res);
});

router.post('/save-profile', async (req, res) => {
  const controller = req.scope.resolve<UserOnboardingController>(
    CONTROLLER_TOKENS.USER_ONBOARDING_CONTROLLER
  );
  await controller.saveProfile(req, res);
});

router.post('/complete', async (req, res) => {
  const controller = req.scope.resolve<UserOnboardingController>(
    CONTROLLER_TOKENS.USER_ONBOARDING_CONTROLLER
  );
  await controller.completeOnboarding(req, res);
});

export default router;
