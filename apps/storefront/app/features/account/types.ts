export type Step = "identify" | "verify";

export type OtpChannel = "whatsapp" | "email";

export type ActionResult = {
  step: Step;
  channel?: OtpChannel;
  // identifier is the phone (whatsapp) or email (email) the code was sent to.
  identifier?: string;
  error?: string;
  profileSaved?: boolean;
  profileError?: string;
};
