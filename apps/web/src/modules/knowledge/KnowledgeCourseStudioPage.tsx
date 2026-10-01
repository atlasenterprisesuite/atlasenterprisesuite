import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAssistantStatus,
  hasVerifiedAssistantProvider,
  sendAssistantWorkspaceMessage,
  type AssistantStatusResponse
} from '../../assistant/client';
import {
  approveAtlasMemory,
  createAtlasMemoryDraft,
  getAtlasMemoryStats,
  listAtlasMemory,
  type AtlasMemoryRecord
} from './memoryApi';
import {
  buildCourseGenerationPrompt,
  courseToMarkdown,
  parseGeneratedCourse,
  type AtlasCoursePackage
} from './courseEngine';

const MAX_SOURCE_CHARS = 40000;

function safeFilename(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'atlas-course';
}

function textOf(record: AtlasMemoryRecord) {
  return String(record.content_json?.text || '');
}

export function KnowledgeCourseStudioPage() {
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatusResponse | null>(null);
  const [role, setRole] = useState('member');
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('');
  const [language, setLanguage] = useState('Spanish');
  const [level, setLevel] = useState('Practical · mixed');
  const [durationHours, setDurationHours] = useState(6);
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeResults, setKnowledgeResults] = useState<AtlasMemoryRecord[]>([]);
  const [course, setCourse] = useState<AtlasCoursePackage | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [runState, setRunState] = useState<'idle'|'running'|'success'|'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    getAssistantStatus()
      .then(status => { if (active) setAssistantStatus(status); })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'assistant_status_unavailable'); });
    getAtlasMemoryStats()
      .then(memory => { if (active) setRole(memory.role); })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'knowledge_role_unavailable'); });
    return () => { active = false; };
  }, []);

  const providerReady = Boolean(assistantStatus && hasVerifiedAssistantProvider(assistantStatus));
  const canApprove = ['owner','admin','platform_admin'].includes(role);
  const sourceTooLarge = sourceMaterial.length > MAX_SOURCE_CHARS;
  const sourceForGeneration = useMemo(() => sourceMaterial.slice(0, MAX_SOURCE_CHARS), [sourceMaterial]);

  async function searchKnowledge() {
    setMessage('');
    try {
      const response = await listAtlasMemory({
        q: knowledgeQuery,
        status: 'approved',
        limit: 20,
        offset: 0
      });
      setKnowledgeResults(response.records);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'knowledge_search_failed');
    }
  }

  function addKnowledge(record: AtlasMemoryRecord) {
    const provenance = [
      '',
      `[ATLAS KNOWLEDGE SOURCE: ${record.id} · ${record.title} · v${record.version}]`,
      record.summary,
      textOf(record)
    ].filter(Boolean).join('\n');
    setSourceMaterial(current => (current.trim() + '\n' + provenance).trim());
  }

  async function generateCourse() {
    if (!topic.trim() || !audience.trim() || !goal.trim() || !sourceMaterial.trim()) {
      setRunState('error');
      setMessage('Topic, audience, learning goal and source material are required.');
      return;
    }
    if (!providerReady) {
      setRunState('error');
      setMessage('A verified ATLAS Assistant provider is required. Course Forge will not fabricate a course while AI readiness is unverified.');
      return;
    }

    setRunState('running');
    setMessage('');
    setCourse(null);
    try {
      const response = await sendAssistantWorkspaceMessage({
        message: buildCourseGenerationPrompt({
          topic: topic.trim(),
          audience: audience.trim(),
          goal: goal.trim(),
          language,
          level,
          durationHours,
          sourceMaterial: sourceForGeneration
        }),
        mode: 'auto',
        profile: 'deep',
        executionMode: 'interactive'
      });
      const parsed = parseGeneratedCourse(response.text || response.output || '');
      setCourse(parsed);
      setConversationId(response.conversation_id || null);
      setRunState('success');
      setMessage('Course package generated. Review the scripts and evidence boundaries before publishing.');
    } catch (error) {
      setRunState('error');
      setMessage(error instanceof Error ? error.message : 'course_generation_failed');
    }
  }

  async function persistCourse(approve: boolean) {
    if (!course) return;
    setMessage('');
    try {
      const saved = await createAtlasMemoryDraft({
        kind: 'workflow',
        title: course.title,
        summary: course.description,
        content: JSON.stringify(course, null, 2),
        sourceType: 'atlas',
        sourceRef: conversationId ? `atlas-assistant:${conversationId}` : undefined,
        moduleIds: ['knowledge','learning'],
        tags: ['atlas-course','course-studio', safeFilename(course.language), safeFilename(course.level)],
        sensitivity: 'organization'
      });
      if (approve) {
        if (!canApprove) throw new Error('course_approval_requires_owner_or_admin');
        await approveAtlasMemory(saved.record.id);
        setMessage('Course saved and explicitly approved. It is now available in the governed ATLAS Learning course library.');
      } else {
        setMessage('Course saved as a governed draft. Approve it in Knowledge Atlas before it appears in Learning.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'course_save_failed');
    }
  }

  function downloadCourse() {
    if (!course) return;
    const blob = new Blob([courseToMarkdown(course)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeFilename(course.title) + '.md';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return <section className="page-stack" aria-labelledby="atlas-course-studio-title">
    <header className="page-header">
      <p className="eyebrow">Knowledge Atlas · Course Forge</p>
      <h1 id="atlas-course-studio-title">Turn governed knowledge into a complete course.</h1>
      <p>Use an ATLAS/ChatGPT conversation, approved Knowledge records or pasted source material to produce instructor scripts, practical exercises, assessments and a reusable teaching package. Generated content remains reviewable and provenance-linked.</p>
    </header>

    <div className="metric-grid" aria-label="Course Forge readiness">
      <article><span>AI</span><strong>{providerReady ? 'Verified' : 'Not verified'}</strong><small>Generation fails closed without a verified provider.</small></article>
      <article><span>Knowledge role</span><strong>{role}</strong><small>{canApprove ? 'Explicit approval available' : 'Draft creation available'}</small></article>
      <article><span>Course state</span><strong>{course ? 'Generated' : 'Not generated'}</strong><small>No course is represented as published before approval.</small></article>
      <article><span>Source limit</span><strong>{Math.min(sourceMaterial.length, MAX_SOURCE_CHARS).toLocaleString()}</strong><small>of {MAX_SOURCE_CHARS.toLocaleString()} characters used per generation.</small></article>
    </div>

    <section className="workspace-card page-stack" aria-labelledby="course-brief-heading">
      <div><p className="eyebrow">1 · Course brief</p><h2 id="course-brief-heading">Define what must be taught</h2></div>
      <div className="work-config-grid">
        <label><span>Topic</span><input value={topic} onChange={event => setTopic(event.target.value)} placeholder="U.S. Tax Practitioner 2027" /></label>
        <label><span>Audience</span><input value={audience} onChange={event => setAudience(event.target.value)} placeholder="New tax preparers" /></label>
        <label><span>Learning goal</span><input value={goal} onChange={event => setGoal(event.target.value)} placeholder="Prepare a real return from intake through review" /></label>
        <label><span>Language</span><select value={language} onChange={event => setLanguage(event.target.value)}><option>Spanish</option><option>English</option><option>Bilingual English/Spanish</option><option>Portuguese</option><option>French</option></select></label>
        <label><span>Level</span><select value={level} onChange={event => setLevel(event.target.value)}><option>Introductory</option><option>Practical · mixed</option><option>Intermediate</option><option>Advanced</option></select></label>
        <label><span>Target hours</span><input type="number" min={1} max={200} value={durationHours} onChange={event => setDurationHours(Math.max(1, Number(event.target.value) || 1))} /></label>
      </div>
    </section>

    <section className="workspace-card page-stack" aria-labelledby="course-source-heading">
      <div><p className="eyebrow">2 · Sources</p><h2 id="course-source-heading">Supply the knowledge ChatGPT/ATLAS should teach</h2><p className="muted">Paste a ChatGPT conversation, notes, research or source text. You can also pull already approved organizational knowledge below.</p></div>
      <label className="field"><span>Source material</span><textarea rows={14} value={sourceMaterial} onChange={event => setSourceMaterial(event.target.value)} placeholder="Paste the conversation or source material here…" /></label>
      {sourceTooLarge ? <p className="notice strong" role="alert">This source is larger than {MAX_SOURCE_CHARS.toLocaleString()} characters. This generation will use the first {MAX_SOURCE_CHARS.toLocaleString()} characters; split larger programs into governed source packs to avoid silent omission.</p> : null}
      <div className="toolbar">
        <label className="field wide-field"><span>Search approved Knowledge</span><input value={knowledgeQuery} onChange={event => setKnowledgeQuery(event.target.value)} placeholder="Search decisions, evidence, notes or prior course sources" /></label>
        <button className="execution-action" type="button" onClick={() => void searchKnowledge()}>Search</button>
      </div>
      {knowledgeResults.length ? <div className="module-grid">
        {knowledgeResults.map(record => <article className="module-card enabled" key={record.id}>
          <span>{record.kind} · approved · v{record.version}</span>
          <strong>{record.title}</strong>
          <p>{record.summary || textOf(record).slice(0, 180)}</p>
          <button className="execution-action" type="button" onClick={() => addKnowledge(record)}>Add as source</button>
        </article>)}
      </div> : null}
    </section>

    <section className="workspace-card page-stack" aria-labelledby="course-generate-heading">
      <div><p className="eyebrow">3 · Generate</p><h2 id="course-generate-heading">Build the instructor-ready course</h2><p className="muted">Course Forge requests a full spoken script for every lesson, practical examples, learner activities, questions with answers, a final project and an assessment rubric.</p></div>
      <div className="work-actions">
        <button className="execution-action" type="button" onClick={() => void generateCourse()} disabled={runState === 'running' || !providerReady}>{runState === 'running' ? 'Building course…' : 'Generate complete course'}</button>
        <Link className="text-link" to="/learning/courses">Open approved course library</Link>
      </div>
      {message ? <p className="notice strong" role="status">{message}</p> : null}
    </section>

    {course ? <section className="page-stack" aria-labelledby="generated-course-heading">
      <header className="page-header">
        <p className="eyebrow">Generated teaching package</p>
        <h2 id="generated-course-heading">{course.title}</h2>
        <p>{course.description}</p>
      </header>

      <div className="metric-grid">
        <article><span>Modules</span><strong>{course.modules.length}</strong><small>Structured teaching units</small></article>
        <article><span>Lessons</span><strong>{course.modules.reduce((sum, module) => sum + module.lessons.length, 0)}</strong><small>Each includes a spoken instructor script</small></article>
        <article><span>Hours</span><strong>{course.estimatedHours}</strong><small>Generated estimate</small></article>
        <article><span>Pass</span><strong>{course.assessment.passingScore}%</strong><small>Course assessment threshold</small></article>
      </div>

      <div className="work-actions">
        <button className="execution-action" type="button" onClick={() => void persistCourse(false)}>Save governed draft</button>
        {canApprove ? <button className="execution-action" type="button" onClick={() => void persistCourse(true)}>Save + explicitly approve for Learning</button> : null}
        <button type="button" onClick={downloadCourse}>Download instructor package (.md)</button>
      </div>

      <article className="workspace-card">
        <p className="eyebrow">Instructor opening</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{course.instructorGuide.openingScript}</p>
      </article>

      {course.modules.map((module, moduleIndex) => <section className="workspace-card page-stack" key={module.title + moduleIndex}>
        <div><p className="eyebrow">Module {moduleIndex + 1}</p><h3>{module.title}</h3><p>{module.objective}</p></div>
        {module.lessons.map((lesson, lessonIndex) => <details key={lesson.title + lessonIndex}>
          <summary><strong>{moduleIndex + 1}.{lessonIndex + 1} {lesson.title}</strong> · {lesson.estimatedMinutes} min</summary>
          <div className="page-stack">
            <div><strong>Objective</strong><p>{lesson.objective}</p></div>
            <div><strong>Instructor script</strong><p style={{ whiteSpace: 'pre-wrap' }}>{lesson.instructorScript}</p></div>
            <div><strong>Worked example</strong><p style={{ whiteSpace: 'pre-wrap' }}>{lesson.workedExample}</p></div>
            <div><strong>Learner activity</strong><p style={{ whiteSpace: 'pre-wrap' }}>{lesson.learnerActivity}</p></div>
            <div><strong>Knowledge check</strong>{lesson.questions.map((question, index) => <div key={index}><p>{index + 1}. {question.question}</p>{question.options.length ? <p className="muted">Options: {question.options.join(' · ')}</p> : null}<p><strong>Answer:</strong> {question.answer}</p><p className="muted">{question.explanation}</p></div>)}</div>
          </div>
        </details>)}
      </section>)}

      <section className="workspace-card page-stack">
        <div><p className="eyebrow">Final applied project</p><h3>{course.finalProject.title}</h3><p>{course.finalProject.brief}</p></div>
        <ul>{course.finalProject.deliverables.map(item => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className="workspace-card page-stack">
        <div><p className="eyebrow">Distribution readiness</p><h3>Prepare the knowledge for other learners</h3></div>
        <ul>{course.distributionChecklist.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="notice">{course.sourceBoundary}</p>
      </section>
    </section> : null}
  </section>;
}
