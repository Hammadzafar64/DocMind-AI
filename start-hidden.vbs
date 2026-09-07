Set WshShell = CreateObject("WScript.Shell")
projectDir = "C:\Users\HAMMAD ZAFAR\.gemini\antigravity-ide\scratch\docmind-ai"
WshShell.CurrentDirectory = projectDir
WshShell.Run """C:\Program Files\nodejs\node.exe"" """ & projectDir & "\daemon.js""", 0, False
