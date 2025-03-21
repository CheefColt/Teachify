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

// Helper function to extract JSON from markdown response
function extractJsonFromText(text: string): string {
    console.log("Raw response:", text.substring(0, 100) + "...");
    
    // If the response is wrapped in markdown code blocks, extract the JSON
    if (text.includes("```json") || text.includes("```")) {
        // Extract content between code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            console.log("Extracted JSON from markdown code block");
            return jsonMatch[1].trim();
        }
    }
    
    // Try to find JSON by looking for opening/closing braces
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        console.log("Extracted JSON using brace matching");
        return jsonMatch[0];
    }
    
    // Return original text if no JSON pattern found
    return text;
}

// Helper function to create a content object from text when JSON parsing fails
function createContentFromText(text: string, topic: string): any {
    console.log("Creating fallback content object from raw text");
    
    // Clean up markdown formatting
    let cleanContent = text;
    
    // Remove markdown code blocks
    cleanContent = cleanContent.replace(/```json|```/g, '');
    
    // Remove common JSON syntax that might be in the text
    cleanContent = cleanContent.replace(/^\s*\{\s*|\}\s*$/g, '');
    
    // Extract what looks like the content section
    let content = "";
    if (cleanContent.includes('"content":')) {
        const contentMatch = cleanContent.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (contentMatch && contentMatch[1]) {
            content = contentMatch[1];
            // Unescape JSON escapes
            content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        } else {
            // If we can't extract it properly, just use everything as content
            content = `Content for ${topic} based on your materials.`;
        }
    } else {
        content = cleanContent.substring(0, 1000); // Use first 1000 chars as content
    }
    
    return {
        content: content,
        keyPoints: [
            `Key points for ${topic}`, 
            "Understanding core concepts",
            "Practical applications"
        ],
        examples: [],
        references: []
    };
}

// Helper function to safely parse JSON with fallbacks
function safeJsonParse(text: string, topic: string): any {
    try {
        const jsonText = extractJsonFromText(text);
        
        // Check for common issues in the JSON that might cause parsing errors
        let cleanedJson = jsonText;
        
        // Fix unterminated strings - common when markdown is in JSON values
        cleanedJson = cleanedJson.replace(/:\s*"([^"]*?)(?:\n|$)/g, ': "$1",\n');
        
        // Make sure all property names have quotes
        cleanedJson = cleanedJson.replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:');
        
        // Fix trailing commas
        cleanedJson = cleanedJson.replace(/,(\s*[\]}])/g, '$1');
        
        // Fix missing commas between properties
        cleanedJson = cleanedJson.replace(/("[^"]*":\s*"[^"]*"(?:\s*\n)?)\s*"/g, '$1,"');
        
        // Add missing closing brackets if needed
        const openBraces = (cleanedJson.match(/\{/g) || []).length;
        const closeBraces = (cleanedJson.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
            cleanedJson += '}';
        }
        
        try {
            return JSON.parse(cleanedJson);
        } catch (secondaryError) {
            console.log("Cleaned JSON parsing failed, trying to create object from content");
            return createContentFromText(text, topic);
        }
    } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.log("Failed to parse:", text.substring(0, 200) + "...");
        
        return createContentFromText(text, topic);
    }
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
        ${previousContent ? 'Using the following content as context:\n' + previousContent : ''}

        Respond with educational content in plain text format, including:
        - A detailed explanation of the topic
        - Key points to remember
        - Examples if relevant
        
        Format the response as simple content text WITHOUT markdown headers or formatting.
        Do not include backticks, code blocks, or JSON formatting in your response.`;

        try {
            console.log(`Generating content for topic: ${topic}`);
            console.log(`Prompt first 100 chars: ${prompt.substring(0, 100)}...`);
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log(`Response length: ${text.length} characters`);
            
            if (!text) {
                throw new Error('Empty response from AI model');
            }

            // For simplicity, just extract the text content directly
            let content = text;
            // Remove any markdown formatting
            content = content.replace(/#{1,6}\s+(.+?)\n/g, '$1\n\n');
            
            // Extract key points from content
            const keyPoints: string[] = [];
            const keyPointsMatch = content.match(/key points(?:\s*to\s*remember)?(?:\s*:)?\s*([\s\S]*?)(?:\n\n|\n(?=Examples)|$)/i);
            
            if (keyPointsMatch && keyPointsMatch[1]) {
                // Extract bullet points or numbered lists
                const pointsList = keyPointsMatch[1].split(/\n\s*[-*]\s+|\n\s*\d+\.\s+/).filter(Boolean);
                keyPoints.push(...pointsList.map(p => p.trim()));
                
                // Remove the key points section from content
                content = content.replace(/key points(?:\s*to\s*remember)?(?:\s*:)?\s*([\s\S]*?)(?:\n\n|\n(?=Examples)|$)/i, '');
            }
            
            // Extract examples if present
            const examples: string[] = [];
            const examplesMatch = content.match(/examples(?:\s*:)?\s*([\s\S]*?)(?:\n\n|\n(?=References)|$)/i);
            
            if (examplesMatch && examplesMatch[1]) {
                const examplesList = examplesMatch[1].split(/\n\s*[-*]\s+|\n\s*\d+\.\s+|\n\s*Example\s+\d+\s*:/).filter(Boolean);
                examples.push(...examplesList.map(e => e.trim()));
                
                // Remove examples section from content
                content = content.replace(/examples(?:\s*:)?\s*([\s\S]*?)(?:\n\n|\n(?=References)|$)/i, '');
            }
            
            // Clean up content
            content = content.trim();
            
            return {
                title: topic,
                content: content,
                keyPoints: keyPoints.length > 0 ? keyPoints : ['Understanding the fundamentals', 'Application of concepts', 'Core principles'],
                examples: examples,
                references: [],
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

        Provide a structured response in JSON format with the following fields:
        {
          "sections": [
            {"title": "Section 1", "content": ["point 1", "point 2"]},
            {"title": "Section 2", "content": ["point 1", "point 2"]}
          ],
          "keyPoints": ["key point 1", "key point 2"],
          "examples": ["example 1", "example 2"],
          "exercises": ["exercise 1", "exercise 2"]
        }
        
        Important: Return valid JSON only, no markdown formatting or code blocks.`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('Empty response from AI model');
            }

            const parsedResponse = safeJsonParse(text, title);
            return {
                title: title,
                sections: parsedResponse.sections || [],
                keyPoints: parsedResponse.keyPoints || [],
                examples: parsedResponse.examples || [],
                exercises: parsedResponse.exercises || []
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

        Provide a structured response in JSON format with the following fields:
        {
          "content": "updated detailed explanation",
          "keyPoints": ["updated key point 1", "updated key point 2", ...],
          "examples": ["updated example 1", "updated example 2", ...],
          "references": ["updated reference 1", "updated reference 2", ...]
        }
        
        Important: Return valid JSON only, no markdown formatting or code blocks.`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('Empty response from AI model');
            }

            const parsedResponse = safeJsonParse(text, existingContent.title);
            return {
                title: existingContent.title,
                content: parsedResponse.content || existingContent.content,
                keyPoints: parsedResponse.keyPoints || existingContent.keyPoints,
                examples: parsedResponse.examples || existingContent.examples,
                references: parsedResponse.references || existingContent.references,
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('Error enhancing content:', error);
            throw new Error('Failed to enhance content');
        }
    }
}