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
| **Master** | `master` / `main` | **生产环境代码**。仅接受 Release 或 Hotfix 合并，严禁直接 Push。 | 永久 |
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
git commit -m "WIP: 完成UI布局"
git commit -m "WIP: 完成接口对接"
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

**4. 推送代码**
因为执行了 Rebase（修改了历史），需要强制推送：

```bash
# 使用 lease 模式更安全，防止覆盖他人代码（虽然是私有分支）
git push --force-with-lease origin feat/user-task-01
```

---

### 第二阶段：合并入公共分支 (Squash Merge)

目标：将个人分支的 N 个提交压缩为 1 个提交合入 `feat/1.0.0`。

#### 方式 A：网页端 Pull Request (推荐)

1.  在 GitLab/GitHub 发起 PR：`feat/user-task-01` -> `feat/1.0.0`。
2.  Code Review 通过。
3.  管理员点击 Merge 按钮时，**务必勾选 "Squash commits"**。

#### 方式 B：本地命令行合并

适用于且有合并权限的资深开发者：

```bash
git checkout feat/1.0.0
git pull origin feat/1.0.0

# 核心命令：只合并内容，不产生 commit
git merge --squash feat/user-task-01

# 提交：编写符合规范的 Commit Message
git commit -m "feat(login): 完成登录模块开发 (Ticket-123)"

git push origin feat/1.0.0
```

---

### 第三阶段：验证与发布 (Release Phase)

1.  **流水线验证**：代码进入 `feat/1.0.0` 自动触发 Dev 环境部署 -> 开发自测 -> UAT 部署 -> 产品验收。
2.  **提测冻结**：

    ```bash
    git checkout -b release/v1.0.0 origin/feat/1.0.0
    ```

3.  **Bug 修复与回流 (关键)**：
    * 在 `release/v1.0.0` 上修复 Bug。
    *   **回流规则**：修复完成后，必须同步回 `feat/1.0.0`，防止 Bug 在后续开发中复活。

    ```bash
    # 修复完 Bug 后
    git checkout feat/1.0.0
    git merge release/v1.0.0  # 或使用 cherry-pick
    git push origin feat/1.0.0
    ```

---

### 第四阶段：上线与清理 (Prod & Cleanup)

1.  **上线**：将 `release/v1.0.0` 合并入 `master`，打 Tag。
2.  **版本清理 (必做)**：
    上线成功后，删除过程分支，标志该版本周期彻底结束。

    ```bash
    # 删除远程分支
    git push origin --delete release/v1.0.0
    git push origin --delete feat/1.0.0
    
    # 开启下一个版本
    git checkout master
    git checkout -b feat/1.1.0
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
*   **Q: `git push -f` 会覆盖别人的代码吗？**
    *   A: 在**私有分支**上操作是安全的。但在公共分支（如 feat/1.0.0）上严禁使用强制推送。
*   **Q: 开发到一半，发现 feat/1.0.0 已经被删了（版本上线了）怎么办？**
    *   A: 请立即联系管理员，确认新版本的 feat 分支名称（如 feat/1.1.0），将你的分支 Rebase 到新的 feat 分支上。

---

## 附录：流程图

在线预览链接：[Mermaid Chart - Create complex, visual diagrams with text.](https://www.mermaidchart.com/play#pako:eNqVWH1PG0ca_yojKl3hVIMJDSTWKXcJUdRKTQ9BetKpnKL17hivWHbdtU2KokhGOQNOKNCGJrmEFkhC4KIkcDmSGpuK71J51vFf6Ue4Z-aZ3Z1dm5CDf3bmeX_7zQPXu3THoF2prkQiMW7rjp0xJ1LjNiGWNuMUCyliaBMuHbcFOWM51_Ss5hbIlQvAky-mJ1wtlyUj1M07tmZdHZ7RLfr1eNfv6z_USaP6rFGrscMSW_6-df-N9_I16W5Ut7yNw-b2rLdWYQtz3upuz3jXP7g9QgzTpXrBdGzULn-Gs1SfBE9AK6p6Wyp7j0tsvoZaGvU6u7WJuv6Uds9NmAWiSxmSSJMM1Qp9xTx1EwUtP5lI9gf2hHbHMO0J0O3d22LVKlp4d7jYqG03V9ebj5aalXm2eNdbXmnUnnD13cPO1BSYOP8JkV8Xent7eyJKv6TUGJux9evg8vwcezLPVha9F1vegtTz5_GuGyH3JVrQs-ABdzzDv4njmhOmjZ739yZ7kxHtozSt5akUcMVBSvSFEsJVtnyfrdfeHT5oHP3kLc42a0deaZstzbHlV1GHP9Pyw1B5y9QL4PNvDzbeVZeJd3-XrTzldZp71Xw2G3V6zLGmuQ9e5Ta7tfN2-zGb-y9JnCPcJ80w-Kd0LZGApiqYdpFGTF6GrhujFpUW73KLbGWBHbzx7h6ww-VWqeLd_nfE5kgxn_0KCilDz8GRJDKRbKl1FinAZLGVpdZaiR3W2MIbb2mnVZqNxv_XHLVHRnmHQXu9_gUsWRbk-ZsizRfi7UJH6bRJr4HX_EDwFPHzvDFl2mPfFLU8L2vz5WZzZY59f5_gFblM3QkqnOMuN6q3GvUye_Qzu7XRDxODTRV17wtH16yxa2bYJ0GDRyuOabGsDtK-O5xlinsAhcmjQ--fECGOXv3lOqBCmlopIr3AAUhMkY-5jhSBSfhYROZV7rDFcqNaY0vr7MUKtj0ERW7EFPOaqvU8rvWpbUQAx8xRy7Tp1b9R18zMCMRZvie69vWst7cPrd56tvh2dzYSykWas5yZi3Qa-Fs3d5q_voKradJc2mWPbkY4L4H9UaoZM93jXaEvpFF_3NyYZb-88h7ue3f3cMjEPKkT5v247-3zDusJFV6BTgJb1wMQm3_mvb7dKj14ezQfnSx08qvzV0In4dDJSa4TSKATYvVW30S1xTI2CrMGk3B1JIvg8fv6g6ek9eif4Aur3uxrzu6x2tNorxchBRafcYG2MM9CQ990OyShzyMuDX2Gw3E-Awl8RotYpRggmt-iYba241slCPCNo5fsyXcRjRxoL2j65NccRjYFjDz8GbogJeEETie3k-sYamZKxHvxGEAIhhNKSv5AvGoZhjgKYHyILmv5ggAkaau8RfCKy1TukCvaRMdEOYZvKEiXY3TK1zBEbxdzgnv7gDQrC97ac_SGd19_LyRmo_WvJ7HqcNqpgHZS-J85hYz5rfJ4r24RiJtHv7_tlbYw66Qb-U56sC8UJy45Rdvo7hYh7hBosebSHioEIsxFT6TLUC1P4nqtUVvyM9gNyevhgcj-ywo2DDAKUdAwHItBA3qKY8pLsPacre0diwRo-Ji27SAl-bV8HmcO6J0mGNk-tD9Ih4BQAzrZoVE68PIpQGCTrzc7Krc267h4pHgWYY9y3ZlEztQn-4RvfE7Yr3dY5TtskD9GmoNPVgE2PV7F1uZB8-FLtrILTz2vHjwd58jntlngMKk-cbKAUyJEbpQtPGT1Gis_Z-X_NCsHfP0Qc9xpt_EVCu3-1oek4WCf4ySxskmC-BbX_tKFBP8EJNKsbzfrLxB32zSojLis4WMlGMVqhnziU1ziSoG3o_6Oc07doZCmXHDlwSIluMX-JNPMPz9Mxb0NRUW4QSFzeBa8YovqT5GRUcHtL0_I658ECbcfJOC3nyW56wS5lmeuHybNWz3oVBCFCadDMClL0fHunkrJkRUiytqDIsqFwqDoVC5CBtxdFAa5twcMPBlIVpyU9ZdrgCI9UuxMDI6CGKwaSAyOgiiXASTJA0_Cl05bPhXq32leUQ0Pv6qarwi-6oAkD-9RLam-anzyZSXFt2JxxKWqRY6UvsWAJA9c528_LfKnAFMlXnSZJ_GNQyCfbgDDmImAkuhtz7RqZK2sNpmCubLJwotIJI4RDQUeXxE_vrZI898xPzMItEFy8OiHx_s-iE_8YRCaC54Z1WZwiZMfvCxy8IOzUryImSiHX8C2p0dljidDfWVUPrxRWOTjovLIK6yPj9zjtnyW_ItUKpV2Nduf3wDH4V4Ti4N_L9oyfutDM9wbVDfzIUWAcZwdsRhu81pGJkkF0HYtAnjjWkJY4s4HQB8gZgfXJeC1G1DghLulAJUKZXGNCoh1lEL46ijFnYznPBieOCHAJCBQW1bXB5z2YAKcaWPHuxg7wkdnm9D1bUrwLl5ngRU8CwUn51dNQkO00EpvH2fTMSJG5azDna5OfTD2UavBwMN1VgECfyjj5YgNecRyOLrtEbdNajwadUQ7aJVzGfNSt8DYRZohYlvJmJaV-iiTyXySL7jOJE19NDAwIL8T10yjkE3159okhRO-7Nn3yJ5qkwUnpSDtz5zO0EA2eWpoKG2cJO6nKHRc041ARyZjDCWTJ-ngpQzkdfgJ5T9AGPrMD2CQmw8DSJ4dPHPmJHnsDN98kv_-P6n3_00jxI1-_VN6NhAfHBrQ0kMnOYC9EMRP9fSAkr_BTinwLwwwrbmuNpMip8npmF45OVKxnjHOGGFiB5NDxpl0m-KuG_8D-XxZPw)
