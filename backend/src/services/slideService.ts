import { GeminiService } from './geminiService';

interface Slide {
  title: string;
  content: string[];
  notes?: string;
}

interface PresentationMetadata {
  totalSlides: number;
  estimatedDuration: number;
  lastGenerated: Date;
}

interface PresentationStructure {
  title: string;
  slides: Slide[];
  presentationMetadata: PresentationMetadata;
}

export class SlideService {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  async generateSlides(topic: string, content: string): Promise<PresentationStructure> {
    try {
      const slideStructure = await this.geminiService.generateSlideOutline(topic, content);
      return {
        title: slideStructure.title,
        slides: slideStructure.slides,
        presentationMetadata: {
          totalSlides: slideStructure.slides.length,
          estimatedDuration: slideStructure.slides.length * 2, // 2 minutes per slide
          lastGenerated: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate slides: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}