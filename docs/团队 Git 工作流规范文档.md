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

### 第二阶段：合并入公共分支 (Squash Merge)

目标：将个人分支的 N 个提交压缩为 1 个提交合入 `feat/1.0.0`。

#### 方式 A：本地命令行合并 (推荐)

```bash
git checkout feat/1.0.0
git pull origin feat/1.0.0

# 核心命令：只合并内容，不产生 commit
git merge --squash feat/user-task-01

# 提交：编写符合规范的 Commit Message
git commit -m "feat(login): 完成登录模块开发 (Ticket-123)"

git push origin feat/1.0.0
```

#### 方式 B：网页端 Pull Request 

1.  在 GitLab/GitHub 发起 PR：`feat/user-task-01` -> `feat/1.0.0`。
2.  Code Review 通过。
3.  管理员点击 Merge 按钮时，**务必勾选 "Squash commits"**。

> 按照标准流程，应该是在网页端走 PR 更合适，但多人协作时可能会出现 PR CodeReview 不及时导致公共分支冲突不断问题 <br />
> 所以本文档暂时推荐 `本地命令行合并` 方式

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

在线预览链接：[Mermaid Chart - Create complex, visual diagrams with text.](https://www.mermaidchart.com/play#pako:eNqVWH1PG0ca_yojKl3hVIMJDSTWKXcJUdRKTQ9BetKpnKL17hivWHbdtU2KokhGOQNOKNCGJrmEFkhC4KIkcDmSGpuK71J51vFf6Ue4Z-aZ3Z1dm5CDf3bmeX_7zQPXu3THoF2prkQiMW7rjp0xJ1LjNiGWNuMUCyliaBMuHbcFOWM51_Ss5hbIlQvAky-mJ1wtlyUj1M07tmZdHZ7RLfr1eNfv6z_USaP6rFGrscMSW_6-df-N9_I16W5Ut7yNw-b2rLdWYQtz3upuz3jXP7g9QgzTpXrBdGzULn-Gs1SfBE9AK6p6Wyp7j0tsvoZaGvU6u7WJuv6Uds9NmAWiSxmSSJMM1Qp9xTx1EwUtP5lI9gf2hHbHMO0J0O3d22LVKlp4d7jYqG03V9ebj5aalXm2eNdbXmnUnnD13cPO1BSYOP8JkV8Xent7eyJKv6TUGJux9evg8vwcezLPVha9F1vegtTz5_GuGyH3JVrQs-ABdzzDv4njmhOmjZ739yZ7kxHtozSt5akUcMVBSvSFEsJVtnyfrdfeHT5oHP3kLc42a0deaZstzbHlV1GHP9Pyw1B5y9QL4PNvDzbeVZeJd3-XrTzldZp71Xw2G3V6zLGmuQ9e5Ta7tfN2-zGb-y9JnCPcJ80w-Kd0LZGApiqYdpFGTF6GrhujFpUW73KLbGWBHbzx7h6ww-VWqeLd_nfE5kgxn_0KCilDz8GRJDKRbKl1FinAZLGVpdZaiR3W2MIbb2mnVZqNxv_XHLVHRnmHQXu9_gUsWRbk-ZsizRfi7UJH6bRJr4HX_EDwFPHzvDFl2mPfFLU8L2vz5WZzZY59f5_gFblM3QkqnOMuN6q3GvUye_Qzu7XRDxODTRV17wtH16yxa2bYJ0GDRyuOabGsDtK-O5xlinsAhcmjQ--fECGOXv3lOqBCmlopIr3AAUhMkY-5jhSBSfhYROZV7rDFcqNaY0vr7MUKtj0ERW7EFPOaqvU8rvWpbUQAx8xRy7Tp1b9R18zMCMRZvie69vWst7cPrd56tvh2dzYSykWas5yZi3Qa-Fs3d5q_voKradJc2mWPbkY4L4H9UaoZM93jXaEvpFF_3NyYZb-88h7ue3f3cMjEPKkT5v247-3zDusJFV6BTgJb1wMQm3_mvb7dKj14ezQfnSx08qvzV0In4dDJSa4TSKATYvVW30S1xTI2CrMGk3B1JIvg8fv6g6ek9eif4Aur3uxrzu6x2tNorxchBRafcYG2MM9CQ990OyShzyMuDX2Gw3E-Awl8RotYpRggmt-iYba241slCPCNo5fsyXcRjRxoL2j65NccRjYFjDz8GbogJeEETie3k-sYamZKxHvxGEAIhhNKSv5AvGoZhjgKYHyILmv5ggAkaau8RfCKy1TukCvaRMdEOYZvKEiXY3TK1zBEbxdzgnv7gDQrC97ac_SGd19_LyRmo_WvJ7HqcNqpgHZS-J85hYz5rfJ4r24RiJtHv7_tlbYw66Qb-U56sC8UJy45Rdvo7hYh7hBosebSHioEIsxFT6TLUC1P4nqtUVvyM9gNyevhgcj-ywo2DDAKUdAwHItBA3qKY8pLsPacre0diwRo-Ji27SAl-bV8HmcO6J0mGNk-tD9Ih4BQAzrZoVE68PIpQGCTrzc7Krc267h4pHgWYY9y3ZlEztQn-4RvfE7Yr3dY5TtskD9GmoNPVgE2PV7F1uZB8-FLtrILTz2vHjwd58jntlngMKk-cbKAUyJEbpQtPGT1Gis_Z-X_NCsHfP0Qc9xpt_EVCu3-1oek4WCf4ySxskmC-BbX_tKFBP8EJNKsbzfrLxB32zSojLis4WMlGMVqhnziU1ziSoG3o_6Oc07doZCmXHDlwSIluMX-JNPMPz9Mxb0NRUW4QSFzeBa8YovqT5GRUcHtL0_I658ECbcfJOC3nyW56wS5lmeuHybNWz3oVBCFCadDMClL0fHunkrJkRUiytqDIsqFwqDoVC5CBtxdFAa5twcMPBlIVpyU9ZdrgCI9UuxMDI6CGKwaSAyOgiiXASTJA0_Cl05bPhXq32leUQ0Pv6qarwi-6oAkD-9RLam-anzyZSXFt2JxxKWqRY6UvsWAJA9c528_LfKnAFMlXnSZJ_GNQyCfbgDDmImAkuhtz7RqZK2sNpmCubLJwotIJI4RDQUeXxE_vrZI898xPzMItEFy8OiHx_s-iE_8YRCaC54Z1WZwiZMfvCxy8IOzUryImSiHX8C2p0dljidDfWVUPrxRWOTjovLIK6yPj9zjtnyW_ItUKpV2Nduf3wDH4V4Ti4N_L9oyfutDM9wbVDfzIUWAcZwdsRhu81pGJkkF0HYtAnjjWkJY4s4HQB8gZgfXJeC1G1DghLulAJUKZXGNCoh1lEL46ijFnYznPBieOCHAJCBQW1bXB5z2YAKcaWPHuxg7wkdnm9D1bUrwLl5ngRU8CwUn51dNQkO00EpvH2fTMSJG5azDna5OfTD2UavBwMN1VgECfyjj5YgNecRyOLrtEbdNajwadUQ7aJVzGfNSt8DYRZohYlvJmJaV-iiTyXySL7jOJE19NDAwIL8T10yjkE3159okhRO-7Nn3yJ5qkwUnpSDtz5zO0EA2eWpoKG2cJO6nKHRc041ARyZjDCWTJ-ngpQzkdfgJ5T9AGPrMD2CQmw8DSJ4dPHPmJHnsDN98kv_-P6n3_00jxI1-_VN6NhAfHBrQ0kMnOYC9EMRP9fSAkr_BTinwLwwwrbmuNpMip8npmF45OVKxnjHOGGFiB5NDxpl0m-KuG_8D-XxZPw)
