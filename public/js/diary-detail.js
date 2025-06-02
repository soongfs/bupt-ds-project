// 获取用户登录状态
const isUserLoggedIn = document.body.dataset.userLoggedIn === 'true';
const diaryId = document.body.dataset.diaryId;
const isAuthor = document.body.dataset.isAuthor === 'true';

// 点赞功能
document.querySelector('.like-btn').addEventListener('click', async () => {
  if (!isUserLoggedIn) {
    alert('请先登录后再点赞');
    return;
  }

  try {
    const res = await fetch(`/api/diaries/${diaryId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    if (res.ok) {
      const countEl = document.querySelector('.like-btn span');
      countEl.textContent = parseInt(countEl.textContent) + 1;
    }
  } catch (err) {
    console.error(err);
  }
});

// 评分功能
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', async () => {
    if (!isUserLoggedIn) {
      alert('请先登录后再评分');
      return;
    }

    const rating = parseInt(star.dataset.rating);
    try {
      const res = await fetch(`/api/diaries/${diaryId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating }),
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        // 更新星星显示
        document.querySelectorAll('.star').forEach((s, index) => {
          s.classList.toggle('active', index < rating);
        });
        document.querySelector('.rating-value').textContent = `你的评分：${rating}分`;
        document.querySelector('.rating-stats').textContent = 
          `(${data.ratingCount}人评分 | 平均${data.avgRating.toFixed(1)}分)`;
      }
    } catch (err) {
      console.error(err);
    }
  });
});

// 收藏功能
document.querySelector('.favorite-btn').addEventListener('click', async () => {
  if (!isUserLoggedIn) {
    alert('请先登录后再收藏');
    return;
  }

  try {
    const res = await fetch(`/api/diaries/${diaryId}/favorite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    if (res.ok) {
      const btn = document.querySelector('.favorite-btn');
      btn.classList.toggle('active');
    }
  } catch (err) {
    console.error(err);
  }
});

// 分享功能
const shareBtn = document.querySelector('.share-btn');
const shareModal = document.querySelector('.share-modal');
const modalOverlay = document.querySelector('.modal-overlay');

shareBtn.addEventListener('click', () => {
  shareModal.classList.add('active');
  modalOverlay.classList.add('active');
});

modalOverlay.addEventListener('click', () => {
  shareModal.classList.remove('active');
  modalOverlay.classList.remove('active');
});

document.querySelectorAll('.share-option').forEach(option => {
  option.addEventListener('click', () => {
    const platform = option.dataset.platform;
    const url = window.location.href;
    const title = document.getElementById('diaryTitle').textContent;

    switch (platform) {
      case 'wechat':
        // 实现微信分享
        alert('请使用微信扫描二维码分享');
        break;
      case 'weibo':
        window.open(`http://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
        break;
      case 'qq':
        window.open(`http://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
        break;
      case 'link':
        navigator.clipboard.writeText(url).then(() => {
          alert('链接已复制到剪贴板');
        });
        break;
    }

    shareModal.classList.remove('active');
    modalOverlay.classList.remove('active');
  });
});

// 编辑功能
if (isUserLoggedIn && isAuthor) {
  const editToggleBtn = document.getElementById('editToggleBtn');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  let originalContent = {};

  // 进入编辑模式
  function enterEditMode() {
    // 保存原始内容
    originalContent = {
      title: document.getElementById('diaryTitle').textContent,
      dayTitles: Array.from(document.querySelectorAll('.day-title-text')).map(el => el.textContent),
      sectionTitles: Array.from(document.querySelectorAll('.section-title')).map(el => el.textContent),
      sectionContents: Array.from(document.querySelectorAll('.section-content')).map(el => el.textContent),
      tips: document.querySelector('.tips-content').textContent
    };

    // 使标题可编辑
    const diaryTitle = document.getElementById('diaryTitle');
    diaryTitle.contentEditable = true;
    diaryTitle.classList.add('editable');

    // 使每日标题可编辑
    document.querySelectorAll('.day-title-text').forEach((el, index) => {
      el.contentEditable = true;
      el.classList.add('editable');
      el.dataset.index = index;
    });

    // 使游记正文可以编辑
    document.querySelectorAll('.diary-content').forEach((el, index) => {
      el.contentEditable = true;
      el.classList.add('editable');
      el.dataset.index = index;
    });

    // 使章节标题可编辑
    document.querySelectorAll('.section-title').forEach((el, index) => {
      el.contentEditable = true;
      el.classList.add('editable');
      el.dataset.index = index;
    });

    // 使章节内容可编辑
    document.querySelectorAll('.section-content').forEach((el, index) => {
      el.contentEditable = true;
      el.classList.add('editable');
      el.dataset.index = index;
    });

    // 使小贴士可编辑
    const tipsContent = document.querySelector('.tips-content');
    tipsContent.contentEditable = true;
    tipsContent.classList.add('editable');

    // 切换按钮显示
    editToggleBtn.style.display = 'none';
    saveBtn.style.display = 'inline-flex';
    cancelBtn.style.display = 'inline-flex';
  }

  // 退出编辑模式
  function exitEditMode() {
    // 移除可编辑状态
    document.getElementById('diaryTitle').contentEditable = false;
    document.getElementById('diaryTitle').classList.remove('editable');

    document.querySelectorAll('.day-title-text').forEach(el => {
      el.contentEditable = false;
      el.classList.remove('editable');
    });

    document.querySelectorAll('.section-title').forEach(el => {
      el.contentEditable = false;
      el.classList.remove('editable');
    });

    document.querySelectorAll('.section-content').forEach(el => {
      el.contentEditable = false;
      el.classList.remove('editable');
    });

    document.querySelectorAll('.diary-content').forEach(el => {
      el.contentEditable = false;
      el.classList.remove('editable');
    });

    document.querySelector('.tips-content').contentEditable = false;
    document.querySelector('.tips-content').classList.remove('editable');

    // 切换按钮显示
    editToggleBtn.style.display = 'inline-flex';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
  }

  // 恢复原始内容
  function restoreOriginalContent() {
    document.getElementById('diaryTitle').textContent = originalContent.title;

    document.querySelectorAll('.day-title-text').forEach((el, index) => {
      el.textContent = originalContent.dayTitles[index];
    });

    document.querySelectorAll('.section-title').forEach((el, index) => {
      el.textContent = originalContent.sectionTitles[index];
    });

    document.querySelectorAll('.section-content').forEach((el, index) => {
      el.textContent = originalContent.sectionContents[index];
    });

    document.querySelector('.tips-content').textContent = originalContent.tips;
  }

  // 保存编辑内容
  async function saveEditedContent() {
    const updatedData = {
      title: document.getElementById('diaryTitle').textContent,
      dayTitles: Array.from(document.querySelectorAll('.day-title-text')).map(el => el.textContent),
      sectionTitles: Array.from(document.querySelectorAll('.section-title')).map(el => el.textContent),
      sectionContents: Array.from(document.querySelectorAll('.section-content')).map(el => el.textContent),
      tips: document.querySelector('.tips-content').textContent,
      content: document.querySelector('.diary-content').innerHTML
    };

    try {
      const response = await fetch(`/api/diaries-edit/${diaryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData),
        credentials: 'include'
      });

      if (response.ok) {
        alert('日记更新成功！');
        exitEditMode();
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
      restoreOriginalContent();
      exitEditMode();
    }
  }

  // 事件监听
  editToggleBtn.addEventListener('click', enterEditMode);
  saveBtn.addEventListener('click', saveEditedContent);
  cancelBtn.addEventListener('click', () => {
    restoreOriginalContent();
    exitEditMode();
  });
}

// 轮播图功能
let currentSlide = 0;
const slides = document.querySelectorAll('.carousel-item');
const dots = document.querySelectorAll('.carousel-dot');

function showSlide(index) {
  slides.forEach(slide => slide.style.display = 'none');
  dots.forEach(dot => dot.classList.remove('active'));

  slides[index].style.display = 'block';
  dots[index].classList.add('active');
  currentSlide = index;
}

dots.forEach((dot, index) => {
  dot.addEventListener('click', () => showSlide(index));
});

// 自动轮播
setInterval(() => {
  currentSlide = (currentSlide + 1) % slides.length;
  showSlide(currentSlide);
}, 5000);

// 初始化显示第一张
showSlide(0); 