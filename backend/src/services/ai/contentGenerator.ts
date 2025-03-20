import { model } from './config';

export interface GeneratedContent {
    title: string;
    content: string;
    keyPoints: string[];
    examples: string[];
    references: string[];
    updatedAt: Date;
}

export interface LectureOutline {
    title: string;
    sections: any[];
    keyPoints: string[];
    examples: string[];
    exercises: string[];
}

export interface ContentGenerationParams {
    topic: string;
    subtopics?: string[];
    previousContent?: string;
    targetAudience?: string;
    complexity?: 'basic' | 'intermediate' | 'advanced';
}

export class ContentGenerator {
    async generateContent(params: ContentGenerationParams): Promise<GeneratedContent> {
        const { topic, subtopics, previousContent, targetAudience = 'college students', complexity = 'intermediate' } = params;

        const prompt = `
        Generate comprehensive educational content for the following topic:
        Topic: ${topic}
        ${subtopics ? `Subtopics: ${subtopics.join(', ')}` : ''}
        Target Audience: ${targetAudience}
        Complexity Level: ${complexity}
        ${previousContent ? 'Update and enhance the following content:' + previousContent : ''}

        Provide a structured response in JSON format with:
        - Detailed content explanation
        - Key points to remember
        - Practical examples
        - Academic references
        
        Return only valid JSON without any additional text.`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('Empty response from AI model');
            }

            const parsedResponse = JSON.parse(text);
            return {
                title: topic,
                content: parsedResponse.content,
                keyPoints: parsedResponse.keyPoints,
                examples: parsedResponse.examples,
                references: parsedResponse.references,
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('Error generating content:', error);
            throw new Error('Failed to generate content');
        }
    }

async generateLectureOutline(title: string, context: string): Promise<LectureOutline> {
    const prompt = `
    Generate a detailed lecture outline for the topic titled "${title}" using the following context:
    ${context}

    Provide a structured outline with sections, key points, examples, and exercises.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text) {
            throw new Error('Empty response from AI model');
        }

        const parsedResponse = JSON.parse(text);
        return {
            title: title,
            sections: parsedResponse.sections,
            keyPoints: parsedResponse.keyPoints, // New addition
            examples: parsedResponse.examples,   // New addition
            exercises: parsedResponse.exercises  // New addition
        };
    } catch (error) {
        console.error('Error generating lecture outline:', error);
        throw new Error('Failed to generate lecture outline');
    }
}

    async enhanceContent(existingContent: GeneratedContent, newInformation: string): Promise<GeneratedContent> {
        const prompt = `
        Update and enhance this educational content with new information:
        
        Existing Content: ${JSON.stringify(existingContent)}
        New Information: ${newInformation}

        Provide an updated version that:
        - Integrates the new information seamlessly
        - Updates examples if relevant
        - Adds new references if applicable
        - Maintains the same structure
        
        Return only valid JSON without any additional text.`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('Empty response from AI model');
            }

            const parsedResponse = JSON.parse(text);
            return {
                ...parsedResponse,
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('Error enhancing content:', error);
            throw new Error('Failed to enhance content');
        }
    }
}