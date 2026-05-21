# Migration Scripts Archive

This directory contains one-time migration scripts that were used during the frontend refactoring on April 26, 2026.

## Scripts

### Python Scripts (frontend/scripts/)
- `fix_duplicates.py` - Fixed duplicate code during refactoring
- `fix_planner_height.py` - Fixed FO route planner height issues
- `fix_sidebar.py` - Fixed sidebar layout issues
- `fix_styles.py` - Fixed styling inconsistencies
- `fix_tenant_planner.py` - Fixed tenant planner component issues
- `fix_toasts.py` - Fixed toast notification styling

### JavaScript Scripts
- `fix-blur.js` - Fixed glass blur effects in UI components

## Context

These scripts were created during the major refactoring commit:
- **Commit**: 9888130 - "refactor: restructure frontend to feature-based architecture and fix backend DTO validation"
- **Date**: April 26, 2026
- **Purpose**: One-time fixes to migrate from old structure to feature-based architecture

## Status

All scripts have been executed and are no longer needed for runtime. They are archived here for historical reference and documentation purposes.

## Note

These scripts should NOT be deleted as they provide valuable context about the migration process. If similar refactoring is needed in the future, these scripts can serve as reference examples.
