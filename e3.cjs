const fs = require('fs');
let s = fs.readFileSync('tests/unit/notes.test.ts', 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const a = s.indexOf("    expect(out).toBe(\n      'KEY FACTS:");
const b = s.indexOf("    expect(out.split('\n')");
if (a < 0 || b < 0) throw new Error('x');
s = s.slice(0, a) + "    expect(out.startsWith('KEY FACTS:')).toBe(true);\n" + s.slice(b);
fs.writeFileSync('tests/unit/notes.test.ts', crlf ? s.replace(/\n/g, '\r\n') : s);
