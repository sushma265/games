/**
 * Shared Types for EARTH // SHUKA - Specialist Allocation & Game Systems
 */

export interface SpecialistAllocation {
  total: number; // Always 5
  earthDefense: number; // 0 - 5
  shukaExtraction: number; // 0 - 5
  isLocked: boolean;
}

export interface SpecialistModifiers {
  earthDefenseBonus: number; // earthDefense * 0.05
  shukaExtractionBonus: number; // shukaExtraction * 0.05
  baseShukaExtractionTime: number; // 4.0 seconds
  finalShukaExtractionTime: number; // computed
  earthDefense?: {
    specialists: number;
    disruptionBonus: number;
  };
  shukaExtraction?: {
    specialists: number;
    speedBonus: number;
    duration: number;
  };
}

export const SPECIALIST_CONFIG = {
  totalSpecialists: 5,
  defaultEarthDefense: 2,
  defaultShukaExtraction: 3,
  shukaExtractionBonusPerSpecialist: 0.05, // 5% per specialist
  earthDefenseBonusPerSpecialist: 0.05, // 5% per specialist
  baseShukaExtractionTime: 4.0 // 4.0 seconds as specified in Phase 4
};

// Phase 11: Centralized Ability & Game Balance Configuration
export type AbilityId = 'EMP_SURGE' | 'OVERCHARGE' | 'SCAN';

export interface AbilityDefinition {
  id: AbilityId;
  name: string;
  key: string;
  duration: number; // active duration in seconds
  cooldown: number; // cooldown in seconds
  description: string;
}

export const ABILITY_CONFIG = {
  empSurge: {
    id: 'EMP_SURGE' as AbilityId,
    name: 'EMP SURGE',
    key: 'E',
    duration: 5,
    cooldown: 20,
    description: 'Temporarily pauses alien extraction progress for 5s'
  },
  overcharge: {
    id: 'OVERCHARGE' as AbilityId,
    name: 'OVERCHARGE',
    key: 'Q',
    duration: 2, // disruption duration
    cooldown: 25,
    progressReduction: 0.25, // 25% base extraction setback
    description: 'Disrupts alien extraction process and reduces progress'
  },
  scan: {
    id: 'SCAN' as AbilityId,
    name: 'SCAN',
    key: 'R',
    duration: 5,
    cooldown: 15,
    description: 'Highlights the nearest uncollected Shuka Energy Core'
  }
};

export const GAME_BALANCE = {
  specialists: {
    earthDefenseBonusPerSpecialist: 0.05,
    shukaExtractionBonusPerSpecialist: 0.05
  },
  abilities: {
    empDuration: 5,
    empCooldown: 20,
    overchargeDuration: 2,
    overchargeCooldown: 25,
    overchargeBaseReduction: 0.25,
    scanDuration: 5,
    scanCooldown: 15
  }
};
