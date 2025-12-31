#!/usr/bin/env node

/**
 * NIS2 Shield Compliance Checker CLI
 * Usage: npx check-nis2 [config-path]
 */

const fs = require('fs');
const path = require('path');
// Import from main bundle
const { ComplianceChecker, ComplianceReportGenerator, mergeConfig, defaultNis2Config } = require('../dist/index');

async function main() {
    console.log('🛡️  NIS2 Shield Compliance Checker v0.3.0');
    console.log('========================================');

    // 1. Load Config
    let configPath = process.argv[2];
    if (!configPath) {
        // Try default locations
        const defaults = ['nis2.config.js', 'nis2.config.json'];
        for (const loc of defaults) {
            if (fs.existsSync(path.resolve(process.cwd(), loc))) {
                configPath = loc;
                break;
            }
        }
    }

    let userConfig = {};
    if (configPath) {
        const fullPath = path.resolve(process.cwd(), configPath);
        console.log(`Loading configuration from: ${fullPath}`);
        try {
            userConfig = require(fullPath);
            // Handle if export default or module.exports
            if (userConfig.default) userConfig = userConfig.default;
        } catch (e) {
            console.error(`❌ Error loading config file: ${e.message}`);
            process.exit(1);
        }
    } else {
        console.warn('⚠️  No configuration file found (nis2.config.js/json). Using defaults.');
        console.warn('   Run with: npx check-nis2 <path/to/config.js>');
    }

    // Merge with defaults
    const config = mergeConfig(userConfig);

    // 2. Run Checks
    console.log('Running compliance checks...');
    const checker = new ComplianceChecker(config);
    const checks = checker.check();

    // 3. Calculate Score
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    const score = Math.round((passed / total) * 100);
    const criticalFailures = checks.filter(c => !c.passed && c.severity === 'critical').length;

    let status = 'PASS';
    if (criticalFailures > 0) status = 'FAIL';
    else if (score < 100) status = 'WARN';

    const report = {
        timestamp: new Date().toISOString(),
        score,
        status,
        checks
    };

    // 4. Generate Reports
    const jsonReport = ComplianceReportGenerator.generateJSON(report);
    const htmlReport = ComplianceReportGenerator.generateHTML(report);

    // 5. Output Results
    console.log('\nAudit Results:');
    checks.forEach(check => {
        const icon = check.passed ? '✅' : (check.severity === 'critical' ? '❌' : '⚠️ ');
        console.log(`${icon} [${check.id}] ${check.description}: ${check.details}`);
    });

    console.log('\n----------------------------------------');
    console.log(`Compliance Score: ${score}% (${status})`);

    // Save files
    const outputDir = path.resolve(process.cwd(), 'nis2-reports');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    fs.writeFileSync(path.join(outputDir, 'compliance_report.json'), jsonReport);
    fs.writeFileSync(path.join(outputDir, 'compliance_report.html'), htmlReport);

    console.log(`\n📄 Reports generated in: ${outputDir}`);
    console.log('   - compliance_report.json');
    console.log('   - compliance_report.html');

    if (status === 'FAIL') process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
