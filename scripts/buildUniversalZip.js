const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const agentDir = path.join(__dirname, '..', 'nexalliance-attendance-agent');
const distDir = path.join(agentDir, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const outputZip = path.join(distDir, 'NexAllianceAttendanceAgent-Universal-Win-Mac.zip');
const output = fs.createWriteStream(outputZip);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on('close', () => {
  console.log(`[ZIP Success] Created Universal Win+Mac ZIP (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB): ${outputZip}`);
});

archive.pipe(output);

// Add files excluding dist and node_modules
archive.glob('**/*', {
  cwd: agentDir,
  ignore: ['dist/**', 'node_modules/**', '.git/**']
});

archive.finalize();
