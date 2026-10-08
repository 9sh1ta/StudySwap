# StudySwap Server (v2)

Express + SQLite backend that mirrors the frontend's `schema.js` exactly
(Student, Subject, Material, Swap_Request, Rating, vw_student_credibility).

## Run

    npm install
    npm run dev          # http://localhost:4000  (needs Node 22.5+)
    npm test
    npm run reset        # wipe data/studyswap.db and re-seed

First start creates `data/studyswap.db` and seeds it with the same data as the
frontend prototype (48 students, 424 materials, 968 ratings).
Demo accounts: ids 101, 102, 107. All use the demo password shown on the Login screen.

Optional env vars (see `.env.example`): PORT, JWT_SECRET, DB_FILE, CORS_ORIGIN, ALLOW_DEMO_LOGIN.

## Layout

    src/shared/        schema.js + seed.js (copies of the frontend's data/ files)
    src/db/            schema.sql (the real DDL), index.js, seedDb.js
    src/lib/core.js    DbError, constraint checks, row helpers, aggregates, views
    src/services/      business logic, one file per area (ported from the mock db.js)
    src/routes/        thin HTTP layer
    test/              API tests (seeded in-memory DB)

If you change `schema.js` or `seed.js` in the frontend, copy them into `src/shared/`
and update `src/db/schema.sql` to match.

## Rules enforced

- Uploaders cannot rate or request their own material; one Pending request per student per material
- Only the uploader accepts/rejects; only the requester completes (with a rating, one transaction) or withdraws
- One rating per student per material; the score is the average of the 3 sub-scores
- Deleting a material is blocked while ratings/requests reference it (ON DELETE RESTRICT)
- Credibility = AVG(score) over a student's materials, computed by the view
- Errors are `{ "error": { code, message, detail, table, column, refs } }`; the frontend turns them back into DbError

## Endpoints (all under /api; "auth" = needs Bearer token)

- auth: POST login, login-as, register; GET email-taken, demo-accounts, me (auth)
- subjects: GET /; POST / (auth); GET by-department/:dept
- materials: GET / (browse), trending, similar, by-uploader/:id, by-subject/:id, recommended/:id (auth), cram-packs/:id (auth), :id, :id/references; POST / (auth); DELETE :id (auth)
- requests (all auth): GET incoming, outgoing; POST /; POST :id/respond, :id/complete; DELETE :id
- ratings: POST / (auth); GET material/:id, by-student/:id, received-by/:id
- students: GET :id, :id/credibility, :id/stats, :id/credibility-trend, leaderboard, leaderboard/departments
- other: GET matches/mutual-swaps (auth); POST matches/propose (auth); GET activity/recent (auth); GET search
