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

  /** Small identity anchor shown during Conversation (.aurina-portrait) */
  identityImage: "/photo/aurina-master.png",

  /** Final Experience host portrait (.reflection-host) — the confirmed
   *  vertical portrait, Final-page only. public/assets/"aurina
   *  portrait.png" (space in name) is the original the user placed;
   *  this file is a byte-identical copy under the confirmed path name
   *  (public/assets/aurina_portrait.png) so code never references a
   *  path with a space. The original is untouched. */
  finalHostImage: "/assets/aurina_portrait.png",
} as const;
