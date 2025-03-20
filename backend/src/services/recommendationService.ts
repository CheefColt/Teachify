import { Resource, IResource } from '../models/Resource';
import { Content } from '../models/Content';
import { GeminiService } from './geminiService';
import { Types } from 'mongoose';

export class RecommendationService {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  async getResourceRecommendations(contentId: string, limit: number = 5): Promise<IResource[]> {
    try {
      if (!Types.ObjectId.isValid(contentId)) {
        throw new Error('Invalid content ID');
      }

      const content = await Content.findById(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      // Get content keywords using AI
      const keywords = await this.geminiService.extractKeywords(content.description);

      // Find related resources based on keywords
      const recommendations = await Resource.find({
        $text: { 
          $search: keywords.join(' '),
          $language: 'english'
        },
        content: { $ne: new Types.ObjectId(contentId) }
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .populate('subject');

      return recommendations;
    } catch (error) {
      throw new Error(`Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}