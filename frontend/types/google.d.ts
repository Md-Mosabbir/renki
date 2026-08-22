/**
 * Minimal typings for Google Identity Services.
 *
 * Google ships no types for the GSI browser script, so this declares only the
 * three calls Renki uses. Deliberately not exhaustive — a partial declaration
 * that is accurate beats a broad `any` that hides a typo in a field name.
 */
interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  /**
   * Filters the account chooser to one Workspace domain.
   *
   * UX only. Anyone can POST a token from any Google account straight to the
   * API, so the real restriction is the backend's own `hd` check. Never treat
   * this as enforcement.
   */
  hd?: string;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  use_fedcm_for_prompt?: boolean;
}

interface GoogleButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: GoogleIdConfiguration) => void;
        renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
        disableAutoSelect: () => void;
      };
    };
  };
}
