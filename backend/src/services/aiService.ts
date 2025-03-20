import { genAI } from '../config/gemini';

export class AIService {
    private model;

    constructor() {
        this.model = genAI.getGenerativeModel({ model: "gemini-pro" });
    }

    async analyzeSyllabus(syllabusText: string) {
        const prompt = `Analyze this syllabus and structure it into topics and subtopics:
        ${syllabusText}`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(response.text());
    }

    async generateLectureContent(topic: string, context: string) {
        const prompt = `Create a detailed lecture outline for the topic: ${topic}
        Context: ${context}`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(response.text());
    }

    async suggestResources(topic: string) {
        const prompt = `Suggest learning resources for: ${topic}`;
        
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(response.text());
    }
}