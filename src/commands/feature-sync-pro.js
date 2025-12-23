/**
 * 🚀 Git 同步工具
 */

const { 
  log, 
  execCommand, 
  text,
  select,
  confirm,
  handleCancel,
  getCurrentBranch, 
  checkGitClean, 
  getRemoteFeatBranches,
  checkAiConfigured,
  spinner,
  note
} = require('../utils');
const aiCommitPro = require('./ai-commit-pro');

async function featureSyncFinal() {
  // 0. 基础环境检查
  if (!checkGitClean()) {
    process.exit(1);
  }

  // 1. 分支识别
  const currentBranch = getCurrentBranch();
  let localBranchChoices = [];
  try {
    // Fetch top 20 recent branches to ensure we have enough after filtering
    const output = await execCommand("git for-each-ref --sort=-committerdate --format='%(refname:short)|%(committerdate:relative)|%(subject)' refs/heads/ | head -n 20", { silent: true });
    localBranchChoices = output.split('\n')
      .filter(l => l)
      .map(line => {
        const [branch, date, subject] = line.split('|');
        return { 
          label: `${branch.padEnd(20)} (${date}) - ${subject}`, 
          value: branch,
          // Store raw branch name for filtering
          rawBranch: branch 
        };
      })
      .filter(item => {
        const b = item.rawBranch;
        return b !== 'master' && b !== 'main' && !b.startsWith('release/');
      })
      .slice(0, 5) // Take top 5 after filtering
      .map(item => ({ label: item.label, value: item.value })); // Clean up object
  } catch (e) {
    const output = await execCommand("git branch --format='%(refname:short)'", { silent: true });
    localBranchChoices = output.split('\n').filter(b => b).map(b => ({ label: b, value: b }));
  }
  localBranchChoices.push({ label: '📝 手动输入名称', value: 'manual' });

  let selectedBranch = await select({
    message: '请选择您的个人开发分支',
    options: localBranchChoices,
    initialValue: currentBranch
  });
  handleCancel(selectedBranch);

  if (selectedBranch === 'manual') {
    selectedBranch = await text({
      message: '请输入分支名称'
    });
    handleCancel(selectedBranch);
  }
  selectedBranch = selectedBranch.trim();

  // 【安全锁】确认私有性
  const isPrivate = await confirm({
    message: `确认 ${selectedBranch} 是【个人独占】分支吗？(多人协作分支压缩会导致冲突)`,
    initialValue: true
  });
  handleCancel(isPrivate);

  if (!isPrivate) {
    log.error('中止操作。多人协作分支请使用常规 merge。');
    process.exit(0);
  }

  // 2. 确定目标公共分支
  const s = spinner();
  s.start('正在同步远程仓库信息...');
  try { await execCommand('git fetch origin', { silent: true }); } catch (e) {}
  s.stop('远程信息同步完成');
  
  const remoteFeatBranches = getRemoteFeatBranches();
  remoteFeatBranches.push({ label: '📝 手动输入', value: 'manual' });
  
  let targetBranch = await select({
    message: '请选择目标公共特性分支 (Target)',
    options: remoteFeatBranches,
    initialValue: remoteFeatBranches[0]?.value
  });
  handleCancel(targetBranch);

  if (targetBranch === 'manual') {
    targetBranch = await text({
      message: '请输入目标分支 (如 feat/1.0.0)'
    });
    handleCancel(targetBranch);
  }
  targetBranch = targetBranch.trim();

  // 切换到开发分支
  if (getCurrentBranch() !== selectedBranch) {
    await execCommand(`git checkout ${selectedBranch}`, { silent: true });
  }

  // 3. 步骤 1：变基同步
  s.start(`正在从 origin/${targetBranch} 变基...`);
  try {
    await execCommand(`git fetch origin ${targetBranch}`, { silent: true });
    await execCommand(`git rebase origin/${targetBranch}`, { silent: true });
    s.stop('变基完成');
  } catch (error) {
    s.stop('变基冲突', 1);
    log.warn('您的代码与公共分支存在逻辑冲突，请手动解决：\n1. 解冲突 -> 2. git add . -> 3. git rebase --continue', '⚠️  冲突处理');
    process.exit(0);
  }

  // 4. 步骤 2：智能历史压缩
  const aheadCount = parseInt((await execCommand(`git rev-list --count origin/${targetBranch}..${selectedBranch}`, { silent: true })).trim());
  
  if (aheadCount === 0) {
    log.success('✅ 分支已是最新，无须同步。');
    return;
  }

  if (aheadCount > 1) {
    log.warn(`📦 检测到 ${aheadCount} 个提交记录，准备打包...`);
    
    try {
      await execCommand(`git reset --soft origin/${targetBranch}`, { silent: true });

      const hasChanges = (await execCommand('git diff --cached --name-only', { silent: true })).trim();

      if (!hasChanges) {
        log.success('✅ 内容一致，无需新提交。');
      } else {
        let committed = false;
        
        // AI 提交介入
        if (checkAiConfigured()) {
          const aiResult = await aiCommitPro();
          if (aiResult === 'committed') {
             const hasChangesNow = (await execCommand('git diff --cached --name-only', { silent: true })).trim();
             if (!hasChangesNow) {
                log.success('✅ AI 已完成提交。');
                committed = true;
             }
          }
        }

        if (!committed) {
          const commitMsg = await text({
            message: '请输入最终提交信息 (如 "feat: 功能描述")'
          });
          handleCancel(commitMsg);

          if (!commitMsg.trim()) {
            log.error('❌ 提交信息不能为空，操作中止。');
            await execCommand('git reset --hard ORIG_HEAD', { silent: true });
            process.exit(1);
          }

          const safeMsg = commitMsg.replace(/"/g, '\\"');
          await execCommand(`git commit -m "${safeMsg}"`, { silent: true }); 
          log.success('✅ 自动压缩完成！');
          committed = true;
        }
      }
    } catch (e) {
      log.error(`❌ 压缩失败: ${e.message}`);
      log.error('正在尝试通过 ORIG_HEAD 恢复历史...');
      await execCommand('git reset --hard ORIG_HEAD', { silent: true });
      process.exit(1);
    }
  } else {
    log.success('✅ 只有 1 个提交记录，无需压缩。');
  }

  // 5. 步骤 3：合并入公共分支
  s.start(`正在合并到 ${targetBranch}...`);
  const userBranch = selectedBranch;
  try {
    await execCommand(`git checkout ${targetBranch}`, { silent: true });
    await execCommand(`git pull origin ${targetBranch}`, { silent: true });
    await execCommand(`git merge ${userBranch}`, { silent: true });
    s.stop('合并完成');
    
    s.start(`正在推送 origin/${targetBranch}...`);
    await execCommand(`git push origin ${targetBranch}`, { silent: true });
    s.stop('推送完成');

    // 6. 步骤 4：恢复开发环境
    await execCommand(`git checkout ${userBranch}`, { silent: true });

    log.success(`公共历史：保持线性，增加 1 条原子提交。\n本地分支 [${userBranch}] 已就绪。`, '✅ 同步完成');
    
    // 【重要提示】关于远程个人分支的同步
    let hasRemote = false;
    try {
      await execCommand(`git rev-parse --abbrev-ref ${userBranch}@{u}`, { silent: true });
      hasRemote = true;
    } catch (e) {
      hasRemote = false;
    }

    if (hasRemote) {
      log.info(`检测到远程个人分支。\n下次推送请使用：git push origin ${userBranch} --force-with-lease`, '💡 提示');
    }

  } catch (e) {
    s.stop('操作异常', 1);
    log.error(`❌ 异常: ${e.message}`);
    log.warn('代码已在本地压缩，请手动处理后续合并。');
    process.exit(1);
  }
}

module.exports = featureSyncFinal;
