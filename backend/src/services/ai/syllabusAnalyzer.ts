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

        console.log('Starting syllabus analysis with text length:', syllabusText.length);
        console.log('Sample of syllabus text:', syllabusText.substring(0, 100) + '...');

        // Check if we're dealing with limited text extraction
        const isLimitedExtraction = syllabusText.includes('appears to be a scanned PDF') || 
                                 syllabusText.includes('Error extracting text') ||
                                 syllabusText.includes('Using placeholder text');

        const prompt = isLimitedExtraction 
            ? `
            Create a generic subject analysis based on this title and code:
            ${syllabusText}
            
            Return valid JSON with this structure:
            {
              "topics": [
                {
                  "title": "Introduction to the Subject",
                  "subtopics": ["Overview", "Key Concepts", "History and Background"],
                  "estimatedDuration": 3,
                  "learningObjectives": ["Understand fundamental concepts", "Identify key principles", "Recognize historical context"]
                },
                {
                  "title": "Core Concepts",
                  "subtopics": ["Theoretical Foundations", "Practical Applications", "Case Studies"],
                  "estimatedDuration": 5,
                  "learningObjectives": ["Apply theoretical concepts", "Analyze real-world examples", "Develop practical skills"]
                }
              ],
              "totalDuration": 15,
              "courseObjectives": ["Develop comprehensive understanding of the subject", "Build practical skills in application"],
              "prerequisites": ["Basic knowledge in the field", "Fundamental concepts"]
            }
            `
            : `
            Analyze this syllabus and provide a structured response in JSON format with the following:
            - List of topics with subtopics
            - Estimated duration for each topic in hours
            - Learning objectives for each topic
            - Overall course objectives
            - Prerequisites
            
            Syllabus content:
            ${syllabusText}
            
            Return only valid JSON with this exact structure:
            {
              "topics": [
                {
                  "title": "Introduction to Programming",
                  "subtopics": ["History of Programming", "Basic Concepts", "Development Environments"],
                  "estimatedDuration": 3,
                  "learningObjectives": ["Understand programming fundamentals", "Set up development environment", "Write simple programs"]
                },
                {
                  "title": "Data Structures",
                  "subtopics": ["Arrays", "Linked Lists", "Trees", "Graphs"],
                  "estimatedDuration": 5,
                  "learningObjectives": ["Implement basic data structures", "Analyze algorithmic complexity", "Apply appropriate data structures"]
                }
              ],
              "totalDuration": 15,
              "courseObjectives": ["Develop problem-solving skills", "Build proficiency in programming language", "Create functional applications"],
              "prerequisites": ["Basic computer skills", "Logical thinking", "Mathematical aptitude"]
            }
            
            Ensure the response is valid JSON without any additional text, markdown formatting, or code blocks.`;

        console.log('Sending analysis prompt to Gemini API...');
        console.log('Using prompt for', isLimitedExtraction ? 'limited text extraction' : 'full syllabus analysis');

        try {
            // Use generateContent which is designed to work with text directly
            const rawResult = await this.geminiService.generateContent(prompt);
            console.log('Raw AI response type:', typeof rawResult);
            console.log('Raw AI response keys:', Object.keys(rawResult || {}));
            
            if (!rawResult) {
                console.error('Empty response received from AI');
                throw new Error('Empty response received from AI');
            }
            
            // Transform or validate the response to match our expected format
            const transformedResult = this.transformToAnalyzedSyllabus(rawResult);
            console.log('Transformed result:', JSON.stringify(transformedResult, null, 2));
            
            if (!this.validateSyllabusResponse(transformedResult)) {
                console.error('Invalid response structure:', JSON.stringify(transformedResult, null, 2));
                throw new Error('Invalid response structure from AI model');
            }

            return transformedResult;
        } catch (error: any) {
            console.error('Syllabus analysis error:', error);
            if (error instanceof SyntaxError) {
                throw new Error('Failed to parse AI response as JSON');
            }
            throw new Error(`Syllabus analysis failed: ${error.message}`);
        }
    }
    
    // Helper method to transform API response to AnalyzedSyllabus
    private transformToAnalyzedSyllabus(data: any): AnalyzedSyllabus {
        try {
            // If the API returned data in a different format, transform it here
            // For example, if courseInfo, topics, objectives are in different properties
            
            // Check if we have a SyllabusAnalysis type response (from geminiService.analyzeSyllabus)
            if (data.courseInfo && data.topics && data.objectives) {
                return {
                    topics: data.topics.map((topic: any) => ({
                        title: topic.title || "Untitled Topic",
                        subtopics: topic.subtopics || [],
                        estimatedDuration: 2, // Default value if not provided
                        learningObjectives: data.objectives || []
                    })),
                    totalDuration: data.topics.length * 2, // Estimate based on number of topics
                    courseObjectives: data.objectives || [],
                    prerequisites: []  // Default empty array if not provided
                };
            }
            
            // If it's already in the correct format, return it
            if (this.validateSyllabusResponse(data)) {
                return data;
            }
            
            // If we have a different structure, try to adapt it
            return {
                topics: Array.isArray(data.topics) ? data.topics.map((t: any) => ({
                    title: t.title || "Untitled Topic",
                    subtopics: Array.isArray(t.subtopics) ? t.subtopics : [],
                    estimatedDuration: typeof t.estimatedDuration === 'number' ? t.estimatedDuration : 2,
                    learningObjectives: Array.isArray(t.learningObjectives) ? t.learningObjectives : []
                })) : [],
                totalDuration: typeof data.totalDuration === 'number' ? data.totalDuration : 10,
                courseObjectives: Array.isArray(data.courseObjectives) ? data.courseObjectives : [],
                prerequisites: Array.isArray(data.prerequisites) ? data.prerequisites : []
            };
        } catch (e) {
            console.error('Error transforming data:', e);
            throw new Error('Failed to transform AI response to expected format');
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
        Each URL should be a string and fully qualified.
        Format the response as a plain JSON array without any additional text, 
        markdown formatting, or code blocks.`;

        try {
            const resources = await this.geminiService.generateContent(prompt);
            console.log('Resource suggestion response:', resources);

            if (!Array.isArray(resources) || !resources.every(r => typeof r === 'string')) {
                console.error('Invalid resource list structure:', resources);
                throw new Error('Invalid resource list structure');
            }

            return resources;
        } catch (error: any) {
            console.error('Resource suggestion error:', error);
            if (error instanceof SyntaxError) {
                throw new Error('Failed to parse AI response as JSON');
            }
            throw new Error(`Resource suggestion failed: ${error.message}`);
        }
    }
}