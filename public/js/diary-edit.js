// 引入browser-image-compression库
import imageCompression from 'browser-image-compression';

document.addEventListener('DOMContentLoaded', function() {
  // 初始化压缩设置UI
  const qualitySlider = document.getElementById('quality');
  const qualityValue = document.getElementById('qualityValue');
  const enableCompression = document.getElementById('enableCompression');
  const compressionOptions = document.querySelector('.compression-options');

  // 更新质量显示
  qualitySlider.addEventListener('input', function() {
    qualityValue.textContent = this.value + '%';
  });

  // 切换压缩选项显示
  enableCompression.addEventListener('change', function() {
    compressionOptions.style.display = this.checked ? 'grid' : 'none';
  });

  // 处理图片上传和压缩
  async function handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
      return file; // 如果不是图片，直接返回原文件
    }

    const enableCompression = document.getElementById('enableCompression').checked;
    if (!enableCompression) {
      return file;
    }

    const maxWidth = parseInt(document.getElementById('maxWidth').value);
    const maxHeight = parseInt(document.getElementById('maxHeight').value);
    const quality = parseInt(document.getElementById('quality').value) / 100;

    try {
      console.log('开始压缩图片:', {
        原始大小: (file.size / 1024 / 1024).toFixed(2) + 'MB',
        maxWidth,
        maxHeight,
        quality
      });

      const options = {
        maxSizeMB: 10, // 最大文件大小
        maxWidthOrHeight: Math.max(maxWidth, maxHeight),
        useWebWorker: true,
        maxIteration: 10,
        initialQuality: quality,
        preserveExif: true, // 保留EXIF数据
      };

      const compressedFile = await imageCompression(file, options);
      
      console.log('压缩完成:', {
        压缩后大小: (compressedFile.size / 1024 / 1024).toFixed(2) + 'MB',
        压缩率: ((1 - compressedFile.size / file.size) * 100).toFixed(1) + '%'
      });

      // 如果压缩后的文件比原文件大，返回原文件
      return compressedFile.size < file.size ? compressedFile : file;
    } catch (error) {
      console.error('图片压缩失败:', error);
      return file; // 压缩失败时返回原文件
    }
  }

  // 处理文件上传
  document.getElementById('mediaUpload').addEventListener('change', async function(event) {
    const files = Array.from(event.target.files);
    const mediaPreview = document.getElementById('mediaPreview');
    
    for (const file of files) {
      try {
        // 处理文件（压缩图片或保持视频不变）
        const processedFile = await handleImageUpload(file);
        
        // 创建FormData对象并上传
        const formData = new FormData();
        formData.append('media', processedFile);

        const response = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('上传失败');
        }

        const data = await response.json();
        
        // 创建预览元素
        const previewDiv = document.createElement('div');
        previewDiv.className = 'media-preview-item';
        
        if (file.type.startsWith('image/')) {
          previewDiv.innerHTML = `
            <img src="${data.url}" alt="预览">
            <div class="media-controls">
              <input type="text" class="form-control caption-input" placeholder="添加说明...">
              <button type="button" class="btn btn-danger btn-sm remove-media">删除</button>
            </div>
          `;
        } else if (file.type.startsWith('video/')) {
          previewDiv.innerHTML = `
            <video src="${data.url}" controls></video>
            <div class="media-controls">
              <input type="text" class="form-control caption-input" placeholder="添加说明...">
              <button type="button" class="btn btn-danger btn-sm remove-media">删除</button>
            </div>
          `;
        }

        // 添加删除功能
        previewDiv.querySelector('.remove-media').addEventListener('click', function() {
          if (confirm('确定要删除这个文件吗？')) {
            previewDiv.remove();
          }
        });

        mediaPreview.appendChild(previewDiv);
      } catch (error) {
        console.error('处理文件失败:', error);
        alert('处理文件失败: ' + error.message);
      }
    }
  });

  // 处理表单提交
  document.querySelector('form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const formData = new FormData(this);
    
    // 添加媒体文件信息
    const mediaItems = Array.from(document.querySelectorAll('.media-preview-item')).map((item, index) => ({
      url: item.querySelector('img, video').src,
      caption: item.querySelector('.caption-input').value,
      type: item.querySelector('img') ? 'image' : 'video',
      order: index
    }));
    
    formData.append('mediaItems', JSON.stringify(mediaItems));

    try {
      const response = await fetch('/api/diaries', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      const result = await response.json();
      if (result.success) {
        window.location.href = `/diary-detail/${result.diaryId}`;
      } else {
        throw new Error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      alert('提交失败: ' + error.message);
    }
  });
}); 