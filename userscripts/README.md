# GitHub Bookmarks 油猴脚本

目标仓库：https://github.com/liu6tot/bookmarks

## 安装

1. 在 Chrome 的 Tampermonkey（油猴）中打开管理面板，选择“添加新脚本”。
2. 删除默认代码，将 `github-bookmarks.user.js` 全部代码粘贴进去，按 Ctrl+S 保存并启用。
3. 刷新普通 HTTP/HTTPS 网页，右下角会出现 ★。
4. 如果没有出现，检查扩展的站点访问权限；在支持“允许用户脚本”的 Chrome 版本中，打开油猴扩展详情页启用该选项，并按油猴提示完成设置。浏览器内部页和部分 PDF 页面不能注入。

## 收藏

点击 ★ → 点击分类标签，或填写新分类 → 编辑标题／网址 → 提交。

- 分类读取 `main` 分支 README 中的 `## 分类名称`，不是 GitHub Issue Labels。
- 分类标签自动换行，单选后以绿色和勾号高亮；记住上次提交的分类。
- 新分类优先于已有分类；点击分类标签会清空新分类输入，避免误用。
- 默认模式不需要令牌：打开已填好标题与正文的 GitHub Issue 页面；登录有权提交的账号，再点击 **Submit new issue**。
- GitHub Issue 标题格式：`[分类] 收藏标题 | https://网页地址`。
- 创建 Issue 后，仓库现有工作流更新 README 并关闭 Issue。Issue 创建成功不代表 README 已更新；失败时查看仓库 Actions。
- 每次打开弹窗都会刷新分类，失败时使用缓存；没有缓存也可以填写新分类。
- 为兼容当前工作流，标题中的方括号／反斜杠转为全角，分类不允许方括号／反斜杠，网址中的括号进行百分号编码。

## 可选：直接创建 Issue

如希望在弹窗中一次提交，打开油猴菜单 → **配置令牌：直接创建 Issue**。

在 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens 中创建令牌：

- Resource owner：`liu6tot`。
- Repository access：仅选择 `bookmarks`。
- Repository permissions：`Issues: Read and write`。

令牌保存在油猴脚本存储中，不写入脚本文件；请勿将包含令牌的油猴备份公开。删除令牌菜单可恢复默认提交页模式。

## 实现参考

- [现有仓库工作流](https://github.com/liu6tot/bookmarks/blob/main/.github/workflows/bookmark.yml)
- [Tampermonkey 文档](https://www.tampermonkey.net/documentation.php)
- [GitHub Issue URL 参数](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue)
- [GitHub 创建 Issue API](https://docs.github.com/en/rest/issues/issues#create-an-issue)

验证范围：JavaScript 语法和分类提取／Issue 格式兼容性；未使用真实账号创建测试 Issue。
