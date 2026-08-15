-- ============================================================
-- Table: ride_groups
-- Depends on: locations
-- A matched (or solo/Uber-fallback) group of riders sharing a trip.
-- ============================================================
CREATE TABLE ride_groups (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_location_id  UUID NOT NULL REFERENCES locations(id),
    departure_time            TIMESTAMPTZ NOT NULL,
    status                    VARCHAR(20) NOT NULL DEFAULT 'matched'
                              CHECK (status IN ('matched', 'active', 'completed', 'cancelled')),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
