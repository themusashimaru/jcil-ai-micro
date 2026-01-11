/**
 * Resume Generator - Conversation Handler
 *
 * Manages the conversational flow for building resumes.
 * Shows progress checklist, asks clarifying questions, and generates documents.
 */

import type {
  ResumeData,
  ResumeGeneratorState,
  ResumeGeneratorStep,
  ContactInfo,
  ResumeFormatting,
} from './types';
import { MODERN_PRESET, CLASSIC_PRESET, MINIMAL_PRESET } from './types';
import { generateResumeDocx, generateResumeFilename } from './generateDocx';
import { generateResumePdf } from './generatePdf';

// ============================================================================
// PROGRESS CHECKLIST
// ============================================================================

export interface ProgressItem {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
  description?: string;
}

export interface ResumeProgress {
  items: ProgressItem[];
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
}

/**
 * Get the progress checklist for the resume builder
 */
export function getProgressChecklist(state: ResumeGeneratorState): ResumeProgress {
  const items: ProgressItem[] = [
    {
      id: 'contact',
      label: 'Contact Information',
      status: getStepStatus(state.step, 'gathering_contact'),
      description: 'Name, email, phone, location, LinkedIn',
    },
    {
      id: 'target',
      label: 'Target Job',
      status: getStepStatus(state.step, 'gathering_target_job'),
      description: "Job title and company you're applying to",
    },
    {
      id: 'experience',
      label: 'Work Experience',
      status: getStepStatus(state.step, 'gathering_experience'),
      description: 'Employment history with achievements',
    },
    {
      id: 'education',
      label: 'Education',
      status: getStepStatus(state.step, 'gathering_education'),
      description: 'Degrees, certifications, training',
    },
    {
      id: 'skills',
      label: 'Skills',
      status: getStepStatus(state.step, 'gathering_skills'),
      description: 'Technical and soft skills',
    },
    {
      id: 'style',
      label: 'Style & Format',
      status: getStepStatus(state.step, 'style_selection'),
      description: 'Template, fonts, margins',
    },
    {
      id: 'generate',
      label: 'Generate Resume',
      status: getStepStatus(state.step, 'generating'),
      description: 'Word and PDF documents',
    },
  ];

  const completedCount = items.filter((item) => item.status === 'completed').length;
  const currentStepIndex = items.findIndex((item) => item.status === 'in_progress');

  return {
    items,
    currentStep: currentStepIndex >= 0 ? currentStepIndex + 1 : items.length,
    totalSteps: items.length,
    percentComplete: Math.round((completedCount / items.length) * 100),
  };
}

/**
 * Determine the status of a progress item based on current step
 */
function getStepStatus(
  currentStep: ResumeGeneratorStep,
  itemStep: ResumeGeneratorStep
): 'pending' | 'in_progress' | 'completed' {
  const stepOrder: ResumeGeneratorStep[] = [
    'welcome',
    'choose_path',
    'uploading',
    'parsing',
    'gathering_contact',
    'gathering_target_job',
    'gathering_experience',
    'gathering_education',
    'gathering_skills',
    'gathering_additional',
    'style_selection',
    'generating',
    'reviewing',
    'revising',
    'complete',
  ];

  const currentIndex = stepOrder.indexOf(currentStep);
  const itemIndex = stepOrder.indexOf(itemStep);

  if (currentStep === itemStep) {
    return 'in_progress';
  }

  // Check if we've passed this step
  if (currentIndex > itemIndex) {
    return 'completed';
  }

  return 'pending';
}

// ============================================================================
// CONVERSATION PROMPTS
// ============================================================================

/**
 * Get the system prompt for the resume generator
 */
export function getResumeSystemPrompt(): string {
  return `You are a professional resume writer helping users create ATS-friendly resumes.

Your role:
1. Guide users through building their resume step by step
2. Ask focused, clarifying questions to gather information
3. Write compelling, achievement-focused bullet points
4. Optimize content for ATS (Applicant Tracking Systems)
5. Use action verbs and quantify achievements when possible

Important guidelines:
- Ask ONE question at a time to avoid overwhelming the user
- Be encouraging and professional
- Help users articulate their achievements with impact
- Use industry-standard resume language
- Ensure all content is honest and accurate to what the user provides

When writing bullet points:
- Start with strong action verbs (Led, Developed, Implemented, Increased, etc.)
- Include metrics and numbers when possible
- Focus on achievements, not just responsibilities
- Keep bullets concise (1-2 lines max)

For ATS optimization:
- Use standard section headings
- Include relevant keywords from the target job
- Avoid tables, graphics, and unusual formatting
- Use standard fonts and clear hierarchy`;
}

/**
 * Get the initial welcome message
 */
export function getWelcomeMessage(): string {
  return `Welcome to the Resume Builder! I'll help you create a professional, ATS-optimized resume.

**Here's how it works:**

1. **Contact Info** - Your name and how employers can reach you
2. **Target Job** - The role you're applying for (helps with keyword optimization)
3. **Experience** - Your work history with achievement-focused bullet points
4. **Education** - Degrees, certifications, and relevant training
5. **Skills** - Technical skills, tools, and competencies
6. **Style** - Choose your template and customize formatting

**Ready to get started?**

You can either:
- **Upload an existing resume** and I'll help you improve it
- **Start fresh** and we'll build it together from scratch

Which would you prefer?`;
}

/**
 * Get the prompt for gathering contact information
 */
export function getContactPrompt(existingContact?: Partial<ContactInfo>): string {
  if (existingContact?.fullName) {
    return `I have your contact info:
- **Name:** ${existingContact.fullName}
- **Email:** ${existingContact.email || 'Not provided'}
- **Phone:** ${existingContact.phone || 'Not provided'}
- **Location:** ${existingContact.location || 'Not provided'}
- **LinkedIn:** ${existingContact.linkedin || 'Not provided'}

Is this correct? Would you like to update anything?`;
  }

  return `Let's start with your contact information.

**What is your full name?**

(I'll ask about email, phone, location, and LinkedIn next)`;
}

/**
 * Get prompts for each step
 */
export function getStepPrompt(step: ResumeGeneratorStep, state: ResumeGeneratorState): string {
  switch (step) {
    case 'welcome':
    case 'choose_path':
      return getWelcomeMessage();

    case 'gathering_contact':
      return getContactPrompt(state.resumeData.contact);

    case 'gathering_target_job':
      return `Great! Now let's talk about the job you're targeting.

**What job title are you applying for?**

(If you have a specific job posting, you can paste the job description and I'll help optimize your resume for it)`;

    case 'gathering_experience':
      const expCount = state.resumeData.experience?.length || 0;
      if (expCount > 0) {
        return `You've added ${expCount} position${expCount > 1 ? 's' : ''}.

**Would you like to add another position, or move on to Education?**`;
      }
      return `Now let's add your work experience.

**What's your most recent (or current) job?**

Please share:
- Company name
- Your job title
- Location (city, state)
- Start and end dates (or "Present" if current)

I'll help you craft impactful bullet points for each role.`;

    case 'gathering_education':
      return `Let's add your education.

**What degree or certification would you like to add?**

Include:
- School/Institution name
- Degree type (Bachelor's, Master's, etc.)
- Field of study
- Graduation date (or expected)
- GPA (if 3.5+ or recent graduate)`;

    case 'gathering_skills':
      return `Now let's highlight your skills.

**What technical skills, tools, or technologies are you proficient in?**

You can list them by category:
- **Technical:** Python, JavaScript, SQL...
- **Tools:** Figma, Jira, Salesforce...
- **Languages:** Spanish (fluent), French (conversational)...

Or just list them and I'll organize them for you.`;

    case 'gathering_additional':
      return `Would you like to add any additional sections?

Common options:
- **Projects** - Personal or open-source projects
- **Publications** - Papers, articles, or blog posts
- **Volunteer Work** - Community involvement
- **Awards** - Recognition and achievements
- **Languages** - If not already included in skills

**Type the section name or say "skip" to continue.**`;

    case 'style_selection':
      return `Your content is ready! Now let's style your resume.

**Choose a template:**

1. **Modern** - Clean, contemporary design with subtle color accents (recommended)
2. **Classic** - Traditional, conservative layout (great for finance, law)
3. **Minimal** - Compact, no-frills design (fits more content)

**Type 1, 2, or 3 to select.**

After choosing, you can customize:
- Fonts (Calibri, Arial, Times New Roman, etc.)
- Margins (wider for readability, narrower to fit more)
- Section order (move education above experience if recent graduate)`;

    case 'generating':
      return `Generating your resume...

I'm creating both Word (.docx) and PDF versions with:
- ATS-optimized formatting
- Consistent styling
- Perfect margins and spacing

This will just take a moment.`;

    case 'reviewing':
      return `Your resume is ready!

I've generated:
- **Word Document** (.docx) - Easy to edit
- **PDF** - Ready to submit

**Review your resume and let me know if you'd like any changes:**
- "Widen the margins"
- "Use a different font"
- "Make the name larger"
- "Move education above experience"
- "Rewrite the summary"
- "Add more keywords"

Or say **"done"** if you're happy with it!`;

    case 'complete':
      return `Your resume is complete!

**Download your files:**
- Word Document (.docx)
- PDF Version

**Tips for using your resume:**
1. Always customize for each application
2. Use keywords from the job description
3. Keep it to 1-2 pages
4. Proofread carefully before submitting

Good luck with your job search! Feel free to come back anytime to update your resume.`;

    default:
      return '';
  }
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Create initial state for the resume generator
 */
export function createInitialState(): ResumeGeneratorState {
  return {
    step: 'welcome',
    questionsAsked: [],
    resumeData: {
      contact: {
        fullName: '',
        email: '',
      },
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    },
    revisionHistory: [],
  };
}

/**
 * Advance to the next step in the resume building process
 */
export function getNextStep(currentStep: ResumeGeneratorStep): ResumeGeneratorStep {
  const stepFlow: Record<ResumeGeneratorStep, ResumeGeneratorStep> = {
    welcome: 'choose_path',
    choose_path: 'gathering_contact',
    uploading: 'parsing',
    parsing: 'gathering_contact',
    gathering_contact: 'gathering_target_job',
    gathering_target_job: 'gathering_experience',
    gathering_experience: 'gathering_education',
    gathering_education: 'gathering_skills',
    gathering_skills: 'gathering_additional',
    gathering_additional: 'style_selection',
    style_selection: 'generating',
    generating: 'reviewing',
    reviewing: 'revising',
    revising: 'reviewing',
    complete: 'complete',
  };

  return stepFlow[currentStep] || 'complete';
}

/**
 * Apply template preset to formatting
 */
export function applyTemplate(
  template: 'modern' | 'classic' | 'minimal',
  currentFormatting?: Partial<ResumeFormatting>
): ResumeFormatting {
  const presets = {
    modern: MODERN_PRESET,
    classic: CLASSIC_PRESET,
    minimal: MINIMAL_PRESET,
  };

  return {
    ...presets[template],
    ...currentFormatting,
    template,
  };
}

// ============================================================================
// DOCUMENT GENERATION
// ============================================================================

export interface GeneratedDocuments {
  docx: Buffer;
  pdf: Buffer;
  docxFilename: string;
  pdfFilename: string;
}

/**
 * Generate both Word and PDF versions of the resume
 */
export async function generateResumeDocuments(data: ResumeData): Promise<GeneratedDocuments> {
  const [docx, pdf] = await Promise.all([generateResumeDocx(data), generateResumePdf(data)]);

  const baseName = data.contact.fullName || 'resume';

  return {
    docx,
    pdf,
    docxFilename: generateResumeFilename(baseName, 'docx'),
    pdfFilename: generateResumeFilename(baseName, 'pdf'),
  };
}

// ============================================================================
// REVISION HANDLING
// ============================================================================

/**
 * Parse a revision request and determine what changes to make
 */
export function parseRevisionRequest(
  request: string,
  currentFormatting: ResumeFormatting
): Partial<ResumeFormatting> {
  const changes: Partial<ResumeFormatting> = {};
  const lowerRequest = request.toLowerCase();

  // Margin adjustments
  if (lowerRequest.includes('widen margin') || lowerRequest.includes('more whitespace')) {
    changes.margins = {
      ...currentFormatting.margins,
      left: Math.min(currentFormatting.margins.left + 0.25, 1.5),
      right: Math.min(currentFormatting.margins.right + 0.25, 1.5),
    };
  }

  if (lowerRequest.includes('narrow margin') || lowerRequest.includes('less whitespace')) {
    changes.margins = {
      ...currentFormatting.margins,
      left: Math.max(currentFormatting.margins.left - 0.25, 0.5),
      right: Math.max(currentFormatting.margins.right - 0.25, 0.5),
    };
  }

  // Font changes
  if (lowerRequest.includes('arial')) {
    changes.fonts = {
      ...currentFormatting.fonts,
      primary: 'Arial',
      header: 'Arial',
    };
  }

  if (lowerRequest.includes('times') || lowerRequest.includes('traditional')) {
    changes.fonts = {
      ...currentFormatting.fonts,
      primary: 'Times New Roman',
      header: 'Times New Roman',
    };
  }

  if (lowerRequest.includes('calibri') || lowerRequest.includes('modern font')) {
    changes.fonts = {
      ...currentFormatting.fonts,
      primary: 'Calibri',
      header: 'Calibri',
    };
  }

  // Size adjustments
  if (lowerRequest.includes('name larger') || lowerRequest.includes('bigger name')) {
    changes.fonts = {
      ...currentFormatting.fonts,
      sizes: {
        ...currentFormatting.fonts.sizes,
        name: Math.min(currentFormatting.fonts.sizes.name + 2, 28),
      },
    };
  }

  if (lowerRequest.includes('name smaller') || lowerRequest.includes('smaller name')) {
    changes.fonts = {
      ...currentFormatting.fonts,
      sizes: {
        ...currentFormatting.fonts.sizes,
        name: Math.max(currentFormatting.fonts.sizes.name - 2, 16),
      },
    };
  }

  // Section reordering
  if (
    lowerRequest.includes('education above experience') ||
    lowerRequest.includes('education first')
  ) {
    const order = [...currentFormatting.sectionOrder];
    const eduIndex = order.indexOf('education');
    const expIndex = order.indexOf('experience');
    if (eduIndex > expIndex) {
      [order[eduIndex], order[expIndex]] = [order[expIndex], order[eduIndex]];
      changes.sectionOrder = order;
    }
  }

  if (
    lowerRequest.includes('experience above education') ||
    lowerRequest.includes('experience first')
  ) {
    const order = [...currentFormatting.sectionOrder];
    const eduIndex = order.indexOf('education');
    const expIndex = order.indexOf('experience');
    if (expIndex > eduIndex) {
      [order[eduIndex], order[expIndex]] = [order[expIndex], order[eduIndex]];
      changes.sectionOrder = order;
    }
  }

  if (lowerRequest.includes('skills at top') || lowerRequest.includes('skills first')) {
    const order = currentFormatting.sectionOrder.filter((s) => s !== 'skills');
    order.splice(1, 0, 'skills'); // After summary
    changes.sectionOrder = order;
  }

  return changes;
}

// ============================================================================
// FORMAT PROGRESS AS MARKDOWN
// ============================================================================

/**
 * Format the progress checklist as markdown for display
 */
export function formatProgressAsMarkdown(progress: ResumeProgress): string {
  const lines = [`**Resume Builder Progress** (${progress.percentComplete}% complete)`, ''];

  progress.items.forEach((item) => {
    const icon = item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '→' : '○';

    const statusText =
      item.status === 'completed'
        ? '~~' + item.label + '~~'
        : item.status === 'in_progress'
          ? `**${item.label}**`
          : item.label;

    lines.push(`${icon} ${statusText}`);
  });

  return lines.join('\n');
}
