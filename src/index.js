const { log, askList } = require('./utils');
const featureSync = require('./commands/feature-sync');
const preRelease = require('./commands/pre-release');
const releaseFinish = require('./commands/release-finish');
const featureSyncPro = require('./commands/feature-sync-pro');
const guide = require('./commands/guide');
const pkg = require('../package.json');

function showHelp() {
  log(`\n🌊 Dev Flow CLI v${pkg.version}`, 'cyan');
  log('\nUsage: flow [command] [options]', 'white');
  
  log('\nOptions:', 'yellow');
  log('  -v, --version   查看当前版本', 'white');
  log('  -h, --help      查看帮助信息', 'white');

  log('\nCommands:', 'yellow');
  log('  guide           查看详细的阶段说明', 'white');
  
  log('\n💡 提示：运行 flow 命令开始交互式流程。\n', 'gray');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    log(`v${pkg.version}`, 'green');
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

  log('\n🌊 Dev Flow CLI 开发流程工具', 'cyan');
  log('基于团队规范自动化您的开发工作流。', 'gray');
  log('\n💡 提示：', 'yellow');
  log('   • 使用 flow --help    查看帮助', 'gray');
  log('   • 使用 control + c    退出流程\n', 'gray');

  const choice = await askList('请选择当前工作流阶段：', [
    { name: '阶段 1：特性同步 (将个人分支合并到公共特性分支)', value: 'feature-sync-pro' },
    { name: '阶段 2：预发布 (从公共特性分支创建 Release 分支)', value: 'pre-release' },
    { name: '阶段 3：正式发布 (将 Release 分支合并到 Master 并发版)', value: 'release-finish' },
  ]);

  try {
    switch (choice) {
      // case 'feature-sync':
      //   await featureSync();
      //   break;
      case 'feature-sync-pro':
        await featureSyncPro();
        break;  
      case 'pre-release':
        await preRelease();
        break;
      case 'release-finish':
        await releaseFinish();
        break;
    }
  } catch (error) {
    log(`\n❌ 错误：${error.message}`, 'red');
    process.exit(1);
  }
}

main();
