# Multi-system curriculum architecture

## Scope

The curriculum platform supports independent educational systems, not one shared subject tree:

- Egypt — General Education — Primary grades 1–6
- Egypt — Al-Azhar Education — Primary grades 1–6
- Future countries — each country and its authority, school system, stage, grade, language, and academic year remain separate.

## Stable curriculum identity

Every curriculum record must be scoped by:

`countryCode`, `educationSystemId`, `stageId`, `gradeId`, `subjectId`, `schoolYear`, `termId`, and `languageCode`.

Never identify a lesson by grade and subject alone. Use stable IDs that include or reference the complete scope. Keep a source record for every official book, plan, or syllabus.

## Source registry fields

Each source should store:

- authority name and official portal URL
- source type: textbook, study plan, syllabus, teacher guide, assessment guide
- country, education system, grade, subject, language, academic year, and term
- official file URL, file format, last checked time, and verification status
- file checksum when the file can be downloaded lawfully
- version history and the reviewer who approved the mapping

Third-party indexes may help discover links, but must never be treated as the approving authority. Prefer official ministry / education-sector portals and confirm that the linked file is served by the authority.

## Automatic update pipeline

1. Check registered official portals on a scheduled cadence.
2. Detect new or changed links and, where permitted, compare file checksums and metadata.
3. Save a new immutable source version; never overwrite the previous approved version.
4. Extract candidate unit, lesson, and learning-objective headings from the new source.
5. Compare the candidate structure with the currently approved curriculum and generate a human-readable change report.
6. Generate original practice questions and assessments aligned to the verified objectives; do not reproduce protected textbook passages or question banks.
7. Place every changed item in an admin review queue with its source link, version, and confidence.
8. Only an authorized reviewer can approve and publish the new version.
9. Keep student progress attached to stable lesson identities; when a lesson changes materially, preserve the old version and map progress explicitly rather than silently resetting it.

## Publication and safety rules

- New or changed content is a draft by default.
- No source or extracted lesson is automatically visible to students.
- Reject incomplete source metadata, broken files, mismatched academic years, duplicate IDs, and unverified lesson maps.
- Keep general education and Al-Azhar curricula separate even when subjects have similar names.
- Keep term 1 and term 2 separate; never infer a missing term from another edition.
- Do not claim a grade is complete until all required books, terms, units, lessons, and assessments have been verified.

## Future country expansion

Add a country and its official education authority to the source registry first. Then register its education systems and grade structures. Do not reuse Egypt-specific grade names, subjects, term calendars, assessment rules, or book assumptions. Localize labels and language independently from the stable IDs.

## Current data limitations (2026–2027)

The source catalogue records discovery links and book counts for Egyptian general education and Al-Azhar primary grades. It is not yet a verified lesson-by-lesson curriculum. The existing generic curriculum map must remain non-importable until the actual official books and plans have been checked and mapped.
