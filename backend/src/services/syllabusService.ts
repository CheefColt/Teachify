import { Model } from 'mongoose';
import { GeminiService } from './geminiService';

interface SyllabusData {
  courseInfo: {
    title: string;
    code: string;
    instructor: string;
    term: string;
  };
  topics: Array<{
    title: string;
    subtopics: string[];
  }>;
  objectives: string[];
  schedule: Array<{
    week: number;
    topic: string;
    activities: string[];
  }>;
}

export class SyllabusService {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  async processSyllabus(syllabusText: string): Promise<SyllabusData> {
    try {
      const structuredData = await this.geminiService.analyzeSyllabus(syllabusText);
      return {
        courseInfo: structuredData.courseInfo,
        topics: structuredData.topics,
        objectives: structuredData.objectives,
        schedule: structuredData.schedule
      };
    } catch (error) {
      throw new Error(`Failed to process syllabus: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}