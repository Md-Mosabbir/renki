-- ============================================================
-- Table: ride_requests
-- Depends on: users, locations, ride_groups
-- A request doubles as the group-membership record: a rider
-- joins a ride_group simply by having ride_group_id set.
-- ============================================================
CREATE TABLE ride_requests (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_location_id         UUID NOT NULL REFERENCES locations(id),
    destination_location_id    UUID NOT NULL REFERENCES locations(id),
    departure_time             TIMESTAMPTZ NOT NULL,
    gender_preference          VARCHAR(20) NOT NULL DEFAULT 'any'
                               CHECK (gender_preference IN ('male', 'female', 'any')),
    status                     VARCHAR(20) NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'matched', 'cancelled', 'expired')),
    ride_group_id              UUID REFERENCES ride_groups(id) ON DELETE SET NULL,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_request_origin_dest_diff CHECK (origin_location_id <> destination_location_id)
);
