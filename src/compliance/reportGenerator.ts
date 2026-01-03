export interface ComplianceReport {
  timestamp: string;
  score: number;
  checks: ComplianceCheckResult[];
  status: 'PASS' | 'FAIL' | 'WARN';
}

export interface ComplianceCheckResult {
  id: string;
  description: string;
  passed: boolean;
  details?: string;
  severity: 'critical' | 'warning';
}

export class ComplianceReportGenerator {
  static generateJSON(report: ComplianceReport): string {
    return JSON.stringify(report, null, 2);
  }

  static generateHTML(report: ComplianceReport): string {
    const color =
      report.status === 'PASS' ? '#4ade80' : report.status === 'FAIL' ? '#f87171' : '#fbbf24';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>NIS2 Shield Compliance Report</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #111; color: #eee; }
        .header { text-align: center; margin-bottom: 40px; }
        .score-card { background: #222; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 30px; border: 1px solid #333; }
        .score { font-size: 48px; font-weight: bold; color: ${color}; }
        .status { font-size: 18px; text-transform: uppercase; color: ${color}; letter-spacing: 2px; }
        .check { background: #1a1a1a; padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #333; }
        .check.pass { border-left-color: #4ade80; }
        .check.fail { border-left-color: #f87171; }
        .check-header { display: flex; justify-content: space-between; align-items: center; }
        .check-title { font-weight: 600; }
        .check-status { font-size: 14px; padding: 4px 8px; border-radius: 4px; background: #333; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ NIS2 Compliance Report</h1>
        <p>${new Date(report.timestamp).toLocaleString()}</p>
    </div>

    <div class="score-card">
        <div class="score">${report.score}%</div>
        <div class="status">${report.status}</div>
    </div>

    <div class="checks">
        ${report.checks
          .map(
            (check) => `
        <div class="check ${check.passed ? 'pass' : 'fail'}">
            <div class="check-header">
                <span class="check-title">${check.description}</span>
                <span class="check-status">${check.passed ? 'PASS' : 'FAIL'}</span>
            </div>
            ${check.details ? `<p style="color: #888; margin-top: 5px; font-size: 14px;">${check.details}</p>` : ''}
        </div>
        `
          )
          .join('')}
    </div>
</body>
</html>`;
  }
}
