# 团队 Git 工作流规范文档 (Strict Private + Linear History)

## 1. 核心原则

1.  **严格私有分支**：个人开发分支（`feat/user-task-*`）仅限开发者本人使用，禁止多人共用，确保 Rebase 安全。
2.  **线性历史 (Linear History)**：通过 `Rebase` 和 `Squash` 策略，杜绝无意义的 Merge Commit，保证公共分支历史是一条直线。
3.  **原子提交 (Atomic Commit)**：一个功能/任务在公共分支上只能体现为 1 个 Commit。
4.  **版本闭环**：版本上线后，必须清理对应的 release 和 feat 分支。

---

## 2. 分支定义

| 分支类型 | 命名规范 | 说明 | 生命周期 |
| :--- | :--- | :--- | :--- |
| **Master** | `master` | **生产环境代码**。仅接受 Release 或 Hotfix 合并，严禁直接 Push。 | 永久 |
| **公共特性** | `feat/1.0.0` | **当前迭代集成地**。对应 Dev/UAT 环境，接受开发者合入。 | 版本周期内 (上线后删除) |
| **私有任务** | `feat/user-login` | **个人工作区**。仅限单人使用，随时可变基 (Rebase)。 | 功能开发期间 (合入后删除) |
| **发布分支** | `release/v1.0.0` | **预发布/冻结区**。对应 Pre 环境，仅修复 Bug。 | 提测至上线 (上线后删除) |
| **热修复** | `hotfix/v1.0.1` | **紧急修复区**。源于 Master，用于修复线上 Bug。 | 修复期间 (上线后删除) |

---

## 3. 常规迭代开发流程

### 第一阶段：开发与同步 (Personal Cycle)

**1. 检出分支**
管理员从 Master 创建公共分支 `feat/1.0.0`，开发者基于此检出私有分支：

```bash
git fetch origin
git checkout -b feat/user-task-01 origin/feat/1.0.0
```

**2. 开发与提交**
在本地进行日常开发，产生多次 Commit（碎片化提交）：

```bash
git add .
git commit -m "feat: 完成UI布局"
git commit -m "feat: 完成接口对接"
```

**3. 同步公共代码 (必须使用 Rebase)**
在准备提交或需要同步代码时，**严禁使用 `git merge`**，必须使用 `git rebase`：

```bash
# 1. 拉取远程公共分支最新代码
git fetch origin feat/1.0.0

# 2. 变基：将你的 commit 接在公共分支最新 commit 之后
git rebase origin/feat/1.0.0
```

*   **遇到冲突**：
    * 手动解决文件冲突。
    *   `git add <冲突文件>`
    *   `git rebase --continue`

**4. 推送代码 (可选)**

> 鉴于本流程在 `第二阶段` 推荐使用 `本地命令行合并` 的方式，个人分支不建议推送到远端。<br />
> 如果一定要推送，请定期清理，否则会造成远端分支混乱难以维护。

因为执行了 Rebase（修改了历史），需要强制推送：

```bash
# 使用 lease 模式更安全，防止覆盖他人代码（虽然是私有分支）
git push --force-with-lease origin feat/user-task-01
```

---

### 第二阶段：合并入公共分支 (Intelligent Sync)

目标：将个人分支的 N 个碎片提交压缩为 1 个原子提交，并以线性方式合入 `feat/1.0.0`。

> ⚠️ **注意**：本阶段操作建议使用 flow CLI 工具，它会自动处理复杂的变基与压缩逻辑。

#### 标准化操作流程 (CLI 自动执行)

脚本内部执行逻辑如下（供理解原理）：

**1. 变基同步 (Rebase)**
首先将个人分支变基到公共分支最新节点，确保没有代码冲突：
```bash
git fetch origin feat/1.0.0
git rebase origin/feat/1.0.0
```

**2. 智能压缩 (Soft Reset)**
如果是多次提交，脚本会使用 Soft Reset 将所有变更回退到暂存区，重新打包：
```bash
# 软回退到公共分支起点，保留文件变更在暂存区
git reset --soft origin/feat/1.0.0

# 重新提交为一个原子 Commit
git commit -m "feat(login): 完成登录模块开发 (Ticket-123)"
```

**3. 线性合并 (Fast-forward)**
切换到公共分支，执行快进合并，并推送到远程：
```bash
git checkout feat/1.0.0
git pull origin feat/1.0.0
git merge feat/user-task-01  # 此时是 Fast-forward
git push origin feat/1.0.0
```

**4. 恢复开发环境**
切回个人分支，保持工作区就绪。
> **提示**：如果您的个人分支之前已推送到远程，由于历史被重写（压缩），下次推送需要使用 `git push --force-with-lease`。

---

### 第三阶段：验证与发布 (Release Phase)

1.  **流水线验证**：代码进入 `feat/1.0.0` 自动触发流水线部署 -> 开发自测 -> UAT 部署 -> 产品验收。
2.  **确定版本与冻结 (Determine Version & Freeze)**：

    > 推荐使用 CLI 工具：选择 `阶段 2：预发布 (pre-release)`。
    > 工具会自动读取 `package.json`，询问是 Patch/Minor/Major 升级，计算新版本号并创建 release 分支。

    手动操作：
    *   **确定新版本号**：基于当前 `package.json` 版本（如 1.0.0），决定下一版本（如 1.1.0）。
    *   **创建发布分支**：
        ```bash
        # 假设决定发布 v1.1.0
        git checkout -b release/v1.1.0 origin/feat/1.0.0
        git push origin release/v1.1.0
        ```
        *注意：此时仅创建分支，暂不修改 package.json 中的版本号，交由第四阶段处理。*

3.  **Bug 修复与回流 (可选)**：
    *   在 `release/v1.1.0` 上修复 Bug。
    *   **回流规则**：修复完成后，必须同步回 `feat/1.0.0`，防止 Bug 在后续开发中复活。

> 关于可选：如果一个版本已经上线，该版本的特性分支和 release 分支应当被清理，此时再回流已经没有任何意义。

    ```bash
    # 修复完 Bug 后
    git checkout feat/1.0.0
    git merge release/v1.1.0  # 或使用 cherry-pick
    git push origin feat/1.0.0
    ```

---

### 第四阶段：上线与清理 (Prod & Cleanup)

1.  **正式发布与生成日志 (Release Finish)**：
    
    > 推荐使用 CLI 工具：选择 `阶段 3：正式发布 (release-finish)`。
    > 工具会自动执行 `standard-version`，它将完成：
    > 1. 更新 `package.json` 版本号。
    > 2. 生成/更新 `CHANGELOG.md`。
    > 3. 创建 Git Tag (v1.1.0)。

    手动操作：
    ```bash
    # 1. 确保在 release 分支 (如 release/v1.1.0)
    git checkout release/v1.1.0
    git pull

    # 2. 生成版本号、变更日志并打 Tag (需安装 standard-version)
    # --release-as 参数确保版本号与分支名一致
    npx standard-version --release-as 1.1.0

    # 3. 推送变更和 Tag
    git push --follow-tags origin release/v1.1.0
    ```

2.  **合并上线**：
    在 Git 平台发起 Pull Request：`release/v1.1.0` -> `master`。
    审核通过后合并上线。

3.  **版本清理 (必做)**：
    上线成功后，删除过程分支，标志该版本周期彻底结束。

    ```bash
    # 删除远程分支
    git push origin --delete release/v1.1.0
    git push origin --delete feat/1.0.0
    
    # 开启下一个版本
    git checkout master
    git checkout -b feat/1.2.0
    ```

---

## 4. 线上紧急修复流程 (Hotfix)

当生产环境出现严重 Bug 需立即修复时执行此流程。

**1. 检出修复分支 (源于 Master)**

```bash
git fetch origin master
git checkout -b hotfix/v1.0.1 origin/master
```

**2. 修复与验证**
在本地修复，部署到 Pre 环境验证。

**3. 双向归仓 (Double Merge)**
验证通过后，代码必须去往两个方向：

*   **方向 1：上线 (To Master)**

    ```bash
    git checkout master
    git merge hotfix/v1.0.1
    git tag v1.0.1
    git push origin master --tags
    ```

*   **方向 2：回流 (To Current Dev)**
    **必须**将修复代码同步到当前正在开发的 `feat` 分支，否则下个版本上线会覆盖此修复。

    ```bash
    git checkout feat/1.1.0
    git cherry-pick <hotfix-commit-hash>
    # 或者 git merge hotfix/v1.0.1
    git push origin feat/1.1.0
    ```

**4. 清理**

```bash
git branch -d hotfix/v1.0.1
git push origin --delete hotfix/v1.0.1
```

---

## 5. 常见问题 (FAQ)

*   **Q: 为什么我要用 Rebase 而不是 Merge？**
    *   A: Rebase 能让你的 commit 接在最新的公共代码之后，避免产生菱形的合并分叉，保持历史像教科书一样清晰。
    *   通过本工具约束 rebase 使用，可以防止团队协作崩塌的严重问题。
    *   **注意：一定不要在公共分支上使用 `rebase` 命令。**
*   **Q: `git push -f` 会覆盖别人的代码吗？**
    *   A: 在**私有分支**上操作是安全的。但在公共分支（如 feat/1.0.0）上严禁使用强制推送。
*   **Q: 开发到一半，发现 feat/1.0.0 已经被删了（版本上线了）怎么办？**
    *   A: 请立即联系管理员，确认新版本的 feat 分支名称（如 feat/1.1.0），将你的分支 Rebase 到新的 feat 分支上。

---

## 附录：流程图

在线预览链接：[Mermaid Chart - Create complex, visual diagrams with text.](https://www.mermaidchart.com/play#pako:eNqVV_9PFEkW_1cqbPaCdzt8kRN0cuEiGLMm6y4B95LLcjFNdw10GLrZnhmUmE2G9fimCHiicoAHKAjLLcIpujDg8b-YqW7mJ_dPuFf1qruru4fFG37pqvftU6_e-9TjTo1uG7QmXZNKpbot3bYyZm-62yIkqw3bhXyaGFqvQ7stIc5k7Vt6n-bkyY020MkVenodbbCPdFAnZ1ta9mb7sJ6l33XX_Lr8j0NS3t8ql0rsqMhmHlbm37mv3pLa8v66u3LkbYy4S5NsYsyd2znXXfM3Ho8Qw3SonjdtC73LX3sf1fsBCXhFVyfFUfdFkY2X0Ev58JDdW0Vff-pxWnvNPNGlDUn1kAzV8vWFHHVSeS3Xn2poDOIJ77ZhWr3g2326zvb3McLHo6lyacObW_aeT3uT42zqiTszWy6tcfe17fbAAIS4_AWRX211dXXnIk6_ptToGrb0OwB5fIytjbPZKXd73Z2Qfv7cXfNDqH2V5vU-QMCBZ_g3sR2z17QQeWNdQ11DxHsn7dFyVBo4YiEt6kMLAZXNzLPl0sejhfLxM3dqxCsdu8UNNj3GZl5HAX-p5drh5rOmngfMHxZWPu7PEHd-h82-5Pc09trbGomC7rKzQxyDO3mf3ds82XjBxt6QVCvhmDTD4J8SWioFRZU3rQKNhAy_Pv-cuCv77PhupXh48t-H5eNX7tyB9-MB4GZHj9noOmn_6ho5Gd-CQGz6vnf0EyrGSuRyH9UMQA-14b69j4l2H--SVtIYh57Jd9Ic5RX1YWlTeK9sz7lvHqcJphRkADsHejyNfxC7Ol52rbv0M1vaRRzVUhl-XYe-6qJZKnP6hOeUzU6wg3fukwN2NFMpTrr3f4pA6yjk-r6FUpWXOwhLkspE6kGtZLxkAQVqC-uCzU6zZ-OVpSI7KrnTm1Fw3wxSq6OTdxK00dtfIF42C_X0fYHm8vG2oJ10yKS3ADtfEFxF0F42Bkyr6_uCluPl671a9WbH2MN5glvkOnV6qYDovtmEy3S319xHD8rvlwCipAbRtIC1Mv6AHZZOS-RXtq5lu26ZYZsE_R0teMxZNhvxc_WqACItB_j3aZk8_vfJ8SJeUdA05NoVILLiyfheFJ4Axe9LvauzGjdfcKw2R7NOOUgCkft0hd_kxErln2tASt7inju97h1ueIfbyFQ-JmoZ3VaEkc1BmjUtevMv1DEzw4KSZ56Ktn474u7uARdUtqZOdkYiCK_Qwaw9fIUOgX7l7qb3_jVsDRFveoc9vxvNKuDthIYbru2uCY9LyocvvJUR9strF6A-2ZUFyrtEpSD38Z67NwLYz4UOb0AJQqw7AcuPb0EbV4oLJ8fj0f5FkN9evhGChEU1kNwniMAnnNWdexf1lshZJzQrdNDNjj7k11-XF16SyvO_Axq2f7feG9llpZfRNilAErLfCdKBBwmoQ3ioH0pePqLucGiIGhanoQYRoMaIeE-xN8O8jYEZEJiMSrCdgD_Z2oOIR_4WtWl6Pye8hVXBQ4v_gjpISz6CVbJmkyXl2IaamyJxt18Aj5X378G1kt8Rd38UGCASWbTedS2XF5wmowGj4xa3mXxEbmi9VVNlG36gIGG2US1j7XB-qzAotDcOiDc5ASyNaHgFNtYRbKHY_XDZ-UB2dgK-tPMZ87Yy48ytEzg5P__ehltcx8yTWtQ7a65pK_RetQuWUVsrDrlJoMy86V10CELojnORSkO3PI3LpXJp2s9hLaTvHD-KrME-oYZHjM46UDScysEDIsVm5Zcg3rRT-QADn1K6VaykvpbLYeeBvFofo9qnVgipciD0gCCrlEoVXd4JSG9yyGHHo5XVQ5zP0jyLMEs4znBq0NT76wU23ivs_SM2-QBL5Pex8uD9lYeRmN9jZfXAW3zFZndgVOH3B1NEK7lmmXlOl-obKa9wQBySh2UTi_ACstGf2eh_vMkDPqeJbq72lvgOhXd_PEZRezD4cpGYbaVAfIttfzpFgb8CEVFfloQHVRGnWpyxhKKYYVFPfIpNHEhwt9MfBlvVYRNlygZ3HkycQlsMmjLN_PPTXDxdUVyE4yEqK6kSu8JifkeGk8NhNSUYh4VSONn5wKRRQorycEeEEtNfY5p0dAp9f-hDXX8lRDivoQC__WuR01lwuXLN_eMAXa0CFCVsSKGkjHFqfqqBPp-WXCEMlbkMTZQNrAocvWRd4CK05CdV7DrEsCvKJhyTVEAKTllzcgTxKyw0qyb3q1NuCpVg3kFhsBRCOZGgSC54Kr62E7lVpH-lOcU1TB-qaz6n-K4DkVz8hmsp9V3j1CFvVXwrETscqkbkRO1HDERywX1-eDbFXyJMmBgqZJ7EN7aEnB6Ai2MhAkmqLplvNcjSqFpwCuXLUgs3IiexjehRbAPPj889yvxn1M8M8nyQHFz6x-M9EJxP_FsThgteOTVmsIm0EzxsknWCtXJ5kTBRDf8CEy-fqhxPhvrIqXq4o6jIt03VkVt4P_6z4bNSsJFOp3uUbgseEdjXxNzi74uyjO_67wLsG1Q3c6FEvARxdXwIYDenZWSSVPZOehGsn4AS8HI1A8nGPIhCawqj8RMHT1NAuVXOKxkzGUQho3gYhQXjHiUHRk8fsF_8HlRGS3jymy1uFHAYCKglq8EnqOQ5Al5KqONeTB3ppnpM6JKEE9yL14XgFp6EvD3oX5qkkmhqlF44LaZtRIJKboA9XWWJgCaiUQOCgO0-hTj8Jo5nPUYKkchhqydPnOjs-GnUlq7iVfaxghLFehbCXaEZIoarjJnNpj_LZDJf5PKO3U_TnzU1Ncnv1C3TyPelGwdvxy3xwZS2l37D9nzCFmBKQ9qYuZChgW3D-ZaWHuMscz9JIXBNNwIfmYzR0tBwlg9-mYG9Dr_Q_hOModL8AzTz8OEBGi41X7x4lj3Whh--gf_9P6lH1pDmRqP-R3opMG9uadJ6Ws4CgNUQnJ_qPU1K_pqrpcDfMCC05jjacJpcIBdifmXvSMd6xrhohIltbmgxLvYkHNf88D_S9yQd)
