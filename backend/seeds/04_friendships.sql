-- Friendships, covering every state the meetup flow moves through.
--
-- responded_at and confirmed_at are not optional decoration: since migration 18
-- the table enforces (status = 'pending') = (responded_at IS NULL) and
-- (status = 'accepted') = (confirmed_at IS NOT NULL), so a row that names a
-- status without its timestamp is rejected outright.
--
-- The three male accounts form a complete triangle on purpose. A friends ride
-- group requires EVERY pair inside it to be confirmed friends, and a triangle
-- is the smallest fixture that can tell a working clique check from one that
-- only checks membership against the creator.
INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, responded_at, confirmed_at) VALUES
-- Rafiul + Tanvir + Sadman: all three pairs met and scanned. {1,3,5} is a legal group.
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'accepted', '2026-01-20 12:00:00+06', '2026-01-20 12:30:00+06', '2026-01-22 15:10:00+06'),
('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'accepted', '2026-01-21 13:00:00+06', '2026-01-21 13:20:00+06', '2026-01-23 11:05:00+06'),
('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 'accepted', '2026-01-24 10:00:00+06', '2026-01-24 10:15:00+06', '2026-01-26 09:40:00+06'),
-- Nusrat + Ishrat said yes to each other but have not met yet. This is the row
-- the meetup screen is built against: one of them shows a code, the other scans.
('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006', 'awaiting_meetup', '2026-02-02 14:00:00+06', '2026-02-02 14:05:00+06', NULL),
-- Unanswered. Farhana sees this as an incoming request.
('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'pending', '2026-02-04 09:00:00+06', NULL, NULL),
-- Rafiul + Imran, and Imran is friends with nobody else. This is the pendant
-- hanging off the triangle: Rafiul now has three confirmed friends of whom only
-- two have met each other, so a picker that narrows and a picker that does not
-- finally look different on screen.
('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'accepted', '2026-02-11 11:00:00+06', '2026-02-11 11:10:00+06', '2026-02-12 13:25:00+06');
