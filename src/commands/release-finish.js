const { log, execCommand, select, handleCancel, spinner, note } = require('../utils');

async function releaseFinish() {
  // 1. List release branches
  const s = spinner();
  s.start('获取远程 release 分支...');
  try {
    await execCommand('git fetch --all', { silent: true });
    s.stop('分支信息同步完成');
  } catch (e) {
    s.stop('分支信息同步失败', 1);
  }
  
  // Get remote release branches
  let branches = [];
  try {
    const branchesOutput = (await execCommand('git branch -r | grep "origin/release/"', { silent: true }));
    if (branchesOutput) {
      branches = branchesOutput.split('\n')
        .map(b => b.trim())
        .filter(b => b)
        .map(b => b.replace('origin/', ''));
    }
  } catch (e) {
    // grep returns exit code 1 if no matches found
  }

  if (branches.length === 0) {
    log.error('❌ 远程未找到以 release/ 开头的分支。');
    process.exit(1);
  }

  // 2. Select Branch
  const selectedBranch = await select({
    message: '选择要完成发布的 release 分支',
    options: branches.map(b => ({ label: b, value: b }))
  });
  handleCancel(selectedBranch);

  // 3. Checkout
  s.start(`检出 ${selectedBranch}...`);
  try {
    await execCommand(`git checkout ${selectedBranch}`, { silent: true });
    await execCommand(`git pull origin ${selectedBranch}`, { silent: true });
    s.stop(`已检出 ${selectedBranch}`);
  } catch(e) {
    s.stop('检出失败', 1);
    throw e;
  }

  // 4. Extract version
  const versionMatch = selectedBranch.match(/release\/v?(\d+\.\d+\.\d+.*)/);
  if (!versionMatch) {
    throw new Error(`无法从分支名解析版本号 ${selectedBranch}`);
  }
  const version = versionMatch[1];
  
  // 5. Standard Version
  s.start(`运行 standard-version (v${version})...`);
  try {
    // standard-version bumps package.json, changelog, commit, tag
    await execCommand(`npx standard-version --release-as ${version}`, { silent: true });
    s.stop('版本发布完成');
  } catch (e) {
    s.stop('Standard-version 运行失败', 1);
    throw e;
  }

  // 6. Push
  s.start('推送变更和标签...');
  try {
    await execCommand(`git push --follow-tags origin ${selectedBranch}`, { silent: true });
    s.stop('推送成功');
  } catch (e) {
    s.stop('推送失败', 1);
    throw e;
  }

  log.success(`分支：${selectedBranch}\n操作：\n1. 请创建 Pull Request: ${selectedBranch} -> master\n2. 合并后记得删除 ${selectedBranch} 和对应 feat 分支`, '✅ 发布准备就绪');
}

module.exports = releaseFinish;
