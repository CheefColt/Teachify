import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

interface SlideStructure {
  title: string;
  slides: Array<{
    title: string;
    content: string[];
    notes?: string;
  }>;
}

interface CourseInfo {
  title: string;
  code: string;
  instructor: string;
  term: string;
}

interface Topic {
  title: string;
  subtopics: string[];
}

interface Schedule {
  week: number;
  topic: string;
  activities: string[];
}

interface SyllabusAnalysis {
  courseInfo: CourseInfo;
  topics: Topic[];
  objectives: string[];
  schedule: Schedule[];
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  async generateSlideOutline(topic: string, content: string): Promise<SlideStructure> {
    try {
      const prompt = `Create a presentation outline for the topic: "${topic}" with the following content: "${content}". 
        Return the response in JSON format with the following structure:
        {
          "title": "main presentation title",
          "slides": [
            {
              "title": "slide title",
              "content": ["point 1", "point 2"],
              "notes": "speaker notes"
            }
          ]
        }`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to generate slide outline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeSyllabus(syllabusText: string): Promise<SyllabusAnalysis> {
    try {
      const prompt = `Analyze this syllabus and extract key information in JSON format:
        "${syllabusText}"
        
        Return the data in this structure:
        {
          "courseInfo": {
            "title": "course title",
            "code": "course code",
            "instructor": "instructor name",
            "term": "term/semester"
          },
          "topics": [
            {
              "title": "main topic",
              "subtopics": ["subtopic 1", "subtopic 2"]
            }
          ],
          "objectives": ["objective 1", "objective 2"],
          "schedule": [
            {
              "week": 1,
              "topic": "topic title",
              "activities": ["activity 1", "activity 2"]
            }
          ]
        }`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to analyze syllabus: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractKeywords(text: string): Promise<string[]> {
    try {
      const prompt = `Extract key topic keywords from the following text. Return only keywords separated by commas, no explanations:
        "${text}"`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
    const keywords: string[] = response.text().split(',').map((k: string) => k.trim());
      
      return keywords.filter(k => k.length > 0);
    } catch (error) {
      throw new Error(`Failed to extract keywords: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractTextFromFile(filePath: string): Promise<string> {
    const fileExtension = filePath.split('.').pop()?.toLowerCase();

    if (fileExtension === 'pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        return pdfData.text;
    } else if (fileExtension === 'docx') {
        const docxData = await mammoth.extractRawText({ path: filePath });
        return docxData.value;
    } else {
        throw new Error('Unsupported file type');
    }
  }

  async processFile(filePath: string) {
    try {
        const text = await this.extractTextFromFile(filePath);
        // Now you can send `text` to the API
        console.log(text);
    } catch (error) {
        console.error('Error processing file:', error);
    }
  }
}