-- Web Push subscriptions: where to send a notification when the app is closed.
--
-- `notifications` (migration 26) is the RECORD of what happened, readable in the
-- app. This table is the TRANSPORT — the browser endpoint a payload is POSTed
-- to. They are deliberately separate: a student with no push subscription still
-- accumulates notification rows and sees them on next open, and revoking push
-- must never delete their history.

CREATE TABLE push_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- The push service URL the browser handed us. Google's, Mozilla's or
    -- Apple's, depending on the browser — we hold no account with any of them,
    -- VAPID is the whole authentication story.
    --
    -- TEXT, not VARCHAR(n): these are opaque vendor URLs with no documented
    -- length bound, and truncating one produces a subscription that fails
    -- forever with no obvious cause.
    endpoint    TEXT NOT NULL,

    -- The two halves of the payload encryption (RFC 8291). Without both, a
    -- payload cannot be encrypted and the send is rejected.
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,

    -- Rough provenance, for support questions like "why does my iPhone never
    -- buzz". Not used in any query that matters.
    user_agent  TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,

    -- ONE row per endpoint, globally, not per (user, endpoint).
    --
    -- A browser hands out one endpoint per installation. If two accounts sign in
    -- on the same phone, the second must TAKE the endpoint rather than add a
    -- second row — otherwise the first account keeps receiving notifications on
    -- a device it no longer owns, which is a privacy leak and not merely noise.
    CONSTRAINT uq_push_endpoint UNIQUE (endpoint)
);

-- Every send starts "who do I notify" and fans out to their devices.
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);

COMMENT ON TABLE push_subscriptions IS
    'Web Push transport. The record of what happened lives in notifications.';
