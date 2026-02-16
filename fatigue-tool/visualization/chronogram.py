# chronogram.py - High-Resolution Duty Timeline Visualization
# ===========================================================

"""
Professional "Raster Plot" or "Chronogram" visualization showing:
- 48 columns per day (30-minute resolution)
- Color-coded by fatigue risk or duty state
- WOCL highlighting
- Circadian phase shifts visible
- "The Flip" detection
- Multi-day duty spanning

Used by: SAFTE-FAST, Jeppesen Crew Fatigue, Boeing Alertness Model
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import LinearSegmentedColormap
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List
import pytz

from models.data_models import MonthlyAnalysis, DutyTimeline


class FatigueChronogram:
    """
    High-resolution timeline showing entire month at 30-minute granularity
    with professional "glass cockpit" aesthetic
    """
    
    def __init__(self, theme='pro_dark'):
        self.theme = theme
        
        if theme == 'pro_dark':
            # Professional Glass Cockpit Palette
            self.bg_color = '#0B0E14'          # Deep Navy/Black
            self.surface_color = '#1C222D'     # Subtle dark grey (off-duty)
            self.text_color = '#E0E0E0'        # Off-white for reduced glare
            self.grid_color = '#2A2F3A'        # Subtle grid lines
            self.wocl_color = '#9C27B0'        # Deep Bio-Purple
            self.duty_base = '#00E5FF'         # Cyan (high legibility)
            self.accent_color = '#76FF03'      # Lime (alternative)
            
            # Muted Risk Gradient for Dark Mode
            self.risk_cmap = LinearSegmentedColormap.from_list(
                'pro_fatigue',
                ['#2E7D32', '#FBC02D', '#EF6C00', '#C62828'],  # Muted Green→Yellow→Orange→Red
                N=100
            )
        elif theme == 'dark':
            # Legacy dark theme
            self.bg_color = '#1e1e1e'
            self.surface_color = '#2d2d2d'
            self.text_color = '#ffffff'
            self.grid_color = '#444444'
            self.wocl_color = '#7B1FA2'
            self.duty_base = '#1565C0'
            self.accent_color = '#2196F3'
            
            self.risk_cmap = LinearSegmentedColormap.from_list(
                'fatigue_risk',
                ['#009E73', '#95C11F', '#F0E442', '#E69F00', '#D55E00', '#CC0000'],
                N=100
            )
        else:
            # Light theme
            self.bg_color = '#ffffff'
            self.surface_color = '#f8f8f8'
            self.text_color = '#000000'
            self.grid_color = '#cccccc'
            self.wocl_color = '#E91E63'
            self.duty_base = '#2196F3'
            self.accent_color = '#1976D2'
            
            self.risk_cmap = LinearSegmentedColormap.from_list(
                'fatigue_risk',
                ['#009E73', '#95C11F', '#F0E442', '#E69F00', '#D55E00', '#CC0000'],
                N=100
            )
        
        # State colors
        self.state_colors = {
            'off': self.surface_color,
            'duty': self.duty_base,
            'sleep': '#4A148C',
            'wocl': self.wocl_color,
        }
    
    def plot_monthly_chronogram(
        self,
        monthly_analysis: MonthlyAnalysis,
        save_path: Optional[str] = None,
        mode: str = 'risk',  # 'risk', 'state', or 'hybrid'
        show_annotations: bool = True
    ):
        """
        Create high-resolution chronogram showing entire month
        
        Args:
            monthly_analysis: Monthly analysis results
            save_path: Output path
            mode: 'risk' (performance heatmap), 'state' (duty/rest), 'hybrid' (both)
            show_annotations: Show pattern detection annotations
        """
        
        roster = monthly_analysis.roster
        duties = monthly_analysis.duty_timelines
        
        if not duties:
            print("No duties to display")
            return
        
        # Get month boundaries
        first_date = min(d.duty_date for d in duties)
        last_date = max(d.duty_date for d in duties)
        
        # Number of days in month
        month_start = first_date.replace(day=1)
        if month_start.month == 12:
            next_month = month_start.replace(year=month_start.year + 1, month=1)
        else:
            next_month = month_start.replace(month=month_start.month + 1)
        days_in_month = (next_month - month_start).days
        
        # ====================================================================
        # CREATE GRID: days × 48 slots (30-min resolution)
        # ====================================================================
        
        grid = np.zeros((days_in_month, 48))  # 0 = OFF
        risk_grid = np.full((days_in_month, 48), np.nan)  # NaN = no data
        
        # Build duty map
        for duty_timeline in duties:
            duty_idx = roster.get_duty_index(duty_timeline.duty_id)
            duty = roster.duties[duty_idx]
            
            # Get timeline points (5-min resolution)
            if not duty_timeline.timeline:
                continue
            
            for point in duty_timeline.timeline:
                # Calculate day and slot
                point_date = point.timestamp_utc.astimezone(
                    pytz.timezone(duty.home_base_timezone)
                )
                
                day_idx = point_date.day - 1  # 0-indexed
                if day_idx < 0 or day_idx >= days_in_month:
                    continue
                
                # 30-minute slot (0-47)
                hour = point_date.hour
                minute = point_date.minute
                slot_idx = hour * 2 + (1 if minute >= 30 else 0)
                
                # Mark as duty
                grid[day_idx, slot_idx] = 1
                
                # Store risk/performance
                risk_grid[day_idx, slot_idx] = point.raw_performance
        
        # ====================================================================
        # CREATE FIGURE
        # ====================================================================
        
        fig, ax = plt.subplots(figsize=(24, days_in_month * 0.4))
        fig.patch.set_facecolor(self.bg_color)
        ax.set_facecolor(self.bg_color)
        
        # ====================================================================
        # PLOT GRID
        # ====================================================================
        
        if mode == 'risk' or mode == 'hybrid':
            # Performance heatmap
            im = ax.imshow(
                risk_grid,
                aspect='auto',
                cmap=self.risk_cmap,
                vmin=0,
                vmax=100,
                interpolation='nearest',
                alpha=0.9
            )
            
            # Colorbar
            cbar = plt.colorbar(im, ax=ax, pad=0.01)
            cbar.set_label('Performance Score', color=self.text_color, fontsize=11)
            cbar.ax.tick_params(colors=self.text_color)
        
        if mode == 'state':
            # Simple duty/rest visualization
            im = ax.imshow(
                grid,
                aspect='auto',
                cmap='Blues',
                vmin=0,
                vmax=1,
                interpolation='nearest'
            )
        
        # ====================================================================
        # WOCL OVERLAY (purple shading)
        # ====================================================================
        
        # WOCL is typically 02:00-06:00 (slots 4-12)
        wocl_start_slot = 4   # 02:00
        wocl_end_slot = 12    # 06:00
        
        for day in range(days_in_month):
            # Add semi-transparent purple rectangle for WOCL
            wocl_rect = mpatches.Rectangle(
                (wocl_start_slot - 0.5, day - 0.5),
                wocl_end_slot - wocl_start_slot,
                1,
                facecolor='#7B1FA2',
                edgecolor='none',
                alpha=0.15,
                zorder=1
            )
            ax.add_patch(wocl_rect)
        
        # ====================================================================
        # ANNOTATIONS
        # ====================================================================
        
        if show_annotations:
            # Detect patterns
            patterns = self._detect_patterns(monthly_analysis)
            
            # Add pattern annotations
            y_offset = -1.5
            for pattern in patterns:
                ax.text(
                    -2, pattern['day_start'] + y_offset,
                    pattern['label'],
                    fontsize=9,
                    color=pattern['color'],
                    weight='bold',
                    va='center',
                    ha='right'
                )
        
        # ====================================================================
        # AXES AND LABELS
        # ====================================================================
        
        # Professional styling: Remove spines for clean "floating" look
        for spine in ax.spines.values():
            spine.set_visible(False)
        
        # Add circadian background (Sun/Moon cycle)
        if self.theme == 'pro_dark':
            # Night hours: 00:00-05:59 (Deep Indigo)
            ax.axvspan(-0.5, 12, color='#1A237E', alpha=0.08, zorder=0)
            # Day hours: 06:00-17:59 (Soft Amber)
            ax.axvspan(12, 36, color='#FF6F00', alpha=0.05, zorder=0)
            # Evening/Night: 18:00-23:59 (Deep Indigo)
            ax.axvspan(36, 48, color='#1A237E', alpha=0.08, zorder=0)
        
        # Y-axis: Days
        day_labels = []
        day_positions = []
        
        for day in range(days_in_month):
            current_date = month_start + timedelta(days=day)
            
            # Show label every 2 days
            if day % 2 == 0:
                day_labels.append(
                    f"{current_date.strftime('%a')} {current_date.day}"
                )
                day_positions.append(day)
        
        ax.set_yticks(day_positions)
        ax.set_yticklabels(day_labels, fontsize=10, color=self.text_color, family='monospace')
        ax.set_ylabel('Day of Month', fontsize=12, color=self.text_color, weight='bold')
        
        # X-axis: Hours (with circadian context)
        hour_labels = [f"{h:02d}:00" for h in range(0, 24, 3)]
        hour_positions = [h * 2 for h in range(0, 24, 3)]
        
        ax.set_xticks(hour_positions)
        ax.set_xticklabels(hour_labels, fontsize=10, color=self.text_color, family='monospace')
        ax.set_xlabel('Time of Day (Home Base)', fontsize=12, color=self.text_color, weight='bold')
        
        # Add WOCL label on x-axis
        ax.text(
            8, -2.5,  # Middle of WOCL (slot 8 = 04:00)
            '🌙 WOCL',
            fontsize=10,
            color=self.wocl_color,
            weight='bold',
            ha='center'
        )
        
        # Add sun/moon indicators for circadian context (if pro_dark theme)
        if self.theme == 'pro_dark':
            # Moon icon at start
            ax.text(2, -3.2, '🌙', fontsize=11, ha='center', va='top')
            # Sun icon at midday
            ax.text(24, -3.2, '☀️', fontsize=11, ha='center', va='top')
            # Moon icon at evening
            ax.text(46, -3.2, '🌙', fontsize=11, ha='center', va='top')
        
        # Grid lines - more subtle for professional look
        ax.set_xticks(np.arange(-0.5, 48, 2), minor=True)
        ax.set_yticks(np.arange(-0.5, days_in_month, 1), minor=True)
        ax.grid(which='minor', color=self.grid_color, linestyle='-', linewidth=0.5, alpha=0.2)
        
        # Title with professional formatting
        ax.set_title(
            f"{month_start.strftime('%B %Y')} - High-Resolution Duty Timeline\n"
            f"Pilot: {roster.pilot_id} | "
            f"Duties: {roster.total_duties} | "
            f"High Risk: {monthly_analysis.high_risk_duties} | "
            f"Critical: {monthly_analysis.critical_risk_duties}",
            fontsize=14,
            fontweight='bold',
            color=self.text_color,
            pad=20,
            family='monospace'
        )
        
        # Set limits
        ax.set_xlim(-0.5, 47.5)
        ax.set_ylim(days_in_month - 0.5, -0.5)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=150, bbox_inches='tight', facecolor=self.bg_color)
            print(f"✓ Chronogram saved: {save_path}")
        else:
            plt.show()
        
        plt.close()
        
        return fig
    
    def _detect_patterns(self, monthly_analysis: MonthlyAnalysis) -> List[dict]:
        """
        Detect fatigue patterns in roster
        
        Returns list of patterns with:
        - day_start: Day index
        - label: Description
        - color: Annotation color
        """
        
        patterns = []
        duties = monthly_analysis.duty_timelines
        roster = monthly_analysis.roster
        
        # Track consecutive WOCL duties
        wocl_streak = 0
        wocl_start = None
        
        # Track "The Flip" (phase shifts)
        prev_report_hour = None
        
        for i, duty_timeline in enumerate(duties):
            duty = roster.duties[roster.get_duty_index(duty_timeline.duty_id)]
            
            report_local = duty.report_time_utc.astimezone(
                pytz.timezone(duty.home_base_timezone)
            )
            report_hour = report_local.hour
            
            # WOCL detection (02:00-06:00 reports)
            if 2 <= report_hour <= 6:
                if wocl_streak == 0:
                    wocl_start = duty_timeline.duty_date.day - 1
                wocl_streak += 1
            else:
                if wocl_streak >= 2:
                    patterns.append({
                        'day_start': wocl_start,
                        'label': f'⚠️ {wocl_streak}× WOCL',
                        'color': '#D55E00'
                    })
                wocl_streak = 0
                wocl_start = None
            
            # "The Flip" detection (>8h phase shift)
            if prev_report_hour is not None:
                shift = abs(report_hour - prev_report_hour)
                if shift > 12:
                    shift = 24 - shift  # Wrap around
                
                if shift >= 8:
                    patterns.append({
                        'day_start': duty_timeline.duty_date.day - 1,
                        'label': f'⚠️ FLIP {shift}h',
                        'color': '#E69F00'
                    })
            
            prev_report_hour = report_hour
        
        # Check final WOCL streak
        if wocl_streak >= 2:
            patterns.append({
                'day_start': wocl_start,
                'label': f'⚠️ {wocl_streak}× WOCL',
                'color': '#D55E00'
            })
        
        return patterns


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

if __name__ == "__main__":
    print("Fatigue Chronogram Module")
    print("=" * 60)
    print()
    print("High-resolution 48-slot-per-day visualization")
    print()
    print("Usage:")
    print("  from chronogram import FatigueChronogram")
    print("  chrono = FatigueChronogram(theme='light')")
    print("  chrono.plot_monthly_chronogram(monthly_analysis, 'timeline.png')")
