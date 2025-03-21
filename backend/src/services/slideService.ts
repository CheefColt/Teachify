import { GeminiService } from './geminiService';
import { Subject } from '../models/Subject';
import mongoose from 'mongoose';

interface Slide {
  title: string;
  content: string[];
  notes?: string;
  imagePrompt?: string;
}

interface PresentationMetadata {
  totalSlides: number;
  estimatedDuration: number;
  lastGenerated: Date;
  templateStyle: TemplateStyle;
  colorScheme: ColorScheme;
}

interface PresentationStructure {
  title: string;
  slides: Slide[];
  presentationMetadata: PresentationMetadata;
  subjectId: string;
}

// Define template styles
type TemplateStyle = 'academic' | 'modern' | 'minimal' | 'vibrant';

// Define color schemes
type ColorScheme = 'blue' | 'green' | 'purple' | 'orange' | 'grayscale';

// Define generation options
interface SlideGenerationOptions {
  templateStyle: TemplateStyle;
  colorScheme: ColorScheme;
  slideCount?: number;
  includeImages?: boolean;
  includeSpeakerNotes?: boolean;
  focusAreas?: string[]; // Specific topics to focus on
}

export class SlideService {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  async generateSlides(topic: string, content: string, options: SlideGenerationOptions = {
    templateStyle: 'modern',
    colorScheme: 'blue'
  }): Promise<PresentationStructure> {
    try {
      const slideStructure = await this.geminiService.generateSlideOutline(topic, content);
      return {
        title: slideStructure.title,
        slides: slideStructure.slides,
        presentationMetadata: {
          totalSlides: slideStructure.slides.length,
          estimatedDuration: slideStructure.slides.length * 2, // 2 minutes per slide
          lastGenerated: new Date(),
          templateStyle: options.templateStyle,
          colorScheme: options.colorScheme
        },
        subjectId: ''
      };
    } catch (error) {
      throw new Error(`Failed to generate slides: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate presentation from a subject with customization options
   */
  async generateFromSubject(
    subjectId: string, 
    options: SlideGenerationOptions
  ): Promise<PresentationStructure> {
    try {
      // Validate subject ID
      if (!mongoose.Types.ObjectId.isValid(subjectId)) {
        throw new Error('Invalid subject ID format');
      }

      // Fetch the subject
      const subject = await Subject.findById(subjectId);
      if (!subject) {
        throw new Error('Subject not found');
      }

      // Check if syllabus analysis is available
      if (!subject.syllabus || !subject.syllabus.analyzed) {
        throw new Error('Subject has not been analyzed yet. Please analyze the syllabus first.');
      }

      // Extract content from syllabus analysis
      const analysis = subject.syllabus.analyzed as {
        courseInfo?: { title?: string; code?: string };
        topics?: Array<{ title: string; subtopics?: string[] }>;
        objectives?: string[];
        schedule?: Array<{ week: number; topic: string }>;
      };
      
      // Determine which topics to focus on
      let focusTopics = options.focusAreas || [];
      if (focusTopics.length === 0 && analysis.topics && analysis.topics.length > 0) {
        // If no focus areas provided, use all main topics
        focusTopics = analysis.topics.map((topic) => topic.title);
      }

      // Prepare content for presentation generation
      const contentSummary = this.prepareContentSummary(analysis, focusTopics);
      
      // Generate customized slide structure using Gemini service
      const prompt = this.buildPresentationPrompt(
        subject.name,
        contentSummary,
        options
      );

      // Call Gemini to generate the presentation
      const slideStructure = await this.geminiService.generateContent(prompt);
      
      // Format and return the result
      return {
        title: slideStructure.title || subject.name,
        slides: slideStructure.slides.map((slide: any) => ({
          ...slide,
          // Generate image prompts if images are requested
          imagePrompt: options.includeImages ? 
            `Create a professional, ${options.templateStyle} style image for ${slide.title}` : 
            undefined
        })),
        presentationMetadata: {
          totalSlides: slideStructure.slides.length,
          estimatedDuration: slideStructure.slides.length * 2, // Estimate 2 minutes per slide
          lastGenerated: new Date(),
          templateStyle: options.templateStyle,
          colorScheme: options.colorScheme
        },
        subjectId: subjectId
      };
    } catch (error) {
      throw new Error(`Failed to generate presentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prepare content summary from syllabus analysis
   */
  private prepareContentSummary(analysis: any, focusTopics: string[]): string {
    let summary = '';
    
    // Add course info
    if (analysis.courseInfo) {
      summary += `Course: ${analysis.courseInfo.title || 'N/A'}\n`;
      summary += `Code: ${analysis.courseInfo.code || 'N/A'}\n`;
    }
    
    // Add learning objectives
    if (analysis.objectives && analysis.objectives.length > 0) {
      summary += '\nLearning Objectives:\n';
      analysis.objectives.forEach((obj: string, i: number) => {
        summary += `${i+1}. ${obj}\n`;
      });
    }
    
    // Add topics and subtopics, filtering by focus topics if provided
    if (analysis.topics && analysis.topics.length > 0) {
      summary += '\nTopics:\n';
      analysis.topics
        .filter((topic: any) => focusTopics.length === 0 || focusTopics.includes(topic.title))
        .forEach((topic: any) => {
          summary += `- ${topic.title}\n`;
          if (topic.subtopics && topic.subtopics.length > 0) {
            topic.subtopics.forEach((subtopic: string) => {
              summary += `  * ${subtopic}\n`;
            });
          }
        });
    }
    
    // Add schedule info if available
    if (analysis.schedule && analysis.schedule.length > 0) {
      summary += '\nSchedule:\n';
      analysis.schedule
        .filter((week: any) => 
          focusTopics.length === 0 || 
          focusTopics.some(t => week.topic.includes(t))
        )
        .forEach((week: any) => {
          summary += `Week ${week.week}: ${week.topic}\n`;
        });
    }
    
    return summary;
  }

  /**
   * Build the presentation generation prompt based on options
   */
  private buildPresentationPrompt(
    subjectName: string, 
    contentSummary: string, 
    options: SlideGenerationOptions
  ): string {
    const { 
      templateStyle, 
      colorScheme, 
      slideCount = 10,
      includeImages = true,
      includeSpeakerNotes = true,
      focusAreas = []
    } = options;

    let styleGuidance = '';
    switch (templateStyle) {
      case 'academic':
        styleGuidance = 'formal, research-oriented presentation with clear structure and academic terminology';
        break;
      case 'modern':
        styleGuidance = 'clean, contemporary design with concise bullet points and visual emphasis';
        break;
      case 'minimal':
        styleGuidance = 'simplified, minimalist approach with essential information only and lots of white space';
        break;
      case 'vibrant':
        styleGuidance = 'engaging, colorful presentation with dynamic content organization and emphasis on key concepts';
        break;
      default:
        styleGuidance = 'professional, balanced presentation';
    }

    // Build the prompt
    return `Create a ${styleGuidance} about "${subjectName}" with the following content:
      
${contentSummary}

${focusAreas.length > 0 ? `Focus specifically on these topics: ${focusAreas.join(', ')}` : ''}

Create approximately ${slideCount} slides (not more than ${slideCount + 2}).

The presentation should follow this structure:
1. Title slide
2. Overview/Agenda
3. Main content slides covering key topics
4. Summary/Conclusion
${includeSpeakerNotes ? '5. Include detailed speaker notes for each slide' : ''}

Return the response in JSON format with the following structure:
{
  "title": "main presentation title",
  "slides": [
    {
      "title": "slide title",
      "content": ["point 1", "point 2", "point 3"],
      "notes": "${includeSpeakerNotes ? 'detailed speaker notes for this slide' : ''}"
    }
  ]
}

${includeImages ? 'For each slide, provide content that would work well with supporting images.' : ''}
Ensure all text is clear, concise, and aligned with the ${templateStyle} presentation style.`;
  }

  /**
   * Export presentation to different formats
   * This is a placeholder for future implementation
   */
  async exportPresentation(presentationId: string, format: 'pptx' | 'pdf'): Promise<string> {
    // In a real implementation, this would generate files in the requested format
    // For now, return a placeholder URL
    return `https://example.com/presentations/${presentationId}.${format}`;
  }
}