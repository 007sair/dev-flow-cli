const { log, select, execCommandSync, intro, outro, handleCancel } = require('./utils');
const preRelease = require('./commands/pre-release');
const releaseFinish = require('./commands/release-finish');
const featureSyncPro = require('./commands/feature-sync-pro');
const aiCommitPro = require('./commands/ai-commit-pro');
const { aiConfig, showConfig } = require('./commands/ai-config');
const guide = require('./commands/guide');
const pkg = require('../package.json');
const chalk = require('chalk');

function showHelp() {
  log.info(`🌊 Dev Flow CLI v${pkg.version}`);
  log.warn('使用方法:');
  log.message('  flow [command] [options]');
  
  log.warn('选项:');
  log.message('  -v, --version       查看当前版本');
  log.message('  -h, --help          查看帮助信息');

  log.warn('核心命令:');
  log.message('  ai                  AI 智能提交 (交互式生成)');
  log.message('  ai setup            配置 AI 助手 (API Key, 语言, 格式等)');
  log.message('  ai config           查看当前 AI 配置');
  
  log.warn('交互式流程:');
  log.message('  flow                启动交互式工作流向导 (推荐)');
  
  log.warn('文档:');
  log.message('  guide               查看详细的规范说明');
  
  log.message(chalk.gray('\n💡 提示：支持直接运行 flow ai -c -g 3 等 aicommits 原生参数'));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`v${pkg.version}`);
    process.exit(0);
  }

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (args[0] === 'guide') {
    guide();
    process.exit(0);
  }

  if (args[0] === 'ai') {
    const subCmd = args[1];

    // 优先拦截 setup 和 config
    if (subCmd === 'setup') {
      await aiConfig();
      process.exit(0);
    }
    
    if (subCmd === 'config') {
      showConfig();
      process.exit(0);
    }

    // 收集 flow ai 之后的所有参数
    const subArgs = args.slice(1).join(' ');
    
    // 如果有参数，直接透传给 aicommits
    // 这样可以支持 flow ai -c -g 3 这样的用法
    if (subArgs.length > 0) {
      try {
        execCommandSync(`aicommits ${subArgs}`);
      } catch (e) {
        process.exit(1);
      }
    } else {
      // 无参数时，执行默认的 aiCommitPro 流程
      await aiCommitPro();
    }
    process.exit(0);
  }

  // 交互式流程开始
  console.clear();
  intro(chalk.bgCyan(chalk.black(' Dev Flow CLI ')));

  const choice = await select({
    message: '请选择当前工作流阶段',
    options: [
      { label: 'AI 智能提交', value: 'ai-commit', hint: '生成 Commit Message' },
      { label: '特性同步', value: 'feature-sync-pro', hint: '个人分支 -> 公共特性分支' },
      { label: '预发布', value: 'pre-release', hint: '特性分支 -> Release 分支' },
      { label: '正式发布', value: 'release-finish', hint: 'Release -> Master' },
      { label: 'AI 配置', value: 'ai-config', hint: '设置 API Key 等' },
    ]
  });
  handleCancel(choice);

  try {
    switch (choice) {
      case 'ai-commit':
        await aiCommitPro();
        break;
      case 'feature-sync-pro':
        await featureSyncPro();
        break;  
      case 'pre-release':
        await preRelease();
        break;
      case 'release-finish':
        await releaseFinish();
        break;
      case 'ai-config':
        await aiConfig();
        break;
    }
    
    outro('操作完成 ✨');
  } catch (error) {
    log.error(`❌ 错误：${error.message}`);
    process.exit(1);
  }
}

main();
