-- ============================================================
-- Table: reports
-- Depends on: users, ride_groups
-- ============================================================
CREATE TABLE reports (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ride_group_id      UUID REFERENCES ride_groups(id) ON DELETE SET NULL,
    reason             VARCHAR(100) NOT NULL,
    description        TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_report_not_self CHECK (reporter_id <> reported_user_id)
);
