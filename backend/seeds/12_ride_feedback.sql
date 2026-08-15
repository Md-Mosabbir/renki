-- One row per rider per completed ride. This is the evidence that promotes an
-- account from trust_stage 'verified' to 'established' — not the QR scan, which
-- only marks the ride starting.
INSERT INTO ride_feedback (id, ride_group_id, user_id, satisfied, note, created_at) VALUES
-- Group 1, completed: both riders happy.
('90000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', TRUE,  NULL,                                          '2026-02-03 09:10:00+06'),
('90000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', TRUE,  NULL,                                          '2026-02-03 09:12:00+06'),
-- Group 4, completed: arrived safely but unhappy with the trip. Dissatisfaction
-- is not a safety report — 10_reports.sql is where those go.
('90000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', FALSE, 'Driver took a long detour through Mirpur 2.', '2026-02-04 18:40:00+06');
