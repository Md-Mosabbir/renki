-- ============================================================
-- Table: ride_histories
-- Depends on: users
-- Recursive M:N. One row per unordered user pair, used to
-- weight friend-priority matching.
-- ============================================================
CREATE TABLE ride_histories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_a           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_b           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_ride_count   INTEGER NOT NULL DEFAULT 0 CHECK (shared_ride_count >= 0),
    last_shared_at      TIMESTAMPTZ,
    CONSTRAINT chk_history_not_self CHECK (user_id_a <> user_id_b),
    CONSTRAINT uq_history_pair UNIQUE (user_id_a, user_id_b)
);
