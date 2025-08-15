import { Router, Request, Response } from "express";
import { storage } from "../services/storage.service";
import { requireAuth, containerMiddleware } from "../middleware";
import { interestSchema, type User } from "@shared/schema";
import { UserOnboardingController } from '../controllers/user-onboarding-controller';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth, containerMiddleware);

// Onboarding routes
router.post("/interest", async (req: Request, res: Response) => {
  try {
    const { interest } = interestSchema.parse(req.body);
    const user = (req as any).user as User;

    const updatedUser = await storage.updateUserInterest(user.id, interest);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Update interest error:", error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to update interest" });
    }
  }
});

// Profile extraction routes (protected) - Using UserOnboarding controller
router.post("/extract-profile", async (req: Request, res: Response) => {
  const controller = req.scope.resolve<UserOnboardingController>('userOnboardingController');
  await controller.extractProfile(req, res);
});

// Save selected profile data (protected)
router.post("/save-profile", async (req: Request, res: Response) => {
  const controller = req.scope.resolve<UserOnboardingController>('userOnboardingController');
  await controller.saveProfile(req, res);
});

router.post("/complete", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    console.log('Completing onboarding for user:', user.id);
    const updatedUser = await storage.completeOnboarding(user.id);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Complete onboarding error:", error);
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

export default router;
