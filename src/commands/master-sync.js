const { 
  log, 
  execCommand, 
  select, 
  confirm,
  handleCancel,
  getCurrentBranch, 
  checkGitClean, 
  spinner
} = require('../utils');

async function masterSync() {
  // 0. 基础环境检查
  if (!checkGitClean()) {
    process.exit(1);
  }

  const currentBranch = getCurrentBranch();

  // 1. 确认当前分支
  log.info(`当前分支: ${currentBranch}`);
  
  // 2. 确认分支类型（决定同步策略）
  const branchType = await select({
    message: '请确认当前分支类型',
    options: [
      { label: '公共协作分支 (Public)', value: 'public', hint: '使用 Merge 策略，保留历史轨迹' },
      { label: '个人独占分支 (Private)', value: 'private', hint: '使用 Rebase 策略，保持线性历史' }
    ]
  });
  handleCancel(branchType);

  // 3. 确定主干分支名称 (尝试探测 master 或 main)
  let masterBranch = 'master';
  try {
    const branches = await execCommand('git branch -r', { silent: true });
    if (branches.includes('origin/main')) {
      masterBranch = 'main';
    }
  } catch (e) {
    // default to master
  }

  const s = spinner();
  
  // 4. 同步远程主干
  s.start(`正在拉取远程 ${masterBranch}...`);
  try {
    await execCommand(`git fetch origin ${masterBranch}`, { silent: true });
    s.stop('拉取完成');
  } catch (e) {
    s.stop('拉取失败', 1);
    log.error(e.message);
    process.exit(1);
  }

  // 5. 执行同步
  if (branchType === 'public') {
    // 策略 A: Merge
    s.start(`正在将 origin/${masterBranch} 合并到当前分支...`);
    try {
      await execCommand(`git merge origin/${masterBranch}`, { silent: true });
      s.stop('合并成功');
      log.success(`✅ 已成功将主干代码 Merge 到 ${currentBranch}`);
      
      // 提示推送
      log.info(`提示: 请运行 git push origin ${currentBranch} 更新远程分支。`);
    } catch (e) {
      s.stop('合并冲突', 1);
      log.warn(`⚠️  合并过程中发生冲突。\n请手动解决冲突后，运行:\n  git add .\n  git commit`, '冲突处理');
      process.exit(0);
    }
  } else {
    // 策略 B: Rebase
    s.start(`正在将当前分支变基到 origin/${masterBranch}...`);
    try {
      await execCommand(`git rebase origin/${masterBranch}`, { silent: true });
      s.stop('变基成功');
      log.success(`✅ 已成功将 ${currentBranch} 变基到最新主干`);
      
      // 提示强推
      log.info(`提示: 由于执行了 Rebase，你需要强制推送:\n  git push origin ${currentBranch} --force-with-lease`, '⚠️  推送提示');
    } catch (e) {
      s.stop('变基冲突', 1);
      log.warn(`⚠️  变基过程中发生冲突。\n请手动解决冲突后，运行:\n  git add .\n  git rebase --continue`, '冲突处理');
      process.exit(0);
    }
  }
}

module.exports = masterSync;
