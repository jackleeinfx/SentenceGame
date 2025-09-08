// Supabase 配置和初始化
const supabaseUrl = 'https://fsqjuteaoprcrdsphqpt.supabase.co'
const supabaseKey = 'sb_publishable_DIcf1pkMLybWGtAafbLABw_FZ4GQEs8'

// 初始化 Supabase 客戶端
const { createClient } = supabase
const supabaseClient = createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 應用程式啟動...');

    // 獲取新的元素
    const hideAddCardCheckbox = document.getElementById('hideAddCard');
    const hideSettingsCheckbox = document.getElementById('hideSettings');
    const addCardSection = document.querySelector('.add-card-section');
    const controlPanel = document.querySelector('.control-panel');

    // 設置隱藏功能的事件監聽器
    if (hideAddCardCheckbox) {
        hideAddCardCheckbox.addEventListener('change', () => {
            const isChecked = hideAddCardCheckbox.checked;
            addCardSection.classList.toggle('hidden', isChecked);
            saveSetting('hideAddCard', isChecked);
        });
    }

    if (hideSettingsCheckbox) {
        hideSettingsCheckbox.addEventListener('change', () => {
            const isChecked = hideSettingsCheckbox.checked;
            controlPanel.classList.toggle('hidden', isChecked);
            saveSetting('hideSettings', isChecked);
        });
    }

    const addCardButton = document.getElementById('addCard');
    const englishInput = document.getElementById('englishWord');
    const chineseInput = document.getElementById('chineseTranslation');
    const cardsContainer = document.getElementById('cardsContainer');
    const sizeSlider = document.getElementById('sizeSlider');
    const sizeValue = document.getElementById('sizeValue');
    const showAllBtn = document.getElementById('showAll');
    const showEnglishBtn = document.getElementById('showEnglish');
    const showChineseBtn = document.getElementById('showChinese');
    const editModeBtn = document.getElementById('editMode');
    const darkModeBtn = document.getElementById('darkMode');
    const shuffleBtn = document.getElementById('shuffleCards');
    const translateBtn = document.getElementById('translateBtn');
    const sortByTimeBtn = document.getElementById('sortByTime');
    const sortByRatingBtn = document.getElementById('sortByRating');
    const sortByAlphabetBtn = document.getElementById('sortByAlphabet');
    const newCardRating = document.getElementById('newCardRating');
    const ratingValue = document.getElementById('ratingValue');
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeValue = document.getElementById('fontSizeValue');
    let isEditMode = false;
    let currentRating = 0;
    let currentSortMode = 'time';

    // 設置管理
    const defaultSettings = {
        cardWidth: '250',
        fontSize: '24',
        displayMode: 'all',
        sortMode: 'time',
        hideAddCard: 'false',
        hideSettings: 'false',
        darkMode: 'false'
    };

    // 從本地存儲加載現有單字卡
    let flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];

    // 設置管理函數
    async function saveSetting(key, value) {
        try {
            console.log(`保存設置: ${key} = ${value}`);
            
            // 先保存到本地存儲
            localStorage.setItem(key, value);
            console.log(`設置 ${key} 已保存到本地存儲`);
            
            // 嘗試保存到 Supabase
            const { error } = await supabaseClient
                .from('user_settings')
                .upsert({ 
                    setting_key: key, 
                    setting_value: value.toString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'setting_key'
                });
            
            if (error) {
                console.error('保存設置到 Supabase 失敗:', error);
                console.error('錯誤詳情:', error.message);
                // 如果是表不存在的錯誤，提示用戶
                if (error.message.includes('relation') && error.message.includes('does not exist')) {
                    console.warn('user_settings 表不存在，請在 Supabase 中創建該表');
                }
            } else {
                console.log(`設置 ${key} 已保存到 Supabase`);
            }
        } catch (error) {
            console.error('保存設置時出錯:', error);
            // 確保至少保存到本地
            localStorage.setItem(key, value);
        }
    }

    // 快速載入本地設置
    function loadLocalSettings() {
        console.log('⚡ 快速載入本地設置...');
        
        const localSettings = {};
        Object.keys(defaultSettings).forEach(key => {
            const localValue = localStorage.getItem(key);
            if (localValue !== null) {
                localSettings[key] = localValue;
            }
        });
        
        // 立即應用本地設置
        const finalSettings = { ...defaultSettings, ...localSettings };
        console.log('應用本地設置:', finalSettings);
        applySettings(finalSettings);
        
        return localSettings;
    }

    // 同步雲端設置（背景執行）
    async function syncCloudSettings(localSettings) {
        try {
            console.log('🌐 背景同步雲端設置...');
            
            const { data, error } = await supabaseClient
                .from('user_settings')
                .select('*');
            
            if (error) {
                console.warn('從 Supabase 讀取設置失敗:', error.message);
                return false;
            }
            
            if (data && data.length > 0) {
                const cloudSettings = {};
                data.forEach(item => {
                    cloudSettings[item.setting_key] = item.setting_value;
                });
                
                console.log('雲端設置:', cloudSettings);
                
                // 檢查是否有差異
                let hasChanges = false;
                Object.keys(cloudSettings).forEach(key => {
                    if (cloudSettings[key] !== localSettings[key]) {
                        hasChanges = true;
                    }
                });
                
                if (hasChanges) {
                    console.log('🔄 發現雲端設置差異，更新本地設置');
                    const finalSettings = { ...defaultSettings, ...localSettings, ...cloudSettings };
                    applySettings(finalSettings);
                    
                    // 同步到本地存儲
                    Object.keys(cloudSettings).forEach(key => {
                        localStorage.setItem(key, cloudSettings[key]);
                    });
                } else {
                    console.log('✅ 雲端設置與本地一致');
                }
                
                return true;
            } else {
                console.log('Supabase 中沒有設置數據');
                return false;
            }
        } catch (error) {
            console.error('同步雲端設置失敗:', error);
            return false;
        }
    }

    function applySettings(settings) {
        // 應用卡片寬度
        if (settings.cardWidth) {
            sizeSlider.value = settings.cardWidth;
            sizeValue.textContent = `${settings.cardWidth}px`;
            updateCardSize(true); // skipSave = true
        }
        
        // 應用字體大小
        if (settings.fontSize) {
            fontSizeSlider.value = settings.fontSize;
            fontSizeValue.textContent = `${settings.fontSize}px`;
            updateFontSize(true); // skipSave = true
        }
        
        // 應用顯示模式
        if (settings.displayMode) {
            setDisplayMode(settings.displayMode, true); // skipSave = true
        }
        
        // 應用排序模式
        if (settings.sortMode) {
            setSortMode(settings.sortMode, true); // skipSave = true
        }
        
        // 應用隱藏設置
        if (settings.hideAddCard === 'true') {
            hideAddCardCheckbox.checked = true;
            addCardSection.classList.add('hidden');
        }
        
        if (settings.hideSettings === 'true') {
            hideSettingsCheckbox.checked = true;
            controlPanel.classList.add('hidden');
        }
        
        // 應用夜間模式
        const shouldBeDarkMode = settings.darkMode === 'true';
        
        if (shouldBeDarkMode !== isDarkMode) {
            // 直接設置狀態，不使用 toggle
            isDarkMode = shouldBeDarkMode;
            
            if (isDarkMode) {
                document.body.classList.add('dark-mode');
                darkModeBtn.classList.add('active');
            } else {
                document.body.classList.remove('dark-mode');
                darkModeBtn.classList.remove('active');
            }
        }
    }

    // 星級選擇功能
    function initializeStarRating() {
        const stars = newCardRating.querySelectorAll('.star');
        
        stars.forEach((star, index) => {
            star.addEventListener('mouseenter', () => {
                updateStarDisplay(index + 1, 'hover');
            });
            
            star.addEventListener('mouseleave', () => {
                updateStarDisplay(currentRating, 'active');
            });
            
            star.addEventListener('click', () => {
                currentRating = index + 1;
                updateStarDisplay(currentRating, 'active');
                ratingValue.textContent = `${currentRating}星`;
            });
        });
        
        // 重置按鈕功能
        newCardRating.addEventListener('dblclick', () => {
            currentRating = 0;
            updateStarDisplay(0, 'active');
            ratingValue.textContent = '0星';
        });
    }

    function updateStarDisplay(rating, type) {
        const stars = newCardRating.querySelectorAll('.star');
        stars.forEach((star, index) => {
            star.classList.remove('active', 'hover');
            if (index < rating) {
                star.classList.add(type);
            }
        });
    }

    // 夜間模式狀態（將由設置管理）
    let isDarkMode = false;

    // 顯示模式控制
    let currentMode = 'all'; // 預設顯示全部

    function setDisplayMode(mode, skipSave = false) {
        currentMode = mode;
        
        // 更新按鈕狀態
        [showAllBtn, showEnglishBtn, showChineseBtn].forEach(btn => {
            btn.classList.remove('active');
        });

        // 設置當前活動按鈕
        switch(mode) {
            case 'all':
                showAllBtn.classList.add('active');
                break;
            case 'english':
                showEnglishBtn.classList.add('active');
                break;
            case 'chinese':
                showChineseBtn.classList.add('active');
                break;
        }

        // 直接更新現有卡片的顯示狀態，不重新渲染
        const cards = document.querySelectorAll('.flashcard');
        cards.forEach(card => {
            // 只更新沒有 showing-all 類的卡片
            if (!card.classList.contains('showing-all')) {
                card.classList.remove('mode-all', 'mode-english', 'mode-chinese');
                card.classList.add(`mode-${mode}`);
                card.classList.remove('flipped');
            }
            // 保持編輯模式狀態
            if (isEditMode) {
                card.classList.add('edit-mode');
            }
        });
        
        // 保存設置（除非明確跳過）
        if (!skipSave) {
            saveSetting('displayMode', mode);
        }
    }

    // 綁定模式切換按鈕事件
    showAllBtn.addEventListener('click', () => setDisplayMode('all'));
    showEnglishBtn.addEventListener('click', () => setDisplayMode('english'));
    showChineseBtn.addEventListener('click', () => setDisplayMode('chinese'));

    // 添加編輯模式切換函數
    function toggleEditMode() {
        isEditMode = !isEditMode;
        editModeBtn.classList.toggle('active');
        
        document.querySelectorAll('.flashcard').forEach(card => {
            card.classList.toggle('edit-mode');
        });
    }

    // 綁定編輯模式按鈕事件
    editModeBtn.addEventListener('click', toggleEditMode);

    // 控制卡片寬度
    function updateCardSize(skipSave = false) {
        const size = sizeSlider.value;
        sizeValue.textContent = `${size}px`;
        
        // 更新所有卡片的寬度
        document.querySelectorAll('.flashcard').forEach(card => {
            card.style.width = `${size}px`;
        });
        
        // 保存設置（除非明確跳過）
        if (!skipSave) {
            saveSetting('cardWidth', size);
        }
    }

    // 監聽滑軌變化
    sizeSlider.addEventListener('input', () => {
        updateCardSize(); // updateCardSize 內部會自動保存
    });

    // 排序功能
    function sortCards(mode) {
        let sortedCards = [...flashcards];
        
        switch(mode) {
            case 'rating':
                sortedCards.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case 'alphabet':
                sortedCards.sort((a, b) => a.english.toLowerCase().localeCompare(b.english.toLowerCase()));
                break;
            case 'time':
            default:
                // 按時間排序：最新的在最上面（倒序）
                sortedCards.reverse();
                break;
        }
        
        return sortedCards;
    }

    // 設置排序模式
    function setSortMode(mode, skipSave = false) {
        currentSortMode = mode;
        
        // 更新按鈕狀態
        [sortByTimeBtn, sortByRatingBtn, sortByAlphabetBtn].forEach(btn => {
            btn.classList.remove('active');
        });
        
        switch(mode) {
            case 'time':
                sortByTimeBtn.classList.add('active');
                break;
            case 'rating':
                sortByRatingBtn.classList.add('active');
                break;
            case 'alphabet':
                sortByAlphabetBtn.classList.add('active');
                break;
        }
        
        displayCards();
        
        // 保存設置（除非明確跳過）
        if (!skipSave) {
            saveSetting('sortMode', mode);
        }
    }

    // 顯示所有已存在的單字卡
    function displayCards() {
        cardsContainer.innerHTML = '';
        const sortedCards = sortCards(currentSortMode);
        
        sortedCards.forEach((card, index) => {
            // 找到原始索引用於刪除和編輯操作
            const originalIndex = flashcards.findIndex(c => 
                c.english === card.english && c.chinese === card.chinese
            );
            const cardElement = createCardElement(card, originalIndex);
            cardsContainer.appendChild(cardElement);
        });
        updateCardSize(); // 應用當前的寬度設置
    }

    // 創建單字卡元素
    function createCardElement(card, index) {
        const div = document.createElement('div');
        div.className = `flashcard mode-${currentMode}${isEditMode ? ' edit-mode' : ''}`;
        
        // 添加星級顯示
        const cardRating = document.createElement('div');
        cardRating.className = 'card-rating';
        const rating = card.rating || 0;
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = `star ${i <= rating ? 'filled' : 'empty'}`;
            star.innerHTML = '★';
            star.dataset.rating = i;
            
            // 編輯模式下可以點擊修改星級
            star.addEventListener('click', async (e) => {
                if (isEditMode) {
                    e.stopPropagation();
                    const newRating = parseInt(star.dataset.rating);
                    
                    try {
                        // 更新資料庫
                        const { error } = await supabaseClient
                            .from('user_cards')
                            .update({ rating: newRating })
                            .eq('english', card.english)
                            .eq('chinese', card.chinese);
                        
                        if (error) throw error;
                        
                        // 更新本地資料
                        flashcards[index].rating = newRating;
                        localStorage.setItem('flashcards', JSON.stringify(flashcards));
                        
                        // 更新顯示
                        updateCardRating(cardRating, newRating);
                        
                    } catch (error) {
                        console.error('更新星級失敗:', error);
                        alert('更新星級失敗，請稍後重試');
                    }
                }
            });
            
            cardRating.appendChild(star);
        }
        
        // 添加刪除按鈕
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            try {
                // 从数组中删除卡片
                const cardToDelete = flashcards[index];
                flashcards.splice(index, 1);
                
                // 刪除 Supabase 中的對應記錄
                const { error } = await supabaseClient
                    .from('user_cards')
                    .delete()
                    .eq('english', cardToDelete.english)
                    .eq('chinese', cardToDelete.chinese);
                
                if (error) {
                    throw error;
                }
                
                console.log('删除操作已同步到 Supabase');
                
                // 更新本地存储
                localStorage.setItem('flashcards', JSON.stringify(flashcards));
                
                // 更新显示
                displayCards();
            } catch (error) {
                console.error('删除时出错:', error);
                alert('删除失败，请稍后重试');
                // 如果删除失败，重新加载数据
                loadFromSupabase();
            }
        });

        // 添加播放按鈕
        const playBtn = document.createElement('button');
        playBtn.className = 'play-btn';
        playBtn.innerHTML = '🔊';
        playBtn.title = '播放語音';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止觸發卡片的點擊事件
            responsiveVoice.speak(card.english, "UK English Female", {
                pitch: 1,
                rate: 0.9,
                volume: 1
            });
        });

        div.innerHTML = `
            <div class="english">${card.english}</div>
            <div class="chinese">${card.chinese}</div>
        `;
        
        div.appendChild(cardRating); // 添加星級顯示
        div.appendChild(deleteBtn);
        div.appendChild(playBtn); // 添加播放按鈕到卡片

        // 卡片點擊事件
        div.addEventListener('click', () => {
            if (!isEditMode) { // 只在非編輯模式下執行翻轉邏輯
                if (div.classList.contains('showing-all')) {
                    div.classList.remove('showing-all');
                    div.classList.remove('mode-all');
                    div.classList.add(`mode-${currentMode}`);
                    div.classList.remove('flipped');
                } else {
                    div.classList.add('showing-all');
                    div.classList.remove(`mode-${currentMode}`);
                    div.classList.add('mode-all');
                }
            }
        });

        return div;
    }

    // 更新卡片星級顯示
    function updateCardRating(cardRatingElement, rating) {
        const stars = cardRatingElement.querySelectorAll('.star');
        stars.forEach((star, index) => {
            star.className = `star ${index < rating ? 'filled' : 'empty'}`;
        });
    }

    // 修改添加新卡片的事件處理程序
    addCardButton.addEventListener('click', async () => {
        const english = englishInput.value.trim();
        const chinese = chineseInput.value.trim();

        if (english && chinese) {
            try {
                console.log('正在保存新卡片...');
                
                const newCard = { 
                    english, 
                    chinese,
                    rating: currentRating 
                };
                
                // 保存到 Supabase
                const { data, error } = await supabaseClient
                    .from('user_cards')
                    .insert([newCard])
                    .select();
                
                if (error) {
                    throw error;
                }
                
                console.log('成功保存到 Supabase');
                
                // 將新卡片添加到本地數組
                flashcards.push(newCard);
                
                // 保存到本地存儲
                localStorage.setItem('flashcards', JSON.stringify(flashcards));
                
                // 更新顯示
                displayCards();
                
                // 清空輸入框和重置星級
                englishInput.value = '';
                chineseInput.value = '';
                currentRating = 0;
                updateStarDisplay(0, 'active');
                ratingValue.textContent = '0星';
                
                // 更新翻譯按鈕狀態
                updateTranslateButtonState();
            } catch (error) {
                console.error('保存失敗:', error);
                console.error('錯誤詳情:', error.message);
                alert('保存失敗: ' + error.message);
            }
        }
    });

    // 🚀 快速初始化流程
    console.log('⚡ 快速載入本地設置...');
    
    // 1. 立即載入並應用本地設置
    const localSettings = loadLocalSettings();
    
    // 2. 立即載入本地卡片數據
    flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];
    if (flashcards.length > 0) {
        console.log('⚡ 快速顯示本地卡片數據');
        displayCards();
    }
    
    // 3. 初始化其他功能
    updateTranslateButtonState();
    initializeStarRating();
    
    console.log('✅ 快速初始化完成，開始背景同步...');
    
    // 4. 背景同步雲端數據（不阻塞界面）
    Promise.all([
        syncCloudSettings(localSettings),
        loadFromSupabase()
    ]).then(([settingsSync, cardsSync]) => {
        console.log('🌐 背景同步完成');
        console.log('設置同步:', settingsSync ? '成功' : '失敗');
        console.log('卡片同步:', cardsSync ? '成功' : '失敗');
        
        if (cardsSync && flashcards.length === 0) {
            // 如果本地沒有數據但雲端有，顯示雲端數據
            displayCards();
        }
    }).catch(error => {
        console.error('背景同步出錯:', error);
    });

    // 切換夜間模式
    async function toggleDarkMode(skipSave = false) {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode');
        darkModeBtn.classList.toggle('active');
        
        console.log(`夜間模式切換為: ${isDarkMode}`);
        
        // 保存設置（除非明確跳過）
        if (!skipSave) {
            // 保存為字符串以保持一致性
            console.log('正在保存夜間模式設置...');
            await saveSetting('darkMode', isDarkMode.toString());
            console.log('夜間模式設置保存完成');
        }
    }

    // 綁定夜間模式按鈕事件
    darkModeBtn.addEventListener('click', async () => {
        console.log('🌙 用戶點擊夜間模式按鈕');
        console.log('點擊前狀態:', isDarkMode);
        
        await toggleDarkMode();
        
        console.log('點擊後狀態:', isDarkMode);
        
        // 驗證設置是否正確保存
        setTimeout(() => {
            const savedValue = localStorage.getItem('darkMode');
            console.log('本地存儲中的夜間模式設置:', savedValue);
        }, 100);
    });

    // 添加洗牌函數 - Fisher-Yates 高隨機度洗牌算法
    function shuffleArray(array) {
        const newArray = [...array]; // 創建副本
        
        // 執行多次洗牌以提高隨機度
        for (let round = 0; round < 3; round++) {
            for (let i = newArray.length - 1; i > 0; i--) {
                // 使用加強的隨機數生成
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }
        }
        
        return newArray;
    }

    // 強制隨機排列函數 - 確保順序一定會改變
    function forceShuffleArray(array) {
        if (array.length <= 1) return [...array];
        
        let shuffled = shuffleArray(array);
        let attempts = 0;
        const maxAttempts = 10;
        
        // 確保順序確實改變了
        while (attempts < maxAttempts) {
            const orderChanged = !array.every((item, index) => 
                item.english === shuffled[index].english
            );
            
            if (orderChanged) {
                break;
            }
            
            // 如果順序沒變，使用更激進的洗牌方法
            shuffled = shuffleArray([...array]);
            
            // 手動交換前兩個元素以確保變化
            if (shuffled.length >= 2 && attempts === maxAttempts - 1) {
                [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
            }
            
            attempts++;
        }
        
        return shuffled;
    }

    // 添加隨機排列功能
    async function shuffleCards() {
        try {
            console.log('🎲 開始高隨機度排列');
            console.log('當前排序模式:', currentSortMode);
            console.log('原始順序:', flashcards.map(c => c.english));
            
            // 使用強制隨機排列，確保順序一定改變
            const shuffledArray = forceShuffleArray(flashcards);
            console.log('隨機排列後順序:', shuffledArray.map(c => c.english));
            
            // 更新全局數據
            flashcards = shuffledArray;
            
            // 暫時切換到時間排序模式，這樣隨機排列的結果才能正確顯示
            const originalSortMode = currentSortMode;
            currentSortMode = 'time';
            
            // 更新排序按鈕狀態
            [sortByTimeBtn, sortByRatingBtn, sortByAlphabetBtn].forEach(btn => {
                btn.classList.remove('active');
            });
            sortByTimeBtn.classList.add('active');
            
            // 保存新的排序模式
            saveSetting('sortMode', 'time');
            
            // 只保存到本地存儲，不同步到 Supabase
            localStorage.setItem('flashcards', JSON.stringify(flashcards));
            
            console.log('✅ 隨機排列完成，已切換到時間排序模式');
            console.log('最終順序:', flashcards.map(c => c.english));
            
            // 重新顯示卡片
            displayCards();
            
            // 添加簡單的淡入效果
            const cards = document.querySelectorAll('.flashcard');
            cards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(-10px)';
                
                setTimeout(() => {
                    card.style.transition = 'all 0.3s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                    
                    // 清理過渡效果
                    setTimeout(() => {
                        card.style.transition = '';
                    }, 300);
                }, index * 20);
            });
        } catch (error) {
            console.error('隨機排列時出錯:', error);
        }
    }

    // 綁定隨機排列按鈕事件
    shuffleBtn.addEventListener('click', shuffleCards);

    // 綁定排序按鈕事件
    sortByTimeBtn.addEventListener('click', () => setSortMode('time'));
    sortByRatingBtn.addEventListener('click', () => setSortMode('rating'));
    sortByAlphabetBtn.addEventListener('click', () => setSortMode('alphabet'));

    // 翻譯功能
    async function translateText(text, from, to) {
        try {
            const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
            const data = await response.json();
            return data[0][0][0];
        } catch (error) {
            console.error('翻譯錯誤:', error);
            return null;
        }
    }

    // 處理翻譯按鈕點擊
    translateBtn.addEventListener('click', async () => {
        const english = englishInput.value.trim();
        const chinese = chineseInput.value.trim();
        
        translateBtn.disabled = true;
        translateBtn.textContent = '翻譯中...';

        try {
            if (english && !chinese) {
                // 英譯中
                const translation = await translateText(english, 'en', 'zh-TW');
                if (translation) {
                    chineseInput.value = translation;
                }
            } else if (chinese && !english) {
                // 中譯英
                const translation = await translateText(chinese, 'zh-TW', 'en');
                if (translation) {
                    englishInput.value = translation;
                }
            }
        } catch (error) {
            console.error('翻譯過程出錯:', error);
            alert('翻譯失敗，請稍後再試');
        } finally {
            translateBtn.disabled = false;
            translateBtn.textContent = '翻譯';
        }
    });

    // 監聽輸入框變化，控制翻譯按鈕狀態
    function updateTranslateButtonState() {
        const english = englishInput.value.trim();
        const chinese = chineseInput.value.trim();
        
        // 只有當其中一個輸入框有內容而另一個為空時，才啟用翻譯按鈕
        translateBtn.disabled = !((english && !chinese) || (!english && chinese));
    }

    englishInput.addEventListener('input', updateTranslateButtonState);
    chineseInput.addEventListener('input', updateTranslateButtonState);

    // 初始化翻譯按鈕狀態
    updateTranslateButtonState();

    // Supabase 相关函数
    async function saveToSupabase() {
        try {
            console.log('正在保存数据到 Supabase...');
            console.log('要保存的数据:', flashcards);
            
            // 先清空現有數據
            const { error: deleteError } = await supabaseClient
                .from('user_cards')
                .delete()
                .neq('id', 0); // 删除所有记录
            
            if (deleteError) {
                console.error('清空數據時出錯:', deleteError);
            }
            
            // 插入新數據
            const { data, error } = await supabaseClient
                .from('user_cards')
                .insert(flashcards)
                .select();
            
            if (error) {
                throw error;
            }
            
            console.log('数据成功保存到 Supabase');
            return true;
        } catch (error) {
            console.error('保存到 Supabase 时出错:', error);
            console.error('错误详情:', error.message);
            return false;
        }
    }

    async function loadFromSupabase() {
        try {
            console.log('正在从 Supabase 读取数据...');
            
            // 从 user_cards 表读取数据
            const { data, error } = await supabaseClient
                .from('user_cards')
                .select('*')
                .order('id', { ascending: true });
            
            if (error) {
                throw error;
            }
            
            console.log('获取到的原始数据:', data);
            
            if (data && data.length > 0) {
                console.log('成功读取到数据，长度:', data.length);
                // 提取 english、chinese 和 rating 字段
                flashcards = data.map(item => ({
                    english: item.english,
                    chinese: item.chinese,
                    rating: item.rating || 0
                }));
            } else {
                console.log('数据库中没有数据，创建初始数据');
                // 如果数据库中没有数据，创建初始数据
                const initialData = [
                    {
                        english: "Hello",
                        chinese: "你好",
                        rating: 3
                    },
                    {
                        english: "Thank you",
                        chinese: "謝謝",
                        rating: 4
                    },
                    {
                        english: "Good morning",
                        chinese: "早安",
                        rating: 2
                    }
                ];
                
                // 将初始数据保存到 user_cards 表
                console.log('正在保存初始数据到 user_cards ...');
                const { error: insertError } = await supabaseClient
                    .from('user_cards')
                    .insert(initialData);
                
                if (insertError) {
                    throw insertError;
                }
                
                console.log('初始数据保存成功');
                flashcards = initialData;
            }
            
            localStorage.setItem('flashcards', JSON.stringify(flashcards));
            displayCards();
            return true;
        } catch (error) {
            console.error('从 Supabase 加载失败，详细错误:', error);
            console.error('错误堆栈:', error.stack);
            return false;
        }
    }

    // 修改 setupRealtimeSync 函数
    function setupRealtimeSync() {
        console.log('设置 Supabase 实时同步监听...');
        
        // 使用 Supabase Realtime 监听 user_cards 表的变化
        const channel = supabaseClient
            .channel('user_cards_changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'user_cards' 
                }, 
                async (payload) => {
                    console.log('检测到数据变化:', payload);
                    
                    // 重新加载所有数据以保持同步
                    try {
                        const { data, error } = await supabaseClient
                            .from('user_cards')
                            .select('*')
                            .order('id', { ascending: true });
                        
                        if (error) {
                            console.error('重新加载数据时出错:', error);
                            return;
                        }
                        
                        if (data && data.length >= 0) {
                            console.log('更新本地数据，新数据长度:', data.length);
                            flashcards = data.map(item => ({
                                english: item.english,
                                chinese: item.chinese,
                                rating: item.rating || 0
                            }));
                            localStorage.setItem('flashcards', JSON.stringify(flashcards));
                            displayCards();
                        }
                    } catch (error) {
                        console.error('实时同步错误:', error);
                    }
                }
            )
            .subscribe();
    }

    // 設置即時同步功能
    function setupSettingsSync() {
        console.log('設置 Supabase 設置即時同步監聽...');
        
        const settingsChannel = supabaseClient
            .channel('settings_changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'user_settings' 
                }, 
                async (payload) => {
                    console.log('檢測到設置變化:', payload);
                    
                    // 暫時禁用即時同步以避免衝突
                    // 只有在其他裝置變更設置時才需要同步
                    // 本地變更不需要重新載入
                    console.log('跳過設置同步，避免與本地變更衝突');
                }
            )
            .subscribe();
    }

    // 在 DOMContentLoaded 事件中添加实时同步
    setupRealtimeSync();
    setupSettingsSync();

    // 獲取測試按鈕
    const testSaveBtn = document.getElementById('testSave');
    const testLoadBtn = document.getElementById('testLoad');
    const testDarkModeBtn = document.getElementById('testDarkMode');

    // 測試存儲功能
    testSaveBtn.addEventListener('click', async () => {
        console.log('===== 開始測試 Supabase 存儲功能 =====');
        testSaveBtn.textContent = '存儲中...';
        testSaveBtn.disabled = true;

        try {
            // 檢查數據
            console.log('當前要存儲的數據:', flashcards);
            
            // 嘗試存儲到 Supabase
            const success = await saveToSupabase();
            
            if (success) {
                console.log('✅ 存儲成功！');
                alert('存儲成功！');
            } else {
                throw new Error('存儲操作失敗');
            }
        } catch (error) {
            console.error('❌ 存儲失敗:', error);
            console.error('詳細錯誤:', error.message);
            alert('存儲失敗: ' + error.message);
        } finally {
            testSaveBtn.textContent = '測試存儲';
            testSaveBtn.disabled = false;
            console.log('===== Supabase 存儲測試結束 =====');
        }
    });

    // 測試讀取功能
    testLoadBtn.addEventListener('click', async () => {
        console.log('===== 開始測試 Supabase 讀取功能 =====');
        testLoadBtn.textContent = '讀取中...';
        testLoadBtn.disabled = true;

        try {
            // 嘗試從 Supabase 讀取數據
            const success = await loadFromSupabase();
            
            if (success) {
                console.log('✅ 讀取成功！');
                console.log('數據長度:', flashcards.length);
                alert(`讀取成功！共讀取到 ${flashcards.length} 張卡片`);
            } else {
                throw new Error('讀取操作失敗');
            }
        } catch (error) {
            console.error('❌ 讀取失敗:', error);
            console.error('詳細錯誤:', error.message);
            alert('讀取失���: ' + error.message);
        } finally {
            testLoadBtn.textContent = '測試讀取';
            testLoadBtn.disabled = false;
            console.log('===== Supabase 讀取測試結束 =====');
        }
    });

    // 測試夜間模式設置功能
    testDarkModeBtn.addEventListener('click', async () => {
        console.log('===== 開始測試夜間模式設置 =====');
        testDarkModeBtn.textContent = '測試中...';
        testDarkModeBtn.disabled = true;

        try {
            console.log('當前夜間模式狀態:', isDarkMode);
            console.log('本地存儲中的設置:', localStorage.getItem('darkMode'));
            
            // 測試從 Supabase 讀取夜間模式設置
            const { data, error } = await supabaseClient
                .from('user_settings')
                .select('*')
                .eq('setting_key', 'darkMode');
            
            if (error) {
                console.error('從 Supabase 讀取夜間模式設置失敗:', error);
                alert('讀取失敗: ' + error.message);
            } else {
                console.log('Supabase 中的夜間模式設置:', data);
                
                if (data && data.length > 0) {
                    const cloudSetting = data[0].setting_value;
                    const localSetting = localStorage.getItem('darkMode');
                    
                    console.log('雲端設置:', cloudSetting);
                    console.log('本地設置:', localSetting);
                    console.log('當前狀態:', isDarkMode.toString());
                    
                    alert(`夜間模式設置檢查:\n雲端: ${cloudSetting}\n本地: ${localSetting}\n當前: ${isDarkMode}`);
                } else {
                    console.log('Supabase 中沒有夜間模式設置');
                    alert('Supabase 中沒有夜間模式設置，可能是 user_settings 表不存在');
                }
            }
            
        } catch (error) {
            console.error('測試夜間模式設置時出錯:', error);
            alert('測試失敗: ' + error.message);
        } finally {
            testDarkModeBtn.textContent = '測試夜間模式';
            testDarkModeBtn.disabled = false;
            console.log('===== 夜間模式設置測試結束 =====');
        }
    });

    // 字體大小滑軌元素已在前面定義

    // 更新字體大小的函數
    function updateFontSize(skipSave = false) {
        const size = fontSizeSlider.value;
        fontSizeValue.textContent = `${size}px`;
        
        // 更新所有卡片的字體大小
        document.querySelectorAll('.flashcard .english').forEach(element => {
            element.style.fontSize = `${size}px`;
        });
        
        document.querySelectorAll('.flashcard .chinese').forEach(element => {
            element.style.fontSize = `${Math.floor(size * 0.75)}px`; // 中文字體稍小
        });
        
        // 保存設置（除非明確跳過）
        if (!skipSave) {
            saveSetting('fontSize', size);
        }
    }

    // 監聽字體大小滑軌變化
    fontSizeSlider.addEventListener('input', updateFontSize);
    
    // 在創建卡片時應用字體大小
    const originalCreateCardElement = createCardElement;
    createCardElement = function(card, index) {
        const cardElement = originalCreateCardElement(card, index);
        const fontSize = fontSizeSlider.value;
        
        cardElement.querySelector('.english').style.fontSize = `${fontSize}px`;
        cardElement.querySelector('.chinese').style.fontSize = `${Math.floor(fontSize * 0.75)}px`;
        
        return cardElement;
    }
    
    // 初始化字體大小
    updateFontSize();
}); 