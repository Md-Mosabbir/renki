export interface GenderVerificationPayload {
  verifiedGender: string;
  livenessVerified: boolean;
  livenessChallengesPassed?: string[];
  faceVector: number[];
  landmarkCount?: number;
  timestamp?: string;
}

export interface VerificationResult {
  verified: boolean;
  verifiedGender: string;
  vectorLength: number;
  message: string;
  processedAt: string;
}
