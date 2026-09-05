@echo off
:: DocMind AI - Auto Start Server
:: Ye script Windows startup pe apne aap chalti hai

cd /d "C:\Users\HAMMAD ZAFAR\.gemini\antigravity-ide\scratch\docmind-ai"
pm2 resurrect
timeout /t 3 /nobreak > nul
pm2 start server.js --name docmind-ai 2>nul || pm2 restart docmind-ai 2>nul
pm2 save --force
