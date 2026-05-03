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
    const controlSection = document.querySelector('.control-section');

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
            controlSection.classList.toggle('hidden', isChecked);
        });
    }

    const addCardButton = document.getElementById('addCard');
    const englishInput = document.getElementById('englishWord');
    const chineseInput = document.getElementById('chineseTranslation');
    const pasteInputBtn = document.getElementById('pasteInputBtn');
    const copyTranslationBtn = document.getElementById('copyTranslationBtn');
    const cardsContainer = document.getElementById('cardsContainer');
    const loadMoreTrigger = document.getElementById('loadMoreTrigger');
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
    const playCountInput = document.getElementById('playCountInput');
    const playIntervalInput = document.getElementById('playIntervalInput');
    const playAllCardsBtn = document.getElementById('playAllCards');
    const articleSourceSelect = document.getElementById('articleSource');
    const articleSearchInput = document.getElementById('articleSearchInput');
    const articleSearchBtn = document.getElementById('articleSearchBtn');
    const articleTrendingBtn = document.getElementById('articleTrendingBtn');
    const articleSearchResults = document.getElementById('articleSearchResults');

    /** 一鍵存入與列表內文上限（字元） */
    const ARTICLE_CARD_MAX = 1000;
    const NEWS_RSS_FETCH = 10;
    const NEWS_DISPLAY = 8;
    /** 隨機熱門：多個美／加主題 RSS 合併後去重、洗牌 */
    const NEWS_TRENDING_FEEDS_PER_FETCH = 4;
    const NEWS_TRENDING_ITEMS_PER_FEED = 8;
    const NEWS_TRENDING_SHOW = 6;
    const NEWS_SNIPPET_MAX = 360;
    const CORS_TIMEOUT_MS = 9000;
    /** 僅拉 RSS 標題列時用較短逾時，失敗快換下一個代理 */
    const CORS_RSS_TIMEOUT_MS = 6500;

    let isEditMode = false;
    let currentRating = 3;
    let currentSortMode = 'time';
    
    // 播放控制變數
    let isPlaying = false;
    let playTimeout = null;
    let currentPlayIndex = 0;
    let translationDebounceTimer = null;
    let isLoadingCards = false;
    let hasMoreCards = true;
    let cardsOffset = 0;
    const CARDS_PAGE_SIZE = 30;

    function autoResizeTextarea(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }

    function setFieldValue(field, value) {
        field.value = value;
        autoResizeTextarea(field);
    }

    // 設置管理
    const defaultSettings = {
        playCount: '2',
        playInterval: '3',
        displayMode: 'all',
        sortMode: 'time',
        hideAddCard: 'false',
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
        
        // hideSettings 為臨時 UI 狀態，不從本地/雲端回讀；每次進站預設隱藏
        hideSettingsCheckbox.checked = true;
        controlSection.classList.add('hidden');
        
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
                ratingValue.textContent = `${currentRating}`;
            });
        });
        
        // 重置按鈕功能
        newCardRating.addEventListener('dblclick', () => {
            currentRating = 0;
            updateStarDisplay(0, 'active');
            ratingValue.textContent = '0';
        });
        
        // 初始化顯示3星
        updateStarDisplay(currentRating, 'active');
        ratingValue.textContent = `${currentRating}`;
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
                // 分頁載入時已經是最新在前
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
            responsiveVoice.speak(card.english, "US English Male", {
                pitch: 1,
                rate: 0.9,
                volume: 1
            });
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

    async function persistFlashcard(english, chinese, options = {}) {
        const { clearForm = false } = options;
        const newCard = {
            english,
            chinese,
            rating: currentRating
        };

        const { error } = await supabaseClient
            .from('user_cards')
            .insert([newCard])
            .select();

        if (error) {
            throw error;
        }

        flashcards.unshift(newCard);
        localStorage.setItem('flashcards', JSON.stringify(flashcards));
        displayCards();

        if (clearForm) {
            setFieldValue(englishInput, '');
            setFieldValue(chineseInput, '');
            currentRating = 3;
            updateStarDisplay(3, 'active');
            ratingValue.textContent = '3';
            updateTranslateButtonState();
        }
    }

    // 修改添加新卡片的事件處理程序
    addCardButton.addEventListener('click', async () => {
        const englishRaw = englishInput.value.trim();
        const chineseRaw = chineseInput.value.trim();

        if (!englishRaw && !chineseRaw) {
            return;
        }

        try {
            console.log('正在保存新卡片...');
            const normalized = await normalizeCardInput(englishRaw, chineseRaw);

            if (!normalized.english || !normalized.chinese) {
                alert('無法自動翻譯完成，請補上另一個語言後再儲存');
                return;
            }

            setFieldValue(englishInput, normalized.english);
            setFieldValue(chineseInput, normalized.chinese);

            await persistFlashcard(normalized.english, normalized.chinese, {
                clearForm: true
            });
            console.log('成功保存到 Supabase');
        } catch (error) {
            console.error('保存失敗:', error);
            console.error('錯誤詳情:', error.message);
            alert('保存失敗: ' + error.message);
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
    
    function setupInfiniteScroll() {
        if (!loadMoreTrigger || typeof IntersectionObserver === 'undefined') {
            return;
        }

        const observer = new IntersectionObserver(async (entries) => {
            const targetEntry = entries[0];
            if (targetEntry.isIntersecting && hasMoreCards && !isLoadingCards) {
                await loadFromSupabase(false);
            }
        }, {
            root: null,
            rootMargin: '200px',
            threshold: 0
        });

        observer.observe(loadMoreTrigger);
    }

    setupInfiniteScroll();

    // 4. 背景同步雲端數據（不阻塞界面）
    Promise.all([
        syncCloudSettings(localSettings),
        loadFromSupabase(true)
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

    // 判斷文字是否包含中文
    function isChineseText(text) {
        return /[\u3400-\u9FFF]/.test(text);
    }

    // 將輸入正規化為英文在前、中文在後
    async function normalizeCardInput(englishRaw, chineseRaw) {
        let english = englishRaw.trim();
        let chinese = chineseRaw.trim();

        // 兩邊都有值但填反時，自動交換
        if (english && chinese && isChineseText(english) && !isChineseText(chinese)) {
            [english, chinese] = [chinese, english];
        }

        // 只有一邊有值時，自動偵測語言並翻譯另一邊
        if (english && !chinese) {
            if (isChineseText(english)) {
                const originalChinese = english;
                const translatedEnglish = await translateText(originalChinese, 'zh-TW', 'en');
                english = translatedEnglish ? translatedEnglish.trim() : '';
                chinese = originalChinese;
            } else {
                const translatedChinese = await translateText(english, 'en', 'zh-TW');
                chinese = translatedChinese ? translatedChinese.trim() : '';
            }
        } else if (!english && chinese) {
            if (isChineseText(chinese)) {
                const translatedEnglish = await translateText(chinese, 'zh-TW', 'en');
                english = translatedEnglish ? translatedEnglish.trim() : '';
            } else {
                const originalEnglish = chinese;
                const translatedChinese = await translateText(originalEnglish, 'en', 'zh-TW');
                english = originalEnglish;
                chinese = translatedChinese ? translatedChinese.trim() : '';
            }
        }

        return { english, chinese };
    }

    async function fetchWithTimeout(url, init = {}, ms = CORS_TIMEOUT_MS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        try {
            return await fetch(url, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    function looksLikeGoogleNewsRss(text) {
        const s = text.trim();
        return s.startsWith('<?xml') || s.includes('<rss') || s.includes('<feed');
    }

    /** 從 Jina Reader 回傳中切出 XML（前綴常為說明文字） */
    function extractRssXmlFromJinaBody(text) {
        let t = text.replace(/^\uFEFF/, '').trim();
        const rssBlock = t.match(/<rss[\s\S]*?<\/rss>/i);
        if (rssBlock) {
            return rssBlock[0];
        }
        const i = t.indexOf('<?xml');
        const j = t.indexOf('<rss');
        const start = i >= 0 ? i : j >= 0 ? j : -1;
        if (start >= 0) {
            t = t.slice(start);
        }
        return t;
    }

    /**
     * Google News RSS 專用：優先 Jina（較不易 403），再試 allorigins、corsproxy。
     */
    async function corsFetchRssXml(rssUrl) {
        const enc = encodeURIComponent(rssUrl);
        const attempts = [
            { label: 'allorigins', url: `https://api.allorigins.win/raw?url=${enc}`, jina: false },
            { label: 'jina', url: `https://r.jina.ai/${enc}`, jina: true },
            { label: 'corsproxy', url: `https://corsproxy.io/?${enc}`, jina: false }
        ];
        let lastErr = null;
        for (const { url, jina } of attempts) {
            try {
                const r = await fetchWithTimeout(url, {}, CORS_RSS_TIMEOUT_MS);
                if (!r.ok) {
                    throw new Error('代理 HTTP ' + r.status);
                }
                let text = await r.text();
                text = text.replace(/^\uFEFF/, '');
                if (jina) {
                    text = extractRssXmlFromJinaBody(text);
                }
                if (!text || text.trim().length < 40) {
                    throw new Error('回應過短');
                }
                if (!looksLikeGoogleNewsRss(text)) {
                    throw new Error('RSS 格式異常');
                }
                return text;
            } catch (e) {
                lastErr = e;
            }
        }
        throw lastErr || new Error('代理皆失敗');
    }

    function friendlyArticleSearchError(e) {
        if (e && e.name === 'AbortError') {
            return new Error('連線逾時（' + CORS_TIMEOUT_MS / 1000 + ' 秒），請再試一次');
        }
        const msg = (e && e.message) || String(e);
        if (/failed to fetch/i.test(msg) || (e && e.name === 'TypeError')) {
            return new Error('無法連線：可能被網路／防火牆擋下，或代理暫時不可用');
        }
        return e instanceof Error ? e : new Error(msg);
    }

    function googleNewsRssUrl(query, langKey) {
        const q = encodeURIComponent(query);
        if (langKey === 'news_zh') {
            return `https://news.google.com/rss/search?q=${q}&hl=zh-TW&gl=TW&ceid=TW:zh`;
        }
        return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
    }

    function normalizeWhitespace(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
    }

    /** Google News RSS 的 description 經扁平化後常重複標題；盡量移除 */
    function dedupeRepeatedTitle(text, title) {
        if (!title || !text) {
            return normalizeWhitespace(text);
        }
        let t = normalizeWhitespace(text);
        const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        t = t.replace(new RegExp(esc, 'gi'), ' ').replace(/\s+/g, ' ').trim();
        return t;
    }

    /**
     * 從 Google News RSS 的 description HTML 抽出可讀摘要（避免整段只有標題重複）。
     */
    function extractGoogleNewsSnippet(descriptionHtml, itemTitle) {
        if (!descriptionHtml || !String(descriptionHtml).trim()) {
            return '';
        }
        const raw = String(descriptionHtml);
        if (!raw.includes('<')) {
            return clipForStorage(dedupeRepeatedTitle(raw, itemTitle), NEWS_SNIPPET_MAX);
        }
        const doc = new DOMParser().parseFromString(raw, 'text/html');
        const candidates = [];

        doc.querySelectorAll('font').forEach((el) => {
            const sz = el.getAttribute('size');
            if (String(sz) === '-1') {
                const t = normalizeWhitespace(el.textContent || '');
                if (t.length >= 12) {
                    candidates.push(t);
                }
            }
        });

        doc.querySelectorAll('p, li, td').forEach((el) => {
            const t = normalizeWhitespace(el.textContent || '');
            if (t.length >= 20 && t.length < 2500 && !/^https?:\/\//i.test(t)) {
                candidates.push(t);
            }
        });

        candidates.sort((a, b) => b.length - a.length);
        for (const chunk of candidates) {
            const cleaned = dedupeRepeatedTitle(chunk, itemTitle).replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
            if (cleaned.length >= 20) {
                return clipForStorage(cleaned, NEWS_SNIPPET_MAX);
            }
        }

        let full = normalizeWhitespace(doc.body?.innerText || doc.body?.textContent || '');
        full = dedupeRepeatedTitle(full, itemTitle).replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
        return clipForStorage(full, NEWS_SNIPPET_MAX);
    }

    function stripReaderResponseNoise(text) {
        let t = String(text || '').replace(/^\uFEFF/, '').trim();
        if (t.startsWith('```')) {
            const firstNl = t.indexOf('\n');
            const close = t.lastIndexOf('```');
            if (firstNl > 0 && close > firstNl) {
                t = t.slice(firstNl + 1, close).trim();
            }
        }
        const lines = t.split('\n');
        const dropLine = (line) => {
            const s = line.trimStart();
            return /^(Title:|URL Source:|Published Time:|Markdown Content:|={3,})/i.test(s);
        };
        while (lines.length && (lines[0].trim() === '' || dropLine(lines[0]))) {
            lines.shift();
        }
        return lines.join('\n').trim();
    }

    function isGoogleNewsArticleUrl(url) {
        try {
            const h = new URL(url).hostname;
            return h === 'news.google.com' || h.endsWith('.news.google.com');
        } catch {
            return false;
        }
    }

    /** Jina 有時會回「標題 + 換行 + Google 新聞整頁 HTML」，只保留 HTML 之前的可讀段 */
    function truncateBeforeHtmlShell(t) {
        const s = String(t || '');
        const m = s.search(/<!doctype\s+html|<html[\s>]/i);
        if (m > 40) {
            return s.slice(0, m).trim();
        }
        return s.trim();
    }

    function readerExtractLooksLikeGoogleShell(innerText) {
        const s = (innerText || '').slice(0, 600);
        if (innerText && innerText.length > 12000 && innerText.includes('google-site-verification')) {
            return true;
        }
        if (/news\.google\.com\/rss\/articles/i.test(s) && innerText.length > 4000) {
            return true;
        }
        return false;
    }

    /**
     * 向新聞條目連結請求可讀正文。
     * news.google.com 的內部連結若經 allorigins/corsproxy 常得到整頁 SPA HTML，故只走 Jina Reader。
     */
    async function fetchNewsPageReaderText(pageUrl) {
        if (!pageUrl) {
            return '';
        }
        const enc = encodeURIComponent(pageUrl);
        const isGNews = isGoogleNewsArticleUrl(pageUrl);
        const attemptUrls = isGNews
            ? [`https://r.jina.ai/${enc}`]
            : [`https://r.jina.ai/${enc}`, `https://api.allorigins.win/raw?url=${enc}`, `https://corsproxy.io/?${enc}`];

        for (const u of attemptUrls) {
            try {
                const r = await fetchWithTimeout(u, {}, 12000);
                if (!r.ok) {
                    continue;
                }
                let t = await r.text();
                t = stripReaderResponseNoise(t);

                if (t.startsWith('Title:')) {
                    const cut = t.indexOf('\n\n');
                    if (cut > 0 && cut < 500) {
                        t = t.slice(cut + 2).trim();
                    }
                }

                t = truncateBeforeHtmlShell(t);
                t = stripReaderResponseNoise(t);

                if (/^<!doctype\s+html|<html[\s>]/i.test(t.trim())) {
                    const doc = new DOMParser().parseFromString(t, 'text/html');
                    const inner = normalizeWhitespace(doc.body?.innerText || doc.body?.textContent || '');
                    if (readerExtractLooksLikeGoogleShell(inner) || inner.length < 100) {
                        continue;
                    }
                    t = inner;
                }

                t = stripReaderResponseNoise(t);
                if (t.length < 45) {
                    continue;
                }
                if (/<script[^>]*>/i.test(t) && t.length > 5000) {
                    continue;
                }
                return clipForStorage(t, ARTICLE_CARD_MAX);
            } catch {
                /* try next */
            }
        }
        return '';
    }

    /**
     * 美國／加拿大、財經股票／科技／政治／國際 等主題的 Google News RSS（英文）。
     * 每次隨機抽幾個主題合併後去重。
     */
    const US_CA_TRENDING_RSS_FEEDS = [
        'https://news.google.com/rss/search?q=stock+market+NASDAQ+NYSE+Wall+Street&hl=en-US&gl=US&ceid=US:en',
        'https://news.google.com/rss/search?q=TSX+Toronto+stock+market+Canada+investing&hl=en-CA&gl=CA&ceid=CA:en',
        'https://news.google.com/rss/search?q=Federal+Reserve+interest+rates+inflation+banking+finance&hl=en-US&gl=US&ceid=US:en',
        'https://news.google.com/rss/search?q=Bank+of+Canada+economy+fiscal+budget&hl=en-CA&gl=CA&ceid=CA:en',
        'https://news.google.com/rss/search?q=technology+AI+semiconductor+Silicon+Valley&hl=en-US&gl=US&ceid=US:en',
        'https://news.google.com/rss/search?q=Canada+technology+innovation+AI&hl=en-CA&gl=CA&ceid=CA:en',
        'https://news.google.com/rss/search?q=US+politics+Congress+White+House+Washington+DC&hl=en-US&gl=US&ceid=US:en',
        'https://news.google.com/rss/search?q=Canada+politics+Parliament+Ottawa+federal&hl=en-CA&gl=CA&ceid=CA:en',
        'https://news.google.com/rss/search?q=United+Nations+NATO+international+summit+geopolitics&hl=en-US&gl=US&ceid=US:en',
        'https://news.google.com/rss/search?q=Canada+foreign+affairs+international+relations&hl=en-CA&gl=CA&ceid=CA:en'
    ];

    /** 點選新聞後：重新抓正文，失敗再退回 RSS description 解析 */
    async function fetchFullNewsBodyForItem(item) {
        let body = '';
        if (item.url) {
            body = await fetchNewsPageReaderText(item.url);
        }
        body = stripReaderResponseNoise(body || '');
        body = truncateBeforeHtmlShell(body);
        if (/<!doctype|<html[\s>]/i.test(body)) {
            body = '';
        }
        if (item.title) {
            body = dedupeRepeatedTitle(body, item.title);
        }
        if (!body || body.length < 35) {
            body = extractGoogleNewsSnippet(item.descriptionRaw || '', item.title);
        }
        item.newsSnippetDisplay = clipForStorage(body, ARTICLE_CARD_MAX);
    }

    /** 只解析欄位；摘要改在點選後由 extractGoogleNewsSnippet 處理 */
    function parseGoogleNewsRssRawItems(xmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        if (doc.querySelector('parsererror')) {
            throw new Error('RSS 解析失敗');
        }
        const items = Array.from(doc.querySelectorAll('item'));
        return items
            .map((it) => {
                const title = it.querySelector('title')?.textContent?.trim() || '';
                const link = it.querySelector('link')?.textContent?.trim() || '';
                const pubDate = it.querySelector('pubDate')?.textContent?.trim() || '';
                const descriptionRaw = it.querySelector('description')?.textContent || '';
                const sourceEl = it.querySelector('source');
                const sourceName = sourceEl?.textContent?.trim() || '';
                return { title, link, pubDate, descriptionRaw, sourceName };
            })
            .filter((x) => x.title);
    }

    function mapGoogleNewsRssItem(it, langKey) {
        return {
            title: it.title,
            link: it.link,
            url: it.link,
            pubDate: it.pubDate,
            descriptionRaw: it.descriptionRaw,
            sourceName: it.sourceName,
            newsLang: langKey,
            kind: 'news',
            extract: null,
            newsSnippetDisplay: null
        };
    }

    function shuffleArray(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /** 隨機熱門：美／加、財經股票／科技／政治／國際等主題 RSS 合併去重 */
    async function fetchTrendingNewsItems() {
        const picks = shuffleArray(US_CA_TRENDING_RSS_FEEDS.slice()).slice(0, NEWS_TRENDING_FEEDS_PER_FETCH);
        const batches = await Promise.all(
            picks.map(async (rssUrl) => {
                try {
                    const xml = await corsFetchRssXml(rssUrl);
                    return parseGoogleNewsRssRawItems(xml).slice(0, NEWS_TRENDING_ITEMS_PER_FEED);
                } catch {
                    return [];
                }
            })
        );
        let merged = batches.flat();
        const seen = new Set();
        merged = merged.filter((row) => {
            const k = row.link || row.title;
            if (!k || seen.has(k)) {
                return false;
            }
            seen.add(k);
            return true;
        });
        merged = shuffleArray(merged);
        return merged.slice(0, NEWS_TRENDING_SHOW).map((it) => mapGoogleNewsRssItem(it, 'news_en'));
    }

    async function searchGoogleNews(langKey, query) {
        const rssUrl = googleNewsRssUrl(query, langKey);
        const xml = await corsFetchRssXml(rssUrl);
        let items = parseGoogleNewsRssRawItems(xml);
        items.sort((a, b) => {
            const da = Date.parse(a.pubDate) || 0;
            const db = Date.parse(b.pubDate) || 0;
            return db - da;
        });
        items = items.slice(0, NEWS_RSS_FETCH);
        return items.map((it) => mapGoogleNewsRssItem(it, langKey));
    }

    function clipForStorage(text, maxChars) {
        const t = text.trim();
        if (t.length <= maxChars) {
            return t;
        }
        return `${t.slice(0, maxChars).trim()}…`;
    }

    function rebuildNewsCardExtract(item) {
        if (item.kind !== 'news') {
            return;
        }
        const snippet =
            item.newsSnippetDisplay || extractGoogleNewsSnippet(item.descriptionRaw || '', item.title) || '';
        const srcLine = item.sourceName ? `來源：${item.sourceName}` : '';
        const bodyParts = [item.title, snippet, srcLine, item.url ? `連結：${item.url}` : ''].filter(Boolean);
        item.extract = clipForStorage(bodyParts.join('\n\n'), ARTICLE_CARD_MAX);
    }

    function fillArticleDetailPanel(detailPanel, item) {
        detailPanel.classList.remove('article-search-detail--empty');
        detailPanel.innerHTML = '';

        const head = document.createElement('div');
        head.className = 'article-detail-head';
        head.textContent = item.title;
        detailPanel.appendChild(head);

        const body = document.createElement('div');
        body.className = 'article-detail-body';
        detailPanel.appendChild(body);

        const actions = document.createElement('div');
        actions.className = 'article-detail-actions';

        if (item.url) {
            const link = document.createElement('a');
            link.href = item.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'article-result-link';
            link.textContent = '開啟原文';
            actions.appendChild(link);
        }

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'input-action-btn article-save-btn';
        saveBtn.textContent = '一鍵存入';
        saveBtn.addEventListener('click', async () => {
            await saveArticleSummaryAsCard(item);
        });
        actions.appendChild(saveBtn);
        detailPanel.appendChild(actions);

        const urlKey = item.url || item.title || '';
        detailPanel.dataset.detailKey = urlKey;

        function setNewsBodyText(txt, isLoading) {
            if (detailPanel.dataset.detailKey !== urlKey) {
                return;
            }
            body.textContent = txt;
            if (isLoading) {
                body.classList.add('article-detail-body--loading');
            } else {
                body.classList.remove('article-detail-body--loading');
            }
        }

        setNewsBodyText('已向原文連結重新請求內文，請稍候…', true);
        fetchFullNewsBodyForItem(item)
            .then(() => {
                if (detailPanel.dataset.detailKey !== urlKey) {
                    return;
                }
                rebuildNewsCardExtract(item);
                const txt = item.newsSnippetDisplay || '';
                if (!txt || txt.length < 8) {
                    setNewsBodyText('未取得內文，請點「開啟原文」閱讀完整報導。', false);
                } else {
                    setNewsBodyText(txt, false);
                }
            })
            .catch(() => {
                if (detailPanel.dataset.detailKey !== urlKey) {
                    return;
                }
                setNewsBodyText('載入內文失敗，請點「開啟原文」或稍後再試。', false);
            });
    }

    function renderNewsPickList(items, hintLine) {
        articleSearchResults.innerHTML = '';

        if (!items.length) {
            const empty = document.createElement('p');
            empty.className = 'article-results-empty';
            empty.textContent = '未取得任何新聞，請稍後再試。';
            articleSearchResults.appendChild(empty);
            return;
        }

        const hint = document.createElement('p');
        hint.className = 'article-results-pick-hint';
        hint.textContent =
            hintLine ||
            '已載入標題（新→舊）。點選一則後會重新向原文連結請求內文並顯示在下方；若載入失敗請用「開啟原文」。';
        articleSearchResults.appendChild(hint);

        const list = document.createElement('div');
        list.className = 'article-result-pick-list';

        items.forEach((item, index) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'article-result-pick-row';
            row.dataset.index = String(index);

            const titleLine = document.createElement('div');
            titleLine.className = 'article-result-pick-title';
            titleLine.textContent = item.title;
            row.appendChild(titleLine);

            const metaParts = [];
            if (item.pubDate) {
                metaParts.push(item.pubDate);
            }
            if (item.sourceName) {
                metaParts.push(item.sourceName);
            }
            if (metaParts.length) {
                const metaLine = document.createElement('div');
                metaLine.className = 'article-result-pick-meta';
                metaLine.textContent = metaParts.join(' · ');
                row.appendChild(metaLine);
            }

            list.appendChild(row);
        });

        articleSearchResults.appendChild(list);

        const detail = document.createElement('div');
        detail.className = 'article-search-detail article-search-detail--empty';
        detail.id = 'articleSearchDetailPanel';
        const ph = document.createElement('p');
        ph.className = 'article-detail-placeholder';
        ph.textContent = '請點選上方一則新聞';
        detail.appendChild(ph);
        articleSearchResults.appendChild(detail);

        list.addEventListener('click', (e) => {
            const row = e.target.closest('.article-result-pick-row');
            if (!row) {
                return;
            }
            const idx = Number(row.dataset.index);
            if (Number.isNaN(idx) || !items[idx]) {
                return;
            }
            list.querySelectorAll('.article-result-pick-row').forEach((r) => r.classList.remove('is-selected'));
            row.classList.add('is-selected');
            fillArticleDetailPanel(detail, items[idx]);
            detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }

    function renderArticleResults(items) {
        articleSearchResults.innerHTML = '';

        if (!items.length) {
            const p = document.createElement('p');
            p.className = 'article-results-empty';
            p.textContent = '沒有找到結果，請換個關鍵字或條目名試試。';
            articleSearchResults.appendChild(p);
            return;
        }

        if (items[0].kind === 'news') {
            renderNewsPickList(items);
            return;
        }

        const unk = document.createElement('p');
        unk.className = 'article-results-empty';
        unk.textContent = '無法顯示此類結果。';
        articleSearchResults.appendChild(unk);
    }

    async function saveArticleSummaryAsCard(item) {
        if (!item.newsSnippetDisplay || item.newsSnippetDisplay.length < 12) {
            try {
                await fetchFullNewsBodyForItem(item);
            } catch (e) {
                console.error(e);
            }
        }
        rebuildNewsCardExtract(item);

        let combined = item.extract || '';
        combined = clipForStorage(combined, ARTICLE_CARD_MAX);
        if (!combined) {
            alert('沒有可存入的內容');
            return;
        }

        try {
            let normalized;
            if (isChineseText(combined)) {
                normalized = await normalizeCardInput('', combined);
            } else {
                normalized = await normalizeCardInput(combined, '');
            }

            if (!normalized.english || !normalized.chinese) {
                alert('翻譯失敗，請稍後再試');
                return;
            }

            await persistFlashcard(normalized.english, normalized.chinese, {
                clearForm: false
            });
        } catch (err) {
            console.error(err);
            alert('存入失敗：' + err.message);
        }
    }

    async function runArticleSearch() {
        const q = articleSearchInput.value.trim();
        if (!q) {
            articleSearchResults.innerHTML = '<p class="article-results-empty">請輸入關鍵字</p>';
            return;
        }

        const source = articleSourceSelect.value;
        articleSearchBtn.disabled = true;
        const prevLabel = articleSearchBtn.textContent;
        articleSearchBtn.textContent = '搜尋中…';
        articleSearchResults.innerHTML = '<p class="article-results-loading">搜尋中…</p>';

        try {
            const items = await searchGoogleNews(source, q);
            renderArticleResults(items.slice(0, NEWS_DISPLAY));
        } catch (e) {
            console.error(e);
            const fe = friendlyArticleSearchError(e);
            const msg = fe && fe.message ? fe.message : String(fe);
            articleSearchResults.innerHTML = '';
            const errP = document.createElement('p');
            errP.className = 'article-results-empty';
            errP.textContent = '搜尋失敗：' + msg + '。';
            articleSearchResults.appendChild(errP);
        } finally {
            articleSearchBtn.disabled = false;
            articleSearchBtn.textContent = prevLabel;
        }
    }

    async function runRandomTrendingNews() {
        const disableTrending = () => {
            if (articleTrendingBtn) {
                articleTrendingBtn.disabled = true;
            }
            articleSearchBtn.disabled = true;
        };
        const enableTrending = () => {
            if (articleTrendingBtn) {
                articleTrendingBtn.disabled = false;
            }
            articleSearchBtn.disabled = false;
        };

        disableTrending();
        const prevTrending = articleTrendingBtn ? articleTrendingBtn.textContent : '';
        if (articleTrendingBtn) {
            articleTrendingBtn.textContent = '載入中…';
        }
        articleSearchResults.innerHTML = '<p class="article-results-loading">載入美／加財經科技政治等主題並隨機挑選…</p>';

        try {
            const items = await fetchTrendingNewsItems();
            renderNewsPickList(
                items,
                '以下為美國或加拿大相關主題（財經股票、科技、政治、國際等）隨機合併挑選；每次不同。點選後以 Jina 讀取內文（news.google.com 不經一般代理以免整頁 HTML）；失敗時會退回 RSS 摘要或請用「開啟原文」。'
            );
        } catch (e) {
            console.error(e);
            const fe = friendlyArticleSearchError(e);
            const msg = fe && fe.message ? fe.message : String(fe);
            articleSearchResults.innerHTML = '';
            const errP = document.createElement('p');
            errP.className = 'article-results-empty';
            errP.textContent = '熱門新聞載入失敗：' + msg + '。';
            articleSearchResults.appendChild(errP);
        } finally {
            enableTrending();
            if (articleTrendingBtn) {
                articleTrendingBtn.textContent = prevTrending || '隨機美加热門';
            }
        }
    }

    articleSearchBtn.addEventListener('click', () => {
        runArticleSearch().catch((e) => console.error(e));
    });

    if (articleTrendingBtn) {
        articleTrendingBtn.addEventListener('click', () => {
            runRandomTrendingNews().catch((e) => console.error(e));
        });
    }

    articleSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            runArticleSearch().catch((err) => console.error(err));
        }
    });

    async function autoTranslateFromSourceInput() {
        const sourceText = englishInput.value.trim();
        if (!sourceText) {
            setFieldValue(chineseInput, '');
            updateTranslateButtonState();
            return;
        }

        const normalized = await normalizeCardInput(sourceText, '');
        if (isChineseText(sourceText)) {
            setFieldValue(chineseInput, normalized.english || '');
        } else {
            setFieldValue(chineseInput, normalized.chinese || '');
        }
        updateTranslateButtonState();
    }

    // 處理翻譯按鈕點擊
    translateBtn.addEventListener('click', async () => {
        const sourceText = englishInput.value.trim();
        
        translateBtn.disabled = true;
        translateBtn.textContent = '翻譯中...';

        try {
            if (!sourceText) {
                setFieldValue(chineseInput, '');
            } else {
                const normalized = await normalizeCardInput(sourceText, '');
                if (isChineseText(sourceText)) {
                    setFieldValue(chineseInput, normalized.english || '');
                } else {
                    setFieldValue(chineseInput, normalized.chinese || '');
                }
            }

            if (!chineseInput.value && sourceText) {
                alert('翻譯失敗，請確認輸入內容');
            } else {
                updateTranslateButtonState();
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
        const sourceText = englishInput.value.trim();
        translateBtn.disabled = !sourceText;
    }

    englishInput.addEventListener('input', () => {
        autoResizeTextarea(englishInput);
        updateTranslateButtonState();
        if (translationDebounceTimer) {
            clearTimeout(translationDebounceTimer);
        }
        translationDebounceTimer = setTimeout(() => {
            autoTranslateFromSourceInput().catch(error => {
                console.error('自動翻譯失敗:', error);
            });
        }, 400);
    });

    // 初始化翻譯按鈕狀態
    updateTranslateButtonState();

    // 一鍵貼上到輸入框
    pasteInputBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text || !text.trim()) {
                alert('剪貼簿沒有可貼上的內容');
                return;
            }

            setFieldValue(englishInput, text.trim());
            await autoTranslateFromSourceInput();
        } catch (error) {
            console.error('貼上失敗:', error);
            alert('貼上失敗，請確認瀏覽器已允許剪貼簿權限');
        }
    });

    // 一鍵複製翻譯結果
    copyTranslationBtn.addEventListener('click', async () => {
        try {
            const translation = chineseInput.value.trim();
            if (!translation) {
                alert('目前沒有可複製的翻譯結果');
                return;
            }

            await navigator.clipboard.writeText(translation);
        } catch (error) {
            console.error('複製失敗:', error);
            alert('複製失敗，請稍後再試');
        }
    });

    autoResizeTextarea(englishInput);
    autoResizeTextarea(chineseInput);

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

    async function loadFromSupabase(reset = false) {
        if (isLoadingCards) {
            return true;
        }

        try {
            if (reset) {
                cardsOffset = 0;
                hasMoreCards = true;
                flashcards = [];
            }

            if (!hasMoreCards) {
                return true;
            }

            isLoadingCards = true;
            console.log(`正在从 Supabase 分頁读取数据... offset=${cardsOffset}, limit=${CARDS_PAGE_SIZE}`);

            const { data, error } = await supabaseClient
                .from('user_cards')
                .select('*')
                .order('id', { ascending: false })
                .range(cardsOffset, cardsOffset + CARDS_PAGE_SIZE - 1);
            
            if (error) {
                throw error;
            }
            
            if (data && data.length > 0) {
                const pageCards = data.map(item => ({
                    english: item.english,
                    chinese: item.chinese,
                    rating: item.rating || 0
                }));

                flashcards = [...flashcards, ...pageCards];
                cardsOffset += data.length;
                hasMoreCards = data.length === CARDS_PAGE_SIZE;
                console.log(`分頁讀取成功，本次 ${data.length} 筆，累計 ${flashcards.length} 筆`);
            } else {
                hasMoreCards = false;
                if (reset) {
                    console.log('資料庫目前沒有卡片');
                }
            }
            
            localStorage.setItem('flashcards', JSON.stringify(flashcards));
            displayCards();
            return true;
        } catch (error) {
            console.error('从 Supabase 加载失败，详细错误:', error);
            console.error('错误堆栈:', error.stack);
            return false;
        } finally {
            isLoadingCards = false;
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
                    
                    // 變更後重置分頁並重新載入第一批
                    try {
                        await loadFromSupabase(true);
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
    
    // 持續播放功能
    async function playAllCards() {
        if (isPlaying) {
            stopPlayback();
            return;
        }
        
        const sortedCards = sortCards(currentSortMode);
        if (sortedCards.length === 0) {
            alert('沒有單字卡可以播放');
            return;
        }
        
        isPlaying = true;
        currentPlayIndex = 0;
        playAllCardsBtn.textContent = '停止播放';
        playAllCardsBtn.classList.add('is-stopping');
        
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
            
            responsiveVoice.speak(card.english, "US English Male", {
                pitch: 1,
                rate: 0.9,
                volume: 1,
                onend: () => {
                    playedCount++;
                    if (playedCount < count) {
                        // 短暫間隔後重複播放同一個單字
                        setTimeout(playOnce, 500);
                    } else {
                        if (callback) callback();
                    }
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
        if (typeof responsiveVoice !== 'undefined') {
            responsiveVoice.cancel();
        }
        
        playAllCardsBtn.disabled = false;
        playAllCardsBtn.textContent = '開始播放';
        playAllCardsBtn.classList.remove('is-stopping');
    }
    
    // 綁定播放控制按鈕事件
    playAllCardsBtn.addEventListener('click', playAllCards);
}); 