-- google_id holds Google's `sub` claim: an opaque 21-digit numeric string.
-- (Earlier fixtures used Auth0's 'google-oauth2|...' format, which is a
-- different identity provider and would never match a real sign-in.)
--
-- Between them these six accounts cover every trust stage, so authorisation
-- logic can be exercised without hand-editing rows.
INSERT INTO users (id, name, email, google_id, profile_picture_url, id_card_image_url, gender, university, trust_stage, created_at) VALUES
('10000000-0000-0000-0000-000000000001', 'Rafiul Islam',      'rafiul.islam@northsouth.edu',  '104729183746512908371', 'https://cdn.nsuride.app/avatars/rafiul.jpg',  'https://cdn.nsuride.app/idcards/rafiul.jpg',  'male',   'North South University', 'established', '2026-01-10 09:00:00+06'),
('10000000-0000-0000-0000-000000000002', 'Nusrat Jahan',      'nusrat.jahan@northsouth.edu',  '113586204917305846271', 'https://cdn.nsuride.app/avatars/nusrat.jpg',  'https://cdn.nsuride.app/idcards/nusrat.jpg',  'female', 'North South University', 'established', '2026-01-11 10:15:00+06'),
('10000000-0000-0000-0000-000000000003', 'Tanvir Ahmed',      'tanvir.ahmed@northsouth.edu',  '117294038561720394856', 'https://cdn.nsuride.app/avatars/tanvir.jpg',  'https://cdn.nsuride.app/idcards/tanvir.jpg',  'male',   'North South University', 'established', '2026-01-12 08:45:00+06'),
-- Gender verified but has never completed a ride: every request she makes must
-- still start at the campus. This is the row rule 2 is tested against.
('10000000-0000-0000-0000-000000000006', 'Ishrat Binte Karim', 'ishrat.karim@northsouth.edu', '108362947105827364910', 'https://cdn.nsuride.app/avatars/ishrat.jpg',  'https://cdn.nsuride.app/idcards/ishrat.jpg',  'female', 'North South University', 'verified',    '2026-02-01 16:20:00+06'),
-- Signed in, gender not verified. May not create a ride request at all, which
-- is why she appears in no group below.
('10000000-0000-0000-0000-000000000004', 'Farhana Akter',     'farhana.akter@northsouth.edu', '102847561930284756193', 'https://cdn.nsuride.app/avatars/farhana.jpg', 'https://cdn.nsuride.app/idcards/farhana.jpg', 'female', 'North South University', 'new',         '2026-01-14 11:30:00+06'),
('10000000-0000-0000-0000-000000000005', 'Sadman Sakib',      'sadman.sakib@northsouth.edu',  '110573829461038475629', 'https://cdn.nsuride.app/avatars/sadman.jpg',  'https://cdn.nsuride.app/idcards/sadman.jpg',  'male',   'North South University', 'established', '2026-01-15 14:00:00+06');
