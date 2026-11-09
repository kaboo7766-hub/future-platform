# Curriculum Map — Future Platform

## Purpose
`src/data/curriculum-map.json` is the editable curriculum blueprint for KG1, KG2, and Grades 1–6. It contains the grade catalog, subject catalog, units, three micro-lessons per unit, a review checkpoint, a unit quiz, learning-path rules, age adaptations, and gamification rules.

## Important curriculum boundary
This is a platform sequencing framework, not a verbatim transcription of Ministry textbooks or a claim of official accreditation. Before publishing lessons to students, the curriculum owner must align every unit title, learning outcome, and assessment item with the current approved textbook/teacher guide, school type, language stream, and religious-education track.

The grade/subject catalog follows the broad Egyptian primary structure: Arabic, English, and mathematics across the grades; religious education as the appropriate Islamic or Christian track; science and social studies in Grades 4–6; and age-appropriate physical/health, arts, technology, and school activity strands. KG includes readiness strands and Discover themes. Some activity strands are marked enrichment rather than compulsory subjects because their implementation may vary by school.

## Data model
The JSON is deliberately normalized for import into Firestore. Do **not** store the entire JSON file as one Firestore document. Import it by splitting grade, subject, unit, lesson, and assessment records into their respective collections; Firestore document and batch limits must be respected. Recommended collections:

| Collection | Document ID | Content |
|---|---|---|
| `curriculumGrades` | `kg1`, `kg2`, `g1`…`g6` | Grade metadata and order |
| `curriculumSubjects` | `{gradeId}_{subjectCode}` | Subject metadata, grade relation, category |
| `curriculumUnits` | `{gradeId}_{subjectCode}_u{n}` | Unit title, order, focus, lesson IDs |
| `curriculumLessons` | lesson ID | Lesson goal, sequence, four-step flow |
| `curriculumAssessments` | assessment ID | Review or unit quiz configuration |
| `studentLearningProgress` | `{studentUid}_{itemId}` | Status, score, attempts, stars, timestamps |
| `studentBadges` | `{studentUid}_{badgeId}` | Awarded badge and award timestamp |

## Required access model
- Public/student reads: only published curriculum items for the student's assigned grade and class.
- Teachers: read assigned classes and manage/publish learning content for those classes.
- Admin: full curriculum management.
- Students must never be able to write their own score, stars, badge, or unlock state directly. Submit answers through a trusted server endpoint or a transaction that validates the answer key server-side.
- Store the authoritative progress record separately from the curriculum definition.

## Standard lesson flow
1. Engage — short visual/audio hook, no score.
2. Explore — explanation or demonstration, 3–5 minutes.
3. Practice — low-stakes game, no stars and no penalty.
4. Evaluate — short check that awards stars and controls the next lesson unlock.

## Unlocking
- Next lesson: previous lesson evaluation passed (default 60%).
- Unit review: all lessons in that unit completed.
- Unit quiz: review completed.
- Next unit: unit quiz passed (default 70%).
- Next grade: all required subjects completed, plus teacher/admin approval.
- Teacher/admin override is supported; student skip is disabled by default.

## Retry and rewards
- Unlimited retries by default.
- After an incorrect answer, show a supportive hint and a different example.
- Offer a short targeted practice before retry.
- Never remove previously earned stars.
- Practice-only activities do not award stars.
- Lesson stars: 60–79% = 1, 80–94% = 2, 95–100% = 3.
- Unit badge: complete the unit and pass its quiz. Perfect badge: score at least 95%.

## Current implementation status
The curriculum JSON and this architecture document are added to the existing feature branch. They are not yet wired to the student/teacher interface, imported into Firestore, or published. The next engineering step is an admin curriculum manager plus a validated import routine and server-side progress/unlock enforcement.

## Admin interface and safe import
- Admin navigation includes **إدارة المناهج والمسارات**.
- `src/pages/CurriculumManager.tsx` previews the grade → subject → unit → lesson hierarchy from the public JSON asset.
- `public/curriculum-map.json` is the browser-readable source used by the preview screen.
- `api/admin/import-curriculum.ts` verifies the Firebase ID token and the user's Firestore role before writing anything.
- The importer accepts only the five curriculum definition collections, limits each request to 50 records, uses deterministic document IDs, and writes all records with `published: false`.
- Import is idempotent: retrying a partially completed import updates the same document IDs rather than creating duplicates.
- Firestore rules deny direct client writes to curriculum definitions and student progress/badge collections. Only published curriculum documents are readable by students.

## Release and activation notes
The UI and API are part of the feature branch / pull request. Firestore rules must be deployed to the Firebase project before the imported curriculum is used. Importing creates drafts only; it does not publish content or automatically expose it to students. Lesson unlock enforcement, teacher publishing controls, and server-validated curriculum quiz grading are separate next steps and must be completed before using this as a live graded course.
