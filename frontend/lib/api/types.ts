/**
 * Shapes shared by the mock and the real API.
 *
 * These mirror the backend's `PublicUser` and friends field for field. That is
 * the whole point: the mock returns these, the real client returns these, and
 * swapping one for the other changes no component. If the backend adds a field,
 * it is added here first and the mock is updated to produce it — so a screen
 * can never be built against a shape the server does not actually send.
 */

export type Gender = 'male' | 'female' | 'unspecified';

/**
 * `chk_ride_groups_gender` — deliberately not `Gender`.
 *
 * A ride's gender is not a person's. Since migration 27 a ride may carry two,
 * and 'mixed' is what that is called; 'unspecified' is a value a person's row
 * holds before onboarding and never a ride.
 */
export type RideGroupGender = 'male' | 'female' | 'mixed';
export type TrustStage = 'new' | 'verified' | 'established';

/** Mirrors `PublicUser` in backend/src/models/user.model.ts. */
export interface User {
  id: string;
  name: string;
  email: string;
  university: string;
  gender: Gender;
  trustStage: TrustStage;
  profilePictureUrl: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  studentId: string | null;
  /** False until the onboarding form is submitted. Drives the signup routing. */
  profileCompleted: boolean;
  /**
   * Moderator. Used only to decide whether to show the reports queue link.
   *
   * Never trusted as authorisation: `GET /api/admin/reports` re-reads the flag
   * from the database on every request, so flipping this in a browser reveals
   * nothing but a link that 404s.
   */
  isAdmin: boolean;
  /**
   * Whether this student has opted out of same-gender-only stranger matching.
   *
   * The one preference on this type that is editable after onboarding, and the
   * only field here that changes who they can be matched with. The rule is
   * mutual: two riders meet only if they share a gender or BOTH set this, so a
   * true here is never on its own enough to place someone in front of another
   * student who did not also choose it.
   */
  matchOpenToAll: boolean;
}

export interface AuthResult {
  token: string;
  user: User;
}

/** Body of POST /api/auth/gather-info. */
export interface ProfileInput {
  name: string;
  university: string;
  gender: Exclude<Gender, 'unspecified'>;
  dateOfBirth: string;
  phone: string;
  studentId: string;
}

export type VerificationOutcome = 'verified' | 'under_review' | 'failed';

export interface VerificationResult {
  outcome: VerificationOutcome;
  /** Present only so a debug view can show it. Screens branch on `outcome`. */
  distance?: number;
}

/**
 * A place a ride can go. Mirrors `PublicDestination` in
 * backend/src/services/location.service.ts.
 *
 * `locations` stores one free-text address; the server splits it into a label
 * and an area so every client groups them the same way.
 */
export interface Destination {
  id: string;
  label: string;
  area: string;
  /** 'campus' | 'other' — campus is sorted first. */
  kind: string;
  latitude: number;
  longitude: number;
}

/* ------------------------------------------------------------------ *
 * Friends
 * ------------------------------------------------------------------ */

/** Mirrors `FriendshipStatus` in backend/src/models/friendship.model.ts. */
export type FriendshipStatus =
  'pending' | 'awaiting_meetup' | 'accepted' | 'declined' | 'blocked';

/**
 * The other person in a friendship.
 *
 * Deliberately thinner than `User` — a friend list is a directory, and the
 * backend does not send phone numbers or email addresses here. Adding a field
 * to this type without adding it to `FriendSummary` on the server produces
 * `undefined` at runtime, so the two move together.
 */
export interface FriendSummary {
  id: string;
  name: string;
  university: string;
  gender: Gender;
  trustStage: TrustStage;
  profilePictureUrl: string | null;
}

export interface Friendship {
  id: string;
  status: FriendshipStatus;
  /** Whether this student sent the request or received it. */
  direction: 'incoming' | 'outgoing';
  friend: FriendSummary;
  createdAt: string;
  confirmedAt: string | null;
}

/** GET /api/friends returns all four lists at once — they are one screen. */
export interface FriendLists {
  friends: Friendship[];
  awaitingMeetup: Friendship[];
  incoming: Friendship[];
  outgoing: Friendship[];
}

/** A student who could be sent a request. Already gender-filtered by the server. */
export interface FriendCandidate {
  id: string;
  name: string;
  university: string;
  gender: Gender;
  trustStage: TrustStage;
  profilePictureUrl: string | null;
}

export type FriendResponseAction = 'accept' | 'decline' | 'block';

/**
 * A live meetup code.
 *
 * `ttlSeconds` comes back alongside the absolute `expiresAt` so the countdown
 * can be driven from the moment the response arrived rather than from the
 * phone's clock, which may disagree with the server's by minutes.
 */
export interface MeetupCode {
  code: string;
  expiresAt: string;
  ttlSeconds: number;
  friendshipId: string;
}

/* ------------------------------------------------------------------ *
 * Groups
 * ------------------------------------------------------------------ */

export type GroupStatus = 'forming' | 'matched' | 'active' | 'completed' | 'cancelled';

export interface GroupMember {
  id: string;
  name: string;
  profilePictureUrl: string | null;
  inviteStatus: 'pending' | 'accepted' | 'declined';
  isCreator: boolean;
  /**
   * This member's own drop-off, or null when it is the group's destination.
   *
   * A stranger match pairs two people going to nearby-but-different places —
   * that is what the H3 ring is for — so the ride has one headline destination
   * and up to two real drop-offs. Null means "same as the group's", which is
   * every friends group, so a screen renders a per-person line only when there
   * is genuinely something to say.
   */
  dropoffLocationId: string | null;
  dropoffLabel: string | null;
}

export interface RideGroup {
  id: string;
  status: GroupStatus;
  /** 'friends' when built from a friend list, 'matched' when the matcher paired strangers. */
  formation: 'friends' | 'matched';
  gender: RideGroupGender;
  capacity: number;
  originLocationId: string;
  /**
   * True when the ride starts at the campus. A stranger match always does — the
   * database refuses any other origin for one — while a friends group may run
   * in any direction, because everyone in it has already met in person.
   */
  startsAtCampus: boolean;
  destinationLocationId: string;
  departureTime: string;
  createdById: string | null;
  /** Set when the ride-start code is scanned. */
  startedAt: string | null;
  completedAt: string | null;
  members: GroupMember[];
  /** Invitations still unanswered. A 'forming' group is waiting on this many. */
  pendingCount: number;
}

/**
 * My confirmed friends plus the edges between them.
 *
 * This is what lets the group builder narrow instead of guess: pick one person
 * and everyone who is not in their `mutuals` can be greyed out immediately,
 * rather than the whole selection failing at submit with a 403.
 *
 * Every id appearing in `mutuals` is already one of my friends — the server
 * will not report friendships involving anyone else.
 */
export interface FriendGraph {
  friends: FriendCandidate[];
  /** friend id -> ids of my OTHER friends they are also friends with. */
  mutuals: Record<string, string[]>;
}

export interface CreateGroupInput {
  friendIds: string[];
  originLocationId: string;
  destinationLocationId: string;
  departureTime: string;
}

/** Every failure the UI is expected to render differently. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ------------------------------------------------------------------ *
 * Stranger matching
 * ------------------------------------------------------------------ */

export type RideRequestStatus =
  'pending' | 'proposed' | 'matched' | 'cancelled' | 'expired';

/**
 * One open search. A student may have at most one at a time — the backend
 * refuses a second with a 409.
 */
export interface RideRequest {
  id: string;
  originLocationId: string;
  destinationLocationId: string;
  departureTime: string;
  status: RideRequestStatus;
  rideGroupId: string | null;
  createdAt: string;
}

/** Where a stranger ride is going. Either a saved landmark or a dropped pin. */
export interface DestinationInput {
  locationId?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

/** One card in the swipe deck. */
export interface DeckCard {
  requestId: string;
  userId: string;
  name: string;
  profilePictureUrl: string | null;
  trustStage: TrustStage;
  destinationLocationId: string;
  destinationLabel: string;
  originLocationId: string;
  /** The gate they will be waiting at, e.g. "NSU Campus — North Gate". */
  originLabel: string;
  departureTime: string;
  /** Kilometres between the two destinations. Both rides leave from campus. */
  distanceKm: number;
  minutesApart: number;
  /**
   * They have already swiped yes on you. Saying yes back creates the ride
   * immediately instead of leaving it waiting — so these cards are dealt first.
   */
  theyAccepted: boolean;
}

export interface Deck {
  /** 'h3-proximity' or 'exact-destination' — which algorithm dealt these. */
  strategy: string;
  windowMinutes: number;
  deckSize: number;
  candidates: DeckCard[];
}

/**
 * The result of answering one card.
 *
 * 'waiting' means this side said yes and the other has not answered. A ride
 * exists only on 'matched', which is the second yes.
 */
export interface SwipeResult {
  outcome: 'waiting' | 'declined' | 'matched';
  group: RideGroup | null;
}

/**
 * A live ride-start code.
 *
 * Same shape and same 90-second life as a friend meetup code, for the same
 * reason: a screenshot has to be stale before it can be forwarded and used.
 */
export interface RideStartCode {
  code: string;
  expiresAt: string;
  ttlSeconds: number;
  rideGroupId: string;
}

/**
 * Someone who has already swiped yes on you.
 *
 * Answering yes creates the ride at once — their consent is already recorded,
 * so there is no second wait. `expiresAt` is the proposal's own deadline, after
 * which the offer is gone.
 */
export interface IncomingMatch {
  /** Your own open request id, needed to answer. */
  myRequestId: string;
  requestId: string;
  userId: string;
  name: string;
  profilePictureUrl: string | null;
  trustStage: TrustStage;
  originLabel: string;
  destinationLabel: string;
  departureTime: string;
  expiresAt: string;
}

/* ------------------------------------------------------------------ *
 * Editing a profile
 * ------------------------------------------------------------------ */

/**
 * What PATCH /api/auth/me accepts, and the whole of it.
 *
 * Everything else on `User` is locked once onboarding is done. Gender, date of
 * birth and student ID are checked against an ID card, so changing one means
 * verifying again rather than typing; university and email come from the
 * northsouth.edu Google account. Sending any of them is a 400 naming the
 * field, not a silent no-op — mirror that here rather than widening the type.
 *
 * `matchOpenToAll` is the exception, and is not a loophole in that rule: it is
 * a preference rather than a claim, which is exactly why it is a separate
 * field from `gender` rather than a way of editing it.
 */
export interface ProfileUpdate {
  name?: string;
  phone?: string;
  matchOpenToAll?: boolean;
}

/* ------------------------------------------------------------------ *
 * Ride history
 * ------------------------------------------------------------------ */

export interface RideCompanion {
  id: string;
  name: string;
  profilePictureUrl: string | null;
  inviteStatus: 'pending' | 'accepted' | 'declined';
  /** Where they got out, when it differed from the ride's destination. */
  dropoffLabel: string | null;
  /**
   * Completed rides shared with this person, all-time. Display only — no
   * permission in Renki is derived from it, and adding one would quietly
   * reintroduce the "you rode together once, so now you may" unlock that the
   * campus-origin rule deliberately does not have.
   */
  sharedRideCount: number;
}

/** A ride that is over. Cancelled ones are included; `status` says which. */
export interface RideHistoryEntry {
  id: string;
  status: 'completed' | 'cancelled';
  formation: 'friends' | 'matched';
  startsAtCampus: boolean;
  /** Full destination shape at both ends, so a card never renders a raw UUID. */
  origin: Destination;
  destination: Destination;
  departureTime: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Set when the ride was called off. */
  cancelledAt: string | null;
  /** Everyone else who was on it. I am not in this list. */
  companions: RideCompanion[];
}

export interface RideHistoryPage {
  rides: RideHistoryEntry[];
  /** Completed rides only, ignoring the page — the number worth showing. */
  totalCompleted: number;
  hasMore: boolean;
}

/* ------------------------------------------------------------------ *
 * Reports
 * ------------------------------------------------------------------ */

/**
 * Mirrors REPORT_REASONS in backend/src/models/report.model.ts and
 * chk_reports_reason. Keep the three in step by hand.
 *
 * `impersonation` is not a sub-case of `other`: the whole scan model exists to
 * prove the person who turned up is the person who matched, so "they were not
 * who their profile said" is the one report a moderator must see first.
 */
export type ReportReason =
  'no_show' | 'unsafe_behaviour' | 'harassment' | 'impersonation' | 'other';

export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

/** The three a moderator may move a report INTO. `open` is where it starts. */
export type ReviewAction = 'under_review' | 'resolved' | 'dismissed';

/**
 * A report as its author sees it.
 *
 * Carries nothing about the review beyond `status` — not who looked at it, not
 * what they wrote. The queue is not a channel between the two parties.
 */
export interface Report {
  id: string;
  reportedUserId: string;
  reportedUserName: string;
  rideGroupId: string | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
}

/** A report as a moderator sees it: both parties named, plus review state. */
export interface AdminReport extends Report {
  reporterId: string;
  reporterName: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
}

export interface ReportInput {
  reportedUserId: string;
  reason: ReportReason;
  description?: string | null;
  /** The ride it happened on, when there was one. */
  rideGroupId?: string | null;
}

export interface AdminReportPage {
  reports: AdminReport[];
  hasMore: boolean;
}

/**
 * What each reason says on screen.
 *
 * Here rather than in a component because two screens render them — the report
 * form and the moderation queue — and two lists of labels drift.
 */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  no_show: 'They never turned up',
  unsafe_behaviour: 'Unsafe behaviour',
  harassment: 'Harassment',
  impersonation: 'Not who their profile said',
  other: 'Something else',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Being looked at',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};
