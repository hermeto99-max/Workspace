#!/bin/bash
# Auto-commit and push all changes to GitHub

git add .
git commit -m "Auto-backup: $(date '+%Y-%m-%d %H:%M:%S')"
git push
