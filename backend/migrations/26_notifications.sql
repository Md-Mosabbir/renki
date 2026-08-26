-- Somewhere for the Observer pattern to put what it observes.
--
-- This migration is plumbing, not the pattern. It exists so the person writing
-- the event bus and its subscribers has a table waiting rather than having to
-- fight a CHECK constraint before reaching any of the actual work.
--
-- Renki has never notified anyone of anything. Today the only way to learn that
-- somebody swiped yes on you is to open the app and look at
-- GET /api/rides/incoming. That is the gap this table and its Observer fill.

CREATE TABLE notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who is being told. CASCADE because a deleted account's notifications are
    -- addressed to nobody.
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    kind         VARCHAR(40) NOT NULL,

    -- Who caused it, when there is a someone. NULL for anything the system did
    -- on its own. SET NULL rather than CASCADE: "your ride was cancelled" is
    -- still true after the person who cancelled it deletes their account.
    actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,

    -- What it is about. Typed columns rather than a jsonb blob, deliberately:
    -- this codebase constrains things in the database, and a blob is where
    -- "rideGroupId" and "ride_group_id" and "groupId" all end up meaning the
    -- same thing in three different subscribers. Exactly one is expected to be
    -- set for most kinds, but that is NOT constrained — a future notification
    -- about both a ride and a friendship should not need a migration.
    ride_group_id UUID REFERENCES ride_groups (id) ON DELETE CASCADE,
    friendship_id UUID REFERENCES friendships (id) ON DELETE CASCADE,

    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A fixed vocabulary from the start. `reports.reason` spent its whole life
    -- as free text and drifted into 'Late arrival' and 'Behavioral concern'
    -- before migration 25 caught it; there is no reason to repeat that.
    --
    -- Adding a kind means a new migration. That is the point: a notification
    -- kind nothing renders is a notification nobody sees.
    CONSTRAINT chk_notifications_kind CHECK (kind IN (
        'ride_matched',        -- both riders, the moment a match becomes a ride
        'swipe_received',      -- someone swiped yes and is waiting on you
        'ride_started',        -- the start code was scanned
        'ride_completed',      -- a member finished the ride
        'ride_cancelled',      -- someone called it off
        'friend_request',      -- a request arrived
        'friend_confirmed',    -- a meetup code was scanned; you are friends
        'group_invite',        -- invited to a friends ride
        'group_ready',         -- the last invitee accepted
        'report_filed'         -- to moderators only
    )),

    -- You are never the actor in your own notification. A "Tanvir swiped yes"
    -- row addressed to Tanvir is a bug, and this is the cheapest place to catch
    -- one — a subscriber that loops over group members and forgets to skip the
    -- person who triggered the event will fail loudly here instead of quietly
    -- telling six people they invited themselves.
    CONSTRAINT chk_notifications_not_self CHECK (
        actor_user_id IS NULL OR actor_user_id <> user_id
    )
);

-- The unread badge. Partial, because that count is read on every page load and
-- the vast majority of rows will be read.
CREATE INDEX notifications_unread_idx
    ON notifications (user_id, created_at DESC)
 WHERE read_at IS NULL;

-- The full list, newest first.
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
