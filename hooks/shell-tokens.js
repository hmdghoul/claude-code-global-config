'use strict';

const READ_ONLY_GIT_SUBCOMMANDS = new Set([
  'status', 'diff', 'log', 'show', 'rev-parse', 'rev-list', 'ls-files', 'ls-tree', 'blame', 'grep',
  'describe', 'shortlog', 'cat-file', 'merge-base', 'show-ref', 'for-each-ref', 'name-rev',
  'ls-remote', 'check-ignore', 'count-objects', 'version'
]);
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);
const BRANCH_LIST_FORM = {
  listFlags: ['-l', '--list'],
  writeShort: 'dDmMcCfut',
  writeLong: ['--delete', '--move', '--copy', '--force', '--set-upstream-to', '--unset-upstream', '--edit-description',
    '--track', '--no-track', '--create-reflog', '--recurse-submodules'],
  valueOptions: ['--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format']
};
const TAG_LIST_FORM = {
  listFlags: ['-l', '--list'],
  writeShort: 'asufdmFe',
  writeLong: ['--annotate', '--sign', '--local-user', '--force', '--delete', '--message', '--file', '--edit',
    '--create-reflog', '--cleanup', '--trailer'],
  valueOptions: ['--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format']
};
const GIT_CONFIG_READ_FLAGS = ['--get', '--get-all', '--get-regexp', '--get-urlmatch', '--get-color', '--get-colorbool', '--list', '-l'];
const GIT_CONFIG_WRITE_FLAGS = ['--unset', '--unset-all', '--add', '--replace-all', '--edit', '-e', '--rename-section', '--remove-section'];
const GIT_LIST_FORM_CHECKS = {
  branch: rest => isListForm(rest, BRANCH_LIST_FORM),
  tag: rest => isListForm(rest, TAG_LIST_FORM),
  remote: rest => {
    const args = rest.filter(arg => arg !== '-v' && arg !== '--verbose');
    return args.length === 0 || args[0] === 'show' || args[0] === 'get-url';
  },
  reflog: rest => rest.length === 0 || !['expire', 'delete', 'drop'].includes(rest[0]),
  worktree: rest => rest[0] === 'list',
  stash: rest => rest[0] === 'list' || rest[0] === 'show',
  config: rest => {
    if (rest[0] === 'get' || rest[0] === 'list') {
      return true;
    }
    return rest.some(arg => GIT_CONFIG_READ_FLAGS.includes(arg)) && !rest.some(arg => GIT_CONFIG_WRITE_FLAGS.includes(arg));
  }
};
const READ_ONLY_GH_COMMANDS = {
  pr: ['view', 'diff', 'list', 'checks', 'status'],
  issue: ['view', 'list', 'status'],
  repo: ['view', 'list'],
  run: ['view', 'list'],
  release: ['view', 'list'],
  workflow: ['view', 'list'],
  label: ['list'],
  auth: ['status'],
  search: ['repos', 'issues', 'prs', 'commits', 'code']
};
const GH_INFO_ARGS = new Set(['--version', 'version', '--help', 'help']);
const SHELL_WRAPPERS = new Set(['bash', 'sh', 'zsh', 'powershell', 'pwsh', 'cmd', 'iex', 'invoke-expression']);
const COMMAND_PREFIXES = new Set(['sudo', 'command', 'builtin', 'env', 'nohup', 'time', 'exec', 'xargs', '!',
  'do', 'then', 'else', 'elif', 'elseif', 'if', 'while', 'until', 'try', 'catch', 'finally', 'return']);
const LOOP_HEADERS = new Set(['for', 'foreach', 'select', 'case', 'function']);

// Redirects get their own token so `git log > f` is not read as `git log`.
const TOKEN_PATTERN = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(#[^\r\n]*)|([;&|(){}`\r\n]+)|([\d*]?>>?(?:&\d)?)|([^\s"';&|(){}`>]+)/g;

function tokenize(command) {
  const tokens = [];
  for (const match of command.matchAll(TOKEN_PATTERN)) {
    if (match[1] !== undefined) {
      tokens.push({ text: match[1], quoted: true, doubleQuoted: true });
    } else if (match[2] !== undefined) {
      tokens.push({ text: match[2], quoted: true });
    } else if (match[3] !== undefined) {
      continue;
    } else if (match[4] !== undefined) {
      tokens.push({ text: match[4], separator: true });
    } else if (match[5] !== undefined) {
      tokens.push({ text: match[5], redirect: true });
    } else {
      tokens.push({ text: match[6] });
    }
  }
  return tokens;
}

function parseSegments(command) {
  const segments = [];
  let group = { precededBy: null, tokens: [] };
  const groups = [group];
  for (const token of tokenize(command)) {
    if (token.separator) {
      group.terminator = token.text;
      group = { precededBy: token.text, tokens: [] };
      groups.push(group);
    } else {
      group.tokens.push(token);
    }
  }
  for (const { precededBy, tokens, terminator } of groups) {
    const segment = buildSegment(tokens, precededBy, terminator || null);
    segments.push(segment);
    for (const token of tokens) {
      // Double quotes still expand $(...) and backticks, so the inner text runs as commands.
      if (token.doubleQuoted && /\$\(|`/.test(token.text)) {
        segments.push(...parseSegments(token.text));
      }
    }
    if (segment.inlineCode !== null) {
      segments.push(...parseSegments(segment.inlineCode));
    }
  }
  return segments;
}

function buildSegment(tokens, precededBy, terminator) {
  const words = [];
  const redirects = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].redirect) {
      words.push(tokens[i]);
      continue;
    }
    const duplicatesStream = /&\d$/.test(tokens[i].text);
    redirects.push({ op: tokens[i].text, target: duplicatesStream ? null : (tokens[i + 1] ? tokens[i + 1].text : '') });
    if (!duplicatesStream) {
      i++;
    }
  }
  const segment = { kind: 'empty', program: null, args: [], redirects, precededBy, terminator, inlineCode: null };
  stripCommandPrefixes(words);
  if (words.length === 0) {
    return segment;
  }
  if (LOOP_HEADERS.has(words[0].text.toLowerCase())) {
    segment.kind = 'header';
    return segment;
  }
  segment.args = words.slice(1).map(word => word.text);
  if (!words[0].quoted && /^[$@]/.test(words[0].text)) {
    segment.kind = 'expression';
    segment.program = words[0].text;
    return segment;
  }
  segment.kind = 'command';
  segment.program = programName(words[0].text);
  if (SHELL_WRAPPERS.has(segment.program)) {
    segment.inlineCode = wrapperCode(segment.program, segment.args);
  }
  return segment;
}

function stripCommandPrefixes(words) {
  while (words.length > 0) {
    const word = words[0];
    if (!word.quoted && COMMAND_PREFIXES.has(word.text.toLowerCase())) {
      words.shift();
      while (words.length > 0 && !words[0].quoted && /^-./.test(words[0].text)) {
        words.shift();
      }
    } else if (!word.quoted && /^[A-Za-z_]\w*=/.test(word.text)) {
      words.shift();
    } else if (!word.quoted && /^\$[\w:]+$/.test(word.text) && words[1] && /^[+-]?=$/.test(words[1].text)) {
      words.splice(0, 2);
    } else {
      return;
    }
  }
}

function programName(text) {
  return text.split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, '');
}

function wrapperCode(program, args) {
  if (program === 'iex' || program === 'invoke-expression') {
    return args.length > 0 ? args.join(' ') : null;
  }
  if (program === 'cmd') {
    const index = args.findIndex(arg => /^\/[ck]$/i.test(arg));
    return index === -1 ? null : args.slice(index + 1).join(' ');
  }
  if (program === 'powershell' || program === 'pwsh') {
    const encoded = args.findIndex(arg => /^-(e|ec|encodedcommand)$/i.test(arg));
    if (encoded !== -1 && args[encoded + 1]) {
      return Buffer.from(args[encoded + 1], 'base64').toString('utf16le');
    }
    const index = args.findIndex(arg => /^-(c|command)$/i.test(arg));
    return index === -1 ? null : args.slice(index + 1).join(' ');
  }
  const index = args.findIndex(arg => /^-[a-z]*c[a-z]*$/.test(arg));
  return index === -1 || args[index + 1] === undefined ? null : args[index + 1];
}

function parseGitInvocation(args) {
  const invocation = { subcommand: null, rest: [], chdirs: [], gitDir: null, workTree: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (GIT_OPTIONS_WITH_VALUE.has(arg)) {
      recordGitLocation(invocation, arg, args[i + 1]);
      i++;
      continue;
    }
    const inline = arg.match(/^(--git-dir|--work-tree)=(.*)$/);
    if (inline) {
      recordGitLocation(invocation, inline[1], inline[2]);
      continue;
    }
    if (arg.startsWith('-')) {
      continue;
    }
    invocation.subcommand = arg;
    invocation.rest = args.slice(i + 1);
    return invocation;
  }
  return invocation;
}

function recordGitLocation(invocation, option, value) {
  if (value === undefined) {
    return;
  }
  if (option === '-C') {
    invocation.chdirs.push(value);
  } else if (option === '--git-dir') {
    invocation.gitDir = value;
  } else if (option === '--work-tree') {
    invocation.workTree = value;
  }
}

function isGitCommandReadOnly(args) {
  const { subcommand, rest } = parseGitInvocation(args);
  if (subcommand === null) {
    return args.includes('--version');
  }
  if (READ_ONLY_GIT_SUBCOMMANDS.has(subcommand)) {
    return true;
  }
  const check = GIT_LIST_FORM_CHECKS[subcommand];
  return Boolean(check && check(rest));
}

function isListForm(rest, rule) {
  const listing = rest.some(arg => rule.listFlags.includes(arg));
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (rule.valueOptions.includes(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith('--')) {
      if (rule.writeLong.includes(arg.split('=')[0])) {
        return false;
      }
      continue;
    }
    if (arg.startsWith('-') && arg.length > 1) {
      if ([...arg.slice(1)].some(flag => rule.writeShort.includes(flag))) {
        return false;
      }
      continue;
    }
    if (!listing) {
      return false;
    }
  }
  return true;
}

function isGhCommandReadOnly(args) {
  const [group, action] = args;
  if (group === undefined || GH_INFO_ARGS.has(group)) {
    return true;
  }
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

function readHookInput(handle) {
  let raw = '';
  process.stdin.on('data', chunk => (raw += chunk));
  process.stdin.on('end', () => {
    let input;
    try { input = JSON.parse(raw || '{}'); } catch (e) { return; }
    const output = handle(input);
    if (output) {
      process.stdout.write(JSON.stringify(output));
    }
  });
}

module.exports = {
  tokenize, parseSegments, parseGitInvocation, isGitCommandReadOnly, isGhCommandReadOnly, readHookInput
};
