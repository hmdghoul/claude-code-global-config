// PermissionRequest hook: in plan mode, approve read tools and shell commands made only of read-only programs.
const { parseSegments, isGitCommandReadOnly, isGhCommandReadOnly, readHookInput } = require('./shell-tokens');

const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const READ_ONLY_PROGRAMS = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'sort', 'uniq', 'cut', 'tr', 'diff', 'cmp',
  'file', 'stat', 'du', 'df', 'pwd', 'echo', 'printf', 'which', 'type', 'whoami', 'date', 'basename', 'dirname',
  'realpath', 'readlink', 'tree', 'jq', 'od', 'true', 'false', 'test', '[', '[[', ':', 'cd', 'pushd', 'popd', 'find',
  'get-childitem', 'gci', 'dir', 'get-content', 'gc', 'select-string', 'sls', 'test-path', 'get-item', 'gi',
  'get-itemproperty', 'resolve-path', 'split-path', 'join-path', 'get-location', 'set-location', 'sl', 'get-command',
  'gcm', 'where', 'where-object', '?', 'select-object', 'select', 'sort-object', 'measure-object', 'measure',
  'group-object', 'format-table', 'ft', 'format-list', 'fl', 'out-string', 'convertfrom-json', 'convertto-json',
  'get-date', 'get-filehash', 'compare-object', 'foreach-object', '%', 'write-output', 'write-host'
]);
const FIND_WRITE_ACTIONS = new Set(['-delete', '-exec', '-execdir', '-ok', '-okdir', '-fprint', '-fprint0', '-fprintf', '-fls']);
const DISCARD_TARGETS = new Set(['/dev/null', '$null', 'nul']);

if (require.main === module) {
  readHookInput(input => {
    if (input.permission_mode !== 'plan' || !canAutoApprove(input)) {
      return null;
    }
    return { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } };
  });
}

function canAutoApprove(input) {
  if (READ_ONLY_TOOLS.has(input.tool_name)) {
    return true;
  }
  if (!SHELL_TOOLS.has(input.tool_name)) {
    return false;
  }
  return isShellCommandReadOnly(String((input.tool_input && input.tool_input.command) || ''));
}

function isShellCommandReadOnly(command) {
  return parseSegments(command).every(isSegmentReadOnly);
}

function isSegmentReadOnly(segment) {
  if (!segment.redirects.every(redirect => redirect.target === null || DISCARD_TARGETS.has(redirect.target.toLowerCase()))) {
    return false;
  }
  if (segment.kind === 'empty' || segment.kind === 'header') {
    return true;
  }
  if (segment.kind === 'expression') {
    const callsMethod = segment.terminator !== null && segment.terminator.startsWith('(');
    const invokedAsCommand = segment.precededBy !== null && /(^|[^&])&$/.test(segment.precededBy);
    return !callsMethod && !invokedAsCommand;
  }
  if (segment.inlineCode !== null) {
    return true;
  }
  if (segment.program === 'git') {
    return isGitCommandReadOnly(segment.args);
  }
  if (segment.program === 'gh') {
    return isGhCommandReadOnly(segment.args);
  }
  if (segment.program === 'find') {
    return !segment.args.some(arg => FIND_WRITE_ACTIONS.has(arg));
  }
  if (segment.program === 'sort') {
    return !segment.args.some(arg => arg === '-o' || arg.startsWith('--output'));
  }
  return READ_ONLY_PROGRAMS.has(segment.program);
}

module.exports = { canAutoApprove };
