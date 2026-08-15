-- One open proposal, half-answered: Tanvir swiped right, Sadman has not looked
-- yet. This is the state the whole consent model exists to represent — before
-- migration 13 these two would already have been sitting in a group together.
--
-- request_a_id < request_b_id is enforced by chk_proposal_ordered, so the pair
-- has exactly one representation and cannot be inserted twice by swapping ends.
INSERT INTO ride_match_proposals (id, request_a_id, request_b_id, response_a, response_b, expires_at, created_at) VALUES
('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000009', 'accepted', 'pending', '2026-02-10 09:55:00+06', '2026-02-10 09:46:00+06');
