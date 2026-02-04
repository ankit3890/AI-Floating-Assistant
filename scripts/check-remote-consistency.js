const https = require('https');
const crypto = require('crypto');
const path = require('path');
const packageJson = require('../package.json');

const version = packageJson.version;
const repoUrl = packageJson.repository.url.replace('.git', '').replace('https://github.com/', '');
const [owner, repo] = repoUrl.split('/');

const platforms = {
    linux: 'latest-linux.yml',
    win: 'latest.yml',
    mac: 'latest-mac.yml'
};

const targetPlatform = process.argv[2] || 'win'; // Default to win based on screenshot evidence
const yamlFilename = platforms[targetPlatform];

if (!yamlFilename) {
    console.error(`Unknown platform: ${targetPlatform}. Use: linux, win, mac`);
    process.exit(1);
}

console.log(`\n🌍 Checking Remote Consistency for ${targetPlatform} (v${version})...\n`);

const fetchUrl = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return resolve(fetchUrl(res.headers.location));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Status code ${res.statusCode}`));
            }
            resolve(res);
        });
        req.on('error', reject);
    });
};

const downloadContent = (url) => {
    return fetchUrl(url).then(res => {
        return new Promise((resolve, reject) => {
            let data = '';
            res.setEncoding('utf8'); // Assume text for YAML
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        });
    });
};

const downloadHash = (url) => {
    console.log(`   ⬇️  Downloading artifact: ${url}`);
    return fetchUrl(url).then(res => {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha512');
            let downloadedBytes = 0;

            res.on('data', chunk => {
                hash.update(chunk);
                downloadedBytes += chunk.length;
                process.stdout.write(`   ... ${downloadedBytes} bytes\r`);
            });

            res.on('end', () => {
                console.log(`\n   ✅ Download complete: ${downloadedBytes} bytes`);
                resolve(hash.digest('base64'));
            });
            res.on('error', reject);
        });
    });
};

async function check() {
    try {
        // 1. Fetch YAML
        const yamlUrl = `https://github.com/${owner}/${repo}/releases/download/v${version}/${yamlFilename}`;
        console.log(`📄 Fetching YAML: ${yamlUrl}`);
        const yamlContent = await downloadContent(yamlUrl);

        const shaMatch = yamlContent.match(/sha512:\s*([A-Za-z0-9+/=]+)/);
        const pathMatch = yamlContent.match(/path:\s*(.+)/);

        if (!shaMatch || !pathMatch) {
            throw new Error('Could not parse sha512 or path from YAML');
        }

        const expectedSha512 = shaMatch[1];
        const artifactFilename = pathMatch[1];

        console.log(`   Expected SHA512: ${expectedSha512}`);
        console.log(`   Artifact Path:   ${artifactFilename}`);

        // 2. Download and Hash Artifact
        const artifactUrl = `https://github.com/${owner}/${repo}/releases/download/v${version}/${artifactFilename}`;
        const actualSha512 = await downloadHash(artifactUrl);

        console.log(`   Actual SHA512:   ${actualSha512}`);

        console.log('\n----------------------------------------');
        if (expectedSha512 === actualSha512) {
            console.log('✅ CONSISTENT: Remote YAML matches Remote Artifact.');
        } else {
            console.error('❌ INCONSISTENT: Remote YAML does NOT match Remote Artifact!');
            console.error('   This confirms the "checksum mismatch" error users are seeing.');
            console.error('   ACTION: You must re-generate the YAML for this artifact and upload it to GitHub.');
            process.exit(1);
        }
        console.log('----------------------------------------\n');

    } catch (err) {
        console.error(`\n❌ Error: ${err.message}`);
        process.exit(1);
    }
}

check();
