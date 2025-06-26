// 获取文章标题
function getArticleTitle() {
  const titleElement = document.getElementById('activity-name');
  return titleElement ? titleElement.innerText.trim() : '未命名文章';
}

// 获取文章作者
function getArticleAuthor() {
  const authorElement = document.getElementById('js_name');
  return authorElement ? authorElement.innerText.trim() : '未知作者';
}

// 获取发布时间
function getPublishTime() {
  const timeElement = document.getElementById('publish_time');
  return timeElement ? timeElement.innerText.trim() : '';
}


// 获取发布时间并格式化为YYYY-MM-DD
function getFormattedDate() {
  const timeElement = document.getElementById('publish_time');
  if (!timeElement) return '';
  
  const timeText = timeElement.innerText.trim();
  // 匹配中文日期格式，如"2025年04月18日 07:44"
  const match = timeText.match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (!match) return '';
  
  // 返回YYYY-MM-DD格式
  return `${match[1]}-${match[2]}-${match[3]}`;
}

// 获取文章正文内容
function getArticleContent() {
  const article = document.getElementById('js_content');
  if (!article) return null;

  // 克隆文章内容以保持原始排版
  const clonedArticle = article.cloneNode(true);
  
  // 处理图片，将图片URL保存下来
  const images = clonedArticle.querySelectorAll('img');
  const imageUrls = [];
  
  images.forEach(img => {
    const src = img.getAttribute('data-src') || img.src;
    if (src) {
      imageUrls.push(src);
      // 将data-src的值设置到src属性，确保图片能正常显示
      img.src = src;
      // 移除懒加载相关属性
      img.removeAttribute('data-src');
      img.removeAttribute('data-type');
      img.removeAttribute('data-w');
      img.style.visibility = 'visible';
    }
  });

  // 获取作者和发布时间信息
  const author = getArticleAuthor();
  const publishTime = getPublishTime();
  
  // 创建包含元信息的头部
  const metaHeader = document.createElement('div');
  metaHeader.style.marginBottom = '20px';
  metaHeader.style.paddingBottom = '10px';
  metaHeader.style.borderBottom = '1px solid #eee';
  metaHeader.innerHTML = `
    <h1>${getArticleTitle()}</h1>
    <div style="color: #666; font-size: 14px; margin-top: 10px;">
      <span>${author}</span>
      ${publishTime ? `<span style="margin-left: 15px;">发布时间: ${publishTime}</span>` : ''}
    </div>
  `;

  // 创建一个容器来包裹头部和文章内容
  const container = document.createElement('div');
  container.appendChild(metaHeader);
  container.appendChild(clonedArticle);

  // 获取完整的HTML内容，包括容器本身
  const content = `
    <style>
      .article-container {
        max-width: 677px;
        margin: 0 auto;
        padding: 0 20px;
        box-sizing: border-box;
      }
    </style>
    <div class="article-container">
      ${container.innerHTML}
    </div>
  `;
  
  return {
    html: content,
    images: imageUrls,
    title: getArticleTitle(),
    date: getFormattedDate()
  };
}

// 发送消息到background script
function saveArticle() {
  const button = document.querySelector('.save-article-btn');
  if (!button) return;

  // 禁用按钮，显示保存中状态
  button.disabled = true;
  button.textContent = '保存中...';
  button.style.background = '#999';

  const content = getArticleContent();
  if (content) {
    chrome.runtime.sendMessage({
      action: 'saveArticle',
      content: content.html,
      images: content.images,
      title: content.title,
      date: content.date
    }, () => {
      // 恢复按钮状态
      button.disabled = false;
      button.textContent = '保存文章';
      button.style.background = '#07C160';
    });
  } else {
    // 如果没有内容，也恢复按钮状态
    button.disabled = false;
    button.textContent = '保存文章';
    button.style.background = '#07C160';
  }
}

// 确保按钮只添加一次
if (!document.querySelector('.save-article-btn')) {
  const button = document.createElement('button');
  button.textContent = '保存文章';
  button.className = 'save-article-btn';
  button.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 10px; background: #07C160; color: white; border: none; border-radius: 4px; cursor: pointer;';
  button.addEventListener('click', saveArticle);
  document.body.appendChild(button);
}