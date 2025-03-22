# Teachify - AI-Powered Educational Platform

## Project Overview
Teachify is an AI-driven educational platform designed to help educators create, manage, and distribute teaching materials efficiently. The platform analyzes syllabi, generates presentations, recommends resources, and provides tools for content creation and presentation.

## Core Features

### 1. Syllabus Analysis
- Automatically extracts key information from uploaded syllabi
- Identifies course objectives, topics, subtopics, and scheduling
- Organizes content into a structured format for further use

### 2. Presentation Generation
- Creates professional slide decks based on syllabus content
- Supports multiple presentation styles (academic, modern, minimal, vibrant)
- Customizable options for slide count, content focus, and visual style
- Exports to multiple formats (PPTX, PDF)

### 3. Resource Pool
- Curates educational resources related to course topics
- Organizes materials by relevance and type
- Allows educators to save and customize resource collections

### 4. Content Generation
- Uses Gemini AI to generate educational content
- Creates slide outlines, lecture notes, and assessment materials
- Ensures content aligns with course objectives and learning outcomes

## Technical Architecture

### Frontend
- React-based single-page application
- TailwindCSS for styling with custom theme components
- Component-based architecture for reusability
- Main components:
  - Dashboard (entry point with analytics)
  - SlideGenerator (creates and edits presentations)
  - ResourcePool (resource management)
  - SubjectManager (syllabus and course management)

### Backend
- Node.js with Express framework
- MongoDB for data storage
- RESTful API architecture
- Key services:
  - GeminiService: Interacts with Google's Gemini AI for content generation
  - SlideService: Manages presentation creation and export
  - SubjectService: Handles syllabus analysis and subject management
  - AuthService: User authentication and authorization

### AI Integration
- Gemini API for content generation and syllabus analysis
- Customized prompts for educational context
- Structured output format for integration with presentation tools

## Data Flow
1. User uploads a syllabus document
2. System analyzes the document to extract structured data
3. User selects topics and presentation options
4. AI generates content based on syllabus analysis
5. User can edit, customize, and export the generated content
6. System provides resources related to the syllabus topics

## Implementation Details

### Authentication
- JWT-based authentication
- Secure password hashing
- Role-based access control

### File Processing
- Support for multiple document formats (PDF, DOCX)
- Document parsing using specialized libraries
- Content extraction and structural analysis

### Presentation Generation
- Dynamic slide creation with pptxgenjs
- PDF generation with pdfkit
- Custom styling and formatting options
- Support for speaker notes and supplementary content

### Resource Management
- Relevance-based filtering and sorting
- Integration with external resource repositories
- Content categorization and tagging

## Getting Started
1. Clone the repository
2. Install dependencies with `npm install`
3. Configure environment variables for API keys
4. Start the development server with `npm run dev`
5. Access the application at http://localhost:3000

## Future Enhancements
- Integration with LMS platforms
- Enhanced AI-driven content customization
- Collaborative editing features
- Student-facing interactive components
- Analytics dashboard for content effectiveness

---

*Teachify leverages artificial intelligence to transform educational content creation, enabling educators to focus on teaching rather than preparation.* 