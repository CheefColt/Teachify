import { GeminiService } from '../../services/geminiService';

export interface AnalyzedTopic {
    title: string;
    subtopics: string[];
    estimatedDuration: number;
    learningObjectives: string[];
}

export interface AnalyzedSyllabus {
    topics: AnalyzedTopic[];
    totalDuration: number;
    courseObjectives: string[];
    prerequisites: string[];
}

export class SyllabusAnalyzer {
    private geminiService: GeminiService;

    constructor() {
        this.geminiService = new GeminiService();
    }

    private validateSyllabusResponse(data: any): data is AnalyzedSyllabus {
        return (
            Array.isArray(data.topics) &&
            typeof data.totalDuration === 'number' &&
            Array.isArray(data.courseObjectives) &&
            Array.isArray(data.prerequisites)
        );
    }

    async analyzeSyllabus(syllabusText: string): Promise<AnalyzedSyllabus> {
        if (!syllabusText?.trim()) {
            throw new Error('Syllabus text cannot be empty');
        }

        const prompt = `
        Analyze this syllabus and provide a structured response in JSON format with the following:
        - List of topics with subtopics
        - Estimated duration for each topic in hours
        - Learning objectives for each topic
        - Overall course objectives
        - Prerequisites
        
        Syllabus content:
        ${syllabusText}
        
        Return only valid JSON without any additional text or formatting.`;

        try {
            const result = await this.geminiService.analyzeSyllabus(syllabusText);
            if (!this.validateSyllabusResponse(result)) {
                throw new Error('Invalid response structure from AI model');
            }

            return result;
        } catch (error: any) {
            if (error instanceof SyntaxError) {
                throw new Error('Failed to parse AI response as JSON');
            }
            throw new Error(`Syllabus analysis failed: ${error.message}`);
        }
    }

    async suggestResources(topic: AnalyzedTopic): Promise<string[]> {
        if (!topic?.title) {
            throw new Error('Invalid topic data');
        }

        const prompt = `
        Suggest learning resources for the following topic:
        ${JSON.stringify(topic)}
        
        Return only a JSON array of URLs to reliable educational resources.
        Each URL should be a string and fully qualified.`;

        try {
            const resources = await this.geminiService.analyzeSyllabus(prompt);

            if (!Array.isArray(resources) || !resources.every(r => typeof r === 'string')) {
                throw new Error('Invalid resource list structure');
            }

            return resources;
        } catch (error: any) {
            if (error instanceof SyntaxError) {
                throw new Error('Failed to parse AI response as JSON');
            }
            throw new Error(`Resource suggestion failed: ${error.message}`);
        }
    }
}