// 全局变量用于存储当前文章标题
const parentFolderName = 'WeixinArticles';
let currentArticleTitle = '';
let currentSafeArticleTitle = '';
let currentArticleDir = '';

// 创建一个映射来存储原始图片URL和新文件名的对应关系
const imageMap = new Map();

// 使用更好的哈希算法
const hashCode = (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    h1 = Math.imul(h1 ^ byte, 2654435761);
    h2 = Math.imul(h2 ^ byte, 1597334677);
  }
  
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  // 生成8位的十六进制字符串
  return ('0000000' + (h1 >>> 0).toString(16)).slice(-8);
};

// 处理下载路径
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // 检查是否是来自我们的扩展的下载
  if (downloadItem.byExtensionId === chrome.runtime.id) {
    // 构建新的文件路径
    let newFilename;

    // 通过文件扩展名判断是否为图片
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const fileExt = downloadItem.filename.split('.').pop().toLowerCase();
    if (imageExtensions.includes(fileExt)) {
      // 如果是图片文件，保存到 images 子文件夹
      const imageNage = imageMap.get(downloadItem.url);
      newFilename = `${parentFolderName}/${currentArticleDir}/images/${imageNage}`;
    } else {
      // 如果是HTML文件，使用原始文章标题（但可能需要处理文件名中不允许的字符）
      const safeHtmlFileName = currentArticleTitle.replace(/[\\/:*?"<>|]/g, '_') + '.html';
      newFilename = `${parentFolderName}/${currentArticleDir}/${safeHtmlFileName}`;
    }
    
    suggest({ filename: newFilename });
  }
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveArticle') {
    // 存储文章标题以供后续使用
    currentArticleTitle = message.title;
    currentSafeArticleTitle = message.title.replace(/[\\/:*?"<>|]/g, '_'); // 处理文件名中不允许的字符
    const currentArticleDate = message.date ? message.date + ' ' : '';
    currentArticleDir = currentArticleDate + currentSafeArticleTitle;
    
    // 处理HTML内容中的图片
    let htmlContent = message.content;
    
    // 使用正则表达式匹配所有img标签
    const imgRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/g;
    let match;
    let index = 0;
    
    while ((match = imgRegex.exec(htmlContent)) !== null) {
      const originalSrc = match[1].trim();
      if (!originalSrc) continue;
      
      const imageHash = hashCode(originalSrc);
      
      // 从URL参数中获取正确的文件扩展名
      const wxFmtMatch = originalSrc.match(/wx_fmt=(\w+)/);
      const imageExt = wxFmtMatch ? wxFmtMatch[1] : 'jpg';
      
      const newImageName = `${imageHash}_${index}.${imageExt}`;
      
      // 存储映射关系
      imageMap.set(originalSrc, newImageName);
      
      // 替换HTML中的图片URL
      htmlContent = htmlContent.replace(
        originalSrc,
        `images/${newImageName}`
      );
      
      index++;
    }
    
    // 创建HTML文件的Data URL
    const base64Content = btoa(new TextEncoder().encode(htmlContent).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    const htmlDataUrl = 'data:text/html;charset=utf-8;base64,' + base64Content;
    
    // 保存HTML文件
    const safeHtmlFileName = currentSafeArticleTitle + '.html';
    chrome.downloads.download({
      url: htmlDataUrl,
      filename: safeHtmlFileName,
      saveAs: false
    }, async (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, message: '保存失败：' + chrome.runtime.lastError.message });
        return;
      }

      // 下载所有图片到 images 文件夹，使用新的文件名
      const imagePromises = Array.from(imageMap.entries()).map(([originalUrl, newName]) => {
        return new Promise((resolve) => {
          chrome.downloads.download({
            url: originalUrl,
            filename: newName,
            saveAs: false,
            conflictAction: 'uniquify'
          }, (imgDownloadId) => {
            resolve(!!imgDownloadId);
          });
        });
      });

      try {
        await Promise.all(imagePromises);
        sendResponse({ success: true, message: '文章和图片保存成功' });
      } catch (error) {
        sendResponse({ success: false, message: '部分图片下载失败' });
      }
    });

    // 返回true表示将异步发送响应
    return true;
  }
});