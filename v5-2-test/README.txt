MoraFiq 5.2 — Pilot workflows (programs and reports)

1. Keep existing v5-1-test untouched. Create a NEW GitHub folder: v5-2-test.
2. Upload all HTML, JS, CSS files in this package to that folder.
3. Set config.js to the SAME Supabase TEST project URL and public publishable key used in v5-1-test. Never use service_role/secret keys.
4. In Supabase project MoraFiq-5-Test, SQL Editor: run migration-5.2.sql ONCE. It adds mf52_documents and five functions, leaving old mf5 tables/functions intact.
5. Open https://cospmedea-spec.github.io/morafiq-site/v5-2-test/workflow.html
6. Counselor: create a draft, then submit it. Center manager: review/approve or return with correction note. Counselor can edit and resubmit returned work.
7. The old admin.html, center.html and counselor.html are included for continuity. New workflow is in workflow.html and workflow.js; links can be added to old pages later.

Security: server-side RPC checks center membership and approval; base table has RLS enabled and no direct browser access. No student-level sensitive data should be entered. Test with dummy content only. Not production audited.
