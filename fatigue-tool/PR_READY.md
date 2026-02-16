# Pull Request Ready for Review

## Branch Created & Pushed ✅

**Branch**: `fix/post-duty-sleep-generation`  
**Commit**: `4fbacae`

## Create Pull Request

Visit this URL to create the PR on GitHub:
```
https://github.com/cianfru/fatigue-tool/pull/new/fix/post-duty-sleep-generation
```

## Summary

### What Was Fixed
1. **Post-duty sleep generation** - Sleep now correctly generated after night flights at hotel layovers
2. **API exposure** - Post-duty sleep now appears in API response under `post_duty_{duty_id}` keys
3. **Timezone display** - Sleep times shown in actual location timezone (not home timezone)

### Files Changed
- `core_model.py` - Main fix (105 lines changed, multiple functions updated)
- `test_api_exposure.py` - NEW: Tests API response includes post-duty sleep with correct TZ
- `test_direct_post_duty.py` - NEW: Tests `_generate_post_duty_sleep()` function directly
- `test_post_duty_sleep.py` - NEW: End-to-end test with full roster simulation
- `test_sleep_blocks.py` - NEW: Tests sleep blocks integration

### Test Results
✅ All 4 new tests passing  
✅ Post-duty sleep correctly generated after night flights  
✅ Sleep displayed in correct location timezone (Dubai, not Rome)  
✅ Sleep properly integrated into fatigue calculations  

### Breaking Changes
⚠️ **API Response Changes**:
- New keys in `sleep_strategies`: `post_duty_{duty_id}`
- Sleep block objects now include: `location_timezone` and `environment` fields
- Sleep times now in location timezone (breaking change if frontend expects home TZ)

### Impact
- **Positive**: More accurate fatigue predictions for pilots with layovers
- **Positive**: Frontend can display sleep in pilot's actual local time
- **Positive**: EASA-compliant rest period modeling
- **Note**: Fatigue scores may decrease for existing rosters (now more realistic)

## Review Checklist
- [ ] Review code changes in `core_model.py`
- [ ] Run all 4 test files to verify functionality
- [ ] Check API response format changes
- [ ] Verify frontend compatibility with new timezone handling
- [ ] Approve and merge when ready

---

**Ready to review and merge** 🚀
