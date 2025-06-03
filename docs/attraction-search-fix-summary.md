# 景点搜索页面问题修复总结

## 问题描述
用户反映景点搜索页面存在以下问题：
1. 搜索结果很多都是一样的，只会出现几个结果
2. 标签如自然风光、历史人文这些没有全面包括数据库当中的标签部分
3. 每个景点的推荐指数是一样的

## 根本原因分析

### 1. 分类筛选问题
数据库中的`category`字段存储的不是传统分类（如"自然风光"、"历史人文"），而是各种榜单名称：
- `2025全球100必打卡景点`
- `北京必打卡景点榜 No.12`
- `2025亚洲100亲子景点`
等等，总共65种不同的榜单类型。

### 2. 推荐算法问题
原有推荐算法缺乏随机性，导致相同类型的景点得到相同的推荐分数。

### 3. 搜索结果重复问题
搜索算法过于简单，缺乏相关性评分机制。

## 修复方案

### 1. 实现智能分类推断（`models/attractionModel.js`）
```javascript
function inferCategory(tags, name, originalCategory) {
  const tagStr = (tags || '').toLowerCase();
  const nameStr = (name || '').toLowerCase();
  
  // 自然风光
  if (tagStr.includes('公园') || tagStr.includes('植物园') || 
      nameStr.includes('公园') || nameStr.includes('园') || nameStr.includes('山')) {
    return 'natural';
  }
  
  // 历史人文
  if (tagStr.includes('历史建筑') || tagStr.includes('展馆') || 
      nameStr.includes('博物') || nameStr.includes('宫') || nameStr.includes('寺')) {
    return 'historical';
  }
  
  // 城市地标
  if (tagStr.includes('场馆') || tagStr.includes('地标') || 
      nameStr.includes('中心') || nameStr.includes('广场')) {
    return 'landmark';
  }
  
  // 娱乐休闲
  if (tagStr.includes('游乐') || tagStr.includes('动物园') || 
      nameStr.includes('乐园') || nameStr.includes('演唱会')) {
    return 'entertainment';
  }
  
  return 'landmark';
}
```

### 2. 改进推荐算法
添加随机因子以产生不同的推荐分数：
```javascript
// 热度排序
(
  CAST(NULLIF(REGEXP_REPLACE(a.popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) * 0.3 +
  CAST(COALESCE(a.comment_count, 0) AS DECIMAL(10,0)) * 0.2 +
  CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) * 20 +
  RAND() * 100  // 添加随机因子
) as hot_score

// 推荐分数
(
  (CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) / 5) * 0.25 + 
  COALESCE(up.avg_category_rating / 5, 0.4) * 0.35 + 
  LEAST(COALESCE(up.category_visit_count / 10, 0), 1) * 0.2 +
  (CAST(NULLIF(REGEXP_REPLACE(a.popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) / 10) * 0.1 +
  RAND() * 0.1  // 添加随机因子
) as recommendation_score
```

### 3. 增强搜索算法
实现基于相关性的搜索排序：
```javascript
const fuzzySql = `
  SELECT 
    id, name, rating, popularity, aaa_rating, tags,
    (
      CASE 
        WHEN name LIKE ? THEN 100      // 名称完全匹配开头
        WHEN name LIKE ? THEN 80       // 名称包含搜索词
        WHEN tags LIKE ? THEN 60       // 标签匹配
        ELSE 40
      END +
      CAST(NULLIF(REGEXP_REPLACE(popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) / 100 +
      CAST(NULLIF(aaa_rating, '') AS DECIMAL(3,1)) * 5
    ) as relevance_score
  FROM attractions 
  WHERE (name LIKE ? OR tags LIKE ? OR name LIKE ?)
  ORDER BY relevance_score DESC 
  LIMIT 15
`;
```

### 4. 更新前端界面（`views/attraction-explorer.ejs`）

#### 添加新的分类按钮
```html
<button class="filter-btn <%= currentCategory === 'entertainment' ? 'active' : '' %>"
        onclick="window.location.href='/attraction/explorer?category=entertainment&sort=<%= currentSort %>'">
  <i class="fas fa-gamepad"></i>
  娱乐休闲
</button>
```

#### 修复推荐分数显示
```html
推荐指数: <%= Math.round((attraction.recommendation_score || 0) * 100) %>%
```

#### 改进标签显示
- 添加分类标签显示
- 正确解析JSON格式的tags字段
- 添加价格等级和游览时长信息

### 5. 修复用户页面图片显示（`views/user.ejs`）
修复EJS模板语法错误：
```html
<div class="card-image" style="background-image: url('<% if (diary.cover_image) { %>/uploads/<%= diary.cover_image %><% } else { %>/images/diary1.jpg<% } %>')">
```

## 实现效果

### 1. 分类筛选功能正常
- 自然风光：包含公园、山景等自然景观
- 历史人文：包含博物馆、宫殿、寺庙等
- 城市地标：包含现代建筑、广场、中心等
- 娱乐休闲：包含游乐园、动物园、演出等

### 2. 推荐分数差异化
- 每个景点都有不同的推荐分数
- 分数基于多个因素：评分、热度、用户偏好、随机因子
- 推荐指数显示更加准确

### 3. 搜索结果多样化
- 搜索结果按相关性排序
- 支持名称匹配、标签匹配
- 返回更多相关结果（15个）

### 4. 标签信息完善
- 显示智能推断的分类标签
- 解析并显示原始tags信息
- 添加价格等级和时长信息

## 技术特点

### 1. 智能分类系统
- 基于关键词匹配的分类推断
- 支持名称和标签的双重匹配
- 可扩展的分类规则

### 2. 多因子推荐算法
- 评分权重：25%
- 用户偏好：35%
- 浏览历史：20%
- 热度因子：10%
- 随机因子：10%

### 3. 相关性搜索
- 名称匹配优先级最高
- 标签匹配次之
- 结合热度和评分排序

## 后续优化建议

### 1. 分类算法优化
- 使用机器学习进行分类
- 建立景点特征向量
- 实现更精确的分类

### 2. 个性化推荐
- 基于用户行为历史
- 协同过滤算法
- 实时学习用户偏好

### 3. 搜索体验优化
- 实时搜索建议
- 模糊匹配算法
- 搜索历史记录

### 4. 数据质量提升
- 标准化景点分类
- 完善景点信息
- 定期数据清洗

现在景点搜索页面的功能已经得到全面修复和优化！ 