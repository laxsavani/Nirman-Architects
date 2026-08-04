@echo off
title NexAlliance Attendance Agent
echo Starting NexAlliance Attendance Agent...
cd /d "%~dp0"
if exist "dist\NexAllianceAttendanceAgent-win32-x64\NexAllianceAttendanceAgent.exe" (
    start "" "dist\NexAllianceAttendanceAgent-win32-x64\NexAllianceAttendanceAgent.exe"
) else if exist "dist\win-unpacked\NexAlliance Attendance Agent.exe" (
    start "" "dist\win-unpacked\NexAlliance Attendance Agent.exe"
) else (
    start "" npx electron .
)
