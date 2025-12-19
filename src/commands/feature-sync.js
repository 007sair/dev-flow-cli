const { log, execCommand, askQuestion, askList, askConfirm, getCurrentBranch, checkGitClean, getRemoteFeatBranches } = require('../utils');

async function featureSync() {
  log('\n🚀 开始阶段：特性同步与合并', 'green');

  // 0. 检查工作区状态
  if (!checkGitClean()) {
    log('❌ 工作区有未提交的变更，请先 stash 或 commit。', 'red');
    process.exit(1);
  }

  // 1. 选择个人分支 (保留你原来的逻辑)
  const currentBranch = getCurrentBranch();
  let localBranchChoices = [];
  try {
    const output = execCommand("git for-each-ref --sort=-committerdate --format='%(refname:short)|%(committerdate:relative)|%(subject)' refs/heads/ | head -n 5", { silent: true });
    localBranchChoices = output.split('\n').filter(l => l).map(line => {
      const [branch, date, subject] = line.split('|');
      return { name: `${branch.padEnd(20)} (${date}) - ${subject}`, value: branch };
    });
  } catch (e) {
    const output = execCommand("git branch --format='%(refname:short)'", { silent: true });
    localBranchChoices = output.split('\n').filter(b => b).map(b => ({ name: b, value: b }));
  }
  localBranchChoices.push({ name: '📝 手动输入', value: 'manual' });

  let selectedBranch = await askList('请选择要合并的个人分支：', localBranchChoices, currentBranch);
  if (selectedBranch === 'manual') selectedBranch = await askQuestion('请输入个人分支名称：');
  selectedBranch = selectedBranch.trim();

  // 1.1 确认私有分支性质
  const isPrivateConfirmed = await askConfirm(`确认 ${selectedBranch} 是私有分支（仅由您个人使用）吗？`, true);
  if (!isPrivateConfirmed) {
    log('❌ 此流程仅适用于私有分支。公共协作分支请使用标准合并流程。', 'red');
    process.exit(0);
  }

  if (selectedBranch !== currentBranch) {
    execCommand(`git checkout ${selectedBranch}`);
  }

  // 2. 选择目标公共特性分支
  log('🔄 同步远程分支信息...', 'blue');
  try { execCommand('git fetch origin'); } catch (e) {}
  const remoteFeatChoices = getRemoteFeatBranches();
  remoteFeatChoices.push({ name: '📝 手动输入', value: 'manual' });
  let targetBranch = await askList('请选择目标公共特性分支：', remoteFeatChoices, remoteFeatChoices[0]?.value);
  if (targetBranch === 'manual') targetBranch = await askQuestion('请输入目标分支 (如 feat/1.0.0)：');
  targetBranch = targetBranch.trim();

  // 3. 变基同步 (保持线性历史的基础)
  log(`\n🔄 正在从 origin/${targetBranch} 变基同步...`, 'blue');
  try {
    execCommand(`git fetch origin ${targetBranch}`);
    execCommand(`git rebase origin/${targetBranch}`);
  } catch (error) {
    log('\n⚠️  检测到冲突！请解决冲突后执行 `git rebase --continue`，完成后重新运行此脚本。', 'red');
    process.exit(0); 
  }

  // --- 核心逻辑改进：计算领先提交数 ---
  const aheadCount = parseInt(execCommand(`git rev-list --count origin/${targetBranch}..${selectedBranch}`, { silent: true }).trim());
  log(`\n📊 状态分析：${selectedBranch} 领先 ${targetBranch} 共 ${aheadCount} 个提交。`, 'cyan');

  // 4. 选择合并模式
  const mergeMode = await askList('选择操作模式：', [
    { name: '模式 1：本地直接合并 (推荐)', value: 'local' },
    { name: '模式 2：推送并创建 PR', value: 'pr' },
  ], 'local');

  if (mergeMode === 'pr') {
    log(`\n📤 推送 ${selectedBranch} 到远程...`, 'blue');
    try {
      execCommand(`git push origin ${selectedBranch} --force-with-lease`);
      log(`\n✅ 已推送。请前往仓库创建 PR: ${selectedBranch} -> ${targetBranch}`, 'green');
    } catch (e) {
      log('❌ 推送失败。', 'red');
    }
    return;
  }

  // --- 模式 1: 本地合并逻辑 ---
  log(`\n🔀 准备合并到 ${targetBranch}...`, 'blue');
  execCommand(`git checkout ${targetBranch}`);
  execCommand(`git pull origin ${targetBranch}`);

  let useSquash = false;
  if (aheadCount > 1) {
    log(`\n💡 发现 ${aheadCount} 个碎片化提交。`, 'yellow');
    useSquash = await askConfirm('建议使用 Squash (压缩) 合并以保持公共分支整洁。是否开启？', true);
  } else {
    log('\n✅ 只有 1 个提交，将执行 Fast-forward 合并。', 'green');
    useSquash = false;
  }

  try {
    if (useSquash) {
      // 执行 Squash 合并
      log(`\n🔀 执行 Squash Merge...`, 'yellow');
      execCommand(`git merge --squash ${selectedBranch}`);
      
      let commitMsg = await askQuestion('请输入原子提交信息 (feat: xxx)：');
      if (!commitMsg.trim()) {
        log('❌ 信息不能为空，撤销合并。', 'red');
        execCommand('git reset --hard HEAD');
        process.exit(1);
      }
      execCommand(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    } else {
      // 执行普通合并 (因为刚 rebase 过，这里必然是 Fast-forward)
      execCommand(`git merge ${selectedBranch}`);
    }

    log(`\n📤 正在推送 ${targetBranch} 到远程...`, 'blue');
    execCommand(`git push origin ${targetBranch}`);
    log('\n✅ 合并并推送成功！', 'green');

    // --- 关键风险处理：Squash 后的分支清理 ---
    if (useSquash) {
      log('\n⚠️  重要提示：由于执行了 Squash，原分支历史已与主干断开。', 'red');
      const deleteNow = await askConfirm(`建议立即删除旧分支 ${selectedBranch} 并基于最新主干重建。现在删除？`, true);
      if (deleteNow) {
        // 必须强制删除，因为 Git 认为 squash 合并后的原分支提交并未合并入主干
        execCommand(`git branch -D ${selectedBranch}`);
        log(`🗑️  已删除旧分支。后续请执行 \`git checkout -b new-branch\` 开始新工作。`, 'green');
      } else {
        log(`🚨 请注意：若继续在 ${selectedBranch} 开发，下次同步时会出现重复冲突！`, 'yellow');
      }
    } else {
      // 普通合并无需强删，但询问一下
      const deleteNormal = await askConfirm(`是否删除已合并的分支 ${selectedBranch}？`, false);
      if (deleteNormal) {
        execCommand(`git branch -d ${selectedBranch}`);
        log(`🗑️  已删除分支。`, 'green');
      }
    }

  } catch (e) {
    log(`❌ 操作失败: ${e.message}`, 'red');
    process.exit(1);
  }
}

module.exports = featureSync;