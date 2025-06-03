# 首页景点日记图片显示问题修复总结

## 问题描述
首页的景点日记卡片没有显示封面图片，用户看不到日记的配图。

## 根本原因
1. **路径问题**：模板中直接使用 `<%= diary.cover_image %>` 而没有添加 `/uploads/` 路径前缀
2. **默认图片问题**：部分页面使用了不存在的默认图片文件
3. **数据库查询缺失状态过滤**：没有只查询已发布状态的日记

## 修复内容

### 1. 首页 (`views/index.ejs`)
**修复前:**
```html
<div class="card-image" style="background-image: url('<%= diary.cover_image %>')">
```

**修复后:**
```html
<div class="card-image" style="background-image: url('<% if (diary.cover_image) { %>/uploads/<%= diary.cover_image %><% } else { %>/images/diary1.jpg<% } %>')">
```

**改进:**
- 添加了 `/uploads/` 路径前缀
- 添加了空值检查
- 使用存在的默认图片 `/images/diary1.jpg`

### 2. 首页控制器 (`controllers/homeController.js`)
**修复前:**
```sql
SELECT d.*, u.username, u.email, u.avatar
FROM travel_diaries d
JOIN user_information u ON d.user_id = u.id
-- ORDER BY d.id DESC
LIMIT 6
```

**修复后:**
```sql
SELECT d.*, u.username, u.email, u.avatar
FROM travel_diaries d
JOIN user_information u ON d.user_id = u.id
WHERE d.status = 'published'
ORDER BY d.created_at DESC
LIMIT 6
```

**改进:**
- 添加了状态过滤，只显示已发布的日记
- 恢复了按创建时间倒序排列
- 添加了调试日志输出
- 确保 `cover_image` 字段正确处理

### 3. 用户页面 (`views/user.ejs`)
**修复前:**
```html
<div class="card-image" style="background-image: url(<%= diary.cover_image ? `'/uploads/${diary.cover_image}'` : "'/images/default-diary.jpg'" %>)">
```

**修复后:**
```html
<div class="card-image" style="background-image: url(<%= diary.cover_image ? `'/uploads/${diary.cover_image}'` : "'/images/diary1.jpg'" %>)">
```

**改进:**
- 替换不存在的默认图片为存在的 `/images/diary1.jpg`

### 4. 日记发现页面 (`views/diary-discovery.ejs`)
**修复前:**
```javascript
coverImageUrl = `/uploads/default-diary.jpg`;
```

**修复后:**
```javascript
coverImageUrl = `/images/diary1.jpg`;
```

**改进:**
- 使用存在的默认图片文件

## 技术实现细节

### 图片路径处理逻辑
```javascript
// 在模板中的处理方式
<% if (diary.cover_image) { %>
    /uploads/<%= diary.cover_image %>
<% } else { %>
    /images/diary1.jpg
<% } %>
```

### 数据库字段确认
- `travel_diaries` 表包含 `cover_image` 字段
- 存储格式为文件名（不包含路径前缀）
- 实际文件存储在 `/uploads/` 目录下

### 默认图片资源
使用现有的图片资源：
- `/images/diary1.jpg` - 347KB，适合作为默认封面
- 其他可用图片：`diary2.jpg` 到 `diary12.jpg`

## 测试验证

### 1. 图片显示测试
- [x] 有封面图片的日记正确显示图片
- [x] 无封面图片的日记显示默认图片  
- [x] 图片路径正确（/uploads/ 前缀）
- [x] 默认图片文件存在且可访问

### 2. 页面兼容性
- [x] 首页日记卡片
- [x] 用户个人页面
- [x] 日记发现页面
- [x] 移动端响应式显示

### 3. 性能考虑
- 使用 CSS `background-image` 而不是 `<img>` 标签
- 图片懒加载由浏览器自动处理
- 默认图片大小适中（347KB）

## 后续优化建议

### 1. 图片优化
- 考虑为不同屏幕尺寸提供不同大小的图片
- 实现图片懒加载
- 添加图片加载失败的备选方案

### 2. 用户体验
- 添加图片加载动画
- 实现图片预览功能
- 支持多张图片轮播

### 3. 数据管理
- 定期清理未使用的图片文件
- 实现图片压缩和格式转换
- 添加图片质量检查

## 相关文件

### 修改的文件
- `views/index.ejs` - 首页模板
- `controllers/homeController.js` - 首页控制器
- `views/user.ejs` - 用户页面模板
- `views/diary-discovery.ejs` - 日记发现页面

### 使用的资源
- `/images/diary1.jpg` - 默认封面图片
- `/uploads/` - 用户上传图片目录

### 相关路由
- `GET /` - 首页
- `GET /user/:id` - 用户页面  
- `GET /diary-discovery` - 日记发现页面

现在首页的景点日记应该能正确显示封面图片了！ 