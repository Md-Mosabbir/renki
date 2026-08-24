-- Every group is single-gender. Two of these were mixed before migration 12
-- made that impossible; the riders were swapped rather than the rule bent.
--
-- formation 'friends' means the creator's friends may join and there is no size
-- cap. 'matched' means the matcher paired strangers, so exactly two riders.
--
-- Migration 19 added direction. Note what it forces: every 'matched' row starts
-- at a campus gate and there is no way to write one that does not — the
-- database refuses it. The one 'friends' row running Gulshan -> NSU is the
-- exemption made visible: those two have met in person, so the campus rule has
-- nothing left to establish.
--
-- Migration 21 added started_at / completed_at, and they are not optional
-- decoration: chk_ride_group_completed_at enforces
-- (status = 'completed') = (completed_at IS NOT NULL), and
-- chk_ride_group_started_at requires a start time for anything active or
-- completed. A fixture naming a status without its timestamps is rejected.
INSERT INTO ride_groups
  (id, origin_location_id, origin_kind, destination_location_id, departure_time,
   status, gender, formation, capacity, created_by_user_id, created_at,
   started_at, completed_at)
VALUES
-- Rafiul + Tanvir, whose friendship is 'accepted' in 04_friendships.sql.
-- Rafiul asked for four seats; only two filled. Gulshan -> NSU: a friends group
-- may run inbound, which no stranger ride ever can.
('60000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000002', 'other',
 '20000000-0000-0000-0000-000000000001',
 '2026-02-03 08:30:00+06', 'completed', 'male', 'friends', 4,
 '10000000-0000-0000-0000-000000000001', '2026-02-03 08:00:00+06',
 '2026-02-03 08:34:00+06', '2026-02-03 09:11:00+06'),

-- Nusrat + Ishrat: not friends, so the matcher paired them. Out of the North
-- Gate, full at two.
('60000000-0000-0000-0000-000000000002',
 '20000000-0000-0000-0000-000000000006', 'campus',
 '20000000-0000-0000-0000-000000000003',
 '2026-02-05 09:00:00+06', 'active', 'female', 'matched', 2,
 NULL, '2026-02-05 08:30:00+06',
 '2026-02-05 09:06:00+06', NULL),

-- Sadman + Rafiul. They are friends, but this ride came out of the stranger
-- matcher rather than an invitation — which is why formation is 'matched' and
-- why it still has to start at a gate. Nobody has scanned yet.
('60000000-0000-0000-0000-000000000003',
 '20000000-0000-0000-0000-000000000001', 'campus',
 '20000000-0000-0000-0000-000000000004',
 '2026-02-06 17:00:00+06', 'matched', 'male', 'matched', 2,
 NULL, '2026-02-06 16:40:00+06',
 NULL, NULL),

-- Solo rider, no match found.
('60000000-0000-0000-0000-000000000004',
 '20000000-0000-0000-0000-000000000007', 'campus',
 '20000000-0000-0000-0000-000000000005',
 '2026-02-04 18:00:00+06', 'completed', 'female', 'matched', 2,
 NULL, '2026-02-04 17:45:00+06',
 '2026-02-04 18:03:00+06', '2026-02-04 18:41:00+06');
