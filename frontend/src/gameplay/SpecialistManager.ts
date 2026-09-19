/**
 * SpecialistManager - Strategic crew allocation between Earth Defense and Shuka Extraction.
 * Total must strictly equal 5 at all times.
 */
export class SpecialistManager {
  public static readonly TOTAL_SPECIALISTS: number = 5;

  public earthDefense: number = 2;
  public shukaExtraction: number = 3;

  // Mid-match reallocation cooldown
  public reallocationCooldown: number = 0;
  public static readonly REALLOCATION_COOLDOWN_TIME: number = 35; // seconds

  constructor() {
    this.setAllocation(2, 3);
  }

  public setAllocation(defense: number, extraction: number): boolean {
    if (defense < 0 || extraction < 0) return false;
    if (defense + extraction !== SpecialistManager.TOTAL_SPECIALISTS) return false;

    this.earthDefense = defense;
    this.shukaExtraction = extraction;
    return true;
  }

  public adjustDefense(delta: number): boolean {
    const newDefense = this.earthDefense + delta;
    const newExtraction = SpecialistManager.TOTAL_SPECIALISTS - newDefense;

    if (newDefense >= 0 && newDefense <= SpecialistManager.TOTAL_SPECIALISTS) {
      this.earthDefense = newDefense;
      this.shukaExtraction = newExtraction;
      return true;
    }
    return false;
  }

  public update(deltaSeconds: number): void {
    if (this.reallocationCooldown > 0) {
      this.reallocationCooldown = Math.max(0, this.reallocationCooldown - deltaSeconds);
    }
  }

  public triggerReallocationCooldown(): void {
    this.reallocationCooldown = SpecialistManager.REALLOCATION_COOLDOWN_TIME;
  }

  public canReallocate(): boolean {
    return this.reallocationCooldown <= 0;
  }

  /**
   * Slowdown multiplier for alien extraction on Earth.
   * Base factor 1.0; each defense specialist adds +0.22 (at 5 defense, alien extraction is ~2.1x slower).
   */
  public getEarthDefenseSlowMultiplier(): number {
    return 1.0 + (this.earthDefense * 0.22);
  }

  /**
   * Speed bonus for player extraction on Shuka.
   * Each extraction specialist adds +0.16 speed bonus (at 5 extraction, player extracts ~1.8x faster).
   */
  public getShukaExtractionBonus(): number {
    return this.shukaExtraction * 0.16;
  }
}
