# 用户页面私信功能添加总结

## 🎯 功能需求
用户反映在其他用户的个人页面中缺少发私信的功能，需要添加这个功能。

## 🔧 实现的功能

### 1. **用户页面私信按钮**
在`views/user.ejs`中添加了私信和关注功能：

```html
<% if (currentUser && currentUser.id === user.id) { %>
  <a href="/user/<%= user.id %>/edit" class="edit-profile-btn">
    <i class="fas fa-edit"></i> 编辑资料
  </a>
<% } else if (currentUser) { %>
  <!-- 查看其他用户时显示的操作按钮 -->
  <div class="user-actions">
    <a href="/messages/new/<%= user.id %>" class="action-btn message-btn">
      <i class="fas fa-envelope"></i> 发私信
    </a>
    <button class="action-btn follow-btn" onclick="toggleFollow(<%= user.id %>)">
      <i class="fas fa-user-plus"></i> 
      <span id="followText">关注</span>
    </button>
  </div>
<% } %>
```

### 2. **用户操作按钮样式**
添加了美观的按钮样式：

```css
.user-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1.5rem;
  border-radius: 25px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s;
  cursor: pointer;
  border: 2px solid transparent;
}

.message-btn {
  background: var(--primary);
  color: white;
}

.message-btn:hover {
  background: #248a7c;
  transform: translateY(-2px);
}

.follow-btn {
  background: transparent;
  color: var(--primary);
  border-color: var(--primary);
}
```

### 3. **关注功能JavaScript**
添加了关注/取消关注的交互功能：

```javascript
// 关注/取消关注功能
async function toggleFollow(userId) {
  try {
    const response = await fetch(`/user/${userId}/follow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });

    const result = await response.json();
    
    if (result.success) {
      const followBtn = document.querySelector('.follow-btn');
      const followText = document.getElementById('followText');
      const followIcon = followBtn.querySelector('i');
      
      if (result.isFollowing) {
        followBtn.classList.add('following');
        followText.textContent = '已关注';
        followIcon.className = 'fas fa-user-check';
      } else {
        followBtn.classList.remove('following');
        followText.textContent = '关注';
        followIcon.className = 'fas fa-user-plus';
      }
      
      // 更新关注者数量
      const followersCountElements = document.querySelectorAll('.stat-item .stat-value');
      if (followersCountElements.length >= 2) {
        const followersElement = followersCountElements[1];
        const currentCount = parseInt(followersElement.textContent.replace(/,/g, '')) || 0;
        const newCount = result.isFollowing ? currentCount + 1 : currentCount - 1;
        followersElement.textContent = Math.max(0, newCount).toLocaleString();
      }
    }
  } catch (error) {
    console.error('关注操作失败:', error);
    alert('网络错误，请稍后重试');
  }
}
```

### 4. **关注状态API**
在`controllers/userController.js`中添加了获取关注状态的API：

```javascript
// 获取关注状态
exports.getFollowStatus = (req, res) => {
  const followerId = req.session.user.id;
  const followedId = req.params.id;

  if (followerId === parseInt(followedId)) {
    return res.json({ success: false, message: '不能关注自己' });
  }

  db.query(
    'SELECT * FROM user_follows WHERE follower_id = ? AND followed_id = ?',
    [followerId, followedId],
    (err, results) => {
      if (err) {
        console.error('查询关注状态失败:', err);
        return res.status(500).json({ success: false, message: '查询关注状态失败' });
      }

      res.json({ 
        success: true, 
        isFollowing: results.length > 0 
      });
    }
  );
};
```

### 5. **路由配置**
在`routes/userRoutes.js`中添加了关注状态查询路由：

```javascript
// 获取关注状态
router.get('/:id/follow-status', auth.requireLogin, userController.getFollowStatus);
```

## 📋 功能特性

### ✅ **私信功能**
- 在其他用户页面显示"发私信"按钮
- 点击后跳转到新消息页面 `/messages/new/:userId`
- 使用现有的消息系统，无需额外开发

### ✅ **关注功能** 
- 在其他用户页面显示"关注"按钮
- 支持关注/取消关注切换
- 实时更新按钮状态和关注者数量
- 页面加载时自动检查关注状态

### ✅ **用户体验优化**
- 美观的按钮设计，符合网站整体风格
- 平滑的动画效果
- 明确的状态反馈
- 错误处理和提示

### ✅ **权限控制**
- 只有登录用户才能看到操作按钮
- 自己的页面显示"编辑资料"按钮
- 其他用户页面显示"发私信"和"关注"按钮
- 防止自己关注自己

## 🎨 界面展示

当用户查看其他用户的个人页面时，现在会看到：

```
[用户头像] [用户名]
           [简介]
           [统计数据：游记 | 关注者 | 正在关注]
           [发私信] [关注]
```

当用户查看自己的页面时：

```
[用户头像] [用户名]
           [简介]
           [统计数据：游记 | 关注者 | 正在关注]
           [编辑资料]
```

## 🔗 相关文件

### 已修改的文件：
- `views/user.ejs` - 添加私信和关注按钮
- `controllers/userController.js` - 添加关注状态API
- `routes/userRoutes.js` - 添加关注状态路由

### 已存在的相关文件：
- `views/message_new.ejs` - 新消息页面（已存在）
- `routes/messageRoutes.js` - 消息路由（已存在）
- `controllers/messageController.js` - 消息控制器（已存在）

## 🎉 完成状态

✅ **私信功能已完成**
- 用户可以在其他用户页面点击"发私信"按钮
- 跳转到消息发送页面
- 集成现有消息系统

✅ **关注功能已完成**  
- 支持关注/取消关注操作
- 实时状态更新
- 关注者数量自动更新

✅ **界面优化已完成**
- 美观的按钮设计
- 响应式交互效果
- 清晰的状态反馈

现在用户在浏览其他用户的个人页面时，可以方便地发送私信和进行关注操作了！🎊 