// 首先確保 Firebase 配置和初始化在最前面
const firebaseConfig = {
    apiKey: "AIzaSyDQZovmdN3y7AGJh9rkVZopch0ZvQG68qw",
    authDomain: "testjack-5fd0c.firebaseapp.com",
    databaseURL: "https://testjack-5fd0c-default-rtdb.firebaseio.com",
    projectId: "testjack-5fd0c",
    storageBucket: "testjack-5fd0c.appspot.com",
    messagingSenderId: "976883349752",
    appId: "1:976883349752:web:5eee959e782b4e95df630d"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

// 獲取數據庫引用
const database = firebase.database();

document.addEventListener('DOMContentLoaded', async () => {
    // 檢查 Firebase 連接狀態
    const connectedRef = database.ref(".info/connected");
    connectedRef.on("value", (snap) => {
        if (snap.val() === true) {
            console.log("已連接到 Firebase");
        } else {
            console.log("未連接到 Firebase");
        }
    });

    // 獲取新的元素
    const hideAddCardCheckbox = document.getElementById('hideAddCard');
    const hideSettingsCheckbox = document.getElementById('hideSettings');
    const addCardSection = document.querySelector('.add-card-section');
    const controlPanel = document.querySelector('.control-panel');

    // 從本地存儲加載隱藏狀態
    const isAddCardHidden = localStorage.getItem('hideAddCard') === 'true';
    const isSettingsHidden = localStorage.getItem('hideSettings') === 'true';

    // 設置新增單詞卡的隱藏狀態
    if (hideAddCardCheckbox) {
        hideAddCardCheckbox.checked = isAddCardHidden;
        if (isAddCardHidden) {
            addCardSection.classList.add('hidden');
        }

        hideAddCardCheckbox.addEventListener('change', () => {
            const isChecked = hideAddCardCheckbox.checked;
            addCardSection.classList.toggle('hidden', isChecked);
            localStorage.setItem('hideAddCard', isChecked);
        });
    }

    // 設置控制面板的隱藏狀態
    if (hideSettingsCheckbox) {
        hideSettingsCheckbox.checked = isSettingsHidden;
        if (isSettingsHidden) {
            controlPanel.classList.add('hidden');
        }

        hideSettingsCheckbox.addEventListener('change', () => {
            const isChecked = hideSettingsCheckbox.checked;
            controlPanel.classList.toggle('hidden', isChecked);
            localStorage.setItem('hideSettings', isChecked);
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
    let isEditMode = false;

    // 從本地存儲加載現有單字卡
    let flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];

    // 從本地存儲加載夜間模式狀態
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    // 初始化夜間模式
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeBtn.classList.add('active');
    }

    // 顯示模式控制
    let currentMode = 'all'; // 預設顯示全部

    function setDisplayMode(mode) {
        currentMode = mode;
        
        // 更新按鈕狀態
        [showAllBtn, showEnglishBtn, showChineseBtn].forEach(btn => {
            btn.classList.remove('active');
        });

        // 更新卡片顯示狀態
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
    function updateCardSize() {
        const size = sizeSlider.value;
        sizeValue.textContent = `${size}px`;
        
        // 更新所有卡片的寬度
        document.querySelectorAll('.flashcard').forEach(card => {
            card.style.width = `${size}px`;
        });
    }

    // 監聽滑軌變化
    sizeSlider.addEventListener('input', updateCardSize);

    // 顯示所有已存在的單字卡
    function displayCards() {
        cardsContainer.innerHTML = '';
        flashcards.forEach((card, index) => {
            const cardElement = createCardElement(card, index);
            cardsContainer.appendChild(cardElement);
        });
        updateCardSize(); // 應用當前的寬度設置
    }

    // 創建單字卡元素
    function createCardElement(card, index) {
        const div = document.createElement('div');
        div.className = `flashcard mode-${currentMode}${isEditMode ? ' edit-mode' : ''}`;
        
        // 添加刪除按鈕
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            try {
                // 从数组中删除卡片
                flashcards.splice(index, 1);
                
                // 更新 Firebase 的 user_cards
                await database.ref('user_cards').set(flashcards);
                console.log('删除操作已同步到 Firebase 的 user_cards');
                
                // 更新本地存储
                localStorage.setItem('flashcards', JSON.stringify(flashcards));
                
                // 更新显示
                displayCards();
            } catch (error) {
                console.error('删除时出错:', error);
                alert('删除失败，请稍后重试');
                // 如果删除失败，重新加载数据
                loadFromFirebase();
            }
        });

        div.innerHTML = `
            <div class="english">${card.english}</div>
            <div class="chinese">${card.chinese}</div>
        `;
        
        div.appendChild(deleteBtn);

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

    // 修改添加新卡片的事件處理程序
    addCardButton.addEventListener('click', async () => {
        const english = englishInput.value.trim();
        const chinese = chineseInput.value.trim();

        if (english && chinese) {
            try {
                console.log('正在保存新卡片...');
                
                // 將新卡片添加到數組
                flashcards.push({ english, chinese });
                
                // 保存到 Firebase
                await database.ref('user_cards').set(flashcards);
                console.log('成功保存到 Firebase');
                
                // 保存到本地存儲
                localStorage.setItem('flashcards', JSON.stringify(flashcards));
                
                // 更新顯示
                displayCards();
                
                // 清空輸入框
                englishInput.value = '';
                chineseInput.value = '';
                
                // 更新翻譯按鈕狀態
                updateTranslateButtonState();
            } catch (error) {
                console.error('保存失敗:', error);
                console.error('錯誤詳情:', error.message);
                // 如果保存失敗，從數組中移除新添加的卡片
                flashcards.pop();
                alert('保存失敗: ' + error.message);
            }
        }
    });

    // 首先尝试从 Firebase 加载数据
    const loadSuccess = await loadFromFirebase();
    
    if (!loadSuccess) {
        // 如果从 Firebase 加载失败，使用本地存储的数据
        flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];
        displayCards();
    }

    // 设置显示模式和其他初始化
    setDisplayMode('all');
    updateCardSize();
    updateTranslateButtonState();

    // 切換夜間模式
    function toggleDarkMode() {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode');
        darkModeBtn.classList.toggle('active');
        localStorage.setItem('darkMode', isDarkMode);
    }

    // 綁定夜間模式按鈕事件
    darkModeBtn.addEventListener('click', toggleDarkMode);

    // 添加洗牌函數
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // 添加隨機排列功能
    async function shuffleCards() {
        flashcards = shuffleArray([...flashcards]);
        localStorage.setItem('flashcards', JSON.stringify(flashcards));
        await saveToFirebase();
        displayCards();
        
        const cards = document.querySelectorAll('.flashcard');
        cards.forEach((card, index) => {
            card.style.animation = 'none';
            card.offsetHeight;
            card.style.animation = 'shuffleAnimation 0.5s ease forwards';
            card.style.animationDelay = `${index * 0.05}s`;
        });
    }

    // 綁定隨機排列按鈕事件
    shuffleBtn.addEventListener('click', shuffleCards);

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

    // 修改 Firebase 相关函数
    async function saveToFirebase() {
        try {
            console.log('正在保存数据到 Firebase...');
            console.log('要保存的数据:', flashcards);
            
            // 使用完整路径保存数据
            await database.ref('/user_cards').set(flashcards);
            console.log('数据成功保存到 Firebase');
            
            // 验证数据是否正确保存
            const snapshot = await database.ref('/user_cards').once('value');
            const savedData = snapshot.val();
            console.log('验证保存的数据:', savedData);
            
            if (JSON.stringify(savedData) === JSON.stringify(flashcards)) {
                console.log('数据验证成功，保存完成');
                return true;
            } else {
                throw new Error('数据验证失败，保存的数据与原数据不匹配');
            }
        } catch (error) {
            console.error('保存到 Firebase 时出错:', error);
            console.error('错误详情:', error.message);
            return false;
        }
    }

    async function loadFromFirebase() {
        try {
            console.log('正在连接到:', 'https://testjack-5fd0c-default-rtdb.firebaseio.com/');
            console.log('正在从 Firebase 读取数据...');
            
            // 先检查连接状态
            const connectedRef = database.ref(".info/connected");
            connectedRef.on("value", (snap) => {
                if (snap.val() === true) {
                    console.log("已连接到 Firebase");
                } else {
                    console.log("未连接到 Firebase");
                }
            });

            // 从 user_cards 路径读取数据
            const snapshot = await database.ref('/user_cards').once('value');
            console.log('获取到的原始数据:', snapshot.val());
            const data = snapshot.val();
            
            if (data && Array.isArray(data)) {
                console.log('成功读取到数组数据，长度:', data.length);
                flashcards = data;
            } else {
                console.log('数据库中没有数据或格式不正确，创建初始数据');
                // 如果数据库中没有数据，创建初始数据
                const initialData = [
                    {
                        english: "Hello",
                        chinese: "你好"
                    },
                    {
                        english: "Thank you",
                        chinese: "謝謝"
                    },
                    {
                        english: "Good morning",
                        chinese: "早安"
                    }
                ];
                
                // 将初始数据保存到根路径下的 user_cards
                console.log('正在保存初始数据到 /user_cards ...');
                await database.ref('/user_cards').set(initialData);
                console.log('初始数据保存成功');
                flashcards = initialData;
            }
            
            localStorage.setItem('flashcards', JSON.stringify(flashcards));
            displayCards();
            return true;
        } catch (error) {
            console.error('从 Firebase 加载失败，详细错误:', error);
            console.error('错误堆栈:', error.stack);
            return false;
        }
    }

    // 修改 setupRealtimeSync 函数
    function setupRealtimeSync() {
        console.log('设置实时同步监听...');
        // 使用完整路径监听 user_cards 的变化
        database.ref('/user_cards').on('value', (snapshot) => {
            console.log('检测到数据变化:', snapshot.val());
            const data = snapshot.val();
            if (data && Array.isArray(data)) {
                console.log('更新本地数据，新数据长度:', data.length);
                flashcards = data;
                localStorage.setItem('flashcards', JSON.stringify(flashcards));
                displayCards();
            } else {
                console.log('收到的数据无效或不是数组:', data);
            }
        }, (error) => {
            console.error('监听错误:', error);
        });
    }

    // 在 DOMContentLoaded 事件中添加实时同步
    setupRealtimeSync();

    // 獲取測試按鈕
    const testSaveBtn = document.getElementById('testSave');
    const testLoadBtn = document.getElementById('testLoad');

    // 測試存儲功能
    testSaveBtn.addEventListener('click', async () => {
        console.log('===== 開始測試存儲功能 =====');
        testSaveBtn.textContent = '存儲中...';
        testSaveBtn.disabled = true;

        try {
            // 檢查數據
            console.log('當前要存儲的數據:', flashcards);
            
            // 檢查連接狀態
            const connectedRef = database.ref(".info/connected");
            const isConnected = await new Promise(resolve => {
                connectedRef.once("value", (snap) => {
                    resolve(snap.val());
                });
            });
            
            if (!isConnected) {
                throw new Error('未連接到 Firebase');
            }
            
            // 嘗試存儲
            await database.ref('/user_cards').set(flashcards);
            
            // 驗證存儲
            const snapshot = await database.ref('/user_cards').once('value');
            const savedData = snapshot.val();
            
            if (JSON.stringify(savedData) === JSON.stringify(flashcards)) {
                console.log('✅ 存儲成功！');
                console.log('存儲的數據:', savedData);
                alert('存儲成功！');
            } else {
                throw new Error('數據驗證失敗');
            }
        } catch (error) {
            console.error('❌ 存儲失敗:', error);
            console.error('詳細錯誤:', error.message);
            alert('存儲失敗: ' + error.message);
        } finally {
            testSaveBtn.textContent = '測試存儲';
            testSaveBtn.disabled = false;
            console.log('===== 存儲測試結束 =====');
        }
    });

    // 測試讀取功能
    testLoadBtn.addEventListener('click', async () => {
        console.log('===== 開始測試讀取功能 =====');
        testLoadBtn.textContent = '讀取中...';
        testLoadBtn.disabled = true;

        try {
            // 檢查連接狀態
            const connectedRef = database.ref(".info/connected");
            const isConnected = await new Promise(resolve => {
                connectedRef.once("value", (snap) => {
                    resolve(snap.val());
                });
            });
            
            if (!isConnected) {
                throw new Error('未連接到 Firebase');
            }

            // 嘗試讀取數據
            const snapshot = await database.ref('/user_cards').once('value');
            const data = snapshot.val();
            
            console.log('讀取到的原始數據:', data);
            
            if (data && Array.isArray(data)) {
                flashcards = data;
                localStorage.setItem('flashcards', JSON.stringify(flashcards));
                displayCards();
                console.log('✅ 讀取成功！');
                console.log('數據長度:', data.length);
                alert(`讀取成功！共讀取到 ${data.length} 張卡片`);
            } else {
                throw new Error('數據格式不正確或為空');
            }
        } catch (error) {
            console.error('❌ 讀取失敗:', error);
            console.error('詳細錯誤:', error.message);
            alert('讀取失敗: ' + error.message);
        } finally {
            testLoadBtn.textContent = '測試讀取';
            testLoadBtn.disabled = false;
            console.log('===== 讀取測試結束 =====');
        }
    });
}); 