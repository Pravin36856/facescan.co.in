Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\ABC\.gemini\antigravity\scratch\ai-photo-saas"
WshShell.Run "cmd /c start_247_service.bat", 0, False
Set WshShell = Nothing
