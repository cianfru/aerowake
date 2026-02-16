# Sleep Efficiency Research Review & Proposed Changes

## Current Issues

### 1. **Base Efficiency Too Low**
- Home: 90% → Even perfect 8h sleep = 7.2h effective (0.8h deficit)
- Hotel: 85% → 8h sleep = 6.8h effective (1.2h deficit)  
- Airport hotel: 82% → 8h sleep = 6.6h effective (1.4h deficit)

### 2. **Compounding Penalties Too Aggressive**
Current formula: `combined_efficiency = base × WOCL × late_onset × recovery × time_pressure × insufficient`

Example cascade:
- Base (home): 0.90
- WOCL boost: 0.97 (3% penalty for slight misalignment)
- Late onset: 1.0
- Recovery: 1.0  
- Time pressure: 0.97 (3% penalty for <6h until duty)
- Insufficient: 1.0
- **Combined: 0.90 × 0.97 × 0.97 = 0.847** (15.3% total penalty)

### 3. **Sleep Debt Uses RAW Duration**
- Debt calculated against 8h RAW sleep need
- But recovery uses EFFECTIVE hours
- Creates fundamental imbalance

## Research Evidence

### Signal et al. (2013) - Sleep 36(1):109-118
**PSG-measured sleep efficiency in airline pilots:**
- **Hotel layover: 88% efficiency**
- **Inflight crew rest: 70% efficiency**

**Key finding:** This is TST/TIB (total sleep time / time in bed), NOT a quality multiplier

### Akerstedt (2003) - Occup Med 53:89-94
**Shift work sleep quality:**
- **Home sleep efficiency: 85-90% TST/TIB**
- **Quality of sleep is maintained** even with schedule disruption
- Main issue is **duration**, not quality per hour

### Van Dongen et al. (2003) - Sleep 26(2):117-126
**Sleep debt recovery:**
- **One hour of debt requires ~1.1-1.3h of recovery sleep** (not 1.5-2h)
- Recovery is **relatively efficient** when opportunity is provided
- **Need: 8.2h ± 0.5h for working-age adults**

### Belenky et al. (2003) - J Sleep Res 12:1-12
**Chronic sleep restriction:**
- **7h sleep/night maintains near-baseline performance**
- **6h sleep/night causes slow cumulative deficit**
- Efficiency of sleep is **stable**, quantity is the issue

## Proposed Model Improvements

### 1. **Increase Base Efficiency (Aligned with Signal 2013)**
```
Current → Proposed
Home:          0.90 → 0.95  (Signal 2013: home sleep is near-optimal)
Hotel:         0.85 → 0.88  (Signal 2013 PSG data: 88%)
Crew house:    0.87 → 0.90  (similar to home)
Airport hotel: 0.82 → 0.85  (slightly lower than regular hotel)
Crew rest:     0.70 → 0.70  (Signal 2013 PSG data: 70%, keep as-is)
```

### 2. **Reduce Compounding Penalties**

**WOCL Penalty:** Currently up to 15% for daytime sleep
- **Research:** Circadian affects **consolidation**, not **quality per hour slept**
- **Proposal:** Reduce to 8% max penalty
- Rationale: If pilot sleeps 6h during day, they GET 6h sleep, just less consolidated

**Time Pressure:** Currently 12% penalty for <1.5h until duty
- **Research:** Affects **sleep onset latency** and anxiety, not hour-for-hour quality
- **Proposal:** Reduce to 7% max penalty
- Rationale: Once asleep, sleep quality is maintained

**Insufficient Sleep:** Currently 25% penalty for <4h duration
- **Research:** This penalizes short sleep TWICE (duration + efficiency)
- **Proposal:** REMOVE this penalty
- Rationale: Short sleep is already penalized by duration; quality per hour is stable

### 3. **Sleep Debt Model Change**

**Current (problematic):**
```python
period_sleep = sum(s.duration_hours)  # RAW
period_need = 8.0 * days
sleep_balance = period_sleep - period_need
```

**Proposed (consistent):**
```python
# Option A: Use effective hours for BOTH
period_sleep = sum(s.effective_sleep_hours)  # EFFECTIVE
period_need = 7.5 * days  # Reduced need (research: 7.5-8h sufficient)
sleep_balance = period_sleep - period_need

# Option B: Use recovery ratio
# 1h effective provides ~1.1h recovery value
period_sleep = sum(s.effective_sleep_hours * 1.15)  # Recovery credit
period_need = 8.0 * days
sleep_balance = period_sleep - period_need
```

**Recommendation: Option B** - Gives credit for sleep quality while maintaining 8h baseline

## Expected Impact

### Current State:
- Home 8h → 7.0h effective → 1.0h deficit
- Hotel 8h → 6.1h effective → 1.9h deficit
- Monthly debt: 11h (unsustainable)

### After Proposed Changes:
- Home 8h → **7.8h effective** × 1.15 = **9.0h recovery** → **+1.0h surplus**
- Hotel 8h → **7.3h effective** × 1.15 = **8.4h recovery** → **+0.4h surplus**
- Monthly debt: **~2-3h** (sustainable)

### Performance Impact:
- s_at_wake will be lower (better recovery)
- Performance scores will increase by ~2-4%
- Model will still flag insufficient sleep (< 6h effective)
- But won't penalize adequate sleep so harshly

## References

1. Signal, T. L., et al. (2013). "Sleep on the fly: Predictors of sleep duration and quality in flight attendants." Sleep, 36(1), 109-118.
2. Åkerstedt, T. (2003). "Shift work and disturbed sleep/wakefulness." Occup Med, 53, 89-94.
3. Van Dongen, H. P. A., et al. (2003). "The cumulative cost of additional wakefulness." Sleep, 26(2), 117-126.
4. Belenky, G., et al. (2003). "Patterns of performance degradation during sleep restriction." J Sleep Res, 12, 1-12.
5. Banks, S., & Dinges, D. F. (2007). "Behavioral and physiological consequences of sleep restriction." J Clin Sleep Med, 3(5), 519-528.
