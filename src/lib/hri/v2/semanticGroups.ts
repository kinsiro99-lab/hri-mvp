export type SemanticGroup =
  | "memory"
  | "emotion"
  | "present"
  | "relationship"
  | "meaning"
  | "direction"
  | "body"
  | "neutral";

export type SemanticIntent =
  | "memory_scene"
  | "memory_person"
  | "memory_place"
  | "emotion_name"
  | "emotion_effect"
  | "present_state"
  | "present_effect"
  | "relationship_state"
  | "relationship_connection"
  | "meaning_value"
  | "meaning_impact"
  | "direction_wish"
  | "direction_next"
  | "body_state"
  | "body_signal"
  | "neutral_deepening";

export interface SemanticIntentDefinition {
  intent: SemanticIntent;
  group: SemanticGroup;
}

export const SEMANTIC_INTENTS: readonly SemanticIntentDefinition[] = [
  { intent: "memory_scene", group: "memory" },
  { intent: "memory_person", group: "memory" },
  { intent: "memory_place", group: "memory" },

  { intent: "emotion_name", group: "emotion" },
  { intent: "emotion_effect", group: "emotion" },

  { intent: "present_state", group: "present" },
  { intent: "present_effect", group: "present" },

  { intent: "relationship_state", group: "relationship" },
  { intent: "relationship_connection", group: "relationship" },

  { intent: "meaning_value", group: "meaning" },
  { intent: "meaning_impact", group: "meaning" },

  { intent: "direction_wish", group: "direction" },
  { intent: "direction_next", group: "direction" },

  { intent: "body_state", group: "body" },
  { intent: "body_signal", group: "body" },

  { intent: "neutral_deepening", group: "neutral" },
] as const;

const INTENT_TO_GROUP = new Map<SemanticIntent, SemanticGroup>(
  SEMANTIC_INTENTS.map(({ intent, group }) => [intent, group]),
);

export function getSemanticGroup(
  intent: SemanticIntent,
): SemanticGroup {
  return INTENT_TO_GROUP.get(intent) ?? "neutral";
}

export function hasUsedSemanticGroup(
  intent: SemanticIntent,
  usedGroups: ReadonlySet<SemanticGroup>,
): boolean {
  return usedGroups.has(getSemanticGroup(intent));
}

export function filterUnusedSemanticGroups(
  intents: readonly SemanticIntent[],
  usedGroups: ReadonlySet<SemanticGroup>,
): SemanticIntent[] {
  return intents.filter(
    (intent) => !hasUsedSemanticGroup(intent, usedGroups),
  );
}

export function collectUsedSemanticGroups(
  intents: readonly SemanticIntent[],
): Set<SemanticGroup> {
  return new Set(intents.map(getSemanticGroup));
}

export const SEMANTIC_GROUP_ORDER: readonly SemanticGroup[] = [
  "memory",
  "emotion",
  "present",
  "relationship",
  "meaning",
  "direction",
  "body",
  "neutral",
] as const;

export function selectNextSemanticGroup(
  availableGroups: readonly SemanticGroup[],
  usedGroups: ReadonlySet<SemanticGroup>,
): SemanticGroup | null {
  for (const group of SEMANTIC_GROUP_ORDER) {
    if (
      availableGroups.includes(group) &&
      !usedGroups.has(group)
    ) {
      return group;
    }
  }

  return null;
}