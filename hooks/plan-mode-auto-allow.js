// PermissionRequest hook: in plan mode, approve every permission prompt except git push.
let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch (e) { return; }
  if (input.permission_mode !== 'plan') return;
  const command = String((input.tool_input && input.tool_input.command) || '');
  if (/\bgit\s+push\b/.test(command)) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } }
  }));
});
