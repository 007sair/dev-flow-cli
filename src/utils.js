const chalk = require('chalk');
const execa = require('execa');
const inquirer = require('inquirer');

const log = (msg, color = 'white') => {
  if (chalk[color]) {
    console.log(chalk[color](msg));
  } else {
    console.log(msg);
  }
};

const execCommand = (command, options = {}) => {
  try {
    const { stdout } = execa.commandSync(command, {
      shell: true,
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return stdout;
  } catch (error) {
    if (!options.silent) {
      log(`命令执行失败：${command}`, 'red');
      log(error.message, 'red');
    }
    throw error;
  }
};

const askQuestion = async (message) => {
  const { answer } = await inquirer.prompt([
    {
      type: 'input',
      name: 'answer',
      message,
    },
  ]);
  return answer;
};

const askList = async (message, choices, defaultVal) => {
  const { answer } = await inquirer.prompt([
    {
      type: 'list',
      name: 'answer',
      message,
      choices,
      default: defaultVal,
    },
  ]);
  return answer;
};

const askConfirm = async (message, defaultVal = true) => {
  const { answer } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'answer',
      message,
      default: defaultVal,
    },
  ]);
  return answer;
};

const getCurrentBranch = () => {
  try {
    return execCommand('git branch --show-current', { silent: true }).trim();
  } catch (e) {
    return null;
  }
};

const checkGitClean = () => {
  try {
    const status = execCommand('git status --porcelain', { silent: true });
    if (status.trim()) {
      log('❌ 工作目录不干净。请提交或暂存更改。', 'red');
      log(status, 'yellow');
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

const getRemoteFeatBranches = () => {
  try {
    const output = execCommand("git for-each-ref --sort=-committerdate --format='%(refname:short)|%(committerdate:relative)|%(subject)' refs/remotes/origin/feat/ | head -n 5", { silent: true });
    return output.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const [fullBranch, date, subject] = line.split('|');
        const branchName = fullBranch.replace('origin/', '');
        return {
          name: `${branchName.padEnd(20)} (${date}) - ${subject}`,
          value: branchName
        };
      });
  } catch (e) {
    return [];
  }
};

module.exports = {
  log,
  execCommand,
  askQuestion,
  askList,
  askConfirm,
  getCurrentBranch,
  checkGitClean,
  getRemoteFeatBranches,
};
