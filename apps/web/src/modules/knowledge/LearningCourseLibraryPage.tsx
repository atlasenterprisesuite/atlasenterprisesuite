import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAtlasMemory, type AtlasMemoryRecord } from './memoryApi';
import { courseToMarkdown, parseGeneratedCourse, type AtlasCoursePackage } from './courseEngine';

type CourseRecord = { record: AtlasMemoryRecord; course: AtlasCoursePackage };

function safeFilename(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'atlas-course';
}

export function LearningCourseLibraryPage() {
  const [records, setRecords] = useState<CourseRecord[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadApprovedCourses() {
      const collected: AtlasMemoryRecord[] = [];
      let offset = 0;
      for (let page = 0; page < 10; page += 1) {
        const response = await listAtlasMemory({ status: 'approved', kind: 'workflow', module: 'learning', limit: 50, offset });
        collected.push(...response.records);
        if (!response.has_more || !response.records.length) break;
        offset += response.records.length;
      }
      const courses = collected
        .filter(record => record.tags.includes('atlas-course'))
        .flatMap(record => {
          try {
            return [{ record, course: parseGeneratedCourse(String(record.content_json?.text || '')) }];
          } catch {
            return [];
          }
        });
      if (active) setRecords(courses);
    }
    loadApprovedCourses().catch(caught => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : 'course_library_unavailable');
      setRecords([]);
    });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records || [];
    return (records || []).filter(({ course }) =>
      [course.title, course.description, course.targetAudience, ...course.learningOutcomes]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, records]);

  function download(course: AtlasCoursePackage) {
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

  return <section className="page-stack" aria-labelledby="atlas-course-library-title">
    <header className="page-header">
      <p className="eyebrow">ATLAS Learning · Knowledge Atlas</p>
      <h1 id="atlas-course-library-title">Approved course library</h1>
      <p>Only explicitly approved ATLAS Course Forge packages appear here. Draft AI output, unapproved chats and restricted organizational knowledge are not presented as learner-ready courses.</p>
    </header>

    <div className="work-actions">
      <Link className="execution-action" to="/knowledge/course-studio">Create a course</Link>
      <Link className="text-link" to="/knowledge">Open Knowledge governance</Link>
    </div>

    <label className="field"><span>Search approved courses</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, audience or learning outcome" /></label>

    {error ? <div className="work-error" role="alert">{error}</div> : null}
    {records === null && !error ? <p role="status" aria-busy="true">Loading approved courses…</p> : null}
    {records && !visible.length ? <div className="empty-state"><strong>No approved Course Forge packages match this view.</strong><span>Create a governed course, review it, then explicitly approve it before learner delivery.</span></div> : null}

    {visible.map(({ record, course }) => <article className="workspace-card page-stack" key={record.id}>
      <div>
        <p className="eyebrow">Approved · v{record.version} · {course.language}</p>
        <h2>{course.title}</h2>
        <p>{course.description}</p>
      </div>
      <div className="metric-grid">
        <article><span>Audience</span><strong>{course.targetAudience}</strong><small>{course.level}</small></article>
        <article><span>Modules</span><strong>{course.modules.length}</strong><small>{course.modules.reduce((sum, module) => sum + module.lessons.length, 0)} lessons</small></article>
        <article><span>Hours</span><strong>{course.estimatedHours}</strong><small>Instructor-ready package</small></article>
        <article><span>Pass</span><strong>{course.assessment.passingScore}%</strong><small>Assessment threshold</small></article>
      </div>
      <details>
        <summary><strong>Open course curriculum and teaching scripts</strong></summary>
        <div className="page-stack">
          <div><strong>Learning outcomes</strong><ul>{course.learningOutcomes.map(item => <li key={item}>{item}</li>)}</ul></div>
          {course.modules.map((module, moduleIndex) => <section key={module.title + moduleIndex}>
            <h3>Module {moduleIndex + 1}: {module.title}</h3>
            <p>{module.objective}</p>
            {module.lessons.map((lesson, lessonIndex) => <details key={lesson.title + lessonIndex}>
              <summary>{moduleIndex + 1}.{lessonIndex + 1} {lesson.title}</summary>
              <div className="page-stack">
                <p><strong>Objective:</strong> {lesson.objective}</p>
                <div><strong>Instructor script</strong><p style={{ whiteSpace: 'pre-wrap' }}>{lesson.instructorScript}</p></div>
                <div><strong>Worked example</strong><p>{lesson.workedExample}</p></div>
                <div><strong>Learner activity</strong><p>{lesson.learnerActivity}</p></div>
              </div>
            </details>)}
          </section>)}
        </div>
      </details>
      <div className="work-actions">
        <button type="button" onClick={() => download(course)}>Download instructor package</button>
      </div>
      <p className="notice">{course.sourceBoundary}</p>
    </article>)}
  </section>;
}
