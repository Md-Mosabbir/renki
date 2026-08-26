-- Reports use a fixed vocabulary (chk_reports_reason), not free text. The
-- earlier version of this file used 'Late arrival' and 'Behavioral concern',
-- which is exactly the drift migration 25 exists to stop — two spellings of
-- two categories that no queue could ever group by.
--
-- One row per status the queue has to render, so the admin screen can be seen
-- in every state without hand-editing rows. The closed one carries a real
-- reviewer because chk_reports_closed_are_reviewed requires it: a resolved
-- report that nobody resolved is not a state the product allows.
INSERT INTO reports (id, reporter_id, reported_user_id, ride_group_id, reason, description, status, created_at, reviewed_at, reviewed_by_user_id) VALUES
('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 'no_show',          'Rider arrived 20 minutes after the agreed pickup window.',  'resolved',     '2026-02-05 09:30:00+06', '2026-02-06 11:00:00+06', '10000000-0000-0000-0000-000000000099'),
('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', 'unsafe_behaviour', 'Passenger was disrespectful to the group during the ride.', 'under_review', '2026-02-03 09:00:00+06', '2026-02-03 12:30:00+06', '10000000-0000-0000-0000-000000000099'),
-- Untouched, so the queue always has something to work. No reviewer, which is
-- what 'open' means.
('a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007', NULL,                                   'harassment',       'Kept messaging after I said I was not interested.',         'open',         '2026-02-12 20:15:00+06', NULL, NULL);
