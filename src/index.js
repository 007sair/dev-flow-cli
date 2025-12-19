const { log, askList } = require('./utils');
const featureSync = require('./commands/feature-sync');
const preRelease = require('./commands/pre-release');
const releaseFinish = require('./commands/release-finish');
const pkg = require('../package.json');

function showHelp() {
  log('\n🌊 Dev Flow CLI 使用说明', 'cyan');

  log('=========================================', 'gray');
  
  log('\n📌 阶段 1：特性同步 (feature-sync)', 'green');
  log('   将个人开发分支合并到公共特性分支。', 'white');
  log('   步骤：', 'gray');
  log('   1. 检查工作区状态是否干净', 'gray');
  log('   2. 选择最近的个人开发分支 (按提交时间排序)', 'gray');
  log('   3. 选择目标公共特性分支 (feat/*)', 'gray');
  log('   4. 拉取远程代码并变基/合并', 'gray');
  log('   5. 选择合并模式 (默认本地线性合并)', 'gray');
  log('   6. 推送合并后的代码并（可选）清理本地分支', 'gray');

  log('\n📌 阶段 2：预发布 (pre-release)', 'green');
  log('   从公共特性分支创建 Release 分支，准备发版。', 'white');
  log('   步骤：', 'gray');
  log('   1. 同步远程分支信息', 'gray');
  log('   2. 选择公共特性分支 (feat/*)', 'gray');
  log('   3. 确定发布版本号 (Major/Minor/Patch)', 'gray');
  log('   4. 创建 release 分支 (release/v*)', 'gray');
  log('   5. 将 release 分支推送到远程', 'gray');

  log('\n📌 阶段 3：正式发布 (release-finish)', 'green');
  log('   完成发布流程，生成 Changelog 并合并到主分支。', 'white');
  log('   步骤：', 'gray');
  log('   1. 获取远程所有 release 分支', 'gray');
  log('   2. 选择要发布的 release 分支', 'gray');
  log('   3. 运行 standard-version 生成 Changelog 和 Tag', 'gray');
  log('   4. 推送分支和 Tag 到远程', 'gray');
  log('   5. 提示用户发起 Pull Request 合并到 master', 'gray');
  
  log('\n💡 提示：运行 flow 命令开始交互式流程。', 'yellow');
}

async function main() {
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    log(`v${pkg.version}`, 'green');
    process.exit(0);
  }

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  log('\n🌊 Dev Flow CLI 开发流程工具', 'cyan');
  log('基于团队规范自动化您的开发工作流。', 'gray');
  log('\n💡 提示：', 'yellow');
  log('   • 使用 flow --help    查看每个阶段的事情', 'gray');
  log('   • 使用 flow --version 查看当前版本', 'gray');
  log('   • 使用 control + c    退出流程\n', 'gray');

  const choice = await askList('请选择当前工作流阶段：', [
    { name: '阶段 1：特性同步 (将个人分支合并到公共特性分支)', value: 'feature-sync' },
    { name: '阶段 2：预发布 (从公共特性分支创建 Release 分支)', value: 'pre-release' },
    { name: '阶段 3：正式发布 (将 Release 分支合并到 Master 并发版)', value: 'release-finish' },
  ]);

  try {
    switch (choice) {
      case 'feature-sync':
        await featureSync();
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
