const zlib = require('zlib');

class CompressionService {
  /**
   * 压缩文本内容
   * @param {string} text 要压缩的文本
   * @param {function} callback 回调函数
   */
  compressText(text, callback) {
    if (!text) {
      return callback(null, null);
    }

    if (typeof callback !== 'function') {
      console.error('Callback is not provided or not a function');
      return;
    }

    zlib.gzip(text, (err, compressed) => {
      if (err) {
        console.error('压缩文本失败:', err);
        return callback(err);
      }
      callback(null, compressed);
    });
  }

  /**
   * 解压文本内容
   * @param {Buffer} compressed 压缩的数据
   * @param {function} callback 回调函数
   */
  decompressText(compressed, callback) {
    if (!compressed) {
      return callback(null, null);
    }

    if (typeof callback !== 'function') {
      console.error('Callback is not provided or not a function');
      return;
    }

    // 如果输入是Buffer，直接使用；否则，将其转换为Buffer
    const buffer = Buffer.isBuffer(compressed) ? compressed : Buffer.from(compressed);

    zlib.gunzip(buffer, (err, decompressed) => {
      if (err) {
        console.error('解压文本失败:', err);
        return callback(err);
      }
      callback(null, decompressed.toString());
    });
  }

  /**
   * 创建优化的搜索内容
   * @param {string} content 原始内容
   * @param {number} maxLength 最大长度（默认500字符）
   * @returns {string} 优化后的搜索内容
   */
  createSearchContent(content, maxLength = 500) {
    // 处理非字符串类型的内容
    if (!content) return '';
    
    // 如果内容是Buffer，转换为字符串
    if (Buffer.isBuffer(content)) {
      content = content.toString();
    }
    
    // 确保内容是字符串类型
    content = String(content);

    // 1. 移除HTML标签
    let text = content.replace(/<[^>]*>/g, ' ');

    // 2. 移除Markdown标记
    text = text.replace(/#+\s*|[*_`]|\[.*?\]|\(.*?\)/g, ' ');

    // 3. 移除多余空白字符
    text = text.replace(/\s+/g, ' ').trim();

    // 4. 提取关键句子（以句号、问号、感叹号分割）
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0);

    // 5. 选择重要句子（优先选择包含数字、日期、地点等的句子）
    const importantSentences = sentences.filter(s => {
      return /[\d年月日]|在|到|从|地|处|城市|景点|景区|公园|寺|宫|殿/.test(s);
    });

    // 6. 如果重要句子不够，补充其他句子
    let selectedSentences = [...importantSentences];
    if (selectedSentences.length < 3 && sentences.length > 0) {
      selectedSentences = selectedSentences.concat(
        sentences.filter(s => !importantSentences.includes(s))
      );
    }

    // 7. 合并句子并限制长度
    let result = selectedSentences.slice(0, 5).join('。');
    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 3) + '...';
    }

    return result;
  }

  /**
   * 压缩日记内容
   * @param {Object} diary 日记对象
   * @param {function} callback 回调函数
   */
  compressDiary(diary, callback) {
    const compressedDiary = { ...diary };

    // 如果没有内容，直接返回
    if (!diary.content) {
      return callback(null, compressedDiary);
    }

    // 压缩主要内容
    this.compressText(diary.content, (err, compressed) => {
      if (err) return callback(err);

      compressedDiary.content = compressed;
      compressedDiary.is_compressed = true;
      compressedDiary.search_content = this.createSearchContent(diary.content);

      // 如果没有章节，直接返回
      if (!diary.sections || !Array.isArray(diary.sections) || diary.sections.length === 0) {
        return callback(null, compressedDiary);
      }

      // 压缩章节内容
      let processedSections = 0;
      compressedDiary.sections = new Array(diary.sections.length);

      diary.sections.forEach((section, index) => {
        if (!section.content) {
          compressedDiary.sections[index] = {
            ...section,
            content: null,
            is_compressed: true
          };
          processedSections++;
          if (processedSections === diary.sections.length) {
            callback(null, compressedDiary);
          }
        } else {
          this.compressText(section.content, (err, compressed) => {
            if (err) return callback(err);

            compressedDiary.sections[index] = {
              ...section,
              content: compressed,
              is_compressed: true
            };
            processedSections++;
            if (processedSections === diary.sections.length) {
              callback(null, compressedDiary);
            }
          });
        }
      });
    });
  }

  /**
   * 解压日记内容
   * @param {Object} diary 压缩的日记对象
   * @param {function} callback 回调函数
   */
  decompressDiary(diary, callback) {
    const decompressedDiary = { ...diary };

    // 如果没有压缩的内容，直接返回
    if (!diary.content || !diary.is_compressed) {
      return callback(null, decompressedDiary);
    }

    // 解压主要内容
    this.decompressText(diary.content, (err, decompressed) => {
      if (err) return callback(err);

      decompressedDiary.content = decompressed;
      decompressedDiary.is_compressed = false;

      // 如果没有章节，直接返回
      if (!diary.sections || !Array.isArray(diary.sections) || diary.sections.length === 0) {
        return callback(null, decompressedDiary);
      }

      // 解压章节内容
      let processedSections = 0;
      decompressedDiary.sections = new Array(diary.sections.length);

      diary.sections.forEach((section, index) => {
        if (!section.content || !section.is_compressed) {
          decompressedDiary.sections[index] = {
            ...section,
            is_compressed: false
          };
          processedSections++;
          if (processedSections === diary.sections.length) {
            callback(null, decompressedDiary);
          }
        } else {
          this.decompressText(section.content, (err, decompressed) => {
            if (err) return callback(err);

            decompressedDiary.sections[index] = {
              ...section,
              content: decompressed,
              is_compressed: false
            };
            processedSections++;
            if (processedSections === diary.sections.length) {
              callback(null, decompressedDiary);
            }
          });
        }
      });
    });
  }
}

module.exports = new CompressionService(); 