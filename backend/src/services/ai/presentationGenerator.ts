import { model } from './config';
import { GeneratedContent } from './contentGenerator';

export interface Slide {
    title: string;
    content: string[];
    notes?: string;
    imagePrompt?: string;
}

export interface GeneratedPresentation {
    title: string;
    description: string;
    slides: Slide[];
    estimatedDuration: number;
    createdAt: Date;
}

export interface PresentationParams {
    content: GeneratedContent;
    style?: 'academic' | 'professional' | 'casual';
    duration?: number;
    includeImages?: boolean;
}

export class PresentationGenerator {
    async generatePresentation(params: PresentationParams): Promise<GeneratedPresentation> {
        const { content, style = 'professional', duration = 30, includeImages = false } = params;

        const prompt = `
        Create a presentation based on this educational content:
        Title: ${content.title}
        Content: ${content.content}
        Key Points: ${content.keyPoints.join(', ')}
        Examples: ${content.examples.join(', ')}
        
        Requirements:
        - Style: ${style}
        - Target Duration: ${duration} minutes
        - ${includeImages ? 'Include image generation prompts for each slide' : 'No images required'}
        
        Return a JSON object with:
        - title: string
        - description: string
        - slides: array of slide objects
        - estimatedDuration: number (in minutes)
        
        Each slide should have:
        - title: string
        - content: array of bullet points
        - notes: string (presenter notes)
        ${includeImages ? '- imagePrompt: string (for image generation)' : ''}
        
        Follow these presentation best practices:
        - Keep bullet points concise and clear
        - Include engaging examples
        - Maintain consistent formatting
        - Balance text and visual elements
        - Include presenter notes for context
        
        Return only valid JSON without any additional text.`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('Empty response from AI model');
            }

            const presentation = JSON.parse(text);
            return {
                ...presentation,
                createdAt: new Date()
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to generate presentation: ${errorMessage}`);
        }
    }

    async customizePresentation(
        presentation: GeneratedPresentation,
        customization: {
            style?: string;
            audience?: string;
            emphasis?: string[];
        }
    ): Promise<GeneratedPresentation> {
        const prompt = `
        Customize this presentation based on the following requirements:
        
        Current Presentation: ${JSON.stringify(presentation)}
        
        Customization Requirements:
        ${customization.style ? `Style: ${customization.style}` : ''}
        ${customization.audience ? `Target Audience: ${customization.audience}` : ''}
        ${customization.emphasis ? `Emphasis on: ${customization.emphasis.join(', ')}` : ''}
        
        Modify the presentation while:
        - Maintaining the core content
        - Adjusting language and examples for the target audience
        - Emphasizing specified topics
        - Updating presenter notes accordingly
        
        Return only valid JSON without any additional text.`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('Empty response from AI model');
            }

            const customized = JSON.parse(text);
            return {
                ...customized,
                createdAt: new Date()
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to customize presentation: ${errorMessage}`);
        }
    }
}
