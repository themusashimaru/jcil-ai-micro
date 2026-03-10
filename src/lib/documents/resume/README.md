# Resume Generator Module

A comprehensive, ATS-optimized resume building system with conversational guidance, professional document generation, and real-time revision support.

---

## Features

### Conversational Building

- **Guided data collection**: Step-by-step questions for contact info, experience, education, skills, and certifications
- **One question at a time**: Avoids overwhelming users
- **Progress tracking**: Visual checklist showing completion status
- **Smart extraction**: Parses conversation to extract structured resume data

### Document Generation

- **Word (.docx)**: Editable document with perfect formatting
- **PDF**: Submission-ready with identical layout
- **Parallel generation**: Both documents created simultaneously
- **Consistent output**: Word and PDF match exactly

### ATS Optimization

- **Single-column layout**: Parseable by all ATS systems
- **Standard fonts**: Calibri, Arial, Times New Roman, Garamond
- **No graphics**: Text-only content for maximum compatibility
- **Keyword analysis**: Scores resume against job descriptions
- **Action verb check**: Ensures achievement-focused bullet points

### Template Presets

| Preset      | Font            | Best For                       |
| ----------- | --------------- | ------------------------------ |
| **Modern**  | Calibri         | Tech, startups, creative roles |
| **Classic** | Times New Roman | Finance, law, consulting       |
| **Minimal** | Arial           | Maximum content density        |

### Revision Support

Users can request changes after generation:

- "Widen the margins" / "Narrow margins"
- "Use Arial font" / "Use Times New Roman"
- "Make the name larger/smaller"
- "Move education above experience"
- "Put skills at the top"

---

## Architecture

```
src/lib/documents/resume/
├── index.ts               # Module exports
├── types.ts               # TypeScript interfaces and presets
├── generateDocx.ts        # Word document generator
├── generatePdf.ts         # PDF generator (PDFKit)
├── conversationHandler.ts # State management and prompts
├── atsScoring.ts          # ATS compatibility analysis
└── README.md              # This file
```

---

## API Usage

### Generate Documents

```typescript
import { generateResumeDocuments, MODERN_PRESET } from '@/lib/documents/resume';

const resumeData: ResumeData = {
  contact: {
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '555-123-4567',
    location: 'New York, NY',
  },
  experience: [
    {
      company: 'Tech Corp',
      title: 'Software Engineer',
      startDate: 'Jan 2020',
      endDate: 'Present',
      bullets: [
        'Led development of microservices architecture',
        'Increased API performance by 40%',
      ],
    },
  ],
  education: [
    {
      institution: 'State University',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      graduationDate: 'May 2019',
    },
  ],
  skills: [
    { category: 'Languages', items: ['TypeScript', 'Python', 'Go'] },
    { category: 'Tools', items: ['Docker', 'Kubernetes', 'AWS'] },
  ],
  formatting: MODERN_PRESET,
};

const { docx, pdf, docxFilename, pdfFilename } = await generateResumeDocuments(resumeData);
```

### Score for ATS

```typescript
import { scoreResumeForATS } from '@/lib/documents/resume';

const score = scoreResumeForATS(resumeData, {
  title: 'Software Engineer',
  company: 'Google',
  jobDescription: 'We are looking for a TypeScript expert...',
});

console.log(`ATS Score: ${score.overall}/100`);
console.log('Issues:', score.issues);
console.log('Suggestions:', score.suggestions);
```

### Parse Revision Requests

```typescript
import { parseRevisionRequest, MODERN_PRESET } from '@/lib/documents/resume';

const changes = parseRevisionRequest('widen the margins and use Arial', MODERN_PRESET);
// Returns: { margins: { left: 1.25, right: 1.25, ... }, fonts: { primary: 'Arial', ... } }
```

---

## Data Model

### ResumeData

```typescript
interface ResumeData {
  contact: ContactInfo; // Required: name, email
  summary?: string; // Professional summary paragraph
  experience: WorkExperience[]; // Job history with bullets
  education: Education[]; // Degrees and certifications
  skills: SkillCategory[]; // Organized by category
  certifications?: Certification[];
  additionalSections?: AdditionalSection[];
  formatting: ResumeFormatting; // Template, margins, fonts
}
```

### ResumeFormatting

```typescript
interface ResumeFormatting {
  template: 'modern' | 'classic' | 'minimal';
  margins: { top: number; bottom: number; left: number; right: number };
  fonts: {
    primary: string;
    header: string;
    sizes: { name: number; sectionHeader: number; body: number; contact: number };
  };
  spacing: { lineHeight: number; sectionGap: number; paragraphGap: number };
  sectionOrder: string[];
  colors?: { primary: string; text: string; muted: string };
}
```

---

## Integration with Chat API

The resume generator is triggered via the `resume_generator` tool mode in `/api/chat`:

1. **User clicks Resume Generator** in Agents menu
2. **Chat API** detects `searchMode: 'resume_generator'`
3. **Conversation phase**: Claude asks questions using specialized prompt
4. **Extraction phase**: When user confirms, extracts all data from conversation
5. **Generation phase**: Creates Word + PDF and returns download links
6. **Revision phase**: User can request changes, triggering regeneration

---

## Security Considerations

- **Authentication required**: Only authenticated users can generate resumes
- **No PII logging**: Resume content is not logged
- **Data extraction**: Happens in-memory, not stored permanently
- **File delivery**: Base64-encoded in response, not stored on server

---

## Testing

```bash
# Type check the module
npx tsc --noEmit

# Run all tests
npm test
```

---

## Future Enhancements

- [ ] Upload existing resume for parsing and improvement
- [ ] Multiple resume versions per job application
- [ ] LinkedIn profile import
- [ ] Cover letter generation
- [ ] Interview preparation tips based on resume content
