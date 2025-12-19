const { log, execCommand, askList } = require('../utils');

async function releaseFinish() {
  log('\n🚀 开始阶段 3：正式发布', 'cyan');

  // 1. List release branches
  log('获取远程分支...', 'gray');
  execCommand('git fetch --all');
  
  // Get remote release branches
  let branches = [];
  try {
    const branchesOutput = execCommand('git branch -r | grep "origin/release/"', { silent: true });
    if (branchesOutput) {
      branches = branchesOutput.split('\n')
        .map(b => b.trim())
        .filter(b => b)
        .map(b => b.replace('origin/', ''));
    }
  } catch (e) {
    // grep returns exit code 1 if no matches found, which execCommand throws
    log('未找到远程 release 分支。', 'yellow');
  }

  if (branches.length === 0) {
    log('远程未找到以 release/ 开头的分支。', 'red');
    process.exit(1);
  }

  // 2. Select Branch
  const selectedBranch = await askList('选择要完成发布的 release 分支：', branches);

  // 3. Checkout
  log(`\n🔀 检出 ${selectedBranch}...`, 'blue');
  execCommand(`git checkout ${selectedBranch}`);
  execCommand(`git pull origin ${selectedBranch}`);

  // 4. Extract version
  // Expected format: release/v1.2.3
  const versionMatch = selectedBranch.match(/release\/v?(\d+\.\d+\.\d+.*)/);
  if (!versionMatch) {
    throw new Error(`无法从分支名解析版本号 ${selectedBranch}`);
  }
  const version = versionMatch[1];
  log(`检测到版本：${version}`, 'yellow');

  // 5. Standard Version
  log(`\n📦 运行 standard-version (release-as ${version})...`, 'blue');
  // standard-version bumps package.json, changelog, commit, tag
  execCommand(`npx standard-version --release-as ${version}`);

  // 6. Push
  log('\n📤 推送变更和标签...', 'blue');
  execCommand(`git push --follow-tags origin ${selectedBranch}`);

  log('\n✅ 发布分支已准备就绪并打标。', 'green');
  log(`👉 现在前往 Git 平台创建 Pull Request：`, 'green');
  log(`   ${selectedBranch} -> master`, 'cyan');

  log('\n⚠️  重要提示：上线完成后，请记得清理分支！', 'yellow');
  log(`   1. 删除公共特性分支 (feat/v${version})`, 'gray');
  log(`   2. 删除发布分支 (${selectedBranch})`, 'gray');
  log('   保持仓库整洁是个好习惯。', 'gray');
  
  // Optional: Delete branch after merge?
  // Usually done after merge in the web UI.
}

module.exports = releaseFinish;
