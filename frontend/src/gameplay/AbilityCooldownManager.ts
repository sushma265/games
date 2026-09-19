/**
 * AbilityCooldownManager - Reusable, authoritative cooldown and effect timer manager.
 * Used on both client and server to manage player ability states.
 */

export class AbilityCooldownManager {
  // Cooldown end timestamp in milliseconds
  private cooldowns: Map<string, number> = new Map();
  // Active effect duration end timestamp in milliseconds
  private activeUntil: Map<string, number> = new Map();

  /**
   * Checks if an ability is off cooldown and ready to be used
   */
  public canUse(ability: string): boolean {
    return this.getRemaining(ability) <= 0;
  }

  /**
   * Starts cooldown and optional active duration for the given ability
   * @param ability Ability identifier
   * @param cooldownDuration Cooldown in seconds
   * @param activeDuration Active effect duration in seconds (optional)
   */
  public startCooldown(ability: string, cooldownDuration: number, activeDuration: number = 0): void {
    const now = Date.now();
    this.cooldowns.set(ability, now + cooldownDuration * 1000);
    if (activeDuration > 0) {
      this.activeUntil.set(ability, now + activeDuration * 1000);
    }
  }

  /**
   * Returns remaining cooldown in seconds (0 if ready)
   */
  public getRemaining(ability: string): number {
    const end = this.cooldowns.get(ability);
    if (!end) return 0;
    const now = Date.now();
    const remaining = (end - now) / 1000;
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Returns remaining active effect duration in seconds (0 if not active)
   */
  public getActiveRemaining(ability: string): number {
    const end = this.activeUntil.get(ability);
    if (!end) return 0;
    const now = Date.now();
    const remaining = (end - now) / 1000;
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Returns whether the ability's active effect is currently running
   */
  public isEffectActive(ability: string): boolean {
    return this.getActiveRemaining(ability) > 0;
  }

  /**
   * Directly sets cooldown remaining in seconds (e.g. from server synchronization)
   */
  public setCooldownRemaining(ability: string, seconds: number): void {
    const now = Date.now();
    this.cooldowns.set(ability, now + seconds * 1000);
  }

  /**
   * Directly sets active remaining in seconds (e.g. from server synchronization)
   */
  public setActiveRemaining(ability: string, seconds: number): void {
    const now = Date.now();
    this.activeUntil.set(ability, now + seconds * 1000);
  }

  /**
   * Retrieves full ability state snapshot
   */
  public getState(ability: string): {
    available: boolean;
    cooldownRemaining: number;
    activeRemaining: number;
    isEffectActive: boolean;
  } {
    const cooldownRemaining = this.getRemaining(ability);
    const activeRemaining = this.getActiveRemaining(ability);
    return {
      available: cooldownRemaining <= 0,
      cooldownRemaining,
      activeRemaining,
      isEffectActive: activeRemaining > 0
    };
  }

  /**
   * Resets all cooldowns
   */
  public reset(): void {
    this.cooldowns.clear();
    this.activeUntil.clear();
  }
}
