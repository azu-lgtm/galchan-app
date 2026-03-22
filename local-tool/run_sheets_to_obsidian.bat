@echo off
cd /d "C:\Users\meiek\Desktop\ClaudeCode-projects\galchan-app"
set PYTHONIOENCODING=utf-8
python local-tool\sheets_to_obsidian.py >> local-tool\run_log.txt 2>&1
