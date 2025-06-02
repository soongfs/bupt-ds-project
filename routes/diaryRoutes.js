router.post('/diaries', auth.requireLogin, diaryController.createDiary);
router.get('/diaries/:id', diaryController.getDiary);
router.put('/diaries/:id', auth.requireLogin, diaryController.updateDiary); 