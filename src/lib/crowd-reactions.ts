export interface CrowdHeadReaction {
  id: string;
  userId: string;
  glyph: string;
  color: string;
  delay: number;
  offset: number;
}

export const HEAD_REACTION_DURATION_MS = 2600;
