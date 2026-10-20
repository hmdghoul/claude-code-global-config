// PermissionRequest hook: in plan mode, approve read tools and shell commands, except git/gh commands that can change state.
const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const READ_ONLY_GIT_SUBCOMMANDS = new Set([
  'status', 'diff', 'log', 'show', 'rev-parse', 'rev-list', 'ls-files', 'ls-tree', 'blame', 'grep',
  'describe', 'shortlog', 'cat-file', 'merge-base', 'show-ref', 'for-each-ref', 'name-rev'
]);
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);
const READ_ONLY_GH_COMMANDS = {
  pr: ['view', 'diff', 'list', 'checks', 'status'],
  issue: ['view', 'list', 'status'],
  repo: ['view', 'list'],
  run: ['view', 'list'],
  release: ['view', 'list'],
  workflow: ['view', 'list']
};

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch (e) { return; }
  if (input.permission_mode !== 'plan') return;
  if (!canAutoApprove(input)) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } }
  }));
});

function canAutoApprove(input) {
  if (READ_ONLY_TOOLS.has(input.tool_name)) {
    return true;
  }
  if (!SHELL_TOOLS.has(input.tool_name)) {
    return false;
  }
  return isShellCommandReadOnlyForGit(String((input.tool_input && input.tool_input.command) || ''));
}

function isShellCommandReadOnlyForGit(command) {
  const tokens = tokenize(command);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.separator) {
      continue;
    }
    const program = token.text.split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, '');
    if (program !== 'git' && program !== 'gh') {
      // A quoted string may be a nested command (bash -c "...", pwsh -Command "..."), so scan it too.
      if (token.quoted && /\s/.test(token.text) && !isShellCommandReadOnlyForGit(token.text)) {
        return false;
      }
      continue;
    }
    const args = argumentsUntilSeparator(tokens, i + 1);
    if (program === 'git' && !isGitCommandReadOnly(args)) {
      return false;
    }
    if (program === 'gh' && !isGhCommandReadOnly(args)) {
      return false;
    }
  }
  return true;
}

function tokenize(command) {
  const pattern = /"((?:[^"\\]|\\.)*)"|'([^']*)'|([;&|(){}`\r\n]+)|([^\s"';&|(){}`]+)/g;
  const tokens = [];
  for (const match of command.matchAll(pattern)) {
    if (match[3] !== undefined) {
      tokens.push({ text: match[3], separator: true });
    } else if (match[4] !== undefined) {
      tokens.push({ text: match[4] });
    } else {
      tokens.push({ text: match[1] !== undefined ? match[1] : match[2], quoted: true });
    }
  }
  return tokens;
}

function argumentsUntilSeparator(tokens, start) {
  const args = [];
  for (let i = start; i < tokens.length && !tokens[i].separator; i++) {
    args.push(tokens[i].text);
  }
  return args;
}

function isGitCommandReadOnly(args) {
  for (let i = 0; i < args.length; i++) {
    if (GIT_OPTIONS_WITH_VALUE.has(args[i])) {
      i++;
      continue;
    }
    if (args[i].startsWith('-')) {
      continue;
    }
    return READ_ONLY_GIT_SUBCOMMANDS.has(args[i]);
  }
  return false;
}

function isGhCommandReadOnly(args) {
  const [group, action] = args;
  if (group === 'api') {
    return isGhApiReadOnly(args.slice(1));
  }
  return Boolean(READ_ONLY_GH_COMMANDS[group] && READ_ONLY_GH_COMMANDS[group].includes(action));
}

function isGhApiReadOnly(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // gh api switches to POST as soon as any field or input body is passed.
    if (/^(-[fF]|--field|--raw-field|--input)/.test(arg)) {
      return false;
    }
    const inlineMethod = arg.match(/^(?:-X|--method=)(.+)$/);
    const method = arg === '-X' || arg === '--method' ? args[i + 1] : inlineMethod && inlineMethod[1];
    if (method && method.toUpperCase() !== 'GET') {
      return false;
    }
  }
  return true;
}
