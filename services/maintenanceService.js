const db = require('../config/test-database');
const compressionService = require('./compressionService');

class MaintenanceService {
  constructor() {
    this.db = db;
  }

  /**
   * 更新所有日记的搜索内容
   * @param {function} callback 回调函数
   */
  updateAllSearchContent(callback) {
    // 获取所有需要更新的日记
    const query = `
      SELECT id, title, content, is_compressed
      FROM travel_diaries
      WHERE 
        content IS NOT NULL
        AND (
          search_content IS NULL
          OR LENGTH(search_content) < 10
          OR search_content = title
          OR content_updated_at > search_content_updated_at
        )
    `;

    this.db.query(query, (err, diaries) => {
      if (err) {
        console.error('获取需要更新的日记失败:', err);
        return callback(err);
      }

      if (!diaries || diaries.length === 0) {
        console.log('没有需要更新搜索内容的日记');
        return callback(null, { updated: 0 });
      }

      let processedCount = 0;
      let updatedCount = 0;
      const total = diaries.length;

      const processDiary = (diary) => {
        const processContent = (content) => {
          // 使用压缩服务的智能提取方法创建搜索内容
          const searchContent = compressionService.createSearchContent(content);
          
          // 更新数据库
          const updateQuery = `
            UPDATE travel_diaries 
            SET 
              search_content = ?,
              search_content_updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `;

          this.db.query(updateQuery, [searchContent, diary.id], (updateErr) => {
            if (updateErr) {
              console.error(`更新日记 ${diary.id} 的搜索内容失败:`, updateErr);
            } else {
              updatedCount++;
            }
            
            processedCount++;
            if (processedCount === total) {
              console.log(`搜索内容更新完成: ${updatedCount}/${total} 条记录已更新`);
              callback(null, { updated: updatedCount, total });
            }
          });
        };

        if (diary.is_compressed && diary.content) {
          compressionService.decompressText(diary.content, (err, decompressed) => {
            if (err) {
              console.error(`解压日记 ${diary.id} 内容失败:`, err);
              processContent(diary.title); // 如果解压失败，使用标题作为搜索内容
            } else {
              processContent(decompressed);
            }
          });
        } else {
          processContent(diary.content || diary.title);
        }
      };

      // 处理每个日记
      diaries.forEach(processDiary);
    });
  }

  /**
   * 清理过期的临时文件
   * @param {function} callback 回调函数
   */
  cleanupTempFiles(callback) {
    // 实现临时文件清理逻辑
    // ...
  }

  /**
   * 运行所有维护任务
   * @param {function} callback 回调函数
   */
  runMaintenance(callback) {
    console.log('开始运行维护任务...');
    
    this.updateAllSearchContent((err, searchResults) => {
      if (err) {
        console.error('更新搜索内容失败:', err);
      } else {
        console.log('搜索内容更新结果:', searchResults);
      }

      this.cleanupTempFiles((err, cleanupResults) => {
        if (err) {
          console.error('清理临时文件失败:', err);
        } else {
          console.log('临时文件清理完成');
        }

        if (callback) callback(null, {
          search: searchResults,
          cleanup: cleanupResults
        });
      });
    });
  }
}

module.exports = new MaintenanceService(); 