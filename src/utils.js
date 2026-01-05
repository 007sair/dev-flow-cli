const chalk = require('chalk');
const execa = require('execa');
const inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
const Fuse = require('fuse.js');

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

const fuzzySelect = async ({ message, options, initialValue }) => {
  // Transform clack options to inquirer options
  const inquirerOptions = options.map(o => ({
    name: o.label || o.value,
    value: o.value,
    short: o.label || o.value
  }));

  const fuse = new Fuse(inquirerOptions, {
    keys: ['name', 'value'],
    threshold: 0.4
  });

  try {
    const { result } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'result',
        message: message,
        source: async (answersSoFar, input) => {
          if (!input) {
            return inquirerOptions;
          }
          return fuse.search(input).map(r => r.item);
        },
        pageSize: 10
      }
    ]);
    return result;
  } catch (error) {
    if (error.isTtyError) {
      // Prompt couldn't be rendered in the current environment
      log.error('Terminal not supported');
    } else {
      // User cancelled or other error
      // Inquirer doesn't have a clean "cancel" return like clack
      // We'll treat it as exit or rethrow
      if (error.message.includes('User force closed')) {
        process.exit(0);
      }
      throw error;
    }
  }
};

module.exports = {
  intro,
  outro,
  text,
  select,
  fuzzySelect,
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
