-- ============================================================
-- Table: uber_integrations
-- Depends on: ride_groups
-- Optional -- only present for groups that used the Uber fallback.
-- ============================================================
CREATE TABLE uber_integrations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_group_id       UUID NOT NULL UNIQUE REFERENCES ride_groups(id) ON DELETE CASCADE,
    provider_ride_id    VARCHAR(100),
    fare_estimate       NUMERIC(8,2),
    ride_status         VARCHAR(50),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
