-- ============================================================
-- Structural checks
-- ============================================================
\dt
\d+ ride_requests
\d+ reports

-- ============================================================
-- Row counts (expected: users 5, locations 5, gender_verifications 5,
-- friendships 3, ride_histories 2, ride_groups 4, ride_requests 8,
-- qr_verifications 2, uber_integrations 1, reports 2)
-- ============================================================
SELECT 'users' AS table_name, count(*) FROM users
UNION ALL SELECT 'locations', count(*) FROM locations
UNION ALL SELECT 'gender_verifications', count(*) FROM gender_verifications
UNION ALL SELECT 'friendships', count(*) FROM friendships
UNION ALL SELECT 'ride_histories', count(*) FROM ride_histories
UNION ALL SELECT 'ride_groups', count(*) FROM ride_groups
UNION ALL SELECT 'ride_requests', count(*) FROM ride_requests
UNION ALL SELECT 'qr_verifications', count(*) FROM qr_verifications
UNION ALL SELECT 'uber_integrations', count(*) FROM uber_integrations
UNION ALL SELECT 'reports', count(*) FROM reports
ORDER BY table_name;

-- ============================================================
-- Referential-integrity smoke test: full itinerary join across
-- every table that touches a ride
-- ============================================================
SELECT
    u.name              AS rider,
    lo.address           AS origin,
    ld.address           AS destination,
    rr.status             AS request_status,
    rg.status             AS group_status,
    qv.code               AS qr_code,
    ui.provider_ride_id   AS uber_ride
FROM ride_requests rr
JOIN users u        ON u.id = rr.user_id
JOIN locations lo   ON lo.id = rr.origin_location_id
JOIN locations ld   ON ld.id = rr.destination_location_id
LEFT JOIN ride_groups rg        ON rg.id = rr.ride_group_id
LEFT JOIN qr_verifications qv   ON qv.ride_group_id = rg.id
LEFT JOIN uber_integrations ui  ON ui.ride_group_id = rg.id
ORDER BY rr.departure_time;

-- ============================================================
-- Constraint check 1: self-friendship must be rejected
-- ============================================================
DO $$
BEGIN
    INSERT INTO friendships (requester_id, addressee_id)
    VALUES ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'chk_friend_not_self did NOT fire -- schema bug';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'OK: chk_friend_not_self correctly rejected a self-friend row';
END $$;

-- ============================================================
-- Constraint check 2: duplicate email must be rejected
-- ============================================================
DO $$
BEGIN
    INSERT INTO users (name, email, gender)
    VALUES ('Duplicate Test', 'rafiul.islam@northsouth.edu', 'male');
    RAISE EXCEPTION 'uq on users.email did NOT fire -- schema bug';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'OK: users.email UNIQUE constraint correctly rejected a duplicate';
END $$;
