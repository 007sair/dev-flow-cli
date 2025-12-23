const chalk = require('chalk');
const execa = require('execa');
const { 
  intro, 
  outro, 
  text, 
  select, 
  confirm, 
  password, 
  spinner, 
  log,
  isCancel,
  cancel,
  note
} = require('@clack/prompts');

// 统一处理取消操作
const handleCancel = (value) => {
  if (isCancel(value)) {
    cancel('操作已取消');
    process.exit(0);
  }
  return value;
};

// Async execution for spinners
const execCommand = async (command, options = {}) => {
  try {
    const { stdout } = await execa.command(command, {
      shell: true,
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return stdout;
  } catch (error) {
    if (!options.silent) {
      log.error(error.message);
    }
    throw error;
  }
};

// Sync execution for quick checks
const execCommandSync = (command, options = {}) => {
  try {
    const { stdout } = execa.commandSync(command, {
      shell: true,
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return stdout;
  } catch (error) {
    if (!options.silent) {
      log.error(error.message);
    }
    throw error;
  }
};

const getCurrentBranch = () => {
  try {
    return execCommandSync('git branch --show-current', { silent: true }).trim();
  } catch (e) {
    return null;
  }
};

const checkGitClean = () => {
  try {
    const status = execCommandSync('git status --porcelain', { silent: true });
    if (status.trim()) {
      log.error('工作目录不干净。请提交或暂存更改。');
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

const getRemoteFeatBranches = () => {
  try {
    // List all remote branches
    const output = execCommandSync("git branch -r", { silent: true });
    return output.split('\n')
      .map(b => b.trim())
      .filter(b => b)
      .filter(b => !b.includes('HEAD') && !b.includes('origin/master') && !b.includes('origin/main') && !b.includes('origin/release'))
      .map(b => {
        const name = b.replace('origin/', '');
        return { label: name, value: name };
      });
  } catch (e) {
    return [];
  }
};

const checkAiConfigured = () => {
  try {
    const output = execCommandSync('aicommits config', { silent: true });
    return output.includes('API Key');
  } catch (e) {
    return false;
  }
};

module.exports = {
  intro,
  outro,
  text,
  select,
  confirm,
  password,
  spinner,
  log,
  note,
  handleCancel,
  execCommand,
  execCommandSync,
  getCurrentBranch,
  checkGitClean,
  getRemoteFeatBranches,
  checkAiConfigured,
  chalk // exporting chalk just in case
};
