/**
 * The progress rail's vocabulary, shared by every service workspace. A stage is
 * plain data; the rail component only draws it. 'na' is the absent-entirely
 * behaviour (dashed, "Not applicable"), never a disabled step.
 */
export type RailStageKind = 'done' | 'current' | 'returned' | 'todo' | 'na';

export interface RailStage {
  k: RailStageKind;
  en: string;
  ar: string;
  metaEn: string;
  metaAr: string;
}

/** The step a workspace leads with -- one task, one button. */
export interface NextStep {
  kind: string;
  href: string;
  tone: 'brand' | 'accent';
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  buttonEn: string;
  buttonAr: string;
}
