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

/** A candidate in the swipe deck. */
export interface RideCandidate {
  id: string;
  name: string;
  gender: Gender;
  trustStage: TrustStage;
  /** Rides already shared with this person. Drives the friend-priority badge. */
  sharedRides: number;
  destination: string;
  departureTime: string;
  /** Straight-line minutes between the two pickup points, for the "detour" line. */
  detourMinutes: number;
}

export interface Destination {
  id: string;
  label: string;
  area: string;
}

export type QueueState =
  | { status: 'searching'; waitingNearby: number }
  | { status: 'candidates'; waitingNearby: number }
  | { status: 'scheduled'; departsAt: string; waitingNearby: number }
  | { status: 'expired' };

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
