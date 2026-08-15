-- Every group is single-gender. Two of these were mixed before migration 12
-- made that impossible; the riders were swapped rather than the rule bent.
--
-- formation 'friends' means the creator's friends may join and there is no size
-- cap. 'matched' means the matcher paired strangers, so exactly two riders.
-- capacity is the creator's choice for a friends group, and fixed at 2 for a
-- stranger match.
INSERT INTO ride_groups (id, destination_location_id, departure_time, status, gender, formation, capacity, created_by_user_id, created_at) VALUES
-- Rafiul + Tanvir, whose friendship is 'accepted' in 04_friendships.sql.
-- Rafiul asked for four seats; only two filled.
('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '2026-02-03 08:30:00+06', 'completed', 'male',   'friends', 4, '10000000-0000-0000-0000-000000000001', '2026-02-03 08:00:00+06'),
-- Nusrat + Ishrat: not friends, so the matcher paired them and the group is full at two.
('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '2026-02-05 09:00:00+06', 'active',    'female', 'matched', 2, NULL,                                   '2026-02-05 08:30:00+06'),
-- Sadman + Rafiul: their friendship is still 'pending', so this is a stranger match.
('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', '2026-02-06 17:00:00+06', 'matched',   'male',   'matched', 2, NULL,                                   '2026-02-06 16:40:00+06'),
-- Solo rider, no match found.
('60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000005', '2026-02-04 18:00:00+06', 'completed', 'female', 'matched', 2, NULL,                                   '2026-02-04 17:45:00+06');
