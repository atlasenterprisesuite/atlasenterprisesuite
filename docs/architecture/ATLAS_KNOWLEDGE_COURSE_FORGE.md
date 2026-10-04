# ATLAS Knowledge Course Forge

Owner: Knowledge Atlas  
Learner surface: ATLAS Learning  
Generation runtime: existing authenticated `atlas-copilot` bus  
Persistence/governance: existing ATLAS Memory lifecycle

## Product correction

Knowledge Atlas is not only a document/memory registry. It must also convert authorized knowledge into reusable teaching systems. Learning is not only the neuroplasticity program. The canonical relationship is:

`authorized source -> Course Forge -> instructor-ready package -> governed draft -> explicit approval -> Learning course library -> instructor/export delivery`

No parallel knowledge database, AI gateway or approval system is introduced.

## Course Forge contract

Route: `/knowledge/course-studio`

Accepted source material:
- pasted ChatGPT/ATLAS conversations;
- user-supplied notes/research;
- approved ATLAS Memory records explicitly selected by the instructor.

Generated package:
- course title/description/audience/prerequisites/outcomes;
- modules and lessons;
- full spoken instructor script for every lesson;
- worked examples and learner activities;
- knowledge-check questions, answers and explanations;
- applied final project;
- passing score and rubric;
- instructor opening/facilitation/closing material;
- distribution checklist;
- source/evidence boundary.

AI execution fails closed when no provider is server-verified.

## Governance

Course generation alone is not publication.

Course persistence reuses `atlas_memory_records`:
- kind: `workflow`;
- modules: `knowledge`, `learning`;
- tag: `atlas-course`;
- source: `atlas`;
- generated package serialized inside governed memory content;
- default lifecycle state: `draft`.

Owners/admins may explicitly choose “Save + explicitly approve for Learning.” This performs a normal ATLAS Memory approval action. It is not automatic approval.

## Learner/instructor library

Route: `/learning/courses`

Only records with:
- status = `approved`;
- kind = `workflow`;
- module = `learning`;
- tag = `atlas-course`

are surfaced as approved courses.

The library can render the curriculum and instructor scripts and export an instructor Markdown package. External public LMS enrollment, accreditation, certificates, payment, email delivery and third-party publishing are not claimed by this slice.

## Truth boundary

“Approved” means approved for organizational instructional use. It does not prove every factual statement is externally verified, accredited, legally sufficient or clinically valid. Source-grounded and regulated material retains its original verification requirements.
