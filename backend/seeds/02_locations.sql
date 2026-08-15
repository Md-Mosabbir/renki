-- kind = 'campus' is what rule 2 tests against: a user at trust_stage
-- 'verified' may only create requests whose origin is one of these rows.
INSERT INTO locations (id, latitude, longitude, address, kind) VALUES
('20000000-0000-0000-0000-000000000001', 23.8151, 90.4257, 'NSU Campus, Bashundhara R/A, Dhaka', 'campus'),
('20000000-0000-0000-0000-000000000002', 23.7806, 90.4193, 'Gulshan 1 Circle, Dhaka',            'other'),
('20000000-0000-0000-0000-000000000003', 23.8759, 90.3795, 'Uttara Sector 7, Dhaka',             'other'),
('20000000-0000-0000-0000-000000000004', 23.7936, 90.4043, 'Banani, Dhaka',                      'other'),
('20000000-0000-0000-0000-000000000005', 23.8067, 90.3686, 'Mirpur 10, Dhaka',                   'other');
