/**
 * FORGE & MUSASHI Business Model Generator
 * =========================================
 *
 * This is the SECRET SAUCE that makes us savage.
 *
 * When a user just says "build me a tutoring website", we:
 * 1. Research competitive pricing in their area
 * 2. Generate realistic pricing tiers with features
 * 3. Create service packages that make sense for the industry
 * 4. Generate testimonials from realistic personas
 * 5. Build FAQs from common customer questions
 *
 * The result: A complete, professional business model that would
 * take someone DAYS to research and write themselves.
 */

import { createGeminiCompletion } from '@/lib/gemini/client';
import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';

// ============================================================================
// Types
// ============================================================================

export interface PricingTier {
  name: string;           // e.g., "Starter", "Professional", "Enterprise"
  price: string;          // e.g., "$49/month", "$75/hour", "Custom"
  period?: string;        // e.g., "per month", "per session", "per project"
  description: string;    // One-liner about this tier
  features: string[];     // List of included features
  highlighted?: boolean;  // Is this the recommended tier?
  ctaText: string;        // Button text, e.g., "Get Started", "Contact Us"
}

export interface ServicePackage {
  name: string;           // e.g., "SAT Prep Course", "Driving Lesson Package"
  description: string;    // 2-3 sentence description
  price?: string;         // Optional price
  duration?: string;      // e.g., "8 weeks", "10 hours"
  features: string[];     // What's included
  icon?: string;          // Suggested icon name (heroicons)
}

export interface Testimonial {
  name: string;           // Realistic name
  role: string;           // e.g., "Parent of SAT student", "Business Owner"
  location?: string;      // e.g., "Hicksville, NY"
  quote: string;          // The testimonial text
  rating: number;         // 1-5 stars
  avatar?: string;        // Will be filled with Unsplash URL
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  avatar?: string;
}

export interface BusinessHours {
  days: string;           // e.g., "Monday - Friday"
  hours: string;          // e.g., "9:00 AM - 6:00 PM"
}

export interface BusinessModel {
  // Core Business Info
  businessName: string;
  tagline: string;                    // Catchy one-liner
  elevatorPitch: string;              // 2-3 sentence description
  uniqueValueProposition: string;     // What makes them different

  // Pricing & Services
  pricingTiers: PricingTier[];        // 2-4 pricing tiers
  services: ServicePackage[];          // 3-6 service packages

  // Social Proof
  testimonials: Testimonial[];         // 3-4 testimonials
  stats?: {                            // Optional impressive stats
    value: string;
    label: string;
  }[];

  // Content
  faqs: FAQ[];                         // 5-8 FAQs
  aboutContent: {
    story: string;                     // Company story/mission
    values: string[];                  // Core values
    teamDescription?: string;          // Team intro
  };

  // Contact & Logistics
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
    hours?: BusinessHours[];
  };

  // SEO & Meta
  seoTitle: string;
  seoDescription: string;
  keywords: string[];

  // Generation metadata
  researchSources?: string[];
  generatedAt: string;
}

export interface BusinessModelInput {
  businessName: string;
  industry: string;
  location?: string;
  services?: string[];
  pricing?: string;
  email?: string;
  phone?: string;
  targetAudience?: string;
  stylePreference?: string;
  additionalContext?: string;
}

// ============================================================================
// Research Functions
// ============================================================================

/**
 * Research competitive pricing for the industry and location
 */
async function researchCompetitivePricing(
  industry: string,
  location?: string,
  services?: string[]
): Promise<{
  pricingData: string;
  sources: string[];
}> {
  if (!isPerplexityConfigured()) {
    return { pricingData: '', sources: [] };
  }

  try {
    const locationStr = location ? ` in ${location}` : '';
    const servicesStr = services?.length ? services.slice(0, 3).join(', ') : industry;

    const query = `What are typical prices and pricing models for ${servicesStr} services${locationStr}?
Include:
- Hourly rates vs package pricing
- Typical price ranges (low, mid, premium)
- What features justify premium pricing
- Common pricing tiers used by successful businesses
Be specific with dollar amounts.`;

    const result = await perplexitySearch({
      query,
      model: 'sonar',
      systemPrompt: `You are a business pricing researcher. Provide specific, actionable pricing data with real dollar amounts. Focus on current market rates.`,
    });

    return {
      pricingData: result.answer,
      sources: result.sources?.map(s => s.url) || [],
    };
  } catch (err) {
    console.error('[BusinessModel] Pricing research failed:', err);
    return { pricingData: '', sources: [] };
  }
}

/**
 * Research common customer questions for FAQs
 */
async function researchCustomerQuestions(
  industry: string,
  services?: string[]
): Promise<string> {
  if (!isPerplexityConfigured()) {
    return '';
  }

  try {
    const servicesStr = services?.length ? services.slice(0, 3).join(', ') : industry;

    const query = `What are the most common questions customers ask before hiring a ${industry} business or buying ${servicesStr} services? List the top 8 questions with brief answers.`;

    const result = await perplexitySearch({
      query,
      model: 'sonar',
      systemPrompt: `You are a customer research specialist. List real questions that potential customers frequently ask, with helpful answers.`,
    });

    return result.answer;
  } catch (err) {
    console.error('[BusinessModel] FAQ research failed:', err);
    return '';
  }
}

// ============================================================================
// Generation Functions
// ============================================================================

/**
 * Generate a complete BusinessModel using AI + Research
 * This is the main function that creates the "savage" business content
 */
export async function generateBusinessModel(
  input: BusinessModelInput,
  geminiModel: string = 'gemini-2.0-flash-exp'
): Promise<BusinessModel> {
  console.log('[BusinessModel] Generating business model for:', input.businessName);

  // Conduct parallel research
  const [pricingResearch, faqResearch] = await Promise.all([
    researchCompetitivePricing(input.industry, input.location, input.services),
    researchCustomerQuestions(input.industry, input.services),
  ]);

  console.log('[BusinessModel] Research complete. Pricing sources:', pricingResearch.sources.length);

  // Build the generation prompt with all context
  const prompt = buildBusinessModelPrompt(input, pricingResearch.pricingData, faqResearch);

  // Use Gemini with structured output expectation
  const result = await createGeminiCompletion({
    messages: [{ role: 'user', content: prompt }],
    model: geminiModel,
    temperature: 0.7, // Some creativity for testimonials
    maxTokens: 4000,
    systemPrompt: `You are a business strategist and copywriter who creates compelling business content.
You specialize in creating professional pricing structures, service packages, and marketing copy.
Always return valid JSON that matches the requested schema exactly.
Be specific, realistic, and persuasive. Never use generic placeholders.`,
  });

  // Parse the response
  const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[BusinessModel] Failed to parse JSON from response');
    return createFallbackBusinessModel(input);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Merge with input data and add metadata
    const businessModel: BusinessModel = {
      businessName: input.businessName,
      tagline: parsed.tagline || `Professional ${input.industry} Services`,
      elevatorPitch: parsed.elevatorPitch || '',
      uniqueValueProposition: parsed.uniqueValueProposition || '',
      pricingTiers: parsed.pricingTiers || [],
      services: parsed.services || [],
      testimonials: addAvatarsToTestimonials(parsed.testimonials || []),
      stats: parsed.stats,
      faqs: parsed.faqs || [],
      aboutContent: {
        story: parsed.aboutContent?.story || '',
        values: parsed.aboutContent?.values || [],
        teamDescription: parsed.aboutContent?.teamDescription,
      },
      contactInfo: {
        email: input.email || parsed.contactInfo?.email,
        phone: input.phone || parsed.contactInfo?.phone,
        address: input.location || parsed.contactInfo?.address,
        hours: parsed.contactInfo?.hours,
      },
      seoTitle: parsed.seoTitle || `${input.businessName} | ${input.industry}`,
      seoDescription: parsed.seoDescription || parsed.elevatorPitch || '',
      keywords: parsed.keywords || [],
      researchSources: pricingResearch.sources,
      generatedAt: new Date().toISOString(),
    };

    console.log('[BusinessModel] Successfully generated model with',
      businessModel.pricingTiers.length, 'pricing tiers,',
      businessModel.services.length, 'services,',
      businessModel.testimonials.length, 'testimonials');

    return businessModel;
  } catch (err) {
    console.error('[BusinessModel] JSON parse error:', err);
    return createFallbackBusinessModel(input);
  }
}

/**
 * Build the prompt for business model generation
 */
function buildBusinessModelPrompt(
  input: BusinessModelInput,
  pricingResearch: string,
  faqResearch: string
): string {
  const locationStr = input.location ? ` in ${input.location}` : '';
  const servicesStr = input.services?.length
    ? `Services they offer: ${input.services.join(', ')}`
    : '';
  const pricingHint = input.pricing
    ? `User mentioned pricing: ${input.pricing}`
    : '';
  const audienceStr = input.targetAudience
    ? `Target audience: ${input.targetAudience}`
    : '';

  return `Generate a complete business model for:

BUSINESS: "${input.businessName}"
INDUSTRY: ${input.industry}${locationStr}
${servicesStr}
${pricingHint}
${audienceStr}
${input.additionalContext ? `Additional context: ${input.additionalContext}` : ''}

COMPETITIVE PRICING RESEARCH:
${pricingResearch || 'No specific pricing research available - use industry standard rates'}

COMMON CUSTOMER QUESTIONS:
${faqResearch || 'Generate common questions for this industry'}

Generate a complete JSON business model with this EXACT structure:

{
  "tagline": "Catchy 5-10 word tagline for the business",
  "elevatorPitch": "2-3 sentence compelling description of the business",
  "uniqueValueProposition": "What makes this business different from competitors",

  "pricingTiers": [
    {
      "name": "Tier name (e.g., Basic, Professional, Premium)",
      "price": "Specific price (e.g., $49/month, $75/hour)",
      "period": "per month, per session, etc.",
      "description": "One sentence about this tier",
      "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
      "highlighted": true/false,
      "ctaText": "Button text"
    }
  ],

  "services": [
    {
      "name": "Service name",
      "description": "2-3 sentence description",
      "price": "Price if applicable",
      "duration": "Duration if applicable",
      "features": ["What's included"],
      "icon": "heroicons icon name (e.g., academic-cap, briefcase, chart-bar)"
    }
  ],

  "testimonials": [
    {
      "name": "Realistic full name",
      "role": "Their role/relationship (e.g., Parent, Business Owner)",
      "location": "City, State",
      "quote": "Realistic 2-3 sentence testimonial",
      "rating": 5
    }
  ],

  "stats": [
    {"value": "500+", "label": "Students Helped"},
    {"value": "98%", "label": "Pass Rate"},
    {"value": "10+", "label": "Years Experience"}
  ],

  "faqs": [
    {
      "question": "Common question?",
      "answer": "Helpful, specific answer"
    }
  ],

  "aboutContent": {
    "story": "2-3 paragraph company story/mission",
    "values": ["Value 1", "Value 2", "Value 3"],
    "teamDescription": "Brief team introduction"
  },

  "contactInfo": {
    "hours": [
      {"days": "Monday - Friday", "hours": "9:00 AM - 6:00 PM"},
      {"days": "Saturday", "hours": "10:00 AM - 4:00 PM"}
    ]
  },

  "seoTitle": "Business Name | Primary Service | Location",
  "seoDescription": "Meta description for search engines (150-160 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

REQUIREMENTS:
1. Generate 3-4 pricing tiers based on the research data
2. Generate 4-6 service packages specific to ${input.industry}
3. Generate 3-4 realistic testimonials with believable names and specific praise
4. Generate 6-8 FAQs based on real customer questions
5. All prices should be realistic for ${input.location || 'the US market'}
6. Use specific numbers, not vague ranges
7. Make testimonials sound authentic, not generic
8. Include compelling stats if possible

Return ONLY the JSON object, no markdown or explanation.`;
}

/**
 * Add Unsplash avatar URLs to testimonials
 */
function addAvatarsToTestimonials(testimonials: Testimonial[]): Testimonial[] {
  // Professional-looking Unsplash portraits
  const avatarUrls = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  ];

  return testimonials.map((t, i) => ({
    ...t,
    avatar: avatarUrls[i % avatarUrls.length],
  }));
}

/**
 * Create a fallback business model when generation fails
 */
function createFallbackBusinessModel(input: BusinessModelInput): BusinessModel {
  return {
    businessName: input.businessName,
    tagline: `Professional ${input.industry} Services`,
    elevatorPitch: `${input.businessName} provides high-quality ${input.industry} services${input.location ? ` in ${input.location}` : ''}. We're committed to delivering exceptional results for every client.`,
    uniqueValueProposition: `Personalized attention and proven results that set us apart.`,
    pricingTiers: [
      {
        name: 'Starter',
        price: '$49',
        period: 'per session',
        description: 'Perfect for getting started',
        features: ['Initial consultation', 'Basic service', 'Email support'],
        highlighted: false,
        ctaText: 'Get Started',
      },
      {
        name: 'Professional',
        price: '$99',
        period: 'per session',
        description: 'Our most popular option',
        features: ['Everything in Starter', 'Extended session', 'Priority scheduling', 'Follow-up support'],
        highlighted: true,
        ctaText: 'Choose Professional',
      },
      {
        name: 'Premium',
        price: '$199',
        period: 'per session',
        description: 'For comprehensive needs',
        features: ['Everything in Professional', 'Dedicated specialist', 'Flexible scheduling', '24/7 support'],
        highlighted: false,
        ctaText: 'Go Premium',
      },
    ],
    services: [
      {
        name: 'Consultation',
        description: 'Initial assessment and personalized recommendations.',
        features: ['Needs assessment', 'Custom plan', 'Expert guidance'],
        icon: 'chat-bubble-left-right',
      },
      {
        name: 'Core Service',
        description: 'Our flagship offering designed to deliver results.',
        features: ['Professional service', 'Quality guarantee', 'Ongoing support'],
        icon: 'star',
      },
      {
        name: 'Advanced Package',
        description: 'Comprehensive solution for complex needs.',
        features: ['Full service', 'Priority handling', 'Extended support'],
        icon: 'rocket-launch',
      },
    ],
    testimonials: addAvatarsToTestimonials([
      {
        name: 'Sarah M.',
        role: 'Customer',
        location: input.location || 'New York',
        quote: `${input.businessName} exceeded our expectations. Professional, reliable, and truly cares about results.`,
        rating: 5,
      },
      {
        name: 'Michael R.',
        role: 'Business Owner',
        location: input.location || 'California',
        quote: 'Outstanding service from start to finish. Highly recommend to anyone looking for quality.',
        rating: 5,
      },
      {
        name: 'Jennifer L.',
        role: 'Returning Client',
        location: input.location || 'Texas',
        quote: "We've been using their services for over a year now. Consistent quality every time.",
        rating: 5,
      },
    ]),
    stats: [
      { value: '500+', label: 'Happy Clients' },
      { value: '10+', label: 'Years Experience' },
      { value: '99%', label: 'Satisfaction Rate' },
    ],
    faqs: [
      {
        question: 'What services do you offer?',
        answer: `We offer a comprehensive range of ${input.industry} services tailored to your needs.`,
      },
      {
        question: 'How do I get started?',
        answer: 'Simply contact us for a free consultation. We\'ll discuss your needs and recommend the best approach.',
      },
      {
        question: 'What are your prices?',
        answer: 'Our pricing varies based on your specific needs. We offer competitive rates with packages starting at $49.',
      },
      {
        question: 'Do you offer guarantees?',
        answer: 'Yes! We stand behind our work and offer satisfaction guarantees on all services.',
      },
      {
        question: 'How long does it take?',
        answer: 'Timeline depends on the service selected. We\'ll provide a clear estimate during your consultation.',
      },
    ],
    aboutContent: {
      story: `${input.businessName} was founded with a simple mission: to provide exceptional ${input.industry} services that make a real difference. We believe in personalized attention, honest communication, and delivering results that exceed expectations.`,
      values: ['Quality', 'Integrity', 'Customer Focus'],
    },
    contactInfo: {
      email: input.email,
      phone: input.phone,
      address: input.location,
      hours: [
        { days: 'Monday - Friday', hours: '9:00 AM - 6:00 PM' },
        { days: 'Saturday', hours: '10:00 AM - 4:00 PM' },
      ],
    },
    seoTitle: `${input.businessName} | ${input.industry} Services${input.location ? ` in ${input.location}` : ''}`,
    seoDescription: `${input.businessName} offers professional ${input.industry} services${input.location ? ` in ${input.location}` : ''}. Contact us today for a free consultation.`,
    keywords: [input.industry, input.businessName, ...(input.services || [])],
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Utility Functions for Section Updates
// ============================================================================

/**
 * Update a specific section of the business model
 * Used for conversational editing like "change pricing to $100/hour"
 */
export async function updateBusinessModelSection(
  currentModel: BusinessModel,
  section: 'pricing' | 'services' | 'testimonials' | 'faqs' | 'about' | 'contact',
  updateRequest: string,
  geminiModel: string = 'gemini-2.0-flash-exp'
): Promise<BusinessModel> {
  console.log('[BusinessModel] Updating section:', section, 'Request:', updateRequest);

  const sectionData = getSectionData(currentModel, section);

  const prompt = `Given this current ${section} data:
${JSON.stringify(sectionData, null, 2)}

Apply this change: "${updateRequest}"

Return the updated ${section} data in the same JSON format.
Only modify what's requested, keep everything else the same.
Return ONLY valid JSON, no explanation.`;

  const result = await createGeminiCompletion({
    messages: [{ role: 'user', content: prompt }],
    model: geminiModel,
    temperature: 0.3,
    maxTokens: 2000,
  });

  try {
    const jsonMatch = result.text?.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      const updated = JSON.parse(jsonMatch[0]);
      return applySectionUpdate(currentModel, section, updated);
    }
  } catch (err) {
    console.error('[BusinessModel] Section update failed:', err);
  }

  return currentModel;
}

function getSectionData(model: BusinessModel, section: string): unknown {
  switch (section) {
    case 'pricing': return model.pricingTiers;
    case 'services': return model.services;
    case 'testimonials': return model.testimonials;
    case 'faqs': return model.faqs;
    case 'about': return model.aboutContent;
    case 'contact': return model.contactInfo;
    default: return {};
  }
}

function applySectionUpdate(model: BusinessModel, section: string, data: unknown): BusinessModel {
  const updated = { ...model };
  switch (section) {
    case 'pricing': updated.pricingTiers = data as PricingTier[]; break;
    case 'services': updated.services = data as ServicePackage[]; break;
    case 'testimonials': updated.testimonials = data as Testimonial[]; break;
    case 'faqs': updated.faqs = data as FAQ[]; break;
    case 'about': updated.aboutContent = data as BusinessModel['aboutContent']; break;
    case 'contact': updated.contactInfo = data as BusinessModel['contactInfo']; break;
  }
  return updated;
}

export default {
  generateBusinessModel,
  updateBusinessModelSection,
};
