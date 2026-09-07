const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const desktopPath = 'C:\\Users\\HAMMAD ZAFAR\\OneDrive\\Desktop';
const shortcutPath = path.join(desktopPath, 'DocMind AI.lnk');
const targetScript = 'C:\\Users\\HAMMAD ZAFAR\\.gemini\\antigravity-ide\\scratch\\docmind-ai\\open-docmind.vbs';
const workDir = 'C:\\Users\\HAMMAD ZAFAR\\.gemini\\antigravity-ide\\scratch\\docmind-ai';
const iconPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe,0';

const vbsContent = `
Set WshShell = CreateObject("WScript.Shell")
Set shortcut = WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """${targetScript.replace(/\\/g, '\\\\')}"""
shortcut.WorkingDirectory = "${workDir.replace(/\\/g, '\\\\')}"
shortcut.Description = "DocMind AI - Intelligent Document System"
shortcut.IconLocation = "${iconPath.replace(/\\/g, '\\\\')}"
shortcut.Save
`;

const tempVbs = path.join(__dirname, 'temp_shortcut.vbs');
fs.writeFileSync(tempVbs, vbsContent, 'utf8');
try {
  execSync(`cscript //nologo "${tempVbs}"`, { stdio: 'inherit' });
  console.log('✅ Shortcut created successfully at:', shortcutPath);
} finally {
  if (fs.existsSync(tempVbs)) fs.unlinkSync(tempVbs);
}
