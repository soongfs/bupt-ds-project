console.log('diary-detail.js 已加载');

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM 已加载完成');
  
  // 获取用户登录状态
  const isUserLoggedIn = document.body.dataset.userLoggedIn === 'true';
  const diaryId = document.body.dataset.diaryId;
  const isAuthor = document.body.dataset.isAuthor === 'true';

  console.log('用户状态:', {
    isUserLoggedIn,
    diaryId,
    isAuthor
  });

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
    console.log('初始化编辑功能');
    
    const editToggleBtn = document.getElementById('editToggleBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    let editor = null;
    let originalContent = {};

    if (!editToggleBtn || !saveBtn || !cancelBtn) {
      console.error('找不到编辑按钮:', {
        editToggleBtn: !!editToggleBtn,
        saveBtn: !!saveBtn,
        cancelBtn: !!cancelBtn
      });
      return;
    }

    // 初始化富文本编辑器
    function initEditor(container) {
      console.log('初始化编辑器');
      return new Quill(container, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'align': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'image'],
            ['clean']
          ]
        },
        placeholder: '在这里写下你的旅行故事...'
      });
    }

    // 进入编辑模式
    function enterEditMode() {
      console.log('进入编辑模式');
      try {
        // 保存原始内容
        originalContent = {
          title: document.getElementById('diaryTitle').textContent,
          content: document.querySelector('.diary-content').innerHTML,
          tips: document.querySelector('.tips-content').textContent,
          cover_image: document.getElementById('editCoverPreview').src,
          sections: getSectionsData()
        };

        // 显示编辑表单，隐藏显示内容
        document.querySelector('.edit-form').style.display = 'block';
        document.querySelector('.diary-content').style.display = 'none';
        document.querySelector('.tips-content').style.display = 'none';

        // 初始化富文本编辑器
        editor = initEditor(document.getElementById('editor-container'));
        editor.root.innerHTML = originalContent.content;

        // 设置封面图片上传处理
        document.getElementById('editCoverUpload').addEventListener('change', handleCoverImageUpload);
        
        // 设置媒体文件上传处理
        document.getElementById('mediaUpload').addEventListener('change', handleMediaUpload);

        // 设置每日行程编辑事件监听
        setupSectionsEventListeners();

        // 切换按钮显示
        editToggleBtn.style.display = 'none';
        saveBtn.style.display = 'inline-flex';
        cancelBtn.style.display = 'inline-flex';
      } catch (error) {
        console.error('进入编辑模式失败:', error);
      }
    }

    // 获取所有章节数据
    function getSectionsData() {
      const sections = [];
      document.querySelectorAll('.section-item').forEach(item => {
        sections.push({
          id: item.dataset.sectionId,
          title: item.querySelector('.section-title').value,
          content: item.querySelector('.section-content').value,
          day_number: parseInt(item.closest('.day-section').dataset.day)
        });
      });
      return sections;
    }

    // 设置章节编辑的事件监听
    function setupSectionsEventListeners() {
      // 添加新的一天
      document.getElementById('addDayBtn').addEventListener('click', () => {
        const days = document.querySelectorAll('.day-section');
        const newDayNumber = days.length + 1;
        
        const daySection = document.createElement('div');
        daySection.className = 'day-section';
        daySection.dataset.day = newDayNumber;
        daySection.innerHTML = `
          <h3>第 ${newDayNumber} 天</h3>
          <button type="button" class="btn btn-outline-primary add-section" data-day="${newDayNumber}">
            <i class="fas fa-plus"></i> 添加新段落
          </button>
        `;
        
        document.getElementById('sections-container').appendChild(daySection);
        setupAddSectionButton(daySection.querySelector('.add-section'));
      });

      // 为现有的添加段落按钮添加事件监听
      document.querySelectorAll('.add-section').forEach(setupAddSectionButton);

      // 为现有的删除段落按钮添加事件监听
      document.querySelectorAll('.remove-section').forEach(setupRemoveSectionButton);
    }

    // 设置添加段落按钮的事件监听
    function setupAddSectionButton(button) {
      button.addEventListener('click', () => {
        const dayNumber = button.dataset.day;
        const sectionItem = document.createElement('div');
        sectionItem.className = 'section-item';
        sectionItem.dataset.sectionId = 'new_' + Date.now(); // 临时ID
        sectionItem.innerHTML = `
          <div class="form-group">
            <label>标题</label>
            <input type="text" class="form-control section-title" placeholder="输入标题">
          </div>
          <div class="form-group">
            <label>内容</label>
            <textarea class="form-control section-content" rows="4" placeholder="输入内容"></textarea>
          </div>
          <button type="button" class="btn btn-danger remove-section">删除此段</button>
        `;
        
        button.parentElement.insertBefore(sectionItem, button);
        setupRemoveSectionButton(sectionItem.querySelector('.remove-section'));
      });
    }

    // 设置删除段落按钮的事件监听
    function setupRemoveSectionButton(button) {
      button.addEventListener('click', () => {
        if (confirm('确定要删除这一段吗？')) {
          button.closest('.section-item').remove();
        }
      });
    }

    // 处理封面图片上传
    async function handleCoverImageUpload(event) {
      const file = event.target.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('image', file);

        try {
          const response = await fetch('/diary/api/upload-image', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            document.getElementById('editCoverPreview').src = `/uploads/${data.filename}`;
            coverImageFilename = data.filename;
          } else {
            throw new Error('上传失败');
          }
        } catch (error) {
          console.error('封面上传失败:', error);
          alert('封面图片上传失败，请重试');
        }
      }
    }

    // 更新轮播图
    function updateCarousel() {
      const carousel = document.querySelector('.media-carousel');
      const items = document.querySelectorAll('.media-preview-item');
      
      // 清空现有轮播图
      carousel.innerHTML = '';
      
      // 添加新的轮播项
      items.forEach((item, index) => {
        const mediaElement = item.querySelector('img, video');
        const isVideo = mediaElement.tagName.toLowerCase() === 'video';
        const mediaUrl = mediaElement.src;

        const carouselItem = document.createElement('div');
        carouselItem.className = `carousel-item ${index === 0 ? 'active' : ''} ${isVideo ? 'video' : ''}`;
        
        if (isVideo) {
          const video = document.createElement('video');
          video.src = mediaUrl;
          video.controls = true;
          carouselItem.appendChild(video);
        } else {
          // 确保图片URL包含完整路径
          const fullUrl = mediaUrl.startsWith('http') || mediaUrl.startsWith('/') 
            ? mediaUrl 
            : '/uploads/' + mediaUrl;
          carouselItem.style.backgroundImage = `url('${fullUrl}')`;
        }
        
        carousel.appendChild(carouselItem);
      });

      // 添加导航点
      if (items.length > 1) {
        const nav = document.createElement('div');
        nav.className = 'carousel-nav';
        items.forEach((_, index) => {
          const dot = document.createElement('div');
          dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
          dot.addEventListener('click', () => showSlide(index));
          nav.appendChild(dot);
        });
        carousel.appendChild(nav);
      }

      // 如果没有媒体，显示占位符
      if (items.length === 0) {
        carousel.innerHTML = `
          <div class="carousel-placeholder">
            <i class="fas fa-images"></i>
            <p>暂无图片</p>
          </div>
        `;
      }
    }

    // 处理媒体文件上传
    async function handleMediaUpload(event) {
      const files = event.target.files;
      const mediaPreview = document.getElementById('mediaPreview');
      
      // 获取压缩设置
      const enableCompression = document.getElementById('enableCompression').checked;
      const maxWidth = parseInt(document.getElementById('maxWidth').value);
      const maxHeight = parseInt(document.getElementById('maxHeight').value);
      const quality = parseInt(document.getElementById('quality').value) / 100;

      // 保存当前的媒体状态
      const currentMedia = Array.from(mediaPreview.children).map(item => ({
        id: item.dataset.mediaId,
        url: item.querySelector('img, video').src,
        caption: item.querySelector('.media-caption').value,
        type: item.querySelector('video') ? 'video' : 'image'
      }));

      for (const file of files) {
        try {
          let processedFile = file;
          
          // 如果启用了压缩，进行图片压缩
          if (enableCompression && file.type.startsWith('image/')) {
            const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: Math.max(maxWidth, maxHeight),
              useWebWorker: true,
              maxIteration: 10,
              initialQuality: quality,
            };
            
            try {
              processedFile = await imageCompression(file, options);
              console.log('压缩前大小:', file.size / 1024 / 1024, 'MB');
              console.log('压缩后大小:', processedFile.size / 1024 / 1024, 'MB');
            } catch (error) {
              console.error('图片压缩失败:', error);
              processedFile = file; // 如果压缩失败，使用原始文件
            }
          }

          const formData = new FormData();
          formData.append('image', processedFile);

          const response = await fetch('/diary/api/upload-image', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            const mediaUrl = `/uploads/${data.filename}`;
            
            // 创建预览元素
            const previewDiv = document.createElement('div');
            previewDiv.className = 'media-preview-item';
            previewDiv.dataset.mediaId = 'new_' + Date.now();
            previewDiv.innerHTML = `
              <img src="${mediaUrl}" alt="媒体预览">
              <div class="media-preview-controls">
                <input type="text" class="form-control media-caption" placeholder="添加说明文字...">
                <button type="button" class="btn btn-danger remove-media">删除</button>
              </div>
            `;

            // 添加删除事件监听
            const removeBtn = previewDiv.querySelector('.remove-media');
            removeBtn.addEventListener('click', () => {
              if (confirm('确定要删除这张图片吗？')) {
                previewDiv.remove();
                updateCarousel(); // 删除后更新轮播图
              }
            });

            // 将新媒体添加到当前媒体列表
            currentMedia.push({
              id: previewDiv.dataset.mediaId,
              url: mediaUrl,
              caption: '',
              type: 'image'
            });

            mediaPreview.appendChild(previewDiv);
            updateCarousel(); // 添加新图片后更新轮播图

            // 保存当前媒体状态到隐藏字段
            const mediaInput = document.createElement('input');
            mediaInput.type = 'hidden';
            mediaInput.name = 'media';
            mediaInput.value = JSON.stringify(currentMedia);
            mediaPreview.appendChild(mediaInput);
          } else {
            throw new Error('上传失败');
          }
        } catch (error) {
          console.error('媒体上传失败:', error);
          alert('媒体文件上传失败，请重试');
        }
      }
    }

    // 获取所有媒体数据
    function getMediaData() {
      const mediaItems = [];
      document.querySelectorAll('.media-preview-item').forEach((item, index) => {
        const mediaElement = item.querySelector('img, video');
        const captionInput = item.querySelector('.media-caption');
        mediaItems.push({
          id: item.dataset.mediaId,
          url: mediaElement.src.split('/').pop(),
          caption: captionInput ? captionInput.value : '',
          type: mediaElement.tagName.toLowerCase() === 'video' ? 'video' : 'image',
          order: index + 1
        });
      });
      return mediaItems;
    }

    // 退出编辑模式
    function exitEditMode() {
      console.log('退出编辑模式');
      try {
        if (editor) {
          editor.destroy();
          editor = null;
        }

        // 恢复原始内容
        document.querySelector('.edit-form').style.display = 'none';
        document.querySelector('.diary-content').style.display = 'block';
        document.querySelector('.tips-content').style.display = 'block';

        document.querySelector('.diary-content').innerHTML = originalContent.content;
        document.querySelector('.tips-content').textContent = originalContent.tips;
        document.getElementById('editCoverPreview').src = originalContent.cover_image;

        // 切换按钮显示
        editToggleBtn.style.display = 'inline-flex';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
      } catch (error) {
        console.error('退出编辑模式失败:', error);
      }
    }

    // 保存编辑内容
    async function saveEditedContent() {
      console.log('保存编辑内容');
      try {
        const sections = getSectionsData();
        const mediaItems = getMediaData();
        console.log('章节数据:', sections);
        console.log('媒体数据:', mediaItems);

        // 创建 FormData 对象
        const formData = new FormData();
        formData.append('title', document.getElementById('editTitle').value);
        formData.append('content', editor.root.innerHTML);
        formData.append('tips', document.getElementById('editTips').value || '');
        
        // 处理封面图片
        const coverImage = document.getElementById('editCoverPreview').src.split('/').pop();
        formData.append('cover_image', coverImage);
        
        // 添加章节数据
        formData.append('sections', JSON.stringify(sections));
        
        // 处理媒体数据
        const mediaData = Array.from(document.querySelectorAll('.media-preview-item')).map((item, index) => {
          const mediaElement = item.querySelector('img, video');
          const captionInput = item.querySelector('.media-caption');
          return {
            id: item.dataset.mediaId,
            url: mediaElement.src.split('/').pop(),
            type: mediaElement.tagName.toLowerCase() === 'video' ? 'video' : 'image',
            caption: captionInput ? captionInput.value : '',
            order: index + 1
          };
        });
        formData.append('media', JSON.stringify(mediaData));

        // 添加新上传的媒体文件
        const mediaFiles = document.getElementById('mediaUpload').files;
        Array.from(mediaFiles).forEach((file, index) => {
          formData.append(`mediaFiles`, file);
        });

        console.log('准备发送的数据:', {
          title: formData.get('title'),
          content: formData.get('content'),
          tips: formData.get('tips'),
          cover_image: formData.get('cover_image'),
          sections: JSON.parse(formData.get('sections')),
          media: JSON.parse(formData.get('media'))
        });

        const response = await fetch(`/diary/api/diaries/${diaryId}`, {
          method: 'PUT',
          body: formData,
          credentials: 'include'
        });

        const result = await response.json();
        console.log('服务器响应:', result);
        
        if (result.success) {
          alert('游记更新成功！');
          window.location.reload();
        } else {
          throw new Error(result.message || '保存失败');
        }
      } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败: ' + error.message);
      }
    }

    // 事件监听
    editToggleBtn.addEventListener('click', (event) => {
      console.log('编辑按钮被点击');
      enterEditMode();
    });

    saveBtn.addEventListener('click', (event) => {
      console.log('保存按钮被点击');
      saveEditedContent();
    });

    cancelBtn.addEventListener('click', (event) => {
      console.log('取消按钮被点击');
      if (confirm('确定要取消编辑吗？所有更改将不会保存。')) {
        exitEditMode();
      }
    });

    // 质量滑块值显示
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    if (qualitySlider && qualityValue) {
      qualitySlider.addEventListener('input', function() {
        qualityValue.textContent = this.value + '%';
      });
    }

    // 压缩开关状态改变
    const enableCompression = document.getElementById('enableCompression');
    const compressionOptions = document.querySelector('.compression-options');
    if (enableCompression && compressionOptions) {
      enableCompression.addEventListener('change', function() {
        compressionOptions.style.display = this.checked ? 'grid' : 'none';
      });
    }
  } else {
    console.log('用户没有编辑权限:', {
      isUserLoggedIn,
      isAuthor
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

  // 初始化轮播图
  initCarousel();

  // 为媒体预览项添加拖拽排序功能
  const mediaPreview = document.getElementById('mediaPreview');
  if (mediaPreview) {
    new Sortable(mediaPreview, {
      animation: 150,
      onEnd: function() {
        updateCarousel(); // 排序结束后更新轮播图
      }
    });
  }

  // 媒体库功能
  let selectedMediaItems = new Set();

  // 打开媒体库模态框
  document.getElementById('openMediaLibrary').addEventListener('click', () => {
    document.getElementById('mediaLibraryModal').style.display = 'block';
    loadMediaLibrary();
  });

  // 关闭媒体库模态框
  document.querySelectorAll('.close-modal').forEach(button => {
    button.addEventListener('click', () => {
      document.getElementById('mediaLibraryModal').style.display = 'none';
    });
  });

  // 加载媒体库内容
  async function loadMediaLibrary(type = 'all', search = '') {
    try {
      const response = await fetch(`/diary/api/media-library?type=${type}&search=${search}`);
      if (response.ok) {
        const data = await response.json();
        const grid = document.getElementById('mediaLibraryGrid');
        grid.innerHTML = '';

        data.files.forEach(file => {
          const item = document.createElement('div');
          item.className = 'media-library-item';
          item.dataset.url = file.url;
          item.dataset.type = file.type;

          if (file.type === 'video') {
            item.innerHTML = `
              <video src="${file.url}" muted></video>
              <span class="media-type-badge">视频</span>
            `;
          } else {
            item.innerHTML = `
              <img src="${file.url}" alt="${file.name}">
              <span class="media-type-badge">图片</span>
            `;
          }

          item.addEventListener('click', () => {
            item.classList.toggle('selected');
            if (item.classList.contains('selected')) {
              selectedMediaItems.add(file);
            } else {
              selectedMediaItems.delete(file);
            }
          });

          grid.appendChild(item);
        });
      }
    } catch (error) {
      console.error('加载媒体库失败:', error);
    }
  }

  // 媒体库筛选
  document.querySelectorAll('input[name="mediaType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      loadMediaLibrary(e.target.value);
    });
  });

  // 媒体库搜索
  const searchInput = document.querySelector('.search-media');
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const type = document.querySelector('input[name="mediaType"]:checked').value;
      loadMediaLibrary(type, e.target.value);
    }, 300);
  });

  // 确认选择媒体
  document.getElementById('confirmMediaSelection').addEventListener('click', () => {
    const mediaPreview = document.getElementById('mediaPreview');
    
    selectedMediaItems.forEach(file => {
      const previewDiv = document.createElement('div');
      previewDiv.className = 'media-preview-item';
      previewDiv.dataset.mediaId = 'new_' + Date.now();

      if (file.type === 'video') {
        previewDiv.innerHTML = `
          <video src="${file.url}" controls></video>
          <div class="media-preview-controls">
            <input type="text" class="form-control media-caption" placeholder="添加说明文字...">
            <button type="button" class="btn btn-danger remove-media">删除</button>
          </div>
        `;
      } else {
        previewDiv.innerHTML = `
          <img src="${file.url}" alt="媒体预览">
          <div class="media-preview-controls">
            <input type="text" class="form-control media-caption" placeholder="添加说明文字...">
            <button type="button" class="btn btn-danger remove-media">删除</button>
          </div>
        `;
      }

      // 添加删除事件监听
      const removeBtn = previewDiv.querySelector('.remove-media');
      removeBtn.addEventListener('click', () => {
        if (confirm('确定要删除这个媒体文件吗？')) {
          previewDiv.remove();
          updateCarousel();
        }
      });

      mediaPreview.appendChild(previewDiv);
    });

    updateCarousel();
    selectedMediaItems.clear();
    document.getElementById('mediaLibraryModal').style.display = 'none';
  });
}); 