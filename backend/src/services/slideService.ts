import { GeminiService } from './geminiService';
import { Subject } from '../models/Subject';
import mongoose from 'mongoose';
import PptxGenJS from 'pptxgenjs';
import PDFDocument from 'pdfkit';

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
  private activePresentation: any = null;

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
   */
  async exportPresentation(presentationId: string, format: 'pptx' | 'pdf'): Promise<Buffer> {
    try {
      // Get the presentation data from frontend state
      // The presentationId is likely in the format "slideset123456789"
      
      // Extract the slides from the request directly
      // Get the slide data from the frontend state that called this API
      const slideSetId = presentationId;
      
      // This should directly access the current presentation that's being viewed
      // We'll extract the data from the request context
      const presentation = this.extractPresentationFromContext(slideSetId);
      
      if (!presentation) {
        console.log(`No presentation found with ID: ${slideSetId}, using default data`);
        // If no presentation found, create a default one with the ID
        return this.exportDefaultPresentation(slideSetId, format);
      }
      
      console.log(`Exporting presentation: ${presentation.title} with ${presentation.slides.length} slides`);
      
      // Format the presentation data for export
      const presentationData = {
        title: presentation.title || 'Untitled Presentation',
        slides: presentation.slides.map((slide: any) => ({
          title: slide.title || 'Untitled Slide',
          content: this.formatSlideContent(slide.content)
        }))
      };

      // Generate the file based on requested format
      if (format === 'pptx') {
        return await this.generatePPTX(presentationData.title, presentationData.slides);
      } else {
        return await this.generatePDF(presentationData.title, presentationData.slides);
      }
    } catch (error: unknown) {
      console.error(`Error generating ${format} file:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to export presentation as ${format}: ${errorMessage}`);
    }
  }

  /**
   * Extract presentation data from the request context or frontend state
   */
  private extractPresentationFromContext(slideSetId: string): any {
    try {
      // In a real implementation, this would access the presentation data
      // from where it's stored in your application's state
      
      // For example, if there's a global variable or context:
      // @ts-ignore - Ignoring global.__slideSets for now as it's a mock implementation
      const allSlideSets = global.__slideSets || [];
      const slideSet = allSlideSets.find((set: any) => set.id === slideSetId);
      
      if (slideSet) {
        return slideSet;
      }
      
      // If not found in global state, try to extract from the active request
      // This depends on how your application manages state
      const req = this.getCurrentRequest();
      if (req && req.body && req.body.slides) {
        return {
          id: slideSetId,
          title: req.body.title || 'Presentation',
          slides: req.body.slides
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting presentation data:', error);
      return null;
    }
  }

  /**
   * Format slide content to handle different formats
   */
  private formatSlideContent(content: any): string[] {
    if (Array.isArray(content)) {
      return content.filter(item => item && typeof item === 'string');
    }
    if (typeof content === 'string') {
      return content.split('\n').filter(line => line.trim());
    }
    return [];
  }

  /**
   * Export a default presentation when the requested one isn't found
   */
  private async exportDefaultPresentation(id: string, format: 'pptx' | 'pdf'): Promise<Buffer> {
    const defaultPresentation = {
      title: `Teachify Presentation ${id}`,
      slides: [
        {
          title: "Introduction to Teachify",
          content: [
            "AI-powered educational platform",
            "Create engaging presentations instantly",
            "Export to multiple formats"
          ]
        }
      ]
    };
    
    if (format === 'pptx') {
      return await this.generatePPTX(defaultPresentation.title, defaultPresentation.slides);
    } else {
      return await this.generatePDF(defaultPresentation.title, defaultPresentation.slides);
    }
  }

  /**
   * Get the current request context
   */
  private getCurrentRequest(): any {
    // This is a placeholder - the actual implementation depends on
    // how your application manages request context
    // For example, if using Express with a middleware that sets req on a namespace:
    try {
      const namespace = require('cls-hooked').getNamespace('app');
      return namespace ? namespace.get('req') : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a PPTX file using pptxgenjs
   */
  private async generatePPTX(title: string, slides: Slide[]): Promise<Buffer> {
    const pptx = new PptxGenJS();
    
    // Set presentation properties
    pptx.author = 'Teachify';
    pptx.company = 'Teachify Educational Tools';
    pptx.revision = '1';
    pptx.subject = 'Educational Content';
    pptx.title = title;

    // Add title slide
    const titleSlide = pptx.addSlide();
    
    // Add title
    titleSlide.addText(title, {
      x: '10%',
      y: '40%',
      w: '80%',
      h: 1.5,
      fontSize: 44,
      color: '363636',
      bold: true,
      align: 'center'
    });

    // Add subtitle
    titleSlide.addText('Generated by Teachify', {
      x: '10%',
      y: '60%',
      w: '80%',
      h: 0.75,
      fontSize: 28,
      color: '666666',
      align: 'center'
    });

    // Add content slides
    slides.forEach((slideData) => {
      const slide = pptx.addSlide();
      
      // Add slide title
      slide.addText(slideData.title, {
        x: '5%',
        y: '5%',
        w: '90%',
        h: 1,
        fontSize: 32,
        color: '363636',
        bold: true,
        align: 'left'
      });

      // Add divider line
      slide.addShape(pptx.ShapeType.line, {
        x: '5%',
        y: '18%',
        w: '90%',
        h: 0,
        line: { color: '363636', width: 1 }
      });
      
      // Add bullet points
      const contentText = slideData.content.map(point => ({ text: point, options: { bullet: true } }));
      slide.addText(contentText, {
        x: '5%',
        y: '22%',
        w: '90%',
        h: '70%',
        fontSize: 24,
        color: '666666',
        bullet: { indent: 15 }
      });

      // Add footer
      slide.addText('Teachify - AI-Powered Educational Tools', {
        x: '5%',
        y: '95%',
        w: '90%',
        h: 0.3,
        fontSize: 12,
        color: '888888',
        align: 'center',
        italic: true
      });
    });

    // Return as buffer (fixed type error)
    const result = await pptx.write({ compression: true, outputType: 'nodebuffer' });
    return result as Buffer;
  }

  /**
   * Generate a PDF file using pdfkit
   */
  private generatePDF(title: string, slides: Slide[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Create a PDF document
        const doc = new PDFDocument({
          autoFirstPage: false,
          size: 'letter',
          margin: 50,
          info: {
            Title: title,
            Author: 'Teachify',
            Subject: 'Educational Content',
            Keywords: 'education, presentation, teachify',
            CreationDate: new Date()
          }
        });

        // Collect PDF data chunks
        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Add title page
        doc.addPage();
        doc.font('Helvetica-Bold')
           .fontSize(36)
           .text(title, { align: 'center' })
           .moveDown(2)
           .font('Helvetica')
           .fontSize(18)
           .text('Generated by Teachify', { align: 'center' })
           .moveDown()
           .text(new Date().toLocaleDateString(), { align: 'center' });

        // Add content pages
        slides.forEach((slide, index) => {
          // Add new page for each slide
          doc.addPage();

          // Add slide number
          doc.font('Helvetica')
             .fontSize(10)
             .text(`Slide ${index + 1}`, { align: 'right' })
             .moveDown();

          // Add slide title
          doc.font('Helvetica-Bold')
             .fontSize(24)
             .text(slide.title)
             .moveDown();

          // Add divider line
          doc.moveTo(50, doc.y)
             .lineTo(doc.page.width - 50, doc.y)
             .stroke()
             .moveDown();

          // Add bullet points
          doc.font('Helvetica')
             .fontSize(14);
          
          slide.content.forEach(point => {
            doc.text(`• ${point}`, {
              indent: 20,
              align: 'left'
            }).moveDown(0.5);
          });

          // Add footer (fixed positioning)
          doc.fontSize(10);
          const footerText = 'Teachify - AI-Powered Educational Tools';
          doc.text(footerText, {
            align: 'center'
          });
        });

        // Finalize the PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}