Issues need to be resolved:

> focustube@0.1.0 dev
> next dev

▲ Next.js 16.2.10 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://192.168.1.42:3000
- Environments: .env.local
✓ Ready in 624ms

(node:26728) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=require'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.
(Use `node --trace-warnings ...` to show where the warning was created)
prisma:query SELECT "public"."Course"."id", "public"."Course"."userId", "public"."Course"."youtubePlaylistId", "public"."Course"."title", "public"."Course"."thumbnailUrl", "public"."Course"."createdAt", "public"."Course"."updatedAt", COALESCE("aggr_selection_0_Video"."_aggr_count_videos", 0) AS "_aggr_count_videos" FROM "public"."Course" LEFT JOIN (SELECT "public"."Video"."courseId", COUNT(*) AS "_aggr_count_videos" FROM "public"."Video" WHERE 1=1 GROUP BY "public"."Video"."courseId") AS "aggr_selection_0_Video" ON ("public"."Course"."id" = "aggr_selection_0_Video"."courseId") WHERE ("public"."Course"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3
prisma:query SELECT "public"."Video"."id", "public"."Video"."courseId", "public"."Video"."youtubeVideoId", "public"."Video"."title", "public"."Video"."position", "public"."Video"."durationSeconds", "public"."Video"."thumbnailUrl", "public"."Video"."isAvailable", "public"."Video"."status"::text, "public"."Video"."lastWatchedSeconds", "public"."Video"."completedAt", "public"."Video"."createdAt", "public"."Video"."updatedAt" FROM "public"."Video" WHERE "public"."Video"."courseId" = $1 ORDER BY "public"."Video"."position" ASC OFFSET $2
 GET /courses/cmrrhv9cm0003ikl4o3x3h2ly 200 in 3.4s (next.js: 1356ms, proxy.ts: 285ms, application-code: 1750ms)
 GET /api/auth/session 200 in 1041ms (next.js: 1013ms, application-code: 28ms)
 GET /api/auth/session 200 in 25ms (next.js: 11ms, application-code: 14ms)




also no need to update this issues.md file 






for new changes after you are done with everything(only if needed, not for ui changes ofcourse):
always update agent.md which is for agent to understand
and update structure.md which is for people to understand codebase
update todo.md too if anything new accomplished