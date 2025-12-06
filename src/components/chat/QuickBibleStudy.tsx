/**
 * QUICK BIBLE STUDY
 *
 * PURPOSE:
 * - Provide comprehensive theological study tools
 * - Multiple study types: Verse, Topic, Word, Book, Figure, Doctrine
 * - Bible version selection
 * - Depth level customization
 * - Additional context for personalized studies
 * - Submits prompt to chat for streaming response
 * - Powered by gpt-5-mini for accuracy
 */

'use client';

import { useState } from 'react';

type StudyType = 'verse' | 'topic' | 'word' | 'book' | 'figure' | 'doctrine';
type BibleVersion = 'KJV' | 'NKJV' | 'ESV' | 'NIV' | 'NASB';
type DepthLevel = 'basic' | 'intermediate' | 'seminary';

interface StudyTypeOption {
  id: StudyType;
  label: string;
  icon: string;
  description: string;
  placeholder: string;
}

const STUDY_TYPES: StudyTypeOption[] = [
  {
    id: 'verse',
    label: 'Verse Study',
    icon: '📖',
    description: 'Deep dive into specific Scripture passages',
    placeholder: 'e.g., John 3:16, Romans 8:28-30, Psalm 23',
  },
  {
    id: 'topic',
    label: 'Topic Study',
    icon: '🔍',
    description: 'Explore biblical themes across Scripture',
    placeholder: 'e.g., Grace, Salvation, Prayer, Faith, Covenant',
  },
  {
    id: 'word',
    label: 'Word Study',
    icon: '📚',
    description: 'Hebrew/Greek word analysis and etymology',
    placeholder: 'e.g., Agape (love), Hesed (mercy), Shalom (peace)',
  },
  {
    id: 'book',
    label: 'Book Overview',
    icon: '📜',
    description: 'Comprehensive book introductions',
    placeholder: 'e.g., Romans, Genesis, Revelation, Psalms',
  },
  {
    id: 'figure',
    label: 'Figure Study',
    icon: '👤',
    description: 'Study biblical figures in depth',
    placeholder: 'e.g., David, Moses, Paul, Mary, Abraham',
  },
  {
    id: 'doctrine',
    label: 'Doctrine Study',
    icon: '⛪',
    description: 'Systematic theological exploration',
    placeholder: 'e.g., Trinity, Justification, Sanctification, Eschatology',
  },
];

const BIBLE_VERSIONS: { id: BibleVersion; label: string }[] = [
  { id: 'KJV', label: 'King James Version' },
  { id: 'NKJV', label: 'New King James Version' },
  { id: 'ESV', label: 'English Standard Version' },
  { id: 'NIV', label: 'New International Version' },
  { id: 'NASB', label: 'New American Standard' },
];

const DEPTH_LEVELS: { id: DepthLevel; label: string; description: string }[] = [
  { id: 'basic', label: 'Basic', description: 'Clear, accessible explanations' },
  { id: 'intermediate', label: 'Intermediate', description: 'Deeper context and research' },
  { id: 'seminary', label: 'Seminary', description: 'Academic theological depth' },
];

interface QuickBibleStudyProps {
  onSubmitPrompt?: (prompt: string) => void;
}

export function QuickBibleStudy({ onSubmitPrompt }: QuickBibleStudyProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [studyType, setStudyType] = useState<StudyType>('verse');
  const [bibleVersion, setBibleVersion] = useState<BibleVersion>('KJV');
  const [depthLevel, setDepthLevel] = useState<DepthLevel>('intermediate');
  const [question, setQuestion] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currentStudyType = STUDY_TYPES.find((t) => t.id === studyType)!;

  const getStudyPrompt = () => {
    const depthInstructions = {
      basic: 'Write at a high school reading level. Focus on clear, practical explanations that any believer can understand. Avoid technical jargon.',
      intermediate: 'Write at a college reading level. Include historical context, cross-references, and moderate theological depth. Balance accessibility with substance.',
      seminary: 'Write at a graduate/seminary level. Include detailed Hebrew/Greek analysis, engagement with scholarly perspectives, systematic theology connections, and advanced hermeneutical principles.',
    };

    const typePrompts: Record<StudyType, string> = {
      verse: `Provide a comprehensive verse-by-verse study of: ${question}

Using the ${bibleVersion} as the primary text, include:
1. **Full Text**: Quote the passage in ${bibleVersion}
2. **Historical Context**: When was this written, to whom, and why?
3. **Literary Context**: What comes before and after? How does it fit the book's structure?
4. **Word Studies**: Key Hebrew/Greek terms with lexical analysis
5. **Cross-References**: Related passages that illuminate the meaning
6. **Theological Significance**: What doctrines does this teach?
7. **Christological Connection**: How does this point to Christ?
8. **Practical Application**: How should believers respond to this truth?

${depthInstructions[depthLevel]}`,

      topic: `Provide a comprehensive topical study on: ${question}

Include:
1. **Definition**: Biblical definition and scope of this topic
2. **Old Testament Foundation**: Key OT passages and development (${bibleVersion})
3. **New Testament Fulfillment**: How Christ and the NT address this topic
4. **Systematic Theology**: How major doctrines connect to this topic
5. **Key Passages**: 5-7 central Scripture references with brief commentary
6. **Common Misconceptions**: Address popular misunderstandings
7. **Practical Application**: How this truth transforms daily life

${depthInstructions[depthLevel]}`,

      word: `Provide an in-depth word study on: ${question}

Include:
1. **Original Language**: Hebrew (OT) or Greek (NT) word(s) used
2. **Transliteration & Pronunciation**: How to say the word
3. **Lexical Definition**: Dictionary meaning with semantic range
4. **Etymology**: Word origin and development
5. **Usage in Scripture**: How it's used across the Bible (${bibleVersion} references)
6. **Theological Significance**: What this word reveals about God
7. **Related Words**: Synonyms, antonyms, and word family
8. **Translation Variations**: How different versions render it

${depthInstructions[depthLevel]}`,

      book: `Provide a comprehensive introduction to the book of: ${question}

Include:
1. **Author & Date**: Who wrote it and when (traditional and scholarly views)
2. **Historical Background**: What was happening when this was written?
3. **Purpose & Theme**: Why was this book written? Main message?
4. **Outline**: Chapter-by-chapter structure overview
5. **Key Verses**: 5-7 central passages (${bibleVersion})
6. **Theological Themes**: Major doctrines taught in this book
7. **Christ in This Book**: How does it point to Jesus?
8. **Practical Value**: Why should believers study this book today?

${depthInstructions[depthLevel]}`,

      figure: `Provide a comprehensive study on the biblical figure: ${question}

Include:
1. **Name Meaning**: Hebrew/Greek origin and significance
2. **Family & Background**: Who were they? Where did they come from?
3. **Timeline**: Key events in their life chronologically
4. **Key Scripture Passages**: Primary texts about them (${bibleVersion})
5. **Character Traits**: Strengths and weaknesses demonstrated
6. **Relationship with God**: How did they encounter and respond to God?
7. **Christological Connection**: How does their life point to Christ?
8. **Lessons for Today**: What can we learn from their example?

${depthInstructions[depthLevel]}`,

      doctrine: `Provide a comprehensive doctrinal study on: ${question}

Include:
1. **Definition**: What is this doctrine and what does it affirm?
2. **Biblical Foundation**: Key Scripture passages (${bibleVersion})
3. **Historical Development**: How has the church understood this?
4. **Systematic Connections**: How does this relate to other doctrines?
5. **Major Views**: Different Christian perspectives (Reformed, Arminian, etc.)
6. **Common Objections**: How do skeptics challenge this? How do we respond?
7. **Practical Implications**: How does this doctrine affect Christian living?
8. **Summary Statement**: A clear, concise affirmation of this truth

${depthInstructions[depthLevel]}`,
    };

    let prompt = typePrompts[studyType];

    // Add additional context if provided
    if (additionalContext.trim()) {
      prompt += `\n\n**IMPORTANT ADDITIONAL CONTEXT FROM THE USER:**\n${additionalContext.trim()}\n\nPlease tailor this study to address the specific context, questions, or needs mentioned above.`;
    }

    return prompt;
  };

  const handleSubmit = () => {
    if (!question.trim()) {
      setError('Please enter your study topic or question');
      return;
    }

    if (!onSubmitPrompt) {
      setError('Unable to submit study request');
      return;
    }

    // Build the prompt and submit to chat
    const studyPrompt = getStudyPrompt();
    onSubmitPrompt(studyPrompt);

    // Reset and close
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuestion('');
    setAdditionalContext('');
    setError(null);
  };

  return (
    <>
      {/* Bible Study Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg px-3 py-2 text-xs font-medium transition"
        style={{
          backgroundColor: 'var(--surface)',
          color: 'var(--primary)',
          border: '1px solid var(--primary)',
        }}
        title="Comprehensive Bible study tools"
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m-8-8h16" />
          </svg>
          <span>Bible Study</span>
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
          <div className="flex justify-center px-3 pb-4 pt-20 sm:px-6 sm:pb-10">
            <div className="w-full max-w-4xl overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 shadow-2xl">
              <div className="flex max-h-[90vh] flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold sm:text-xl">📖 Bible Study</h2>
                    <span className="text-xs text-gray-400 hidden sm:inline">Powered by gpt-5-mini</span>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
                  <div className="space-y-5">
                    {/* Study Type Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Study Type</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {STUDY_TYPES.map((type) => (
                          <button
                            key={type.id}
                            onClick={() => setStudyType(type.id)}
                            className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                              studyType === type.id
                                ? 'border-amber-500 bg-amber-500/10 text-white'
                                : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:bg-white/10'
                            }`}
                          >
                            <span className="text-xl">{type.icon}</span>
                            <div>
                              <div className="text-sm font-medium">{type.label}</div>
                              <div className="text-xs text-gray-500 hidden sm:block">{type.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bible Version & Depth Level */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Bible Version */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Bible Version</label>
                        <select
                          value={bibleVersion}
                          onChange={(e) => setBibleVersion(e.target.value as BibleVersion)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-white/20 focus:outline-none"
                        >
                          {BIBLE_VERSIONS.map((version) => (
                            <option key={version.id} value={version.id} className="bg-zinc-900">
                              {version.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Depth Level */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Study Depth</label>
                        <select
                          value={depthLevel}
                          onChange={(e) => setDepthLevel(e.target.value as DepthLevel)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-white/20 focus:outline-none"
                        >
                          {DEPTH_LEVELS.map((level) => (
                            <option key={level.id} value={level.id} className="bg-zinc-900">
                              {level.label} - {level.description}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Question Input */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">
                        {currentStudyType.label}
                      </label>
                      <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder={currentStudyType.placeholder}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Additional Context - Optional */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">
                        Additional Focus or Context <span className="text-gray-500">(Optional)</span>
                      </label>
                      <textarea
                        value={additionalContext}
                        onChange={(e) => setAdditionalContext(e.target.value)}
                        placeholder="e.g., I'm teaching this to my youth group, I'm having a discussion with family about this topic, I want to understand this from a Reformed perspective, I'm preparing a sermon..."
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none resize-none text-sm"
                        rows={2}
                      />
                      <p className="text-xs text-gray-500">
                        Share your specific situation, audience, or questions to personalize the study.
                      </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        {error}
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      onClick={handleSubmit}
                      disabled={!question.trim()}
                      className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-4 font-semibold text-white transition hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
                    >
                      Begin {currentStudyType.label}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
