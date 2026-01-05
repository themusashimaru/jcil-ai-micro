/**
 * INTENT ANALYZER
 *
 * The first stage of the Research Brain.
 * Analyzes vague user requests and extracts what they REALLY need.
 *
 * "The user is kind of dumb. They don't really know what they're asking."
 * - This component fixes that.
 */

import { GoogleGenAI } from '@google/genai';
import { ResearchIntent, AgentContext } from '../../core/types';

const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY_1 || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export class IntentAnalyzer {
  private model = 'gemini-2.5-pro-preview-05-06';

  /**
   * Analyze a user query and extract true intent
   */
  async analyze(query: string, context: AgentContext): Promise<ResearchIntent> {
    const contextInfo = this.buildContextInfo(context);

    const prompt = `You are an expert research analyst. A user has made a research request, but users often don't know exactly what they need. Your job is to understand their TRUE intent and what information would actually help them.

USER'S REQUEST:
"${query}"

CONTEXT ABOUT THE USER:
${contextInfo}

Analyze this request and output a JSON object with the following structure:
{
  "originalQuery": "exact user query",
  "refinedQuery": "what they actually need, clarified and specific",
  "topics": ["list", "of", "distinct", "topics", "to", "research"],
  "requiredDepth": "quick" | "standard" | "deep",
  "expectedOutputs": ["what the user expects to learn - be specific"],
  "contextClues": {
    "industry": "detected industry or null",
    "location": "detected location or null",
    "timeframe": "relevant time period or null",
    "competitors": ["any mentioned competitors"]
  }
}

RULES FOR ANALYSIS:
1. If the query is vague (e.g., "research my competition"), expand it into specific topics
2. Detect implicit needs (if they ask about competitors, they probably also need pricing info)
3. requiredDepth should be:
   - "quick" for simple factual queries
   - "standard" for most business research
   - "deep" for strategic analysis, market research, investment decisions
4. expectedOutputs should list 3-8 specific things the user will learn
5. Extract ANY context clues from the query or conversation history

OUTPUT ONLY THE JSON OBJECT, NO OTHER TEXT.`;

    try {
      const response = await gemini.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      const text = response.text?.trim() || '';

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ResearchIntent;

      // Validate required fields
      if (!parsed.refinedQuery || !parsed.topics || parsed.topics.length === 0) {
        throw new Error('Invalid intent structure');
      }

      return parsed;
    } catch (error) {
      console.error('[IntentAnalyzer] Error analyzing intent:', error);

      // Fallback: create a basic intent from the query
      return this.createFallbackIntent(query);
    }
  }

  /**
   * Build context information string from AgentContext
   */
  private buildContextInfo(context: AgentContext): string {
    const lines: string[] = [];

    if (context.previousMessages && context.previousMessages.length > 0) {
      lines.push('RECENT CONVERSATION:');
      const recent = context.previousMessages.slice(-5);
      for (const msg of recent) {
        lines.push(`${msg.role}: ${msg.content.substring(0, 200)}...`);
      }
    }

    if (context.userDocuments && context.userDocuments.length > 0) {
      lines.push(`\nUSER HAS UPLOADED DOCUMENTS: ${context.userDocuments.join(', ')}`);
    }

    if (context.preferences) {
      if (context.preferences.depth) {
        lines.push(`\nUSER PREFERENCE: ${context.preferences.depth} depth research`);
      }
    }

    return lines.length > 0 ? lines.join('\n') : 'No additional context available.';
  }

  /**
   * Create a basic fallback intent if analysis fails
   */
  private createFallbackIntent(query: string): ResearchIntent {
    // Extract basic topics from the query
    const topics = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4)
      .slice(0, 5);

    return {
      originalQuery: query,
      refinedQuery: query,
      topics: topics.length > 0 ? topics : ['general research'],
      requiredDepth: 'standard',
      expectedOutputs: ['General information about the topic'],
      contextClues: {},
    };
  }

  /**
   * Check if a query needs research or is a simple question
   */
  async needsDeepResearch(query: string): Promise<boolean> {
    const researchIndicators = [
      'research',
      'analyze',
      'compare',
      'competitor',
      'market',
      'industry',
      'trend',
      'investigate',
      'deep dive',
      'find out',
      'everything about',
      'comprehensive',
      'study',
      'evaluate',
    ];

    const lowerQuery = query.toLowerCase();
    return researchIndicators.some(indicator => lowerQuery.includes(indicator));
  }
}

export const intentAnalyzer = new IntentAnalyzer();
