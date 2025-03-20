import express from 'express';
import { RecommendationController } from '../controllers/recommendationController';
import { auth } from '../middleware/auth';

const router = express.Router();
const recommendationController = new RecommendationController();

router.get(
  '/:contentId',
  auth,
  recommendationController.getRecommendations
);

export default router;