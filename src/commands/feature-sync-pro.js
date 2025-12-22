/**
 * 🚀 Git 同步工具
 * 
 * 核心设计：
 * 1. 自动变基：保持历史线性。
 * 2. 软重置压缩：利用 git reset --soft 将碎片提交打包为原子提交，且 Commit ID 保持一致。
 * 3. 兼容性：支持分支延用，无需合并一次删一次。
 * 4. 安全锁：严禁在多人协作分支使用，提供故障恢复路径。
 */

const { 
  log, 
  execCommand, 
  askQuestion, 
  askList, 
  askConfirm, 
  getCurrentBranch, 
  checkGitClean, 
  getRemoteFeatBranches 
} = require('../utils');

async function featureSyncFinal() {
  log('\n🌟 启动 Git 同步流程', 'cyan');

  // 0. 基础环境检查
  if (!checkGitClean()) {
    log('❌ 错误：您的工作区有未处理的变更，请先 commit 或 stash。', 'red');
    process.exit(1);
  }

  // 1. 分支识别
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
  localBranchChoices.push({ name: '📝 手动输入名称', value: 'manual' });

  let selectedBranch = await askList('请选择您的个人开发分支：', localBranchChoices, currentBranch);
  if (selectedBranch === 'manual') selectedBranch = await askQuestion('请输入分支名称：');
  selectedBranch = selectedBranch.trim();

  // 【安全锁】确认私有性
  log('\n⚠️  风险确认', 'yellow');
  const isPrivate = await askConfirm(`您确认 ${selectedBranch} 是【个人独占】分支吗？\n   (如果是多人共同开发的分支，压缩操作会造成他人代码冲突)`, true);
  if (!isPrivate) {
    log('中止操作。多人协作分支请使用常规 merge，不要进行压缩。', 'red');
    process.exit(0);
  }

  // 2. 确定目标公共分支
  log('\n🔄 正在同步远程仓库信息...', 'blue');
  try { execCommand('git fetch origin'); } catch (e) {}
  
  const remoteFeatBranches = getRemoteFeatBranches(); // 假设 utils 已实现获取远程 feat 分支列表
  remoteFeatBranches.push({ name: '📝 手动输入', value: 'manual' });
  let targetBranch = await askList('请选择目标公共特性分支 (Target)：', remoteFeatBranches, remoteFeatBranches[0]?.value);
  if (targetBranch === 'manual') targetBranch = await askQuestion('请输入目标分支 (如 feat/1.0.0)：');
  targetBranch = targetBranch.trim();

  // 切换到开发分支
  if (getCurrentBranch() !== selectedBranch) {
    execCommand(`git checkout ${selectedBranch}`);
  }

  // 3. 步骤 1：变基同步（解决冲突的第一道防线）
  log(`\n🔄 步骤 1: 正在从 origin/${targetBranch} 获取最新代码并变基...`, 'blue');
  try {
    execCommand(`git fetch origin ${targetBranch}`);
    // 自动变基，确保开发分支是基于公共分支最新点检出的
    execCommand(`git rebase origin/${targetBranch}`);
  } catch (error) {
    log('\n❌ 变基冲突！', 'red');
    log('您的代码与公共分支存在逻辑冲突，请手动解决：', 'yellow');
    log('1. 在编辑器中解冲突 -> 2. git add . -> 3. git rebase --continue');
    log('完成后请重新运行此脚本。', 'cyan');
    process.exit(0);
  }

  // 4. 步骤 2：智能历史压缩
  const aheadCount = parseInt(execCommand(`git rev-list --count origin/${targetBranch}..${selectedBranch}`, { silent: true }).trim());
  
  if (aheadCount === 0) {
    log('\n✅ 您的分支已是最新，无须同步。', 'green');
    return;
  }

  if (aheadCount > 1) {
    log(`\n📦 步骤 2: 检测到 ${aheadCount} 个提交记录，准备进行自动打包...`, 'yellow');
    const commitMsg = await askQuestion('请输入合并后的提交信息 (建议格式: "feat: 功能描述"):');
    
    if (!commitMsg.trim()) {
      log('❌ 提交信息不能为空，操作中止。', 'red');
      process.exit(1);
    }

    try {
      log('正在执行 Soft Reset 压缩...', 'gray');
      // 核心魔法：软回退到公共分支点。改动全部保留在 Stage 区。
      execCommand(`git reset --soft origin/${targetBranch}`);

      // 检查是否有实际变更
      const hasChanges = execCommand('git diff --cached --name-only', { silent: true }).trim();

      if (!hasChanges) {
        log('\n✅ 检测到内容与目标分支完全一致，无需创建新的提交。', 'green');
        // 虽然没有变更，但我们已经重置了指针，现在分支已经和目标对齐了
      } else {
        const commitMsg = await askQuestion('请输入最终合并的提交信息 (建议格式: "feat: 功能描述"):');
        if (!commitMsg.trim()) {
          log('❌ 提交信息不能为空，操作中止。', 'red');
          execCommand('git reset --hard ORIG_HEAD');
          process.exit(1);
        }

        const safeMsg = commitMsg.replace(/"/g, '\\"');
        log('正在提交原子记录...', 'gray');
        execCommand(`git commit -m "${safeMsg}"`); 
        log('✅ 自动压缩完成！', 'green');
      }
    } catch (e) {
      log('❌ 压缩失败，正在尝试通过 ORIG_HEAD 恢复历史...', 'red');
      execCommand('git reset --hard ORIG_HEAD');
      process.exit(1);
    }
  } else {
    log('\n✅ 只有 1 个提交记录，无需压缩。', 'green');
  }

  // 5. 步骤 3：合并入公共分支
  log(`\n🤝 步骤 3: 正在合并到公共分支 ${targetBranch}...`, 'blue');
  const userBranch = selectedBranch;
  try {
    // 切换到目标分支
    execCommand(`git checkout ${targetBranch}`);
    // 同步远程目标分支（以防在执行脚本期间有人提交了代码）
    execCommand(`git pull origin ${targetBranch}`);

    // Fast-forward 合并
    log(`执行 Fast-forward 合并...`, 'gray');
    execCommand(`git merge ${userBranch}`);

    // 推送远程
    log(`正在推送 origin/${targetBranch}...`, 'gray');
    execCommand(`git push origin ${targetBranch}`);

    // 6. 步骤 4：恢复开发环境
    log(`\n🔄 步骤 4: 切换回开发分支 ${userBranch}...`, 'blue');
    execCommand(`git checkout ${userBranch}`);

    log('\n✨✨ 同步全链路完成！ ✨✨', 'green');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
    log(`✅ 公共历史：保持线性，增加了 1 条原子提交。`, 'cyan');
    log(`✅ 本地开发：分支 [${userBranch}] 已就绪，可直接继续开发。`, 'cyan');
    
    // 【重要提示】关于远程个人分支的同步
    let hasRemote = false;
    try {
      // 检查是否有上游分支，silent 模式防止报错信息直接打印
      execCommand(`git rev-parse --abbrev-ref ${userBranch}@{u}`, { silent: true });
      hasRemote = true;
    } catch (e) {
      hasRemote = false; // 说明没有上游分支，直接跳过提示
    }

    if (hasRemote) {
      log(`\n💡 提示：检测到您有远程个人分支。由于本地历史已压缩，`, 'yellow');
      log(`   下次推送个人分支请使用：git push origin ${userBranch} --force-with-lease`, 'yellow');
    }
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'gray');

  } catch (e) {
    log(`\n❌ 合并/推送阶段发生异常: ${e.message}`, 'red');
    log('您的代码已在本地分支压缩成功，您可以手动执行后续合并。', 'yellow');
    process.exit(1);
  }
}

module.exports = featureSyncFinal;