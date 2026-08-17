/**
 * Centralized AURINA brand asset references.
 *
 * To replace an asset: drop the file into `public/`, update the path
 * here, done — no component needs to change. Presentation only; no
 * engine coupling.
 */
export const AURINA_ASSETS = {
  /** Arrival header logo mark on the bright background (.arrival-brand-avatar) */
  arrivalLogoLight: "/assets/aurina/aurina-wave-logo.png",

  /** Dark-background variant of the logo mark — not placed yet; reserved for a dark surface */
  arrivalLogoDark: "/assets/aurina/image.png",

  /** Arrival hero background (.arrival) */
  arrivalBackground: "/assets/aurina-arrival-bg.png",

  /** Arrival hero host image (.arrival-portrait) */
  arrivalHeroImage: "/photo/aurina-master.png",

  /** Small identity anchor shown during Conversation/Reflection (.aurina-portrait, .reflection-portrait) */
  identityImage: "/photo/aurina-master.png",
} as const;
