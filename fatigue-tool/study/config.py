"""Study governance values shown to pilots. Mirror of fatigue-insight-hub/src/lib/study-config.ts.

The owner confirms these before recruitment; change both files together and
bump CONSENT_VERSION whenever the meaning of the consent text changes.
"""

CONSENT_VERSION = 'calibration-v2'
CONTROLLER = 'the Aerowake project owner (a private individual)'
CONTACT = 'the in-app Support link'
PURPOSE = ('calibrating the Aerowake sleepiness model against what pilots actually feel, pooled and '
           'pseudonymised across all pilots; results will not be published')
RETENTION = 'until you stop contributing and delete it, or 24 months after your last activity'

# Abuse and storage bounds (per signed-in pilot).
DAILY_ROW_CAP = 100          # new study rows in any rolling 24 hours
TOTAL_DEBRIEF_CAP = 3000     # stored debriefs per pilot
WRITES_PER_MINUTE = 30       # study writes per pilot per minute (in-process)
READS_PER_MINUTE = 60        # study reads/exports per pilot per minute (in-process)

# Participant pseudonym salt shared with pilot-study exports (study/routes.py).
PARTICIPANT_SALT = 'aerowake-pilot-study-v1:'


def summary():
    return dict(consent_version=CONSENT_VERSION, controller=CONTROLLER, contact=CONTACT,
                purpose=PURPOSE, retention=RETENTION)
