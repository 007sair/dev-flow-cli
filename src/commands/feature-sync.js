const { log, execCommand, askQuestion, askList, askConfirm, getCurrentBranch, checkGitClean, getRemoteFeatBranches } = require('../utils');

async function featureSync() {
  log('\n🚀 开始阶段 1：特性同步', 'green');

  // 0. 检查工作区状态
  if (!checkGitClean()) {
    process.exit(1);
  }

  // 1. 选择个人分支
  const currentBranch = getCurrentBranch();
  let localBranchChoices = [];
  try {
    // 获取前5个最近修改的本地分支，包含时间和提交信息
    const output = execCommand("git for-each-ref --sort=-committerdate --format='%(refname:short)|%(committerdate:relative)|%(subject)' refs/heads/ | head -n 5", { silent: true });
    
    localBranchChoices = output.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const [branch, date, subject] = line.split('|');
        return {
          name: `${branch.padEnd(20)} (${date}) - ${subject}`,
          value: branch
        };
      });
  } catch (e) {
    // Fallback if git command fails
    try {
      const output = execCommand("git branch --format='%(refname:short)'", { silent: true });
      localBranchChoices = output.split('\n').map(b => b.trim()).filter(b => b).map(b => ({ name: b, value: b }));
    } catch (err) {
      throw new Error('无法获取本地分支列表');
    }
  }

  // 添加手动输入选项
  localBranchChoices.push({ name: '📝 手动输入', value: 'manual' });

  let selectedBranch = await askList(
    '请选择要合并的个人分支：',
    localBranchChoices,
    currentBranch // 尝试默认选中当前分支
  );

  if (selectedBranch === 'manual') {
    selectedBranch = await askQuestion('请输入个人分支名称：');
  }
  selectedBranch = selectedBranch.trim();
  if (!selectedBranch) throw new Error('未选择个人分支');

  // 1.1 确认私有分支
  const isPrivateConfirmed = await askConfirm(`确认 ${selectedBranch} 是私有分支（仅由您个人使用，未与他人共同开发）吗？`, true);
  if (!isPrivateConfirmed) {
    log('❌以此流程仅适用于私有分支。已退出。', 'red');
    process.exit(0);
  }

  if (selectedBranch !== currentBranch) {
    log(`正在切换到分支 ${selectedBranch}...`, 'blue');
    try {
      execCommand(`git checkout ${selectedBranch}`);
    } catch (e) {
      throw new Error(`切换分支失败: ${e.message}`);
    }
  }

  // 2. 选择目标公共特性分支
  
  // 2.2 同步远程并列举
  log('🔄 同步远程分支信息...', 'blue');
  try {
    execCommand('git fetch origin');
  } catch (e) {
    log('Fetch 失败 (可能是网络问题)，继续使用本地缓存...', 'yellow');
  }

  const remoteFeatChoices = getRemoteFeatBranches();

  // 添加手动输入选项
  remoteFeatChoices.push({ name: '📝 手动输入', value: 'manual' });

  // 默认选中第一个（最新的）
  const defaultTarget = remoteFeatChoices.length > 1 ? remoteFeatChoices[0].value : null;

  // 2.3 让用户选择
  let targetBranch = await askList('请选择目标公共特性分支：', remoteFeatChoices, defaultTarget);
  
  if (targetBranch === 'manual') {
    targetBranch = await askQuestion('请输入目标公共特性分支 (例如 feat/1.0.0)：');
  }
  targetBranch = targetBranch.trim();
  if (!targetBranch) throw new Error('未选择目标分支');

  // 3. 同步逻辑
  log(`\n🔄 正在与 ${targetBranch} 同步...`, 'blue');
  
  // 3.1 Fetch 目标分支
  try {
    execCommand(`git fetch origin ${targetBranch}`);
  } catch (e) {
    throw new Error(`拉取远程分支 origin/${targetBranch} 失败。请确认分支是否存在。`);
  }

  // 3.2 变基 (私有分支默认使用 Rebase)
  try {
    log('正在执行 git rebase...', 'blue');
    execCommand(`git rebase origin/${targetBranch}`);
  } catch (error) {
    log('\n⚠️  检测到冲突！', 'red');
    log('请在编辑器中解决冲突。', 'yellow');
    log('解决冲突 -> `git add .` -> `git rebase --continue`。', 'yellow');
    
    const resolved = await askConfirm('是否已解决冲突并完成操作？');
    if (!resolved) {
      log('用户取消操作。', 'red');
      process.exit(0);
    }
  }

  // 4. 选择合并模式 (默认: 本地合并)
  log('\n🤝 准备合并代码。', 'cyan');
  const mergeMode = await askList('选择合并模式：', [
    { name: '模式 2：本地合并 (默认 - 本地合并后推送到目标分支)', value: 'local' },
    { name: '模式 1：Pull Request (推送个人分支，手动创建 PR)', value: 'pr' },
  ], 'local');

  if (mergeMode === 'pr') {
    log(`\n📤 正在推送 ${selectedBranch} 到远程...`, 'blue');
    try {
      execCommand(`git push origin ${selectedBranch}`);
    } catch (e) {
      log('推送失败。如果执行了变基，可能需要强制推送。', 'yellow');
      const force = await askConfirm('是否强制推送？');
      if (force) {
        execCommand(`git push origin ${selectedBranch} --force`);
      } else {
        throw e;
      }
    }
    
    log('\n✅ 分支已推送。', 'green');
    log(`🔗 请创建合并请求：${selectedBranch} -> ${targetBranch}`, 'green');
  } else {
    // 本地合并
    log(`\n🔀 切换到 ${targetBranch}...`, 'blue');
    execCommand(`git checkout ${targetBranch}`);
    
    log('⬇️  拉取最新变更...', 'blue');
    execCommand(`git pull origin ${targetBranch}`);

    // 5. 合并策略 (默认: 线性)
    const strategy = await askList('选择合并策略：', [
      { name: '线性合并 (默认 - Fast-forward/Rebase)', value: 'linear' },
      { name: '保留提交记录 (Merge Commit, --no-ff)', value: 'bubble' },
    ], 'linear');

    log(`\n🔀 正在合并 ${selectedBranch} 到 ${targetBranch}...`, 'blue');
    try {
      if (strategy === 'linear') {
         // 尝试快进
         execCommand(`git merge ${selectedBranch}`);
      } else {
         execCommand(`git merge --no-ff ${selectedBranch}`);
      }
    } catch (e) {
      log('❌ 合并失败。请手动解决冲突。', 'red');
      process.exit(1);
    }

    log(`\n📤 正在推送 ${targetBranch} 到远程...`, 'blue');
    execCommand(`git push origin ${targetBranch}`);
    
    log('\n✅ 合并完成！', 'green');
    
    // 删除本地个人分支默认选项为 false
    const deleteBranch = await askConfirm(`删除本地个人分支 ${selectedBranch}？`, false);
    if (deleteBranch) {
      execCommand(`git branch -d ${selectedBranch}`);
      log(`🗑️  已删除 ${selectedBranch}`, 'yellow');
    }
  }
}

module.exports = featureSync;
