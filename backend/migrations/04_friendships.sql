-- ============================================================
-- Table: friendships
-- Depends on: users
-- Recursive M:N. A user can't friend themselves, and a given
-- requester/addressee pair can only exist once.
-- ============================================================
CREATE TABLE friendships (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_friend_not_self CHECK (requester_id <> addressee_id),
    CONSTRAINT uq_friend_pair UNIQUE (requester_id, addressee_id)
);
