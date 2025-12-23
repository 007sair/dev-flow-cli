const fs = require('fs');
const path = require('path');
const semver = require('semver');
const { 
  log, 
  execCommand, 
  select, 
  text, 
  confirm, 
  handleCancel,
  checkGitClean, 
  getRemoteFeatBranches, 
  spinner, 
  note 
} = require('../utils');

function getPackageJson() {
  const pPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pPath)) throw new Error('package.json not found');
  return JSON.parse(fs.readFileSync(pPath, 'utf8'));
}

async function preRelease() {
  // 0. 检查工作区状态
  if (!checkGitClean()) {
    process.exit(1);
  }

  // 1. 同步并选择公共特性分支
  const s = spinner();
  s.start('同步远程分支信息...');
  try {
    await execCommand('git fetch origin', { silent: true });
    s.stop('同步完成');
  } catch (e) {
    s.stop('同步失败 (继续使用本地缓存)', 1);
  }

  const remoteFeatChoices = getRemoteFeatBranches().map(b => ({
    label: b.label || b.name, // Adapter if getRemoteFeatBranches returns name/value
    value: b.value
  }));
  
  remoteFeatChoices.push({ label: '📝 手动输入', value: 'manual' });

  const defaultTarget = remoteFeatChoices.length > 1 ? remoteFeatChoices[0].value : null;
  let selectedBranch = await select({
    message: '请选择要发布的公共特性分支',
    options: remoteFeatChoices,
    initialValue: defaultTarget
  });
  handleCancel(selectedBranch);

  if (selectedBranch === 'manual') {
    selectedBranch = await text({
      message: '请输入公共特性分支 (例如 feat/1.0.0)'
    });
    handleCancel(selectedBranch);
  }
  selectedBranch = selectedBranch.trim();
  if (!selectedBranch) throw new Error('未选择分支');

  // 2. 检出选中的特性分支
  s.start(`正在检出 ${selectedBranch}...`);
  try {
    const localExists = (await execCommand(`git branch --list ${selectedBranch}`, { silent: true })).trim();
    if (localExists) {
      await execCommand(`git checkout ${selectedBranch}`, { silent: true });
      await execCommand(`git pull origin ${selectedBranch}`, { silent: true });
    } else {
      await execCommand(`git checkout -b ${selectedBranch} origin/${selectedBranch}`, { silent: true });
    }
    s.stop(`已检出 ${selectedBranch}`);
  } catch (e) {
    s.stop('检出失败', 1);
    throw new Error(`检出分支失败: ${e.message}`);
  }

  // 3. Determine Version
  const pkg = getPackageJson();
  const currentVersion = pkg.version;
  
  const releaseType = await select({
    message: `当前版本: ${currentVersion}，请选择发布类型`,
    options: [
      { label: `Patch (补丁) (${semver.inc(currentVersion, 'patch')})`, value: 'patch' },
      { label: `Minor (功能) (${semver.inc(currentVersion, 'minor')})`, value: 'minor' },
      { label: `Major (主版本) (${semver.inc(currentVersion, 'major')})`, value: 'major' },
      { label: '自定义', value: 'custom' },
    ]
  });
  handleCancel(releaseType);

  let nextVersion;
  if (releaseType === 'custom') {
    nextVersion = await text({
      message: '请输入自定义版本号'
    });
    handleCancel(nextVersion);
  } else {
    nextVersion = semver.inc(currentVersion, releaseType);
  }

  if (!semver.valid(nextVersion)) {
    throw new Error(`无效的版本号：${nextVersion}`);
  }

  const releaseBranchName = `release/v${nextVersion}`;
  
  // Check for conflicting local 'release' branch
  try {
    const hasReleaseBranch = (await execCommand('git branch --list release', { silent: true })).trim();
    if (hasReleaseBranch) {
      log.warn('检测到本地存在名为 "release" 的分支，这会导致创建 release/v... 分支失败。', '⚠️ 分支冲突');
      
      const action = await select({
        message: '请选择如何处理冲突分支 "release"',
        options: [
          { label: '重命名为 release-backup (推荐)', value: 'rename' },
          { label: '删除 (确保不需要)', value: 'delete' },
          { label: '取消操作', value: 'cancel' }
        ]
      });
      handleCancel(action);

      if (action === 'cancel') {
        process.exit(0);
      } else if (action === 'rename') {
        await execCommand('git branch -m release release-backup', { silent: true });
        log.success('✅ 已重命名为 release-backup');
      } else if (action === 'delete') {
        await execCommand('git branch -D release', { silent: true });
        log.success('🗑️  已删除 release 分支');
      }
    }
  } catch (e) {
    // Ignore
  }

  // 5. Create Release Branch
  const isConfirmed = await confirm({
    message: `即将基于 ${selectedBranch} 创建分支 ${releaseBranchName} 并推送，确认吗？`
  });
  handleCancel(isConfirmed);
  
  if (!isConfirmed) process.exit(0);

  s.start(`正在创建并推送 ${releaseBranchName}...`);
  try {
    await execCommand(`git checkout -b ${releaseBranchName}`, { silent: true });
    await execCommand(`git push origin ${releaseBranchName}`, { silent: true });
    s.stop(`分支 ${releaseBranchName} 创建并推送成功`);
  } catch (e) {
    s.stop('创建或推送失败', 1);
    throw new Error(`操作失败: ${e.message}`);
  }

  log.success(`分支：${releaseBranchName}\n下一步：部署到预发布环境 (通常由 CI/CD 自动完成)。`, '✅ 预发布分支就绪');
}

module.exports = preRelease;
