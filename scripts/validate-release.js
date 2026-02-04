const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { execSync } = require('child_process');

const packageJson = require('../package.json');
const version = packageJson.version;
const repoUrl = packageJson.repository.url.replace('.git', '').replace('https://github.com/', '');
const [owner, repo] = repoUrl.split('/');

console.log(`\n🔍 Validating Release v${version} for ${owner}/${repo}...\n`);

// 1. Get Local Artifact
const distDir = path.join(__dirname, '../dist');
let appImageName = `AI-Floating-Assistant-${version}.AppImage`;
let appImagePath = path.join(distDir, appImageName);

if (!fs.existsSync(appImagePath)) {
    const altName = `AI Floating Assistant-${version}.AppImage`;
    const altPath = path.join(distDir, altName);
    if (fs.existsSync(altPath)) {
        appImageName = altName;
        appImagePath = altPath;
    }
}

if (!fs.existsSync(appImagePath)) {
    console.error(`❌ Local artifact not found: ${appImagePath}`);
    console.error('   Run "npm run dist:linux" first to generate artifacts.');
    process.exit(1);
}

// 2. Calculate Local Checksum
console.log(`📦 Local Artifact: ${appImageName}`);
const fileBuffer = fs.readFileSync(appImagePath);
const hashSum = crypto.createHash('sha512');
hashSum.update(fileBuffer);
const localSha512 = hashSum.digest('base64');
console.log(`   SHA512: ${localSha512}`);

// 3. Fetch Remote YAML
const yamlUrl = `https://github.com/${owner}/${repo}/releases/download/v${version}/latest-linux.yml`;
console.log(`\n☁️  Fetching Remote YAML: ${yamlUrl}`);

const fetchUrl = (url, cb) => {
    https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
            return fetchUrl(res.headers.location, cb);
        }
        if (res.statusCode !== 200) {
            console.error(`❌ Failed to fetch YAML (Status: ${res.statusCode})`);
            res.resume();
            return;
        }
        cb(res);
    }).on('error', (e) => {
        console.error(`❌ Error fetching YAML: ${e.message}`);
    });
};

fetchUrl(yamlUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        // 4. Parse Remote Checksum
        const match = data.match(/sha512:\s*([A-Za-z0-9+/=]+)/);
        if (!match) {
            console.error('❌ Could not find sha512 in remote YAML');
            console.log('--- Remote YAML ---');
            console.log(data);
            process.exit(1);
        }

        const remoteSha512 = match[1];
        console.log(`   Remote SHA512: ${remoteSha512}`);

        // 5. Compare
        console.log('\n----------------------------------------');
        if (localSha512 === remoteSha512) {
            console.log('✅ SUCCESS: Checksums match! Update should work.');
        } else {
            console.error('❌ MISMATCH: Checksums do not match!');
            console.error('   The file on GitHub Releases likely has a different hash than your local build.');
            console.error('\n   ACTION REQUIRED:');
            console.error('   1. Upload your LOCAL "dist/latest-linux.yml" to the GitHub Release.');
            console.error('      This will overwrite the outdated YAML file.');
            process.exit(1);
        }
        console.log('----------------------------------------\n');
    });
});
