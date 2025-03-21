import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import FormData from 'form-data';
import axios from 'axios';

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
      
      // Remove markdown code blocks if presen
      const cleanedText = this.removeMarkdownCodeBlocks(text);
      return JSON.parse(cleanedText);
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
      
      // Remove markdown code blocks if present
      const cleanedText = this.removeMarkdownCodeBlocks(text);
      return JSON.parse(cleanedText);
    } catch (error) {
      throw new Error(`Failed to analyze syllabus: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper function to remove markdown code blocks
  private removeMarkdownCodeBlocks(text: string): string {
    // Check if the text contains markdown code blocks
    if (text.includes("```")) {
      // Extract JSON from the code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        return jsonMatch[1].trim();
      }
    }
    return text.trim();
  }

  // New method to generate content from text without requiring a file
  async generateContent(prompt: string): Promise<any> {
    try {
      // Log the prompt being sent to the API (truncate for readability)
      console.log('\n-------- PROMPT TO GEMINI API --------');
      console.log(prompt.length > 1000 
        ? prompt.substring(0, 500) + '...\n[truncated]...\n' + prompt.substring(prompt.length - 500) 
        : prompt);
      console.log('----------------------------------------\n');
      
      // Send the prompt to the Gemini API
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      // Get the raw response text
      const rawResponse = response.text();
      
      // Log the raw response (truncate for readability)
      console.log('\n-------- RAW RESPONSE FROM GEMINI API --------');
      console.log(rawResponse.length > 1000 
        ? rawResponse.substring(0, 500) + '...\n[truncated]...\n' + rawResponse.substring(rawResponse.length - 500) 
        : rawResponse);
      console.log('----------------------------------------------\n');

      // Remove markdown code blocks if present
      const cleanedResponse = this.removeMarkdownCodeBlocks(rawResponse);
      
      // Log cleaned response
      console.log('\n-------- CLEANED RESPONSE --------');
      console.log(`Response length: ${cleanedResponse.length} characters`);
      console.log('----------------------------------\n');
      
      // Attempt to parse the JSON response
      try {
        const jsonResponse = JSON.parse(cleanedResponse);
        console.log('\n-------- PARSED JSON STRUCTURE --------');
        console.log('Keys:', Object.keys(jsonResponse));
        if (jsonResponse.topics) {
          console.log('Topics count:', jsonResponse.topics.length);
          console.log('First topic example:', JSON.stringify(jsonResponse.topics[0], null, 2));
        }
        console.log('--------------------------------------\n');
        return jsonResponse;
      } catch (jsonError: unknown) {
        console.error('\n-------- JSON PARSING ERROR --------');
        console.error('Error:', jsonError);
        console.error('First 200 chars of cleaned response:', cleanedResponse.substring(0, 200));
        console.error('Last 200 chars of cleaned response:', cleanedResponse.substring(cleanedResponse.length - 200));
        console.error('------------------------------------\n');
        throw new Error(`Failed to parse JSON response: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
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
    try {
        const fileExtension = filePath.split('.').pop()?.toLowerCase();
        console.log(`Extracting text from file with extension: ${fileExtension}`);

        if (fileExtension === 'pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            
            try {
                console.log('Attempting to extract text from PDF...');
                const pdfData = await pdfParse(dataBuffer);
                
                // Check if we got meaningful text (not just PDF structure markers)
                if (pdfData.text && pdfData.text.length > 100 && !pdfData.text.includes('%PDF-')) {
                    console.log(`Successfully extracted ${pdfData.text.length} characters from PDF`);
                    return pdfData.text;
                } else {
                    console.log('PDF text extraction returned insufficient text, file might be scanned/image-based');
                    // If we're in a real implementation, we would use OCR here
                    // For now, return a placeholder message
                    return `This appears to be a scanned PDF document or one with limited text content. 
                    In a production environment, OCR would be used to extract text from the images in this PDF.
                    For now, we're using placeholder text for the syllabus with the basic information provided by the user.`;
                }
            } catch (pdfError) {
                console.error('Error parsing PDF:', pdfError);
                return `Error extracting text from PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}. 
                Using placeholder text for syllabus analysis.`;
            }
        } else if (fileExtension === 'docx') {
            try {
                console.log('Extracting text from DOCX...');
                const docxData = await mammoth.extractRawText({ path: filePath });
                console.log(`Successfully extracted ${docxData.value.length} characters from DOCX`);
                return docxData.value;
            } catch (docxError) {
                console.error('Error parsing DOCX:', docxError);
                return `Error extracting text from DOCX: ${docxError instanceof Error ? docxError.message : 'Unknown error'}. 
                Using placeholder text for syllabus analysis.`;
            }
        } else if (fileExtension === 'txt') {
            console.log('Reading TXT file...');
            const text = fs.readFileSync(filePath, 'utf-8');
            console.log(`Successfully read ${text.length} characters from TXT file`);
            return text;
        } else {
            console.error('Unsupported file type');
            return `Unsupported file type: ${fileExtension}. Please upload a PDF, DOCX, or TXT file.`;
        }
    } catch (error) {
        console.error('Error in extractTextFromFile:', error);
        return `Error extracting text from file: ${error instanceof Error ? error.message : 'Unknown error'}. 
        Using placeholder text for syllabus analysis.`;
    }
  }

  async processFile(filePath: string, prompt: string) {
    try {
      // Extract text from the file
      const text = await this.extractTextFromFile(filePath);

      // Combine the extracted text with the prompt
      const combinedPrompt = `${prompt}\n\nFile Content:\n${text}`;

      // Send the combined prompt to the Gemini API
      const result = await this.model.generateContent(combinedPrompt);
      const response = await result.response;
      
      // Get the raw response text
      const rawResponse = response.text();
      console.log('Raw Response from Gemini:', rawResponse);

      // Remove markdown code blocks if present
      const cleanedResponse = this.removeMarkdownCodeBlocks(rawResponse);
      
      // Attempt to parse the JSON response
      try {
        const jsonResponse = JSON.parse(cleanedResponse);
        console.log('Parsed JSON Response:', jsonResponse);
        return jsonResponse;
      } catch (jsonError: unknown) {
        console.error('Error parsing JSON response:', jsonError);
        console.error('Cleaned Response:', cleanedResponse);
        throw new Error(`Failed to parse JSON response: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;
    }
  }
}