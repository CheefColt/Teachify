import axios from 'axios';
import { GeminiService } from './geminiService';

interface ResourceSearchParams {
  query: string;
  topics: string[];
  type?: string;
  limit?: number;
  syllabusText?: string;
  useRealUrls?: boolean;
}

interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'article' | 'pdf' | 'video' | 'book';
  source: string;
  datePublished?: string;
  relevanceScore?: number;
}

// Cache for resource search results
interface CacheEntry {
  resources: Resource[];
  timestamp: number;
  key: string;
}

/**
 * Service for finding educational resources
 * This is a placeholder that can be expanded with real API integrations
 */
export class ResourceService {
  private geminiService: GeminiService;
  private resourceCache: CacheEntry[] = [];
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly MAX_CACHE_SIZE = 20; // Maximum number of cached searches
  
  constructor() {
    this.geminiService = new GeminiService();
  }
  
  /**
   * Generate a cache key from search parameters
   */
  private generateCacheKey(params: ResourceSearchParams): string {
    const { topics, query, type, limit } = params;
    const topicsKey = topics.sort().join(',');
    const queryKey = query || '';
    const typeKey = type || 'all';
    const limitKey = limit || 10;
    
    return `${topicsKey}|${queryKey}|${typeKey}|${limitKey}`;
  }
  
  /**
   * Check if a cached result exists and is still valid
   */
  private getCachedResult(params: ResourceSearchParams): Resource[] | null {
    const key = this.generateCacheKey(params);
    const now = Date.now();
    
    const cacheEntry = this.resourceCache.find(entry => entry.key === key);
    
    if (cacheEntry && (now - cacheEntry.timestamp) < this.CACHE_EXPIRY) {
      console.log('Using cached resource results for key:', key);
      return cacheEntry.resources;
    }
    
    return null;
  }
  
  /**
   * Add a result to the cache
   */
  private cacheResult(params: ResourceSearchParams, resources: Resource[]): void {
    const key = this.generateCacheKey(params);
    const timestamp = Date.now();
    
    // Remove existing entry with the same key if it exists
    this.resourceCache = this.resourceCache.filter(entry => entry.key !== key);
    
    // Add new entry
    this.resourceCache.push({ key, resources, timestamp });
    
    // Limit cache size by removing oldest entries
    if (this.resourceCache.length > this.MAX_CACHE_SIZE) {
      this.resourceCache.sort((a, b) => a.timestamp - b.timestamp);
      this.resourceCache = this.resourceCache.slice(-this.MAX_CACHE_SIZE);
    }
    
    console.log('Cached resource results for key:', key);
  }
  
  /**
   * Search for educational resources using external APIs
   * Currently returns mock data, but can be expanded to use multiple resource providers
   */
  async findResources(params: ResourceSearchParams): Promise<Resource[]> {
    console.log('Searching for resources with params:', params);

    // Check cache first
    const cachedResults = this.getCachedResult(params);
    if (cachedResults) {
      // If useRealUrls is different than what's in cache, we need to refresh
      if (params.useRealUrls && cachedResults[0].url.includes('example.com')) {
        console.log('Cached results use example URLs but real URLs requested - skipping cache');
      } else {
        return cachedResults;
      }
    }

    try {
      // If we have specific topics and syllabus text, try to use AI for better suggestions
      if (params.topics && params.topics.length > 0 && params.syllabusText) {
        try {
          const aiSuggestions = await this.suggestResourcesWithAI(
            params.syllabusText, 
            params.topics, 
            params.query, 
            params.useRealUrls
          );
          console.log(`AI suggested ${aiSuggestions.length} resources`);
          
          // If AI suggestions are available, cache and return them
          if (aiSuggestions.length > 0) {
            this.cacheResult(params, aiSuggestions);
            return aiSuggestions;
          }
        } catch (aiError) {
          console.error('Error getting AI suggestions, falling back to mock:', aiError);
        }
      }
      
      // For now, return mock data with real URLs if requested
      const mockResources = this.getMockResources(params);
      
      // Cache the results
      this.cacheResult(params, mockResources);
      return mockResources;
    } catch (error) {
      console.error('Error finding resources:', error);
      throw new Error('Failed to find educational resources');
    }
  }

  /**
   * Integration with Gemini AI to generate relevant resource suggestions
   * This could be implemented to suggest resources based on syllabus content
   */
  async suggestResourcesWithAI(
    syllabusText: string, 
    topics: string[], 
    query?: string,
    useRealUrls?: boolean
  ): Promise<Resource[]> {
    console.log('Suggesting resources with AI based on syllabus and topics');
    
    try {
      // Extract a sample of the syllabus to avoid exceeding token limits
      const syllabusExcerpt = syllabusText.length > 1000 
        ? syllabusText.substring(0, 1000) + '...'
        : syllabusText;
      
      const topicsString = topics.join(', ');
      const prompt = `
        As an educational resource expert, please suggest practical learning resources for the following topics: ${topicsString}
        ${query ? `\nThe user is specifically looking for: ${query}` : ''}
        
        Context from syllabus: ${syllabusExcerpt}
        
        Respond with a JSON array of resources that match these criteria. Each resource should have:
        - id: A unique identifier
        - title: A descriptive title
        - description: 1-2 sentences about the resource
        - url: ${useRealUrls ? 'A real, working URL to an actual resource on this topic' : 'A fictitious but plausible URL'}
        - type: One of these types: "article", "pdf", "video"
        - source: The publishing platform or creator
        - datePublished: A date in YYYY-MM-DD format
        - relevanceScore: A number between 0.7 and 1.0 indicating relevance
        
        ${useRealUrls ? 
          `IMPORTANT: You must provide actual URLs to real, credible educational resources from the following sources:
          - For articles: GeeksforGeeks, W3Schools, freeCodeCamp, MDN Web Docs, DigitalOcean tutorials, Dev.to
          - For videos: Direct links to specific YouTube tutorials, Khan Academy, freeCodeCamp videos
          - For PDFs: Oracle documentation, IBM Developer, Microsoft Learn, TutorialsPoint

          Ensure the URLs point to specific content pages rather than just search results when possible.
          Do NOT include courses or academic journals - focus on practical learning resources.` 
          : ''}
        
        Only return valid JSON without any additional text or explanation.
      `;
      
      // Call the Gemini API through our service
      const response = await this.geminiService.generateContent(prompt);
      
      // Try to parse the JSON response
      try {
        // Clean up the response - sometimes AI models add markdown code blocks
        const jsonContent = response.replace(/```json|```/g, '').trim();
        const resources = JSON.parse(jsonContent);
        
        // Validate the response structure
        if (Array.isArray(resources) && resources.length > 0 && 
            resources[0].id && resources[0].title && resources[0].description) {
          console.log(`Successfully parsed ${resources.length} AI-suggested resources`);
          return resources;
        } else {
          console.error('Invalid resource structure from AI response');
          return [];
        }
      } catch (parseError) {
        console.error('Error parsing AI response as JSON:', parseError);
        console.log('AI Response:', response);
        return [];
      }
    } catch (error) {
      console.error('Error suggesting resources with AI:', error);
      return [];
    }
  }

  /**
   * Generate mock resources for demonstration purposes
   * This would be replaced with real API calls in production
   */
  private getMockResources(params: ResourceSearchParams): Resource[] {
    const resourceTypes = ['article', 'pdf', 'video', 'book'];
    const sources = [
      'Educational Blog', 
      'Academic Journal', 
      'Video Platform', 
      'Online Library', 
      'University Repository',
      'Educational Resource Portal',
      'Academic Database'
    ];
    
    const resources: Resource[] = [];
    const searchTerms = [...params.topics];
    if (params.query) searchTerms.push(params.query);
    
    // Generate 5-10 mock resources
    const resourceCount = params.limit || Math.floor(Math.random() * 6) + 5;
    
    for (let i = 0; i < resourceCount; i++) {
      const type = params.type && resourceTypes.includes(params.type) 
        ? params.type as 'article' | 'pdf' | 'video' | 'book'
        : resourceTypes[Math.floor(Math.random() * resourceTypes.length)] as 'article' | 'pdf' | 'video' | 'book';
      
      const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
      
      resources.push({
        id: `res_${Date.now()}_${i}`,
        title: `${type === 'video' ? 'Video tutorial: ' : ''}${searchTerm} - ${this.getRandomTitle(type)}`,
        description: this.getRandomDescription(type, searchTerm),
        url: params.useRealUrls 
          ? this.getRealResourceUrl(type, searchTerm)
          : `https://example.com/${type}/${i}`,
        type,
        source: params.useRealUrls 
          ? this.getRealSource(type) 
          : sources[Math.floor(Math.random() * sources.length)],
        datePublished: this.getRandomDate(),
        relevanceScore: Math.random() * 0.3 + 0.7 // Between 0.7 and 1.0
      });
    }
    
    // Sort by relevance
    resources.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    return resources;
  }

  /**
   * Get a real URL for a resource based on type and topic
   */
  private getRealResourceUrl(type: string, topic: string): string {
    const encodedTopic = encodeURIComponent(topic);
    const randomValue = Math.random();
    
    switch (type) {
      case 'article': {
        // Tech blogs, tutorials, documentation sites
        if (randomValue < 0.2) {
          return `https://www.geeksforgeeks.org/search?q=${encodedTopic}`;
        } else if (randomValue < 0.4) {
          return `https://dev.to/search?q=${encodedTopic}`;
        } else if (randomValue < 0.6) {
          return `https://www.freecodecamp.org/news/search/?query=${encodedTopic}`;
        } else if (randomValue < 0.8) {
          return `https://www.w3schools.com/search/search.php?q=${encodedTopic}`;
        } else {
          return `https://www.digitalocean.com/community/tutorials?q=${encodedTopic}`;
        }
      }
      
      case 'pdf': {
        // Documentation, guides, and tutorials
        if (randomValue < 0.25) {
          return `https://web.mit.edu/search/?q=${encodedTopic}+pdf&sites=ocw.mit.edu&client=mit&proxystylesheet=mit&output=xml_no_dtd&oe=utf-8&as_dt=i`;
        } else if (randomValue < 0.5) {
          return `https://docs.oracle.com/search/?q=${encodedTopic}`;
        } else if (randomValue < 0.75) {
          return `https://www.ibm.com/docs/en/search/${encodedTopic}`;
        } else {
          return `https://www.tutorialspoint.com/search.htm?search=${encodedTopic}`;
        }
      }
      
      case 'video': {
        // Direct video platforms with educational content
        if (randomValue < 0.3) {
          // Direct YouTube search for tutorials
          return `https://www.youtube.com/results?search_query=${encodedTopic}+tutorial`;
        } else if (randomValue < 0.5) {
          // freeCodeCamp YouTube channel
          return `https://www.youtube.com/c/Freecodecamp/search?query=${encodedTopic}`;
        } else if (randomValue < 0.7) {
          // Khan Academy
          return `https://www.khanacademy.org/search?page_search_query=${encodedTopic}`;
        } else if (randomValue < 0.9) {
          // Coursera
          return `https://www.coursera.org/search?query=${encodedTopic}`;
        } else {
          // edX
          return `https://www.edx.org/search?q=${encodedTopic}`;
        }
      }
      
      case 'book': {
        // Books, guides and comprehensive learning resources
        if (randomValue < 0.3) {
          return `https://learning.oreilly.com/search/?query=${encodedTopic}`;
        } else if (randomValue < 0.6) {
          return `https://www.manning.com/search?q=${encodedTopic}`;
        } else if (randomValue < 0.9) {
          return `https://www.packtpub.com/search?keys=${encodedTopic}`;
        } else {
          return `https://www.britannica.com/search?query=${encodedTopic}`;
        }
      }
      
      default:
        // General learning resources
        const sites = [
          `https://www.geeksforgeeks.org/search?q=${encodedTopic}`,
          `https://www.w3schools.com/search/search.php?q=${encodedTopic}`,
          `https://developer.mozilla.org/en-US/search?q=${encodedTopic}`,
          `https://www.freecodecamp.org/news/search/?query=${encodedTopic}`,
          `https://stackoverflow.com/search?q=${encodedTopic}`
        ];
        return sites[Math.floor(Math.random() * sites.length)];
    }
  }

  /**
   * Get a real source name based on resource type
   */
  private getRealSource(type: string): string {
    const sources = {
      article: ['GeeksforGeeks', 'W3Schools', 'freeCodeCamp', 'Dev.to', 'MDN Web Docs', 'DigitalOcean Tutorials'],
      pdf: ['Oracle Documentation', 'IBM Developer', 'MIT OpenCourseWare', 'TutorialsPoint', 'Microsoft Learn'],
      video: ['YouTube', 'Khan Academy', 'freeCodeCamp', 'Coursera', 'edX', 'Udemy'],
      book: ["O'Reilly", 'Manning Publications', 'Packt Publishing', 'Britannica', 'Apress']
    };
    
    const typeSpecificSources = sources[type as keyof typeof sources] || sources.article;
    return typeSpecificSources[Math.floor(Math.random() * typeSpecificSources.length)];
  }

  /**
   * Track resource interactions to build a recommendation system
   * In a real implementation, this would store data in a database
   */
  async trackResourceInteraction(resourceId: string, userId: string, interactionType: 'view' | 'bookmark' | 'download'): Promise<void> {
    // In a real implementation, this would store the interaction in a database
    console.log(`Tracking ${interactionType} interaction for resource ${resourceId} by user ${userId}`);
    
    // Example of how this might be implemented with a database
    // await db.resourceInteractions.insert({
    //   resourceId,
    //   userId,
    //   interactionType,
    //   timestamp: new Date()
    // });
  }
  
  /**
   * Get recommended resources based on popular selections by other users
   * In a real implementation, this would use collaborative filtering algorithms
   */
  async getRecommendedResources(userId: string, subjectId: string): Promise<Resource[]> {
    // In a real implementation, this would:
    // 1. Find resources that similar users have interacted with
    // 2. Apply collaborative filtering algorithms
    // 3. Return personalized recommendations
    
    console.log(`Getting recommended resources for user ${userId} in subject ${subjectId}`);
    
    // For now, return mock recommendations
    return this.getMockResources({ 
      topics: ['Recommended resources'], 
      query: 'popular' 
    });
  }

  private getRandomTitle(type: string): string {
    const titles = {
      article: [
        'Comprehensive Guide',
        'Ultimate Overview',
        'Practical Approaches',
        'Modern Techniques',
        'Theoretical Foundations',
        'Best Practices',
        'Educational Applications'
      ],
      pdf: [
        'Research Paper',
        'Academic Study',
        'Published Analysis',
        'Conference Proceedings',
        'Technical Documentation',
        'Case Study Analysis',
        'Scholarly Review'
      ],
      video: [
        'Step-by-step Tutorial',
        'Illustrated Explanation',
        'Practical Demonstration',
        'Visual Guide',
        'Quick Overview',
        'Instructor Presentation',
        'Interactive Lesson'
      ],
      book: [
        'Textbook Chapter',
        'Complete Reference',
        'Learning Resource',
        'Educational Material',
        'Comprehensive Course',
        'Student Handbook',
        'Teaching Guide'
      ]
    };
    
    const typeSpecificTitles = titles[type as keyof typeof titles] || titles.article;
    return typeSpecificTitles[Math.floor(Math.random() * typeSpecificTitles.length)];
  }

  private getRandomDescription(type: string, topic: string): string {
    const descriptions = {
      article: [
        `A thorough examination of ${topic} with practical examples and case studies.`,
        `An in-depth guide to understanding ${topic} from basic principles to advanced applications.`,
        `Latest insights and best practices for implementing ${topic} in educational environments.`,
        `Comprehensive analysis of ${topic} with expert perspectives and industry recommendations.`
      ],
      pdf: [
        `Academic research paper exploring different aspects of ${topic} with detailed analysis.`,
        `Scholarly article documenting the latest findings related to ${topic} in educational settings.`,
        `Technical documentation on ${topic} with methodologies and research conclusions.`,
        `Peer-reviewed publication on advances in ${topic} with citations and references.`
      ],
      video: [
        `Visual explanations of ${topic} with step-by-step tutorials and examples.`,
        `Engaging video content that breaks down complex concepts of ${topic} into digestible segments.`,
        `Interactive video lessons on ${topic} designed for various learning styles.`,
        `HD video lectures covering all aspects of ${topic} with practical demonstrations.`
      ],
      book: [
        `Comprehensive textbook material covering all aspects of ${topic} with exercises and examples.`,
        `Educational resource providing in-depth knowledge about ${topic} with practical applications.`,
        `Well-structured learning material that guides learners through ${topic} systematically.`,
        `Complete reference manual for ${topic} with detailed explanations and study materials.`
      ]
    };
    
    const typeSpecificDescriptions = descriptions[type as keyof typeof descriptions] || descriptions.article;
    return typeSpecificDescriptions[Math.floor(Math.random() * typeSpecificDescriptions.length)];
  }

  private getRandomDate(): string {
    // Generate date within last 3 years
    const now = new Date();
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(now.getFullYear() - 3);
    
    const randomDate = new Date(threeYearsAgo.getTime() + Math.random() * (now.getTime() - threeYearsAgo.getTime()));
    return randomDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
} 