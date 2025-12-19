# Dev Flow CLI

**Dev Flow CLI** 是一个用于自动化团队 Git 工作流的命令行工具。它旨在帮助开发者遵循“严格私有分支 + 线性历史”的规范，简化日常的 Git 操作，确保代码库的整洁和版本管理的规范性。

## 📖 背景

本项目基于 [团队 Git 工作流规范](./docs/团队%20Git%20工作流规范文档.md) 构建，核心原则包括：

*   **严格私有分支**：个人开发分支仅限本人使用。
*   **线性历史 (Linear History)**：通过 Rebase 和 Squash 策略，杜绝无意义的 Merge Commit。
*   **原子提交**：一个功能在公共分支上体现为 1 个 Commit。
*   **版本闭环**：自动化处理版本发布和分支清理。

## 🚀 安装

### NPM 安装

你可以选择全局安装或者安装到项目中。

**全局安装**（推荐用于个人常用工具）：
这样你可以在任何目录下直接使用 `flow` 命令。

```bash
npm install -g dev-flow-cli
```

**项目内安装**（推荐用于团队统一规范）：
将工具安装为项目的开发依赖，确保团队成员使用相同版本的工具。

```bash
npm install --save-dev dev-flow-cli
```

### 本地开发安装

如果你想参与本项目开发，或者进行源码调试：

1. 克隆仓库到本地：
   ```bash
   git clone https://github.com/007sair/dev-flow-cli.git
   cd dev-flow-cli
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 链接到全局进行测试：
   ```bash
   npm link
   ```

## 🛠 使用指南

### 启动方式

**1. 全局安装 / 本地开发链接后**
直接在终端运行：
```bash
flow
```

**2. 项目内安装 (Local Dependency)**
在项目根目录下使用 `npx` 运行：
```bash
npx flow
```
或者在 `package.json` 的 scripts 中添加：
```json
"scripts": {
  "flow": "flow"
}
```
然后运行 `npm run flow`。

### 交互式菜单


```text
? 请选择当前工作流阶段： (Use arrow keys)
❯ 阶段 1：特性同步 (将个人分支合并到公共特性分支)
  阶段 2：预发布 (从公共特性分支创建 Release 分支)
  阶段 3：正式发布 (将 Release 分支合并到 Master 并发版)
```

### 常用命令

*   `flow`：启动交互式主菜单。
*   `flow --help`：查看帮助信息和阶段说明。
*   `flow --version`：查看当前版本。

## 🌊 工作流阶段详解

### 阶段 1：特性同步 (Feature Sync)

**目标**：将个人开发分支（如 `feat/user-task-01`）合并到公共特性分支（如 `feat/1.0.0`）。

**自动化步骤**：
1.  检查工作区状态。
2.  自动列出并让你选择最近的个人开发分支。
3.  选择目标公共特性分支。
4.  自动拉取远程代码并执行变基（Rebase）或合并操作。
5.  支持“本地线性合并”模式（推荐），确保历史清晰。
6.  推送合并后的代码，并可选清理本地分支。

### 阶段 2：预发布 (Pre-Release)

**目标**：从公共特性分支冻结代码，创建 Release 分支准备发版。

**自动化步骤**：
1.  同步远程分支信息。
2.  选择来源的公共特性分支（`feat/*`）。
3.  确定发布版本号（支持 Major/Minor/Patch 自动计算）。
4.  自动创建 release 分支（如 `release/v1.0.0`）。
5.  将 release 分支推送到远程。

### 阶段 3：正式发布 (Release Finish)

**目标**：完成发布流程，生成 Changelog 并打 Tag。

**自动化步骤**：
1.  获取远程所有 release 分支。
2.  选择要发布的 release 分支。
3.  调用 `standard-version` 自动生成 `CHANGELOG.md` 并更新版本号。
4.  自动打 Git Tag。
5.  推送分支和 Tag 到远程。
6.  提示后续操作（如发起 Pull Request 合并到 master）。

## 📦 依赖库

*   [inquirer](https://www.npmjs.com/package/inquirer): 交互式命令行界面。
*   [execa](https://www.npmjs.com/package/execa): 执行 Shell 命令。
*   [chalk](https://www.npmjs.com/package/chalk): 终端输出着色。
*   [semver](https://www.npmjs.com/package/semver): 语义化版本处理。
*   [standard-version](https://www.npmjs.com/package/standard-version): 自动化版本控制和 Changelog 生成。

## 📄 许可证

ISC
