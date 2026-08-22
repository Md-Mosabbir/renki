import type {
  AuthResult,
  Destination,
  ProfileInput,
  QueueState,
  RideCandidate,
  User,
  VerificationResult,
} from './types';
import { ApiError } from './types';

/**
 * The mock backend.
 *
 * Deliberately not a pile of `Promise.resolve(fixture)`. It keeps a little
 * state in memory, so the flows that matter — sign in, fill the form, verify,
 * swipe — actually progress from one screen to the next the way they will
 * against the real API. A mock that always returns the same user cannot
 * exercise the routing, which is the part most likely to be wrong.
 *
 * State lives in module scope, so a full page reload resets it. That is the
 * intended escape hatch while building: refresh to start over.
 */

const LATENCY_MS = 450;

function sleep<T>(value: T, ms = LATENCY_MS): Promise<T> {
  // A real network is never instant. Without this the loading states never
  // render during development and ship untested.
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let currentUser: User | null = null;

function freshUser(): User {
  return {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Nusrat Jahan',
    email: 'nusrat.jahan@northsouth.edu',
    university: 'North South University',
    gender: 'unspecified',
    trustStage: 'new',
    profilePictureUrl: null,
    dateOfBirth: null,
    phone: null,
    studentId: null,
    profileCompleted: false,
  };
}

export const mockApi = {
  async signIn(email: string): Promise<AuthResult> {
    // The domain rule is the backend's, enforced there against Google's `hd`
    // claim. Mirrored here only so the error state is reachable while building.
    if (!email.toLowerCase().endsWith('@northsouth.edu')) {
      await sleep(null, 300);
      throw new ApiError(403, 'Renki is open to @northsouth.edu accounts only');
    }

    currentUser = { ...freshUser(), email: email.toLowerCase() };
    return sleep({ token: 'mock-jwt-token', user: currentUser });
  },

  async me(): Promise<User> {
    if (!currentUser) {
      throw new ApiError(401, 'Not signed in');
    }
    return sleep(currentUser);
  },

  async completeProfile(input: ProfileInput): Promise<User> {
    if (!currentUser) {
      throw new ApiError(401, 'Not signed in');
    }
    currentUser = {
      ...currentUser,
      ...input,
      profileCompleted: true,
    };
    return sleep(currentUser);
  },

  /**
   * Mocked face + gender verification.
   *
   * Per the spec this is inferred directly from what the student selected —
   * there is no scan. It resolves to `verified` so the happy path is walkable,
   * and `under_review` is reachable through `forceOutcome` so the report flow
   * can be built and demoed without pretending a model failed.
   */
  async verifyIdentity(
    forceOutcome?: VerificationResult['outcome']
  ): Promise<VerificationResult> {
    if (!currentUser) {
      throw new ApiError(401, 'Not signed in');
    }

    const outcome = forceOutcome ?? 'verified';
    if (outcome === 'verified') {
      currentUser = { ...currentUser, trustStage: 'verified' };
    }
    return sleep({ outcome, distance: outcome === 'verified' ? 0.31 : 0.71 }, 2200);
  },

  async destinations(): Promise<Destination[]> {
    return sleep(DESTINATIONS);
  },

  async candidates(): Promise<RideCandidate[]> {
    return sleep(CANDIDATES);
  },

  async queue(): Promise<QueueState> {
    return sleep({ status: 'candidates', waitingNearby: 10 } as QueueState);
  },

  reset(): void {
    currentUser = null;
  },
};

const DESTINATIONS: Destination[] = [
  { id: 'dhanmondi', label: 'Dhanmondi 27', area: 'Dhanmondi' },
  { id: 'uttara', label: 'Uttara Sector 7', area: 'Uttara' },
  { id: 'banani', label: 'Banani 11', area: 'Banani' },
  { id: 'mirpur', label: 'Mirpur DOHS', area: 'Mirpur' },
  { id: 'gulshan', label: 'Gulshan 2 Circle', area: 'Gulshan' },
  { id: 'mohakhali', label: 'Mohakhali Bus Stand', area: 'Mohakhali' },
];

const CANDIDATES: RideCandidate[] = [
  {
    id: 'c1',
    name: 'Ishrat Rahman',
    gender: 'female',
    trustStage: 'verified',
    sharedRides: 0,
    destination: 'Dhanmondi 27',
    departureTime: '14:40',
    detourMinutes: 4,
  },
  {
    id: 'c2',
    name: 'Farhana Akter',
    gender: 'female',
    trustStage: 'established',
    sharedRides: 3,
    destination: 'Dhanmondi 27',
    departureTime: '14:45',
    detourMinutes: 2,
  },
  {
    id: 'c3',
    name: 'Sadia Islam',
    gender: 'female',
    trustStage: 'established',
    sharedRides: 0,
    destination: 'Dhanmondi 32',
    departureTime: '14:50',
    detourMinutes: 7,
  },
  {
    id: 'c4',
    name: 'Tasnim Chowdhury',
    gender: 'female',
    trustStage: 'verified',
    sharedRides: 1,
    destination: 'Dhanmondi 15',
    departureTime: '15:00',
    detourMinutes: 5,
  },
];
