export type AtlasCourseQuestion = {
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'short_answer' | 'scenario';
  options: string[];
  answer: string;
  explanation: string;
};

export type AtlasCourseLesson = {
  title: string;
  objective: string;
  estimatedMinutes: number;
  instructorScript: string;
  workedExample: string;
  learnerActivity: string;
  questions: AtlasCourseQuestion[];
};

export type AtlasCourseModule = {
  title: string;
  objective: string;
  lessons: AtlasCourseLesson[];
};

export type AtlasCoursePackage = {
  schemaVersion: 'atlas-course-v1';
  title: string;
  description: string;
  language: string;
  level: string;
  targetAudience: string;
  prerequisites: string[];
  learningOutcomes: string[];
  estimatedHours: number;
  modules: AtlasCourseModule[];
  finalProject: {
    title: string;
    brief: string;
    deliverables: string[];
  };
  assessment: {
    passingScore: number;
    rubric: Array<{ criterion: string; weight: number; evidence: string }>;
  };
  instructorGuide: {
    openingScript: string;
    facilitationNotes: string[];
    closingScript: string;
  };
  distributionChecklist: string[];
  sourceBoundary: string;
};

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(item => text(item)).filter(Boolean) : [];
}

function extractJson(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('course_json_missing');
  return candidate.slice(start, end + 1);
}

function normalizeQuestion(value: unknown): AtlasCourseQuestion {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const typeValue = text(item.type, 'short_answer');
  const type: AtlasCourseQuestion['type'] = ['single_choice','multiple_choice','short_answer','scenario'].includes(typeValue)
    ? typeValue as AtlasCourseQuestion['type']
    : 'short_answer';
  return {
    question: text(item.question, 'Question unavailable'),
    type,
    options: strings(item.options),
    answer: text(item.answer, 'Instructor review required'),
    explanation: text(item.explanation)
  };
}

function normalizeLesson(value: unknown): AtlasCourseLesson {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    title: text(item.title, 'Untitled lesson'),
    objective: text(item.objective),
    estimatedMinutes: Math.max(5, Math.round(numberValue(item.estimatedMinutes, 30))),
    instructorScript: text(item.instructorScript),
    workedExample: text(item.workedExample),
    learnerActivity: text(item.learnerActivity),
    questions: Array.isArray(item.questions) ? item.questions.map(normalizeQuestion).slice(0, 20) : []
  };
}

function normalizeModule(value: unknown): AtlasCourseModule {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    title: text(item.title, 'Untitled module'),
    objective: text(item.objective),
    lessons: Array.isArray(item.lessons) ? item.lessons.map(normalizeLesson).slice(0, 20) : []
  };
}

export function parseGeneratedCourse(raw: string): AtlasCoursePackage {
  const parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
  const finalProject = (parsed.finalProject && typeof parsed.finalProject === 'object' ? parsed.finalProject : {}) as Record<string, unknown>;
  const assessment = (parsed.assessment && typeof parsed.assessment === 'object' ? parsed.assessment : {}) as Record<string, unknown>;
  const instructorGuide = (parsed.instructorGuide && typeof parsed.instructorGuide === 'object' ? parsed.instructorGuide : {}) as Record<string, unknown>;
  const rubric = Array.isArray(assessment.rubric) ? assessment.rubric.map(value => {
    const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    return {
      criterion: text(item.criterion, 'Criterion'),
      weight: Math.max(0, Math.min(100, numberValue(item.weight, 0))),
      evidence: text(item.evidence)
    };
  }).slice(0, 20) : [];

  const course: AtlasCoursePackage = {
    schemaVersion: 'atlas-course-v1',
    title: text(parsed.title, 'Untitled ATLAS Course'),
    description: text(parsed.description),
    language: text(parsed.language, 'English'),
    level: text(parsed.level, 'Mixed'),
    targetAudience: text(parsed.targetAudience, 'General learners'),
    prerequisites: strings(parsed.prerequisites),
    learningOutcomes: strings(parsed.learningOutcomes),
    estimatedHours: Math.max(1, numberValue(parsed.estimatedHours, 1)),
    modules: Array.isArray(parsed.modules) ? parsed.modules.map(normalizeModule).slice(0, 30) : [],
    finalProject: {
      title: text(finalProject.title, 'Final applied project'),
      brief: text(finalProject.brief),
      deliverables: strings(finalProject.deliverables)
    },
    assessment: {
      passingScore: Math.max(0, Math.min(100, numberValue(assessment.passingScore, 80))),
      rubric
    },
    instructorGuide: {
      openingScript: text(instructorGuide.openingScript),
      facilitationNotes: strings(instructorGuide.facilitationNotes),
      closingScript: text(instructorGuide.closingScript)
    },
    distributionChecklist: strings(parsed.distributionChecklist),
    sourceBoundary: text(parsed.sourceBoundary, 'Generated only from supplied or explicitly authorized source material; verify important claims before instruction.')
  };

  if (!course.modules.length || !course.modules.some(module => module.lessons.length)) {
    throw new Error('course_lessons_missing');
  }
  return course;
}

export function buildCourseGenerationPrompt(input: {
  topic: string;
  audience: string;
  goal: string;
  language: string;
  level: string;
  durationHours: number;
  sourceMaterial: string;
}) {
  return `Operate as ATLAS Course Forge. Build a complete instructor-ready course from the supplied material.

NON-NEGOTIABLE RULES
- Use only supplied source material plus clearly labeled general instructional structure. Do not invent source-specific facts.
- The course must be teachable end-to-end: every lesson needs a full instructorScript, workedExample, learnerActivity and knowledge-check questions with answers/explanations.
- Include practical scenarios, a final applied project, passing score and rubric.
- Distinguish verified/source-grounded claims from assumptions or material that requires verification.
- Do not claim external certification, accreditation or legal/clinical approval.
- Return ONLY valid JSON. No Markdown fences and no prose before or after JSON.

JSON CONTRACT
{
  "schemaVersion":"atlas-course-v1",
  "title":"...",
  "description":"...",
  "language":"...",
  "level":"...",
  "targetAudience":"...",
  "prerequisites":["..."],
  "learningOutcomes":["..."],
  "estimatedHours":0,
  "modules":[{
    "title":"...",
    "objective":"...",
    "lessons":[{
      "title":"...",
      "objective":"...",
      "estimatedMinutes":30,
      "instructorScript":"Full spoken teaching script, not an outline.",
      "workedExample":"...",
      "learnerActivity":"...",
      "questions":[{
        "question":"...",
        "type":"single_choice|multiple_choice|short_answer|scenario",
        "options":["..."],
        "answer":"...",
        "explanation":"..."
      }]
    }]
  }],
  "finalProject":{"title":"...","brief":"...","deliverables":["..."]},
  "assessment":{"passingScore":80,"rubric":[{"criterion":"...","weight":25,"evidence":"..."}]},
  "instructorGuide":{"openingScript":"...","facilitationNotes":["..."],"closingScript":"..."},
  "distributionChecklist":["..."],
  "sourceBoundary":"..."
}

COURSE REQUEST
Topic: ${input.topic}
Audience: ${input.audience}
Learning goal: ${input.goal}
Language: ${input.language}
Level: ${input.level}
Target duration: ${input.durationHours} hours

AUTHORIZED SOURCE MATERIAL
${input.sourceMaterial}`;
}

export function courseToMarkdown(course: AtlasCoursePackage) {
  const lines: string[] = [
    `# ${course.title}`,
    '',
    course.description,
    '',
    `**Language:** ${course.language}`,
    `**Level:** ${course.level}`,
    `**Audience:** ${course.targetAudience}`,
    `**Estimated duration:** ${course.estimatedHours} hours`,
    '',
    '## Learning outcomes',
    ...course.learningOutcomes.map(item => `- ${item}`),
    '',
    '## Prerequisites',
    ...(course.prerequisites.length ? course.prerequisites.map(item => `- ${item}`) : ['- None specified']),
    ''
  ];

  course.modules.forEach((module, moduleIndex) => {
    lines.push(`## Module ${moduleIndex + 1}: ${module.title}`, '', module.objective, '');
    module.lessons.forEach((lesson, lessonIndex) => {
      lines.push(
        `### Lesson ${moduleIndex + 1}.${lessonIndex + 1}: ${lesson.title}`,
        '',
        `**Objective:** ${lesson.objective}`,
        `**Time:** ${lesson.estimatedMinutes} minutes`,
        '',
        '#### Instructor script',
        lesson.instructorScript,
        '',
        '#### Worked example',
        lesson.workedExample,
        '',
        '#### Learner activity',
        lesson.learnerActivity,
        '',
        '#### Knowledge check'
      );
      lesson.questions.forEach((question, index) => {
        lines.push(
          `${index + 1}. ${question.question}`,
          question.options.length ? `   Options: ${question.options.join(' | ')}` : '',
          `   Answer: ${question.answer}`,
          `   Explanation: ${question.explanation}`
        );
      });
      lines.push('');
    });
  });

  lines.push(
    '## Final applied project',
    '',
    `### ${course.finalProject.title}`,
    course.finalProject.brief,
    ...course.finalProject.deliverables.map(item => `- ${item}`),
    '',
    `## Assessment · passing score ${course.assessment.passingScore}%`,
    '',
    ...course.assessment.rubric.map(item => `- **${item.criterion} (${item.weight}%):** ${item.evidence}`),
    '',
    '## Instructor guide',
    '',
    '### Opening script',
    course.instructorGuide.openingScript,
    '',
    '### Facilitation notes',
    ...course.instructorGuide.facilitationNotes.map(item => `- ${item}`),
    '',
    '### Closing script',
    course.instructorGuide.closingScript,
    '',
    '## Distribution checklist',
    ...course.distributionChecklist.map(item => `- ${item}`),
    '',
    '## Source boundary',
    course.sourceBoundary
  );

  return lines.filter((line, index, values) => line !== '' || values[index - 1] !== '').join('\n');
}
