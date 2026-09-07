Set WshShell = CreateObject("WScript.Shell")
projectDir = "C:\Users\HAMMAD ZAFAR\.gemini\antigravity-ide\scratch\docmind-ai"
startScript = projectDir & "\start-hidden.vbs"

' Start background daemon silently
WshShell.Run "wscript.exe """ & startScript & """", 0, False

' Give a brief moment for socket readiness
WScript.Sleep 800

' Launch default browser to localhost:3000
WshShell.Run "http://localhost:3000", 1, False
