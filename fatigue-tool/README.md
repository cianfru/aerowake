# EASA Fatigue Analysis Tool - Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Run the Simple Example

Test that everything works:

```bash
python simple_example.py
```

You should see output showing:
- ✅ Analysis complete
- Performance metrics (landing performance, sleep debt, etc.)
- Risk assessment (with risk level and recommended actions)
- Pinch events (if any)

### Step 3: Choose Your Interface

You have 3 ways to use the tool:

#### Option A: Command Line (Quick Single Analysis)
```bash
python analyze_duty.py
```
Interactive command-line interface - best for quick single-duty analysis.

#### Option B: Web Interface (Full Featured)
```bash
streamlit run fatigue_app.py
```
Full-featured web app - best for roster analysis, visualizations, and reports.

#### Option C: Python API (Custom Integration)
```python
from core_model import BorbelyFatigueModel
from config import ModelConfig
# ... your code here
```

---

## 📊 Understanding the Output

### Performance Scale (0-100)
- **75-100**: Low risk (well-rested)
- **65-75**: Moderate risk (monitor)
- **55-65**: High risk (mitigation needed)
- **45-55**: Critical risk (roster change required)
- **0-45**: Extreme risk (unsafe to fly)

### Key Metrics

**Landing Performance**: Most critical - performance at touchdown
**Minimum Performance**: Worst performance during entire duty
**Cumulative Sleep Debt**: Total sleep deficit accumulated
**WOCL Encroachment**: Time spent working during 02:00-06:00 home time
**Pinch Events**: Dangerous combinations of high sleep pressure + circadian low

### Risk Classification

The tool uses EASA regulatory references:

- **Low**: No action needed
- **Moderate**: Enhanced monitoring (AMC1 ORO.FTL.120)
- **High**: Mitigation required (GM1 ORO.FTL.235)
- **Critical**: Roster modification mandatory (ORO.FTL.120a)
- **Extreme**: Do not fly (ORO.FTL.120b)

---

## 🔧 Configuration Options

The tool has 4 preset configurations in `config.py`:

### 1. Default EASA Config (Recommended)
```python
config = ModelConfig.default_easa_config()
```
Balanced approach based on EASA research

### 2. Conservative Config (Safety-Critical)
```python
config = ModelConfig.conservative_config()
```
- Stricter thresholds
- More cautious sleep quality assumptions
- Better for safety advocacy

### 3. Liberal Config (Airline-Style)
```python
config = ModelConfig.liberal_config()
```
- More forgiving thresholds
- Mirrors typical airline assumptions
- ⚠️ May underestimate risk

### 4. Research Config (Academic)
```python
config = ModelConfig.research_config()
```
- Pure Borbély parameters
- No safety margins
- For comparing with published studies

---

## 📂 File Structure

```
fatigue_tool/
├── config.py              # Model parameters & thresholds
├── data_models.py         # Data structures (Roster, Duty, etc.)
├── easa_utils.py          # Compliance validation & risk scoring
├── core_model.py          # Biomathematical fatigue engine
├── roster_parser.py       # PDF/CSV roster parsing
├── visualization.py       # Charts and graphs
├── fatigue_app.py         # Streamlit web interface
│
├── simple_example.py      # Basic test (START HERE)
├── analyze_duty.py        # Command-line interface
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

---

## 🎯 Common Use Cases

### 1. Analyze Your Monthly Roster

```bash
streamlit run fatigue_app.py
```
1. Upload your roster (PDF or CSV)
2. Set your home base and pilot ID
3. View monthly heatmap showing high-risk days
4. Export SMS reports for specific duties

### 2. Compare Two Roster Options

```python
from core_model import BorbelyFatigueModel
from config import ModelConfig

model = BorbelyFatigueModel()

# Analyze roster A
analysis_a = model.simulate_roster(roster_a)

# Analyze roster B  
analysis_b = model.simulate_roster(roster_b)

# Compare average risk
print(f"Roster A: {analysis_a.average_performance:.1f}/100")
print(f"Roster B: {analysis_b.average_performance:.1f}/100")
```

### 3. Identify High-Risk Duties Proactively

Before flying a roster, identify which duties need attention:

```python
analysis = model.simulate_roster(roster)

for timeline in analysis.duty_timelines:
    if timeline.landing_performance < 55:  # High/Critical/Extreme
        print(f"⚠️  Duty {timeline.duty_id} on {timeline.duty_date}")
        print(f"   Landing performance: {timeline.landing_performance:.1f}")
```

### 4. Generate SMS Fatigue Report

The web interface (`fatigue_app.py`) has a built-in report generator that creates:
- Summary of duty details
- Performance metrics with EASA references
- Risk assessment with recommended actions
- Supporting evidence (charts, pinch events)

---

## ⚠️ Important Disclaimers

### What This Tool IS:
✅ Educational fatigue risk assessment
✅ Based on EASA-published research
✅ Helps you understand your fatigue risk
✅ Provides evidence for SMS reports
✅ Useful for roster comparison

### What This Tool IS NOT:
❌ Not certified for regulatory compliance
❌ Not a replacement for airline FRMS
❌ Not for operational go/no-go decisions
❌ Not validated against operational data
❌ Not a medical fitness assessment

### Legal Use:
- Use for **advocacy** (filing fatigue reports, requesting roster changes)
- Use for **education** (understanding biomathematical principles)
- Use for **research** (comparing roster options, trend analysis)

- **Do NOT use** for fitness-for-duty determination
- **Always exercise** professional judgment per EASA ORO.FTL.120
- **Always comply** with your airline's FRMS

---

## 🐛 Troubleshooting

### "Module not found" errors
```bash
pip install -r requirements.txt
```

### Timezone errors
Make sure airport timezones use IANA format:
- ✅ `"Europe/London"` 
- ❌ `"GMT"` or `"BST"`

### Extremely low performance scores
This usually indicates:
1. Duty starting at WOCL (02:00-06:00 home time)
2. No prior sleep in the roster
3. Long duty duration

Check your duty timing and add prior rest if realistic.

### Web app won't start
```bash
# Make sure Streamlit is installed
pip install streamlit

# Run from the correct directory
cd fatigue_tool
streamlit run fatigue_app.py
```

---

## 📚 Scientific References

### Core Model
- Borbély & Achermann (1999). Sleep homeostasis and models of sleep regulation. *J Biol Rhythms*, 14(6), 559-570
- EASA (2013). Moebus Report: Evidence-based fatigue risk assessment
- Van Dongen et al. (2003). Cumulative cost of additional wakefulness. *Sleep*, 26(2), 117-126

### Circadian Adaptation
- Aschoff (1978). Features of circadian rhythms relevant for shift schedules. *Ergonomics*, 21(10), 739-754
- Waterhouse et al. (2007). Jet lag: trends and coping strategies. *Lancet*, 369, 1117-1129

### Regulatory
- EU Regulation 965/2012 (EASA ORO.FTL)
- AMC1 ORO.FTL.105 - Acclimatization
- GM1 ORO.FTL.235 - Disruptive duties

---

## 🤝 Contributing

This is an educational open-source project. Contributions welcome:

### Ways to Contribute:
1. **Bug reports** - Found an issue? Let us know
2. **Feature requests** - Need a specific analysis?
3. **Validation data** - Have operational fatigue data to compare?
4. **Documentation** - Improve this guide

### Development:
- Code is modular and well-commented
- Follow existing style and structure
- All parameters should be in `config.py`
- Add tests for new features

---

## 💡 Tips for Effective Use

### 1. Start Conservative
Use `ModelConfig.conservative_config()` when advocating for safety changes. The stricter thresholds give you a stronger safety margin.

### 2. Document Everything
When filing SMS reports, include:
- Screenshots of performance timelines
- List of pinch events
- Comparison to similar duties
- Specific EASA regulatory references from the output

### 3. Focus on Landing Performance
This is the most critical metric - it represents your cognitive state at the most demanding phase of flight.

### 4. Track Trends
Run monthly analyses to identify patterns:
- Which duty types are consistently high-risk?
- Is your roster getting better or worse over time?
- Are certain pairings problematic?

### 5. Be Proactive
Don't wait until you're exhausted. Use this tool BEFORE flying to identify problems and request changes.

---

## 📞 Support

### For Technical Issues:
- Check this README first
- Review the example files
- Check file permissions and paths

### For EASA Regulations:
- Consult [EASA website](https://www.easa.europa.eu)
- Speak with your airline's flight safety department
- Contact your pilot union

### For Medical Concerns:
- Consult an Aviation Medical Examiner (AME)
- Do not use this tool for fitness-for-duty assessment

---

## ✈️ Remember

**This tool empowers YOU with information.**

- Airlines have commercial FRMS tools - now you have yours
- Use it to advocate for safer rosters proactively
- File evidence-based fatigue reports
- Make informed decisions about your safety

**But always exercise professional judgment per EASA ORO.FTL.120.**

Fly safe! 🛫
