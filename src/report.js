import { green, red, yellow } from './colors.js';
import { formatTestSummary, formatFailedTestsBlock } from './testSummary.js';
import { formatDuration } from './formatDuration.js';

export function renderTestTree(handlers, testStatus) {
  const roots = handlers.filter((h) => !h.parent);
  const lines = [];

  const walk = (node, depth = 0) => {
    const indent = '  '.repeat(depth);
    const result = testStatus.find((t) => t.id === node.id);
    let mark = '';
    let errorLine = '';

    if (node.type !== 'suite') {
      if (result?.status === 'pass') {
        mark = green('✓');
      } else if (result?.status === 'fail') {
        mark = red('✗');
        errorLine = ` - Error: ${result.error}`;
      } else {
        mark = yellow('○');
      }
    }

    lines.push(node.type === 'suite' ? `${indent}${node.name}` : `${indent}${mark} ${node.name}`);
    if (errorLine) lines.push(red(`${indent}${errorLine}`));

    if (node.children) {
      for (const childId of node.children) {
        const child = handlers.find((h) => h.id === childId);
        if (child) walk(child, depth + 1);
      }
    }
  };

  for (const root of roots) walk(root);
  return lines.join('\n');
}

export function isBrowserFailure(result) {
  return Boolean(result.error) || result.testStatus.some((t) => t.status === 'fail');
}

export function formatBrowserReport(result) {
  const header = `\n=== ${result.browser} ===`;

  if (result.error) {
    return `${header}\n${red(result.error)}`;
  }

  const parts = [
    header,
    renderTestTree(result.handlers, result.testStatus),
    formatTestSummary({ testStatus: result.testStatus, durationMs: result.durationMs }),
  ];

  const failedBlock = formatFailedTestsBlock({
    testStatus: result.testStatus,
    handlers: result.handlers,
  });
  if (failedBlock) parts.push(failedBlock);

  return parts.join('\n');
}

export function formatAggregate(results) {
  const width = Math.max(0, ...results.map((r) => r.browser.length));
  const lines = ['Cross-browser summary:'];

  for (const result of results) {
    const name = result.browser.padEnd(width);

    if (result.error) {
      lines.push(`  ${name}  ${red('✗')}  ${result.error}`);
      continue;
    }

    const passed = result.testStatus.filter((t) => t.status === 'pass').length;
    const failed = result.testStatus.filter((t) => t.status === 'fail').length;
    const mark = failed > 0 ? red('✗') : green('✓');
    lines.push(`  ${name}  ${mark}  ${passed} passed, ${failed} failed (${formatDuration(result.durationMs)})`);
  }

  return lines.join('\n');
}
