/**
 * Study governance values shown to pilots. Mirror of fatigue-tool/study/config.py.
 * The owner confirms these before recruitment; change both files together and
 * bump STUDY_CONSENT_VERSION whenever the meaning of the consent text changes.
 */
export const STUDY_CONSENT_VERSION = 'calibration-v2';
export const STUDY_CONTROLLER = 'the Aerowake project owner (a private individual)';
export const STUDY_CONTACT = 'the in-app Support link';
export const STUDY_SUPPORT_URL = 'https://github.com/cianfru/aerowake/issues';
export const STUDY_PURPOSE = 'calibrating the Aerowake sleepiness model against what pilots actually feel, pooled and pseudonymised across all pilots. Results will not be published';
export const STUDY_RETENTION = 'until you stop contributing and delete it, or 24 months after your last activity';

/** Recall windows used by the server to classify debriefs (hours after the rated moment). */
export const DEBRIEF_WINDOW_DAYS = 30;
/** A duty is flagged when its forecast peak KSS, rounded to one decimal, reaches the high band. */
export const FLAG_KSS = 6.5;
