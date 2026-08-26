-- google_id holds Google's `sub` claim: an opaque 21-digit numeric string.
-- (Earlier fixtures used Auth0's 'google-oauth2|...' format, which is a
-- different identity provider and would never match a real sign-in.)
--
-- Between them these seven accounts cover every trust stage, so authorisation
-- logic can be exercised without hand-editing rows.
--
-- Every account carries a completed profile. That is not decoration: friend
-- requests, discovery and group creation all refuse an account with
-- profile_completed_at IS NULL, so a fixture without it is a fixture the
-- friends feature cannot be demonstrated against. Phone numbers match
-- chk_users_phone_format (+8801[3-9]XXXXXXXX) and student IDs are 7-12 digits.
INSERT INTO users (id, name, email, google_id, profile_picture_url, id_card_image_url, gender, university, trust_stage, date_of_birth, phone, student_id, profile_completed_at, created_at) VALUES
('10000000-0000-0000-0000-000000000001', 'Rafiul Islam',      'rafiul.islam@northsouth.edu',  '104729183746512908371', 'https://cdn.nsuride.app/avatars/rafiul.jpg',  'https://cdn.nsuride.app/idcards/rafiul.jpg',  'male',   'North South University', 'established', '2003-04-17', '+8801712345601', '2011234601', '2026-01-10 09:20:00+06', '2026-01-10 09:00:00+06'),
('10000000-0000-0000-0000-000000000002', 'Nusrat Jahan',      'nusrat.jahan@northsouth.edu',  '113586204917305846271', 'https://cdn.nsuride.app/avatars/nusrat.jpg',  'https://cdn.nsuride.app/idcards/nusrat.jpg',  'female', 'North South University', 'established', '2004-09-02', '+8801812345602', '2021234602', '2026-01-11 10:40:00+06', '2026-01-11 10:15:00+06'),
('10000000-0000-0000-0000-000000000003', 'Tanvir Ahmed',      'tanvir.ahmed@northsouth.edu',  '117294038561720394856', 'https://cdn.nsuride.app/avatars/tanvir.jpg',  'https://cdn.nsuride.app/idcards/tanvir.jpg',  'male',   'North South University', 'established', '2003-11-28', '+8801912345603', '2011234603', '2026-01-12 09:05:00+06', '2026-01-12 08:45:00+06'),
-- Gender verified but has never completed a ride: every request she makes must
-- still start at the campus. This is the row rule 2 is tested against.
('10000000-0000-0000-0000-000000000006', 'Ishrat Binte Karim', 'ishrat.karim@northsouth.edu', '108362947105827364910', 'https://cdn.nsuride.app/avatars/ishrat.jpg',  'https://cdn.nsuride.app/idcards/ishrat.jpg',  'female', 'North South University', 'verified',    '2005-01-19', '+8801612345606', '2051234606', '2026-02-01 16:45:00+06', '2026-02-01 16:20:00+06'),
-- Signed in, gender not verified. May not create a ride request at all, which
-- is why she appears in no group below.
('10000000-0000-0000-0000-000000000004', 'Farhana Akter',     'farhana.akter@northsouth.edu', '102847561930284756193', 'https://cdn.nsuride.app/avatars/farhana.jpg', 'https://cdn.nsuride.app/idcards/farhana.jpg', 'female', 'North South University', 'new',         '2004-06-11', '+8801512345604', '2041234604', '2026-01-14 11:55:00+06', '2026-01-14 11:30:00+06'),
('10000000-0000-0000-0000-000000000005', 'Sadman Sakib',      'sadman.sakib@northsouth.edu',  '110573829461038475629', 'https://cdn.nsuride.app/avatars/sadman.jpg',  'https://cdn.nsuride.app/idcards/sadman.jpg',  'male',   'North South University', 'established', '2003-08-05', '+8801312345605', '2011234605', '2026-01-15 14:25:00+06', '2026-01-15 14:00:00+06'),
-- Rafiul's friend, and NOBODY else's. The three accounts above form a closed
-- triangle, which proves a clique check that works; this one is what proves a
-- clique check that refuses. Rafiul can group with {Tanvir, Sadman} or with
-- {Imran}, never with both, because Imran has met neither of them. Without a
-- row like this the group picker looks identical whether its narrowing works or
-- does nothing at all.
('10000000-0000-0000-0000-000000000007', 'Imran Hossain',     'imran.hossain@northsouth.edu', '119483027561948302756', 'https://cdn.nsuride.app/avatars/imran.jpg',   'https://cdn.nsuride.app/idcards/imran.jpg',   'male',   'North South University', 'verified',    '2004-02-23', '+8801712345607', '2041234607', '2026-02-10 10:15:00+06', '2026-02-10 09:50:00+06');

-- The moderator, in a statement of its own because it is the only row that
-- sets is_admin and the only one outside the rider fixtures entirely.
--
-- Deliberately in NO friendship, group or ride. `users.is_admin` gates the
-- report queue, and an admin who is also a rider makes every queue test
-- ambiguous — you can never tell whether a report is visible because the
-- account is an admin or because it was a party to the ride. This account has
-- no other relationship to anything, so the only reason it can read a report
-- is the flag.
INSERT INTO users (id, name, email, google_id, profile_picture_url, gender, university, trust_stage, date_of_birth, phone, student_id, profile_completed_at, created_at, is_admin) VALUES
('10000000-0000-0000-0000-000000000099', 'Renki Moderator', 'moderator@northsouth.edu', '190000000000000000001', NULL, 'female', 'North South University', 'established', '1995-05-05', '+8801712345699', '1000000099', '2026-01-01 09:00:00+06', '2026-01-01 09:00:00+06', true);
