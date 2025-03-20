import { Request, Response } from 'express';
import { RecommendationService } from '../services/recommendationService';

export class RecommendationController {
  private recommendationService: RecommendationService;

  constructor() {
    this.recommendationService = new RecommendationService();
  }

  getRecommendations = async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

      if (!contentId) {
        return res.status(400).json({ error: 'Content ID is required' });
      }

      const recommendations = await this.recommendationService.getResourceRecommendations(
        contentId,
        limit
      );

      res.json({
        success: true,
        count: recommendations.length,
        data: recommendations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recommendations'
      });
    }
  };
}