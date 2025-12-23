const fs = require('fs');
const path = require('path');
const os = require('os');
const { 
  log, 
  text, 
  password, 
  select, 
  intro, 
  outro, 
  note,
  handleCancel,
  execCommand
} = require('../utils');

const CONFIG_PATH = path.join(os.homedir(), '.aicommits');

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config = {};
  content.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      config[key.trim()] = value.trim();
    }
  });
  return config;
}

function writeConfig(config) {
  const content = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  fs.writeFileSync(CONFIG_PATH, content, 'utf8');
}

async function aiConfig() {
  intro('🤖 AI 配置向导');

  // 1. 调用 aicommits 原生配置 (Setup API Key, Model etc.)
  try {
    await execCommand('aicommits setup', { stdio: 'inherit' });
  } catch (e) {
    log.error('配置中断或失败');
    return;
  }

  const currentConfig = readConfig();

  // 2. 补充配置: Commit Type
  const type = await select({
    message: '请选择提交格式 (Type):',
    options: [
      { label: 'Conventional Commits (feat: description)', value: 'conventional' },
      { label: 'Gitmoji (✨ feat: description)', value: 'gitmoji' }
    ],
    initialValue: currentConfig.type || 'conventional'
  });
  handleCancel(type);

  // 3. 补充配置: Generate Count
  const generate = await select({
    message: '每次生成几条候选建议 (Generate):',
    options: [
      { label: '1 条 (节省 Token)', value: '1' },
      { label: '2 条', value: '2' },
      { label: '3 条 (更多选择)', value: '3' },
      { label: '4 条', value: '4' },
      { label: '5 条', value: '5' }
    ],
    initialValue: currentConfig.generate || '1'
  });
  handleCancel(generate);

  // Save
  const newConfig = {
    ...currentConfig,
    type,
    generate
  };

  writeConfig(newConfig);
  
  log.message(`配置已更新:\n- 格式: ${type}\n- 条数: ${generate}`, '✅ 配置保存成功');
  
  outro('现在可以使用 flow ai 或 flow ai-commit 命令了。');
}

function showConfig() {
  const config = readConfig();
  if (Object.keys(config).length === 0) {
    log.warn('未找到 AI 配置文件。请运行 flow ai setup 进行配置。');
    return;
  }
  
  const displayText = Object.entries(config)
    .map(([key, value]) => {
      // Hide API Key
      if (key === 'OPENAI_API_KEY') {
        return `${key}=${value.substring(0, 3)}...${value.substring(value.length - 4)}`;
      }
      return `${key}=${value}`;
    })
    .join('\n');
    
  log.info(`当前 AI 配置:\n${displayText}\n`);
}

module.exports = { aiConfig, showConfig };
