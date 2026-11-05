# IBM Bob development evidence and accuracy notes

The original task-consumption screenshot and task-history Markdown document the one relevant CivicLedger task inspected in the local Bob profile. They are retained as original evidence, not edited to imply stronger results. This does not establish whether unrelated, deleted, or other-device sessions exist.

## Contribution actually implemented

The later exchange reviews the existing `validateRef` citation validator. Bob proposed replacing first-match selection with a unique-match guard: collect documents matching the reference ID and return false unless exactly one exists. The verified implementation preserves the existing case, version, hash, page, line-range, and exact-excerpt checks. Engine regression tests cover identical and changed duplicates in either order.

A separate finding-citation validation repair prevents draft generation when a finding reference is invalid. Do not attribute that separate repair to Bob.

## Suggestions that were not adopted as written

- The initial planning proposal mentions `recordedBy`, `recordedAt`, and an `EvidenceEntry` type. It preceded source inspection and is not evidence that those fields or that proposed feature were implemented.
- Bob's illustrative test calls do not match the actual fixture/processing APIs. They were not copied as executable tests. The repository's tests are the implemented checks.
- The claim that `Number.isInteger(undefined)` can pass is incorrect; it returns false. That suggestion was not accepted.
- The export explicitly says no tests were run against the actual suite. Bob did not execute the project tests.

## Independent verification and limits

The public browser-only edition passed 41 automated tests, strict TypeScript checking, lint, and a production build. An isolated clean installation reproduced the production artifacts. Details and coverage limits are in `qa/PUBLIC-VALIDATION.md`. Private-v5 results in the edited video apply to that release and are distinguished from the public edition.

IBM Bob supported development of a core reliability guard. It is not the application's runtime model. No live watsonx.ai, watsonx Orchestrate, or IBM Consulting Advantage integration is implemented or claimed. No field-study time savings or business impact has been measured.

The original export contains only planning and fictional citation-review material. It does not include credentials, private service endpoints, real applicant records, or the private application's source history.
