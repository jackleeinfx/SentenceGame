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
    const heightSlider = document.getElementById('heightSlider');
    const heightValue = document.getElementById('heightValue');
    const playCountInput = document.getElementById('playCountInput');
    const playIntervalInput = document.getElementById('playIntervalInput');
    const playAllCardsBtn = document.getElementById('playAllCards');
    const stopPlaybackBtn = document.getElementById('stopPlayback');
    let isEditMode = false;
    let currentRating = 3;
    let currentSortMode = 'time';
    
    // 播放控制變數
    let isPlaying = false;
    let playTimeout = null;
    let currentPlayIndex = 0;

    // 設置管理
    const defaultSettings = {
        cardWidth: '250',
        fontSize: '24',
        cardHeight: '120',
        playCount: '2',
        playInterval: '3',
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
        
        // 應用卡片高度
        if (settings.cardHeight) {
            heightSlider.value = settings.cardHeight;
            heightValue.textContent = `${settings.cardHeight}px`;
            updateCardHeight(true); // skipSave = true
        }
        
        // 應用播放次數
        if (settings.playCount) {
            playCountInput.value = settings.playCount;
        }
        
        // 應用播放間隔
        if (settings.playInterval) {
            playIntervalInput.value = settings.playInterval;
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
        
        // 初始化顯示3星
        updateStarDisplay(currentRating, 'active');
        ratingValue.textContent = `${currentRating}星`;
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
        updateCardHeight(); // 應用當前的高度設置
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
            
            // 點擊修改星級（無需編輯模式）
            star.addEventListener('click', async (e) => {
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
            });
            
            cardRating.appendChild(star);
        }
        
        // 添加刪除按鈕
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // 確認刪除
            const confirmDelete = confirm(`確定要刪除單字卡「${card.english} - ${card.chinese}」嗎？`);
            if (!confirmDelete) {
                return;
            }
            
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

        div.innerHTML = `
            <div class="english">${card.english}</div>
            <div class="chinese">${card.chinese}</div>
        `;
        
        div.appendChild(cardRating); // 添加星級顯示
        div.appendChild(deleteBtn);

        // 卡片點擊事件（單擊切換顯示）
        div.addEventListener('click', () => {
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
        });

        // 卡片雙擊事件（播放語音）
        div.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            speakText(card.english);
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
                
                // 清空輸入框和重置星級為3星
                englishInput.value = '';
                chineseInput.value = '';
                currentRating = 3;
                updateStarDisplay(3, 'active');
                ratingValue.textContent = '3星';
                
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
    
    // 4. 初始化字體大小和卡片高度（必須在 displayCards 之後）
    updateFontSize(true); // skipSave = true，避免覆蓋已載入的設定
    updateCardHeight(true); // skipSave = true，避免覆蓋已載入的設定
    
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
    const testCardHeightBtn = document.getElementById('testCardHeight');
    const testSupabaseConnectionBtn = document.getElementById('testSupabaseConnection');
    const testVoiceBtn = document.getElementById('testVoice');

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

    // 測試卡片高度雲端同步功能
    testCardHeightBtn.addEventListener('click', async () => {
        console.log('===== 開始測試卡片高度雲端同步 =====');
        testCardHeightBtn.textContent = '測試中...';
        testCardHeightBtn.disabled = true;

        try {
            console.log('當前卡片高度設置:', heightSlider.value);
            console.log('本地存儲中的卡片高度:', localStorage.getItem('cardHeight'));
            
            // 測試從 Supabase 讀取卡片高度設置
            const { data, error } = await supabaseClient
                .from('user_settings')
                .select('*')
                .eq('setting_key', 'cardHeight');
            
            if (error) {
                console.error('從 Supabase 讀取卡片高度設置失敗:', error);
                alert('讀取失敗: ' + error.message);
            } else {
                console.log('Supabase 中的卡片高度設置:', data);
                
                if (data && data.length > 0) {
                    const cloudSetting = data[0].setting_value;
                    const localSetting = localStorage.getItem('cardHeight');
                    const currentValue = heightSlider.value;
                    
                    console.log('雲端設置:', cloudSetting);
                    console.log('本地設置:', localSetting);
                    console.log('當前滑軌值:', currentValue);
                    
                    alert(`卡片高度設置檢查:\n雲端: ${cloudSetting}px\n本地: ${localSetting}px\n當前: ${currentValue}px`);
                } else {
                    console.log('Supabase 中沒有卡片高度設置');
                    alert('Supabase 中沒有卡片高度設置，可能是 user_settings 表不存在或該設置尚未保存');
                }
            }
            
        } catch (error) {
            console.error('測試卡片高度設置時出錯:', error);
            alert('測試失敗: ' + error.message);
        } finally {
            testCardHeightBtn.textContent = '測試卡片高度';
            testCardHeightBtn.disabled = false;
            console.log('===== 卡片高度設置測試結束 =====');
        }
    });

    // 診斷 Supabase 雲端連線功能
    testSupabaseConnectionBtn.addEventListener('click', async () => {
        console.log('===== 開始診斷 Supabase 雲端連線 =====');
        testSupabaseConnectionBtn.textContent = '診斷中...';
        testSupabaseConnectionBtn.disabled = true;

        try {
            // 1. 測試基本連線
            console.log('1. 測試 Supabase 基本連線...');
            console.log('Supabase URL:', supabaseUrl);
            console.log('Supabase Key:', supabaseKey ? '已設置' : '未設置');

            // 2. 測試 user_settings 表是否存在
            console.log('2. 測試 user_settings 表...');
            const { data: settingsData, error: settingsError } = await supabaseClient
                .from('user_settings')
                .select('count', { count: 'exact', head: true });

            if (settingsError) {
                console.error('user_settings 表錯誤:', settingsError);
                if (settingsError.message.includes('relation') && settingsError.message.includes('does not exist')) {
                    alert('❌ user_settings 表不存在！\n\n請在 Supabase SQL 編輯器中執行:\n\nCREATE TABLE user_settings (\n    id BIGSERIAL PRIMARY KEY,\n    setting_key TEXT NOT NULL UNIQUE,\n    setting_value TEXT NOT NULL,\n    updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow all operations" ON user_settings FOR ALL USING (true);');
                    return;
                }
                throw settingsError;
            }

            console.log('✅ user_settings 表存在，記錄數:', settingsData);

            // 3. 測試 user_cards 表是否存在
            console.log('3. 測試 user_cards 表...');
            const { data: cardsData, error: cardsError } = await supabaseClient
                .from('user_cards')
                .select('count', { count: 'exact', head: true });

            if (cardsError) {
                console.error('user_cards 表錯誤:', cardsError);
                if (cardsError.message.includes('relation') && cardsError.message.includes('does not exist')) {
                    alert('❌ user_cards 表不存在！\n\n請在 Supabase SQL 編輯器中執行:\n\nCREATE TABLE user_cards (\n    id BIGSERIAL PRIMARY KEY,\n    english TEXT NOT NULL,\n    chinese TEXT NOT NULL,\n    rating INTEGER DEFAULT 0,\n    created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow all operations" ON user_cards FOR ALL USING (true);');
                    return;
                }
                throw cardsError;
            }

            console.log('✅ user_cards 表存在，記錄數:', cardsData);

            // 4. 測試寫入權限
            console.log('4. 測試設置寫入權限...');
            const testKey = 'test_connection_' + Date.now();
            const { error: writeError } = await supabaseClient
                .from('user_settings')
                .upsert({ 
                    setting_key: testKey, 
                    setting_value: 'test_value'
                });

            if (writeError) {
                console.error('寫入測試失敗:', writeError);
                alert('❌ 無法寫入 user_settings 表！\n錯誤: ' + writeError.message + '\n\n可能需要檢查 RLS 策略設置。');
                return;
            }

            console.log('✅ 寫入測試成功');

            // 5. 測試讀取權限
            console.log('5. 測試設置讀取權限...');
            const { data: readData, error: readError } = await supabaseClient
                .from('user_settings')
                .select('*')
                .eq('setting_key', testKey);

            if (readError) {
                console.error('讀取測試失敗:', readError);
                alert('❌ 無法讀取 user_settings 表！\n錯誤: ' + readError.message);
                return;
            }

            console.log('✅ 讀取測試成功:', readData);

            // 6. 清理測試數據
            await supabaseClient
                .from('user_settings')
                .delete()
                .eq('setting_key', testKey);

            console.log('✅ 測試數據清理完成');

            // 7. 檢查現有設置
            console.log('6. 檢查現有設置...');
            const { data: allSettings, error: allError } = await supabaseClient
                .from('user_settings')
                .select('*');

            if (allError) {
                console.error('讀取所有設置失敗:', allError);
            } else {
                console.log('現有設置:', allSettings);
                const settingsList = allSettings.map(s => `${s.setting_key}: ${s.setting_value}`).join('\n');
                alert(`✅ Supabase 連線診斷成功！\n\n資料庫狀態:\n- user_settings 表: 存在\n- user_cards 表: 存在\n- 讀寫權限: 正常\n\n現有設置 (${allSettings.length} 項):\n${settingsList || '無設置'}`);
            }

        } catch (error) {
            console.error('診斷過程中出錯:', error);
            alert('❌ 診斷失敗: ' + error.message + '\n\n請檢查:\n1. Supabase URL 和 Key 是否正確\n2. 網路連線是否正常\n3. 資料庫表是否已創建');
        } finally {
            testSupabaseConnectionBtn.textContent = '診斷雲端連線';
            testSupabaseConnectionBtn.disabled = false;
            console.log('===== Supabase 連線診斷結束 =====');
        }
    });
    
    // 語音功能診斷
    testVoiceBtn.addEventListener('click', async () => {
        console.log('===== 開始診斷語音功能 =====');
        testVoiceBtn.textContent = '診斷中...';
        testVoiceBtn.disabled = true;

        try {
            const testText = "Hello, this is a voice test";
            
            // 檢測設備和瀏覽器
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isChrome = /Chrome/.test(navigator.userAgent);
            const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
            
            let diagnosticInfo = `設備檢測結果:\n`;
            diagnosticInfo += `- 移動設備: ${isMobile ? '是' : '否'}\n`;
            diagnosticInfo += `- iOS 設備: ${isIOS ? '是' : '否'}\n`;
            diagnosticInfo += `- Chrome 瀏覽器: ${isChrome ? '是' : '否'}\n`;
            diagnosticInfo += `- Safari 瀏覽器: ${isSafari ? '是' : '否'}\n\n`;
            
            // 檢測 Web Speech API 支援
            const speechSupport = 'speechSynthesis' in window;
            diagnosticInfo += `Web Speech API 支援: ${speechSupport ? '是' : '否'}\n`;
            
            if (speechSupport) {
                const voices = window.speechSynthesis.getVoices();
                diagnosticInfo += `可用語音數量: ${voices.length}\n`;
                
                if (voices.length > 0) {
                    const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
                    diagnosticInfo += `英語語音數量: ${englishVoices.length}\n`;
                    
                    if (englishVoices.length > 0) {
                        diagnosticInfo += `\n可用的英語語音:\n`;
                        englishVoices.slice(0, 5).forEach(voice => {
                            diagnosticInfo += `- ${voice.name} (${voice.lang})\n`;
                        });
                        if (englishVoices.length > 5) {
                            diagnosticInfo += `... 還有 ${englishVoices.length - 5} 個語音\n`;
                        }
                    }
                }
            }
            
            // 檢測 ResponsiveVoice 支援
            const rvSupport = typeof responsiveVoice !== 'undefined';
            diagnosticInfo += `\nResponsiveVoice 支援: ${rvSupport ? '是' : '否'}\n`;
            
            if (rvSupport) {
                const rvVoiceSupport = responsiveVoice.voiceSupport();
                diagnosticInfo += `ResponsiveVoice 語音支援: ${rvVoiceSupport ? '是' : '否'}\n`;
            }
            
            console.log('診斷資訊:', diagnosticInfo);
            
            // 顯示診斷結果
            alert(`🔍 語音功能診斷結果:\n\n${diagnosticInfo}\n\n現在將進行語音測試...`);
            
            // 進行實際語音測試
            console.log('開始語音測試...');
            await new Promise((resolve) => {
                speakText(testText, () => {
                    console.log('語音測試完成');
                    resolve();
                });
                
                // 5秒後強制結束測試
                setTimeout(() => {
                    console.log('語音測試超時');
                    resolve();
                }, 5000);
            });
            
            alert(`✅ 語音診斷完成！\n\n如果您聽到了測試語音"${testText}"，說明語音功能正常。\n\n如果沒有聽到或品質不佳，建議：\n1. 在 Safari 瀏覽器中嘗試\n2. 檢查設備音量和靜音開關\n3. 確保網路連線正常`);
            
        } catch (error) {
            console.error('語音診斷錯誤:', error);
            alert(`❌ 語音診斷出錯: ${error.message}`);
        } finally {
            testVoiceBtn.textContent = '診斷語音功能';
            testVoiceBtn.disabled = false;
            console.log('===== 語音功能診斷結束 =====');
        }
    });
    
    // 字體大小滑軌元素已在前面定義

    // 更新字體大小的函數
    function updateFontSize(skipSave = false) {
        const size = fontSizeSlider.value;
        fontSizeValue.textContent = `${size}px`;
        
        console.log(`🔤 更新字體大小: ${size}px, skipSave: ${skipSave}`);
        
        // 更新所有卡片的字體大小
        document.querySelectorAll('.flashcard .english').forEach(element => {
            element.style.fontSize = `${size}px`;
        });
        
        document.querySelectorAll('.flashcard .chinese').forEach(element => {
            element.style.fontSize = `${Math.floor(size * 0.75)}px`; // 中文字體稍小
        });
        
        // 保存設置（除非明確跳過）
        if (!skipSave) {
            console.log(`💾 準備保存字體大小設置: fontSize = ${size}`);
            saveSetting('fontSize', size);
        } else {
            console.log(`⏭️ 跳過保存字體大小設置`);
        }
    }

    // 更新卡片高度的函數
    function updateCardHeight(skipSave = false) {
        const height = heightSlider.value;
        heightValue.textContent = `${height}px`;
        
        console.log(`📏 更新卡片高度: ${height}px, skipSave: ${skipSave}`);
        
        // 更新所有卡片的高度
        document.querySelectorAll('.flashcard').forEach(card => {
            card.style.minHeight = `${height}px`;
        });
        
        // 保存設置（除非明確跳過）
        if (!skipSave) {
            console.log(`💾 準備保存卡片高度設置: cardHeight = ${height}`);
            saveSetting('cardHeight', height);
        } else {
            console.log(`⏭️ 跳過保存卡片高度設置`);
        }
    }

    // 監聽字體大小滑軌變化
    fontSizeSlider.addEventListener('input', () => updateFontSize());
    
    // 監聽卡片高度滑軌變化
    heightSlider.addEventListener('input', () => updateCardHeight());
    
    // 監聽播放設定輸入欄位變化
    playCountInput.addEventListener('change', () => {
        const count = parseInt(playCountInput.value);
        if (count >= 1 && count <= 10) {
            saveSetting('playCount', count.toString());
        } else {
            playCountInput.value = 2; // 恢復預設值
        }
    });
    
    playIntervalInput.addEventListener('change', () => {
        const interval = parseInt(playIntervalInput.value);
        if (interval >= 1 && interval <= 30) {
            saveSetting('playInterval', interval.toString());
        } else {
            playIntervalInput.value = 3; // 恢復預設值
        }
    });
    
    // 智能語音播放函數 - 支持移動設備優化
    function speakText(text, callback = null) {
        console.log(`🔊 準備播放語音: "${text}"`);
        
        // 檢測是否為移動設備
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        
        console.log(`📱 設備檢測: mobile=${isMobile}, iOS=${isIOS}, Chrome=${isChrome}, Safari=${isSafari}`);
        
        // 優先使用原生 Web Speech API (在支援的瀏覽器上品質更好)
        if ('speechSynthesis' in window) {
            console.log('🎯 使用原生 Web Speech API');
            
            // 取消任何正在播放的語音
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // 針對不同設備優化設定
            if (isIOS) {
                // iOS 設備優化設定
                utterance.lang = 'en-US';
                utterance.rate = 0.8;  // 稍慢一點，更清晰
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                console.log('🍎 應用 iOS 優化設定');
            } else if (isMobile) {
                // 其他移動設備優化設定
                utterance.lang = 'en-US';
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                console.log('📱 應用移動設備優化設定');
            } else {
                // 桌面設備設定
                utterance.lang = 'en-US';
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                console.log('🖥️ 應用桌面設備設定');
            }
            
            // 嘗試選擇更好的語音
            const voices = window.speechSynthesis.getVoices();
            console.log(`🎤 可用語音數量: ${voices.length}`);
            
            if (voices.length > 0) {
                // 優先選擇順序：英語男聲 -> 英語女聲 -> 預設
                const preferredVoices = [
                    'Alex',           // macOS 英語男聲
                    'Daniel',         // iOS 英語男聲
                    'Fred',           // macOS 英語男聲
                    'Microsoft David Desktop', // Windows 英語男聲
                    'Google US English Male',  // Android 英語男聲
                ];
                
                let selectedVoice = null;
                
                // 首先嘗試找到偏好的語音
                for (const preferredName of preferredVoices) {
                    selectedVoice = voices.find(voice => 
                        voice.name.includes(preferredName) && voice.lang.startsWith('en')
                    );
                    if (selectedVoice) {
                        console.log(`✅ 找到偏好語音: ${selectedVoice.name}`);
                        break;
                    }
                }
                
                // 如果沒找到偏好語音，選擇任何英語語音
                if (!selectedVoice) {
                    selectedVoice = voices.find(voice => 
                        voice.lang.startsWith('en-US') || voice.lang.startsWith('en')
                    );
                    if (selectedVoice) {
                        console.log(`🔄 使用備選英語語音: ${selectedVoice.name}`);
                    }
                }
                
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                    console.log(`🎵 選定語音: ${selectedVoice.name} (${selectedVoice.lang})`);
                } else {
                    console.log('⚠️ 未找到合適的英語語音，使用系統預設');
                }
            } else {
                console.log('⚠️ 無可用語音列表，使用系統預設');
            }
            
            utterance.onstart = () => {
                console.log('🎵 語音開始播放');
            };
            
            utterance.onend = () => {
                console.log('✅ 語音播放完成');
                if (callback) callback();
            };
            
            utterance.onerror = (event) => {
                console.error('❌ 語音播放錯誤:', event.error);
                // 如果原生 API 失敗，回退到 ResponsiveVoice
                fallbackToResponsiveVoice(text, callback);
            };
            
            window.speechSynthesis.speak(utterance);
            
        } else if (typeof responsiveVoice !== 'undefined' && responsiveVoice.voiceSupport()) {
            // 回退到 ResponsiveVoice
            console.log('🔄 回退到 ResponsiveVoice');
            fallbackToResponsiveVoice(text, callback);
        } else {
            console.error('❌ 無可用的語音播放方式');
            if (callback) callback();
        }
    }
    
    // ResponsiveVoice 回退函數
    function fallbackToResponsiveVoice(text, callback = null) {
        console.log('📢 使用 ResponsiveVoice 播放');
        
        // 檢測設備類型選擇最佳語音
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        let voiceName = "US English Male";
        
        if (isMobile) {
            // 移動設備上使用更通用的語音選項
            const mobileVoices = [
                "US English Male",
                "UK English Male", 
                "US English Female",
                "UK English Female"
            ];
            
            // 檢查哪些語音可用
            for (const voice of mobileVoices) {
                if (responsiveVoice.isPlaying() !== undefined) { // 簡單的可用性檢查
                    voiceName = voice;
                    break;
                }
            }
            console.log(`📱 移動設備選用語音: ${voiceName}`);
        }
        
        responsiveVoice.speak(text, voiceName, {
            pitch: 1,
            rate: 0.9,
            volume: 1,
            onend: callback || (() => {}),
            onerror: (error) => {
                console.error('ResponsiveVoice 錯誤:', error);
                if (callback) callback();
            }
        });
    }
    
    // 停止所有語音播放
    function stopAllSpeech() {
        console.log('🛑 停止所有語音播放');
        
        // 停止原生 Web Speech API
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            console.log('✅ 已停止原生語音播放');
        }
        
        // 停止 ResponsiveVoice
        if (typeof responsiveVoice !== 'undefined') {
            responsiveVoice.cancel();
            console.log('✅ 已停止 ResponsiveVoice 播放');
        }
    }

    // 持續播放功能
    async function playAllCards() {
        if (isPlaying) return;
        
        const sortedCards = sortCards(currentSortMode);
        if (sortedCards.length === 0) {
            alert('沒有單字卡可以播放');
            return;
        }
        
        isPlaying = true;
        currentPlayIndex = 0;
        playAllCardsBtn.disabled = true;
        playAllCardsBtn.textContent = '播放中...';
        stopPlaybackBtn.disabled = false;
        
        console.log('🎵 開始播放所有單字卡');
        
        playNextCard(sortedCards);
    }
    
    function playNextCard(cards) {
        if (!isPlaying || currentPlayIndex >= cards.length) {
            stopPlayback();
            return;
        }
        
        const card = cards[currentPlayIndex];
        const playCount = parseInt(playCountInput.value);
        const interval = parseInt(playIntervalInput.value) * 1000; // 轉換為毫秒
        
        console.log(`🔊 播放第 ${currentPlayIndex + 1}/${cards.length} 張卡片: ${card.english}`);
        
        // 播放當前單字指定次數
        playCardMultipleTimes(card, playCount, () => {
            if (!isPlaying) return;
            
            currentPlayIndex++;
            
            if (currentPlayIndex < cards.length) {
                // 等待間隔時間後播放下一張
                playTimeout = setTimeout(() => {
                    playNextCard(cards);
                }, interval);
            } else {
                // 播放完所有卡片
                stopPlayback();
                alert('所有單字卡播放完成！');
            }
        });
    }
    
    function playCardMultipleTimes(card, count, callback) {
        let playedCount = 0;
        
        function playOnce() {
            if (!isPlaying || playedCount >= count) {
                if (callback) callback();
                return;
            }
            
            speakText(card.english, () => {
                playedCount++;
                if (playedCount < count) {
                    // 短暫間隔後重複播放同一個單字
                    setTimeout(playOnce, 500);
                } else {
                    if (callback) callback();
                }
            });
        }
        
        playOnce();
    }
    
    function stopPlayback() {
        console.log('⏹️ 停止播放');
        
        isPlaying = false;
        currentPlayIndex = 0;
        
        if (playTimeout) {
            clearTimeout(playTimeout);
            playTimeout = null;
        }
        
        // 停止語音播放
        stopAllSpeech();
        
        playAllCardsBtn.disabled = false;
        playAllCardsBtn.textContent = '開始播放';
        stopPlaybackBtn.disabled = true;
    }
    
    // 綁定播放控制按鈕事件
    playAllCardsBtn.addEventListener('click', playAllCards);
    stopPlaybackBtn.addEventListener('click', stopPlayback);
    
    // 在創建卡片時應用字體大小
    const originalCreateCardElement = createCardElement;
    createCardElement = function(card, index) {
        const cardElement = originalCreateCardElement(card, index);
        const fontSize = fontSizeSlider.value;
        const cardHeight = heightSlider.value;
        
        cardElement.querySelector('.english').style.fontSize = `${fontSize}px`;
        cardElement.querySelector('.chinese').style.fontSize = `${Math.floor(fontSize * 0.75)}px`;
        cardElement.style.minHeight = `${cardHeight}px`;
        
        return cardElement;
    }
}); 