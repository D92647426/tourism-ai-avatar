@echo off
title Lingshan AI Guide
cd /d "%~dp0"
if not exist "target\ai-guide-1.0.0.jar" (
    echo [ERROR] Build the source with mvn clean package first.
    exit /b 1
)
echo Starting http://localhost:8080/
echo Press Ctrl+C to stop this application.
java -jar "target\ai-guide-1.0.0.jar"
exit /b %errorlevel%
