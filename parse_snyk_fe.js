const fs = require('fs');

try {
    const raw = fs.readFileSync('snyk_frontend_results_v2.json');
    let content;

    if (raw[0] === 0xFF && raw[1] === 0xFE) {
        content = raw.toString('utf16le');
    } else {
        content = raw.toString('utf8');
    }

    const firstBrace = content.indexOf('{');
    if (firstBrace > 0) content = content.slice(firstBrace);

    const sarif = JSON.parse(content);

    sarif.runs.forEach(run => {
        run.results.forEach((result, idx) => {
            console.log(`Issue ${idx + 1}: [${result.level.toUpperCase()}] ${result.ruleId}`);
            console.log(`Message: ${result.message.text}`);
            if (result.locations) {
                result.locations.forEach(loc => {
                    const uri = loc.physicalLocation.artifactLocation.uri;
                    const line = loc.physicalLocation.region.startLine;
                    console.log(`Location: ${uri}:${line}`);
                });
            }
            console.log('---');
        });
    });
} catch (e) {
    console.error('Error:', e.message);
}
