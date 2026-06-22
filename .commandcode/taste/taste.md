# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# ux
- Fix core features to work correctly rather than building technical fallback UIs for non-technical users. Confidence: 0.75

# ux
- Use reference components exactly as provided — do not modify styling, layout, or behavior from given UI components. Confidence: 0.65
- Default to dark mode for the entire UI — ensure it persists across login and page navigation without switching to light. Confidence: 0.75

# ux
- All buttons in the UI must be functional — remove or replace any non-functional decorative buttons. Confidence: 0.85
- Prefer explicit buttons (camera, browse) over drag-and-drop for file input. Confidence: 0.75

# database
- Use Supabase for PostgreSQL hosting — don't suggest local database workarounds. Confidence: 0.90

# workflow
- Prefer giving step-by-step manual instructions over automated execution, especially for privileged operations. Confidence: 0.85
- When executing privileged database operations, always target specific rows (e.g., by email or ID) rather than broad WHERE clauses that affect all users. Confidence: 0.75

