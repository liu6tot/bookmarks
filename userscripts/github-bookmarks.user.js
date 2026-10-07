// ==UserScript==
// @name         GitHub Bookmarks ★
// @namespace    https://github.com/liu6tot/bookmarks
// @version      1.2.0
// @description  从 README 读取分类，将当前网页收藏为 GitHub Issue
// @match        http://*/*
// @match        https://*/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// ==/UserScript==

(() => {
  'use strict';
  const REPO = 'liu6tot/bookmarks';
  const README = `https://raw.githubusercontent.com/${REPO}/main/README.md`;
  const TOKEN_KEY = `token:${REPO}`;
  const CACHE_KEY = `categories:${REPO}`;

  function request(url, options = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        url, method: 'GET', timeout: 20000, anonymous: true,
        ...options,
        onload: r => {
          if (r.status >= 200 && r.status < 300) resolve(r.responseText);
          else reject(new Error(`请求失败（HTTP ${r.status}）。${r.status === 401 || r.status === 403 ? '请检查令牌权限或请求额度。' : ''}`));
        },
        onerror: () => reject(new Error('网络请求失败，请检查连接或油猴的域名访问权限。')),
        ontimeout: () => reject(new Error('请求超时，请重试。'))
      });
    });
  }

  function parseCategories(markdown) {
    const found = [];
    let fence = null;
    for (const line of markdown.split(/\r?\n/)) {
      const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (delimiter) {
        const marker = delimiter[1];
        if (!fence) fence = marker;
        else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
        continue;
      }
      if (fence) continue;
      // Match the workflow's exact heading format: "## CATEGORY".
      if (line.startsWith('## ')) {
        const name = line.slice(3);
        if (name && name === name.trim() && !/[\[\]\\]/.test(name) && !found.includes(name)) found.push(name);
      }
    }
    return found;
  }

  function buildIssue(category, title, url, cleanTracking = true) {
    category = category.trim();
    if (!category || /[\[\]\\\r\n]/.test(category)) throw new Error('请选择或填写分类；分类不能包含方括号、反斜杠或换行。');
    // The existing workflow writes raw Markdown and passes strings through awk.
    title = title.replace(/\s+/g, ' ').trim().replace(/\[/g, '［').replace(/\]/g, '］').replace(/\\/g, '＼');
    if (!title) throw new Error('请填写收藏标题。');
    let parsed;
    try { parsed = new URL(url.trim()); } catch { throw new Error('请输入有效的网址。'); }
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('网址必须以 http:// 或 https:// 开头。');
    if (parsed.username || parsed.password) throw new Error('请移除网址中的账号或密码后再收藏。');
    if (cleanTracking) {
      for (const key of [...parsed.searchParams.keys()]) {
        if (/^utm_/i.test(key) || /^(gclid|dclid|fbclid|msclkid|gad_source|gad_campaignid|gbraid|wbraid)$/i.test(key)) parsed.searchParams.delete(key);
      }
    }
    const safeURL = parsed.href.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '%5C');
    const fullTitle = title;
    const available = 256 - (`[${category}] ` + ` | ${safeURL}`).length;
    if (available < 1) throw new Error('分类和网址过长，无法放入 Issue 标题。请使用该网页的较短原始链接；脚本不会截断网址。');
    if (title.length > available) {
      title = available === 1 ? '…' : title.slice(0, available - 1).replace(/[\uD800-\uDBFF]$/, '') + '…';
    }
    return { title: `[${category}] ${title} | ${safeURL}`, body: `- 分类：${category}\n- 网页标题：${fullTitle}\n- 链接：${safeURL}\n\n由 GitHub Bookmarks 油猴脚本创建。` };
  }

  GM_registerMenuCommand('配置令牌：直接创建 Issue', () => {
    const token = prompt('可选：输入 fine-grained GitHub token，仅授权 liu6tot/bookmarks 的 Issues: Read and write。\n留空不修改。令牌保存在油猴脚本存储中。');
    if (token && token.trim()) { GM_setValue(TOKEN_KEY, token.trim()); alert('已保存。之后可在弹窗中直接创建 Issue。'); }
  });
  GM_registerMenuCommand('删除已保存令牌', () => { GM_deleteValue(TOKEN_KEY); alert('已删除令牌，将使用 GitHub 新建 Issue 页面。'); });

  const host = document.createElement('div');
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;width:0!important;height:0!important;z-index:2147483647!important;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host{color-scheme:light}*{box-sizing:border-box}button,input,select{font:inherit}
      button{cursor:pointer}.star{position:fixed;right:20px;bottom:24px;width:48px;height:48px;border:0;border-radius:50%;background:#ffc947;color:#242424;font:28px sans-serif;box-shadow:0 3px 14px #0004}
      .overlay{position:fixed;inset:0;background:#0006;display:flex;align-items:center;justify-content:center;padding:16px;font:14px/1.5 system-ui,sans-serif;color:#222}
      [hidden]{display:none!important}.panel{background:white;border-radius:14px;padding:22px;width:450px;max-width:100%;max-height:90vh;overflow:auto;box-shadow:0 10px 50px #0005}
      h2{font-size:19px;margin:0 0 14px}label{display:block;margin:12px 0 5px;font-weight:600}input,select{width:100%;padding:9px;border:1px solid #bbb;border-radius:7px;background:#fff;color:#222}
      .category-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0 10px;font-weight:600}.category-header .reload{padding:4px 8px;font-size:12px;font-weight:400}
      .tags{display:flex;flex-wrap:wrap;gap:8px;max-height:180px;overflow:auto;padding:3px}.tag{border:1px solid #dce3df;border-radius:999px;padding:6px 13px;background:#f6f8f7;color:#37443b;max-width:100%;overflow-wrap:anywhere;transition:background .15s,border-color .15s}
      .tag:hover{background:#eaf3ed;border-color:#85ad92}.tag[aria-pressed="true"]{background:#19733c;border-color:#19733c;color:white}.tag[aria-pressed="true"]::before{content:'✓ ';font-weight:700}.tag:focus-visible{outline:2px solid #19733c;outline-offset:2px}
      .hint{color:#666;font-size:12px;margin:5px 0}.status{white-space:pre-wrap;margin:10px 0;color:#555}.error{color:#b42318}.actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
      .actions button,.reload{border:1px solid #ccc;border-radius:7px;padding:8px 12px;background:#f6f6f6;color:#222}.actions .primary{background:#19733c;color:white;border-color:#19733c}button:disabled{opacity:.55;cursor:wait}a{color:#0969da}
    </style>
    <button class="star" title="收藏到 GitHub bookmarks" aria-label="收藏到 GitHub bookmarks">★</button>
    <div class="overlay" hidden>
      <form class="panel" role="dialog" aria-modal="true" aria-labelledby="heading">
        <h2 id="heading">★ 收藏到 GitHub</h2>
        <div class="hint">仓库：liu6tot/bookmarks · 分类来自 README</div>
        <div class="category-header"><span id="category-label">已有分类</span><button type="button" class="reload">刷新分类</button></div>
        <div id="category" class="tags" role="group" aria-labelledby="category-label"></div>
        <p class="hint selection">点击标签选择一个分类</p>
        <label for="new-category">新分类（可选）</label><input id="new-category" placeholder="填写后优先使用新分类" maxlength="80">
        <label for="title">收藏标题</label><input id="title" required>
        <label for="url">网页地址</label><input id="url" type="url" required>
        <label class="hint" style="font-weight:400"><input id="clean-tracking" type="checkbox" checked style="width:auto;margin-right:6px">移除常见广告跟踪参数（utm、gclid 等）</label>
        <p class="hint mode"></p><p class="status" role="status" aria-live="polite"></p>
        <div class="actions"><button type="button" class="cancel">取消</button><button type="submit" class="primary">打开 GitHub 提交页</button></div>
      </form>
    </div>`;
  document.documentElement.appendChild(host);
  const $ = selector => root.querySelector(selector);
  const overlay = $('.overlay'), tags = $('#category'), status = $('.status'), submit = $('.primary');
  let selectedCategory = '';
  let busy = false, previousFocus;
  function report(message, error = false) { status.textContent = message; status.classList.toggle('error', error); }
  function populate(categories) {
    const selected = selectedCategory || GM_getValue(`lastCategory:${REPO}`, '');
    tags.replaceChildren();
    selectedCategory = categories.includes(selected) ? selected : '';
    for (const category of categories) {
      const tag = document.createElement('button');
      tag.type = 'button'; tag.className = 'tag'; tag.textContent = category;
      tag.dataset.category = category;
      tag.addEventListener('click', () => {
        selectedCategory = category;
        $('#new-category').value = '';
        updateSelection();
      });
      tags.append(tag);
    }
    updateSelection();
  }
  function updateSelection() {
    const custom = $('#new-category').value.trim();
    for (const tag of tags.querySelectorAll('.tag')) {
      tag.setAttribute('aria-pressed', String(!custom && tag.dataset.category === selectedCategory));
    }
    $('.selection').textContent = custom ? `将使用新分类：${custom}` : selectedCategory ? `已选择：${selectedCategory}` : '点击标签选择一个分类，或在下方填写新分类';
  }
  async function loadCategories() {
    $('.reload').disabled = true;
    report('正在读取 README 分类…');
    try {
      const categories = parseCategories(await request(`${README}?t=${Date.now()}`));
      GM_setValue(CACHE_KEY, categories); populate(categories);
      report(categories.length ? `已读取 ${categories.length} 个分类。` : 'README 暂无分类，请填写新分类。');
    } catch (error) {
      const cached = GM_getValue(CACHE_KEY, []); populate(cached);
      report(`${error.message}\n${cached.length ? '已使用上次缓存的分类。' : '仍可手动填写新分类。'}`, true);
    } finally { $('.reload').disabled = false; }
  }
  function close() { if (!busy) { overlay.hidden = true; previousFocus?.focus(); } }
  $('.star').addEventListener('click', () => {
    if (!overlay.hidden) return;
    previousFocus = document.activeElement;
    overlay.hidden = false;
    $('#title').value = document.title || location.hostname;
    $('#url').value = location.href;
    $('#new-category').value = '';
    const direct = Boolean(GM_getValue(TOKEN_KEY, ''));
    submit.textContent = direct ? '创建 Issue 并收藏' : '打开 GitHub 提交页';
    $('.mode').textContent = direct ? '提交后直接创建 Issue，由仓库工作流写入 README。' : '无需令牌；打开 GitHub 后，点击 Submit new issue 完成提交。';
    populate(GM_getValue(CACHE_KEY, []));
    $('#title').focus(); loadCategories();
  });
  $('.reload').addEventListener('click', loadCategories);
  $('#new-category').addEventListener('input', updateSelection);
  $('.cancel').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab' && !overlay.hidden) {
      const fields = [...$('.panel').querySelectorAll('button,input,select,a')].filter(el => !el.disabled);
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && root.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && root.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  $('.panel').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    try {
      const category = $('#new-category').value.trim() || selectedCategory;
      const issue = buildIssue(category, $('#title').value, $('#url').value, $('#clean-tracking').checked);
      const token = GM_getValue(TOKEN_KEY, '');
      if (!token) {
        const query = new URLSearchParams(issue);
        GM_openInTab(`https://github.com/${REPO}/issues/new?${query}`, { active: true, insert: true });
        GM_setValue(`lastCategory:${REPO}`, category);
        report('已打开 GitHub。请在新页面点击 Submit new issue；此时尚未收藏。');
        return;
      }
      busy = true; submit.disabled = true; report('正在创建 Issue，请稍候…');
      const result = JSON.parse(await request(`https://api.github.com/repos/${REPO}/issues`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }, data: JSON.stringify(issue)
      }));
      GM_setValue(`lastCategory:${REPO}`, category);
      report(`Issue #${result.number} 已创建；README 更新仍需等待工作流完成。`);
      const link = document.createElement('a'); link.textContent = '查看 Issue／工作流结果'; link.href = result.html_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; status.append(document.createElement('br'), link);
    } catch (error) { report(`${error.message}\n若提交请求超时，请先检查仓库 Issues，确认是否已创建，再决定重试。`, true); }
    finally { busy = false; submit.disabled = false; }
  });
})();
