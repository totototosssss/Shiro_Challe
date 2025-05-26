document.addEventListener('DOMContentLoaded', () => {
    let maxDaysGlobal; // 選択された総日数
    const INITIAL_STATE_BASE = {
        day: 1,
        knowledge: 5, stress: 20, energy: 100, money: 500,
        focus: 20, mental: 30, luck: 5,
        shiroImage: 'shiro.png',
        shiroHappyImage: 'shiro_happy.png',
        shiroSadImage: 'shiro_sad.png',
        logMessage: '', 
        inventory: [],
        permanentBuffs: {},
        activeEffects: {},
        insultOnlineCount: 0,
        pachinkoCount: 0,
        soaplandUsedCount: 0,
        studyActionCount: 0,
        omikujiUsedToday: false,
        quizAttemptedToday: false // クイズ挑戦フラグ
    };
    let gameState = {};

    // --- 育成ゲーム アイテム定義 ---
    const ITEMS = {
        'energy_drink_law': { name: '法力エナジードリンク改', price: 600, type: 'consumable_active', description: '使用: 体力+25、集中力+18。ただしストレス+8。', use: (gs, lh) => { gs.energy += 25; lh.add(`体力${formatChange(25)}`); gs.focus += 18; lh.add(`集中力${formatChange(18)}`); gs.stress += 8; lh.add(`ストレス${formatChange(8, "negative")}`); return true; }},
        'omikuji': { name: '開運おみくじ', price: 150, type: 'consumable_active', description: '今日の運勢を占う。1日1回限定。', use: (gs, lh) => { if (gs.omikujiUsedToday) { lh.add("おみくじは本日既に引いています。"); showThought("今日はもう引いた…",1800,'neutral'); return false; } gs.omikujiUsedToday = true; const r=Math.random()*100; let rt="",lc=0,mc=0,sm="",st='neutral'; if(r<5){rt="【大吉】";lc=getRandomInt(30,45);mc=getRandomInt(10,20);sm="やったー！ツイてる！";st='success';} else if(r<20){rt="【中吉】";lc=getRandomInt(10,18);mc=getRandomInt(5,10);sm="おお、中吉！";st='success';} else if(r<50){rt="【小吉】";lc=getRandomInt(3,7);mc=getRandomInt(1,3);sm="小吉か。";st='neutral';} else if(r<75){rt="【吉】";lc=getRandomInt(1,2);mc=0;sm="吉。平穏が一番。";st='neutral';} else if(r<85){rt="【末吉】";lc=0;mc=getRandomInt(-2,0);sm="末吉…微妙。";st='neutral';} else if(r<95){rt="【凶】";lc=getRandomInt(-7,-3);mc=getRandomInt(-8,-4);sm="うわっ、凶だ…。";st='failure';} else{rt="【大凶】";lc=getRandomInt(-10,-8);mc=getRandomInt(-10,-8);sm="まさかの大凶…！";st='failure';} lh.add(`おみくじ結果 ${formatMessage(rt,st)}！`); if(lc!==0){gs.luck+=lc;lh.add(`合格運${formatChange(lc)}`);}else{lh.add(`合格運変化なし`);} if(mc!==0){gs.mental+=mc;lh.add(`精神力${formatChange(mc)}`);}else{lh.add(`精神力変化なし`);} showThought(sm,2300,st); return true; }},
        'luxury_soapland': { name: '行きつけのソープ', price: 65000, type: 'consumable_active', description: '究極癒やし。ストレス0,集中力MAX。資金も激減。', use: (gs, lh) => { gs.stress=0;lh.add(`ストレス完全消滅！`);gs.focus=100;lh.add(`集中力MAX！`);gs.soaplandUsedCount++;gs.money-=10000;lh.add(`追加料金で資金${formatChange(-10000,"negative")}`);showThought("全て忘れてリフレッシュ！",2500,'success');return true;}},
        'best_exercise_book':{name:'Sランク過去問集',price:7500,type:'permanent',description:'所有中、演習時の知識獲得+45%,集中力消費-20%。',permanentEffect:{exerciseKnowledgeBoost:0.45,exerciseFocusSave:0.20}},
        'intensive_lecture_ticket':{name:'短期集中講座受講証',price:3000,type:'consumable_active',description:'使用:知識+15,集中+20,精神+14,ストレス+8。次回勉強/演習効率1.7倍(1日)。',use:(gs,lh)=>{gs.knowledge+=15;lh.add(`法律知識${formatChange(15)}`);gs.focus+=20;lh.add(`集中力${formatChange(20)}`);gs.mental+=14;lh.add(`精神力${formatChange(14)}`);gs.stress+=8;lh.add(`講座負荷ストレス${formatChange(8,"negative")}`);const bt=Math.random()<0.5?'studyTextbookBoost':'studyExerciseBoost';const tn=bt==='studyTextbookBoost'?'基本書':'演習';gs.activeEffects[bt]={duration:2,value:1.7,displayName:`集中講座(${tn})`};lh.add(formatMessage(`集中講座(${tn})効果`,"item")+"を得た！");return true;}},
        'counseling_ticket':{name:'カウンセリング予約券',price:1800,type:'consumable_active',description:'使用:精神力+35、ストレス-40。専門家は頼りに。',use:(gs,lh)=>{gs.mental+=35;lh.add(`精神力${formatChange(35)}`);gs.stress-=40;lh.add(`ストレス${formatChange(-40)}`);return true;}},
        'noise_cancelling_earphones':{name:'高級NCイヤホン',price:5000,type:'permanent',description:'所有中、勉強時集中力低下-40%。ストレス自然増を微軽減。',permanentEffect:{focusRetentionBoost:0.40,dailyStressResist:1}},
        'small_lucky_charm':{name:'小さな交通安全お守り',price:1000,type:'permanent',description:'所有中、合格運+10(初期)、毎日運気が少し上がる気が。',permanentEffect:{luck:10,dailyLuckIncrease:2.5}}
    };

    // --- 育成ゲーム ランダムイベント定義 ---
    const RANDOM_EVENTS = [
        { name: "オプチャ炎上", msg: "差別的発言が拡散し大炎上！精神大ダメージ…", effect: (gs) => { gs.knowledge=Math.round(gs.knowledge*0.6); gs.stress=Math.min(100,gs.stress+50); gs.energy=Math.round(gs.energy*0.5); gs.focus=Math.round(gs.focus*0.4); gs.mental=Math.round(gs.mental*0.3); gs.luck=Math.max(0,gs.luck-20);}},
        { name: "にゃま暴言", msg: "突然にゃまが現れ心無い言葉を…心が折れそうだ。", effect: (gs) => { gs.knowledge=Math.round(gs.knowledge*0.4); gs.stress=Math.min(100,gs.stress+40); gs.energy=Math.round(gs.energy*0.4); gs.focus=Math.round(gs.focus*0.35); gs.mental=Math.round(gs.mental*0.4); gs.luck=Math.max(0,gs.luck-15);}},
        { name: "親バレ危機", msg: "自室で㊙️をしていたら親に目撃された…最悪だ。", effect: (gs) => { gs.stress=Math.min(100,gs.stress+55); gs.energy=Math.round(gs.energy*0.45); gs.focus=Math.round(gs.focus*0.4); gs.mental=Math.round(gs.mental*0.3);}},
        { name: "将来心配", msg: "親から「28歳にもなって将来どうするの？」と真剣に心配された…気分が重い。", effect: (gs) => { gs.stress=Math.min(100,gs.stress+35); gs.mental=Math.max(0,gs.mental-25); gs.focus=Math.max(0,gs.focus-20);}},
        { name: "体調不良", msg: "原因不明の体調不良。今日は何もできそうにない…。", effect: (gs) => { gs.energy=Math.max(5,gs.energy-55); gs.focus=Math.max(5,gs.focus-40); gs.stress=Math.min(100,gs.stress+30); gs.activeEffects['bad_condition'] = { duration:3, displayName:'体調不良', value:0.3 };}},
        { name: "大谷活躍", msg: "大谷選手が特大HR！なんだか元気が出た！", effect: (gs) => { gs.knowledge=Math.round(gs.knowledge*1.02); gs.stress=Math.max(0,gs.stress-6); gs.energy=Math.round(gs.energy*1.05); gs.focus=Math.round(gs.focus*1.05); gs.mental=Math.round(gs.mental*1.05); gs.luck=Math.min(100,gs.luck+7);}},
        { name: "学者動画発見", msg: "有名学者の予備試験対策動画を偶然発見！役立ちそうだ！", effect: (gs) => { gs.knowledge+=getRandomInt(1,3); gs.focus+=getRandomInt(4,9); gs.stress-=4;}},
        { name: "真実の言葉", msg: "にゃまに「予備試験なんて夢見すぎ笑」と言われた。もうダメかも…。", effect: (gs) => { gs.mental-=getRandomInt(20,30); gs.stress+=getRandomInt(25,35); gs.focus-=getRandomInt(14,20); gs.knowledge-=getRandomInt(0,1);}},
        { name: "基準点上昇デマ", msg: "SNSで「今年の択一基準点は大幅上昇」というデマを見てしまった…。不安だ。", effect: (gs) => { gs.stress+=getRandomInt(15,25); gs.focus-=getRandomInt(8,14); gs.mental-=getRandomInt(5,10);}}
    ];
    const RANDOM_EVENT_CHANCE = 0.12; // 少し出現率アップ

    // --- DOM要素取得 (育成ゲーム) ---
    const difficultyScreen = document.getElementById('difficulty-selection-screen');
    const gameContainer = document.querySelector('.game-container');
    const selectEasyButton = document.getElementById('select-easy');
    const selectHardButton = document.getElementById('select-hard');
    const maxDaysDisplayElem = document.getElementById('max-days-display');
    const dayDisplayElem = document.getElementById('day-display');
    const knowledgeDisplay = document.getElementById('knowledge-display');
    const stressDisplay = document.getElementById('stress-display');
    const energyDisplay = document.getElementById('energy-display');
    const moneyDisplayHeaderValue = document.getElementById('money-display-header-value');
    const focusDisplay = document.getElementById('focus-display');
    const mentalDisplay = document.getElementById('mental-display');
    const luckDisplay = document.getElementById('luck-display');
    const shiroImageElem = document.getElementById('shiro-image');
    const shiroThoughtBubble = document.getElementById('shiro-thought-bubble');
    const logMessageDisplay = document.getElementById('log-message');
    const logMessageArea = document.getElementById('log-message-area');
    const actionButtons = document.querySelectorAll('.action-buttons-grid button'); // NodeList
    const doQuizButton = document.getElementById('do-quiz-button'); // クイズボタンを個別に取得
    const inventoryListElem = document.getElementById('inventory-list');
    const eventNotificationArea = document.getElementById('event-notification');
    const eventMessageElem = document.getElementById('event-message');
    const examResultModal = document.getElementById('exam-result-modal');
    const examCalcMsg = document.getElementById('exam-calculation-message');
    const examActualResult = document.getElementById('exam-actual-result');
    const fictionEndingElem = document.getElementById('fiction-ending');
    const fictionNoticeElem = fictionEndingElem.querySelector('.fiction-body');
    const examResultTitle = document.getElementById('exam-result-title');
    const examResultMesssage = document.getElementById('exam-result-message');
    const restartGameButton = document.getElementById('restart-game-button');
    const examShiroImageElem = document.getElementById('exam-shiro-image');
    const itemShopModal = document.getElementById('item-shop-modal');
    const openShopButton = document.getElementById('open-shop-button');
    const shopMoneyDisplay = document.getElementById('shop-money-display');
    const itemShopListElem = document.getElementById('item-shop-list');
    const modalCloseButtons = document.querySelectorAll('.modal-close-button'); // 育成ゲームの共通閉じるボタン

    // --- DOM要素取得 (クイズモーダル) ---
    const dailyQuizModal = document.getElementById('daily-quiz-modal');
    const closeQuizModalButton = document.getElementById('close-quiz-modal-button');
    const quizMessageTextContentElement = document.getElementById('quiz-message-text-content');
    const quizChoicesAreaElement = document.getElementById('quiz-choices-area');
    const quizFeedbackTextElement = document.getElementById('quiz-feedback-text');
    const quizNextQuestionBtn = document.getElementById('quiz-next-question-btn');
    const quizMainAreaElement = document.getElementById('quiz-main-area'); // クイズのメインコンテンツ表示エリア
    const quizResultAreaElement = document.getElementById('quiz-result-area'); // クイズの結果表示エリア
    const quizProgressBarElement = document.getElementById('quiz-progress-bar');
    const quizProgressTextElement = document.getElementById('quiz-progress-text');
    const quizCurrentScoreValueElement = document.getElementById('quiz-current-score-value');
    const quizCurrentScoreDisplayElement = dailyQuizModal.querySelector('.quiz-current-score-display'); // クイズモーダル内のスコア表示
    const quizResultIconContainer = document.getElementById('quiz-result-icon-container');
    const quizResultRankTitleElement = document.getElementById('quiz-result-rank-title');
    const quizFinalScoreValueElement = document.getElementById('quiz-final-score-value');
    const quizTotalQuestionsOnResultElement = document.getElementById('quiz-total-questions-on-result');
    const quizResultMessageElement = document.getElementById('quiz-result-message');
    const quizFinishButton = document.getElementById('quiz-finish-button'); // クイズ終了して育成に戻るボタン
    // const quizConfettiCanvas = document.getElementById('quiz-confetti-canvas'); // もしHTMLにcanvasを固定配置する場合

    // --- LogHelper (前回からの改善版) ---
    const LogHelper = {
        currentLogEntries: [],
        add: function(message) { this.currentLogEntries.push(message); },
        addRaw: function(html) { this.currentLogEntries.push(html); },
        clearCurrentTurnLogs: function() { this.currentLogEntries = []; },
        commitCurrentTurnToGameState: function(prependText = "") {
            if (this.currentLogEntries.length > 0) {
                let turnLogHtml = this.currentLogEntries.join('<br>');
                if (prependText) turnLogHtml = prependText + "<br>" + turnLogHtml;
                if (gameState.logMessage && !gameState.logMessage.endsWith('<br>') && gameState.logMessage !== "") {
                    gameState.logMessage += '<br>';
                }
                gameState.logMessage += turnLogHtml;
            }
            this.clearCurrentTurnLogs();
        },
        renderFullLog: function() {
            if (logMessageDisplay && gameState.logMessage !== undefined) {
                logMessageDisplay.innerHTML = gameState.logMessage;
                if (logMessageArea) logMessageArea.scrollTop = logMessageArea.scrollHeight;
            }
        },
        setInitialLogMessage: function() {
            gameState.logMessage = `しろちゃんの${maxDaysGlobal}日間の予備試験への道が始まる…。合格は絶望的だ。`;
            this.renderFullLog();
        },
        resetFullLog: function() {
            gameState.logMessage = "";
            this.clearCurrentTurnLogs();
            this.renderFullLog();
        }
    };

    // --- ユーティリティ関数 ---
    function getRandom(min, max) { return Math.random() * (max - min) + min; }
    function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

    function showThought(message, duration = 2200, type = 'neutral') {
        shiroThoughtBubble.textContent = message;
        shiroThoughtBubble.className = 'thought-bubble show';
        if (type === 'success') shiroThoughtBubble.classList.add('success');
        else if (type === 'failure') shiroThoughtBubble.classList.add('failure');
        setTimeout(() => {
            shiroThoughtBubble.classList.remove('show', 'success', 'failure');
        }, duration);
    }

    function flashParamValue(displayElem, change) {
        const parentP = displayElem.closest('p[data-param]');
        if (!parentP) return;
        parentP.classList.remove('param-value-increased', 'param-value-decreased', 'flash-positive', 'flash-negative');
        void parentP.offsetWidth;
        if (change > 0) {
            parentP.classList.add('param-value-increased'); parentP.classList.add('flash-positive');
        } else if (change < 0) {
            parentP.classList.add('param-value-decreased'); parentP.classList.add('flash-negative');
        }
        setTimeout(() => {
            parentP.classList.remove('flash-positive', 'flash-negative');
        }, 700);
    }
    
    // --- UI更新関数 (育成ゲーム) ---
    function updateMainUI() {
        Object.keys(gameState).forEach(key => {
            if (['knowledge', 'stress', 'energy', 'focus', 'mental', 'luck'].includes(key)) {
                let currentMaxVal = 100;
                if (key === 'knowledge') currentMaxVal = 150;
                if (key === 'energy' && gameState.permanentBuffs.maxEnergyBoost) {
                    currentMaxVal += gameState.permanentBuffs.maxEnergyBoost;
                }
                gameState[key] = clamp(gameState[key], 0, currentMaxVal);
            }
        });
        gameState.money = Math.max(0, gameState.money);

        dayDisplayElem.textContent = gameState.day;
        maxDaysDisplayElem.textContent = maxDaysGlobal;
        moneyDisplayHeaderValue.textContent = Math.round(gameState.money);

        const paramsToUpdate = {
            knowledge: knowledgeDisplay, stress: stressDisplay, energy: energyDisplay,
            focus: focusDisplay, mental: mentalDisplay, luck: luckDisplay
        };
        for (const key in paramsToUpdate) {
            const displayElement = paramsToUpdate[key];
            if (displayElement) {
                const oldUiValue = parseFloat(displayElement.textContent);
                const newGameStateValue = Math.round(gameState[key]);
                if (oldUiValue !== newGameStateValue && !isNaN(oldUiValue)) {
                    flashParamValue(displayElement, newGameStateValue - oldUiValue);
                }
                displayElement.textContent = newGameStateValue;
            }
        }
        shiroImageElem.src = gameState.shiroImage;
        LogHelper.renderFullLog(); // ログUIの更新

        inventoryListElem.innerHTML = '';
        const activeItems = gameState.inventory.filter(invItem => ITEMS[invItem.id]);
        if (activeItems.length === 0) {
            inventoryListElem.innerHTML = '<li class="no-items">なし</li>';
        } else {
            activeItems.forEach(invItem => {
                const itemDef = ITEMS[invItem.id];
                if (!itemDef) return;
                const li = document.createElement('li');
                let itemHtml = `<span class="item-name-qty">${itemDef.name}`;
                if(itemDef.type === 'consumable_active') itemHtml += ` <span class="item-quantity">(x${invItem.quantity})</span>`;
                else if (itemDef.type === 'permanent') itemHtml += ` <span class="item-quantity">(所持中)</span>`;
                itemHtml += `</span>`;
                if(itemDef.type === 'consumable_active') itemHtml += `<button class="use-item-button" data-item-id="${invItem.id}">使用</button>`;
                li.innerHTML = itemHtml;
                inventoryListElem.appendChild(li);
            });
        }
        document.querySelectorAll('.use-item-button').forEach(button => {
            button.addEventListener('click', (e) => {
                useItem(e.target.dataset.itemId, e.target.closest('li'));
            });
        });

        // クイズ挑戦ボタンの有効/無効状態更新
        if (doQuizButton) {
            doQuizButton.disabled = gameState.quizAttemptedToday;
        }
    }

    // --- アイテムとショップ関連 (育成ゲーム) ---
    function populateShop() { /* ... (変更なし) ... */ }
    function buyItem(itemId) { /* ... (変更なし、LogHelper.commitCurrentTurnToGameState() を使用) ... */ }
    function useItem(itemId, itemElement) { /* ... (変更なし、LogHelper.commitCurrentTurnToGameState() を使用) ... */ }
    
    // (populateShop, buyItem, useItem の中身は前回提示したもので、LogHelperの呼び出し方を新しいものに合わせる必要があれば修正)
    // 以下、簡略化のため中身を省略しますが、実際には前回コードをベースにLogHelper呼び出しを調整
    function populateShop() {
        itemShopListElem.innerHTML = '';
        shopMoneyDisplay.textContent = Math.round(gameState.money);
        for (const id in ITEMS) {
            const item = ITEMS[id];
            const card = document.createElement('div'); card.className = 'item-card';
            const isOwnedPermanent = item.type === 'permanent' && gameState.inventory.find(inv => inv.id === id);
            const canAfford = gameState.money >= item.price;
            card.innerHTML = `<h4><i class="fas fa-star"></i> ${item.name}</h4><p>${item.description}</p><p class="item-price"><i class="fas fa-coins"></i> ${item.price}円</p><button class="button-primary buy-item-button" data-item-id="${id}" ${!canAfford || isOwnedPermanent ? 'disabled' : ''}><i class="fas fa-shopping-cart"></i> ${isOwnedPermanent ? '購入済' : '購入'}</button>`;
            itemShopListElem.appendChild(card);
        }
        document.querySelectorAll('.buy-item-button').forEach(b => b.addEventListener('click', () => buyItem(b.dataset.itemId)));
    }
    function buyItem(itemId) {
        const itemDef = ITEMS[itemId]; if (!itemDef) return;
        if (itemDef.type === 'permanent' && gameState.inventory.find(inv => inv.id === itemId)) { showThought("既に購入済みだ。", 1800, 'neutral'); return; }
        if (gameState.money < itemDef.price) { showThought("活動資金が足りない…", 1800, 'failure'); return; }
        gameState.money -= itemDef.price; LogHelper.add(`--- アイテム購入 ---`); LogHelper.add(`${formatMessage(itemDef.name, "item")}を${itemDef.price}円で購入。`);
        if (itemDef.type === 'permanent') { if (itemDef.permanentEffect) { for (const k in itemDef.permanentEffect) { if(k==='luck')gameState.luck=clamp(gameState.luck+itemDef.permanentEffect.luck,0,100); else gameState.permanentBuffs[k]=(gameState.permanentBuffs[k]||0)+itemDef.permanentEffect[k];}} LogHelper.add(`${formatMessage(itemDef.name,"item")}の永続効果発揮。`); if(!gameState.inventory.find(inv=>inv.id===itemId)) gameState.inventory.push({id:itemId,name:itemDef.name,quantity:1});}
        else { const ex=gameState.inventory.find(inv=>inv.id===itemId); if(ex)ex.quantity++; else gameState.inventory.push({id:itemId,name:itemDef.name,quantity:1});}
        LogHelper.commitCurrentTurnToGameState(); LogHelper.renderFullLog(); showThought(`${itemDef.name}を手に入れた！`,1800,'success'); updateMainUI(); populateShop();
    }
    function useItem(itemId, itemElement) {
        const idx=gameState.inventory.findIndex(inv=>inv.id===itemId&&inv.quantity>0); if(idx===-1){showThought("アイテムがない。",1800,'failure');return;}
        const itemDef=ITEMS[itemId]; if(!itemDef||itemDef.type!=='consumable_active'||!itemDef.use){showThought("使用不可。",1800,'failure');return;}
        if(gameState.energy<5&&itemId!=='energy_drink_law'){showThought("体力不足。",2000,'failure');return;}
        LogHelper.add(`--- アイテム使用 ---`); const success=itemDef.use(gameState,LogHelper);
        if(success){gameState.inventory[idx].quantity--; if(gameState.inventory[idx].quantity<=0)gameState.inventory.splice(idx,1); if(itemElement){itemElement.classList.add('item-used-flash');setTimeout(()=>itemElement.classList.remove('item-used-flash'),700);} showThought(`${itemDef.name}使用！`,1800,'success');}
        LogHelper.commitCurrentTurnToGameState(); LogHelper.renderFullLog(); updateMainUI();
    }

    // --- フォーマットと計算 (育成ゲーム) ---
    function formatChange(change, typeOverride = null) { const r=Math.round(change);let t=typeOverride;if(!t)t=r>=0?"positive":"negative";const s=r>0?"+":"";return `<strong class="${t}">${s}${r}</strong>`; }
    function formatMessage(text, type = "") { return `<strong class="${type==="item"?"item":type}">${text}</strong>`; }
    function calculateChange(base,pF=[],nF=[],m=1.0,isEC=false){let fM=m;if(isEC&&gameState.permanentBuffs.energyConsumptionModifier)fM*=(1+gameState.permanentBuffs.energyConsumptionModifier);pF.forEach(f=>fM*=(1+f.v*(f.p/100)));nF.forEach(f=>fM*=(1-f.v*(f.p/100)));let ch=base*Math.max(0.01,fM);if(gameState.activeEffects.bad_condition?.duration>0&&base>0&&!isEC)ch*=gameState.activeEffects.bad_condition.value;return ch;}

    // --- イベントと日次処理 (育成ゲーム) ---
    function applyActiveEffectsEndOfDay() { let expMsg="";for(const k in gameState.activeEffects){gameState.activeEffects[k].duration--;if(gameState.activeEffects[k].duration<=0){expMsg+=`${formatMessage(gameState.activeEffects[k].displayName,"item")}効果終了。<br>`;delete gameState.activeEffects[k];}}if(expMsg)LogHelper.addRaw(expMsg); }
    function triggerRandomEvent() {
        eventNotificationArea.style.display = 'none';
        if (Math.random() < RANDOM_EVENT_CHANCE) {
            const event = RANDOM_EVENTS[getRandomInt(0, RANDOM_EVENTS.length - 1)];
            eventMessageElem.innerHTML = `<strong>イベント発生！</strong> ${event.msg}`;
            eventNotificationArea.style.display = 'block';
            gameContainer.classList.add('event-flash-highlight');
            setTimeout(() => gameContainer.classList.remove('event-flash-highlight'), 1500);
            event.effect(gameState);
            LogHelper.addRaw(`<div class="log-event-highlight"><strong>ランダムイベント: ${event.name}</strong><br>${event.msg}</div>`);
            showThought(`「${event.name}」発生！`, 3200, 'neutral');
            return true;
        }
        return false;
    }
    
    // --- アクション関数 (育成ゲーム) ---
    function studyTextbook(){gameState.studyActionCount++;LogHelper.add("<strong><i class='fas fa-book-open'></i> 基本書を読み知識を詰めた。</strong>");let kGB=getRandom(3,7),kM=1.0;const b=gameState.activeEffects.studyTextbookBoost;if(b?.duration>0){kM*=b.value;LogHelper.add(`${formatMessage(b.displayName,"item")}効率UP！`);}let kG=calculateChange(kGB,[{p:gameState.focus,v:0.85},{p:gameState.mental,v:0.25}],[{p:gameState.stress,v:0.85},{p:(100-gameState.energy),v:0.75}],kM);kG=Math.max(0,Math.round(kG));gameState.knowledge+=kG;LogHelper.add(kG>0?`法律知識${formatChange(kG)}。`:`全く頭に入らず…。`);gameState.energy-=Math.round(calculateChange(30,[],[],1,true));gameState.stress+=Math.round(calculateChange(15,[{p:(100-gameState.mental),v:0.65}]));let fD=getRandomInt(22,32);if(gameState.permanentBuffs.focusRetentionBoost)fD*=(1-gameState.permanentBuffs.focusRetentionBoost);gameState.focus-=Math.round(fD);gameState.mental-=getRandomInt(4,8);if(gameState.energy<10)showThought("もう限界…",1800,'failure');else if(gameState.focus<5)showThought("目がかすむ…",1800,'failure');}
    function doExercise(){gameState.studyActionCount++;LogHelper.add("<strong><i class='fas fa-pencil-alt'></i> 過去問・演習書と格闘。</strong>");let kGB=getRandom(2,8),kM=1.0;if(gameState.permanentBuffs.exerciseKnowledgeBoost)kM+=gameState.permanentBuffs.exerciseKnowledgeBoost;const b=gameState.activeEffects.studyExerciseBoost;if(b?.duration>0){kM*=b.value;LogHelper.add(`${formatMessage(b.displayName,"item")}効率UP！`);}let kG=calculateChange(kGB,[{p:gameState.focus,v:0.9},{p:gameState.knowledge,v:0.10}],[{p:gameState.stress,v:0.75},{p:(100-gameState.energy),v:0.75}],kM);kG=Math.max(0,Math.round(kG));gameState.knowledge+=kG;LogHelper.add(kG>0?`実践知識${formatChange(kG)}。`:`問題解けず…。`);let fC=getRandomInt(28,40);if(gameState.permanentBuffs.exerciseFocusSave)fC*=(1-gameState.permanentBuffs.exerciseFocusSave);gameState.focus-=Math.round(fC);gameState.energy-=Math.round(calculateChange(38,[],[],1,true));gameState.stress+=Math.round(calculateChange(20,[{p:(100-gameState.mental),v:0.55}]));gameState.mental-=getRandomInt(6,12);if(gameState.focus<5)showThought("頭が停止…",1800,'failure');}
    function work(){LogHelper.add("<strong><i class='fas fa-briefcase'></i> 短期バイトに励んだ。</strong>");if(gameState.energy<40){LogHelper.add(formatMessage("疲労困憊、仕事にならず…。","negative"));showThought("体が重い…",1800,'failure');gameState.money+=getRandomInt(200,500);gameState.energy-=getRandomInt(25,40);}else{let e=calculateChange(getRandom(800,2200),[{p:gameState.focus,v:0.03}]);e=Math.round(e);gameState.money+=e;LogHelper.add(`働いて${formatMessage("+"+e,"positive")}円得た。`);showThought("これで少しは…。",1800,'neutral');}gameState.energy-=Math.round(calculateChange(55,[],[],1,true));gameState.stress+=getRandomInt(10,24);gameState.focus-=getRandomInt(9,18);gameState.mental-=getRandomInt(2,4);}
    function insultOnline(){gameState.insultOnlineCount++;LogHelper.add("<strong><i class='fas fa-keyboard'></i> オプチャで他人を罵倒。</strong>");const t=["にゃま","なんく","ささみ"][getRandomInt(0,2)];gameState.energy-=getRandomInt(6,14);if(Math.random()<0.4){let sr=getRandom(30,50);gameState.stress-=Math.round(sr);let mb=getRandomInt(6,12);gameState.mental+=mb;let fb=getRandomInt(4,9);gameState.focus+=fb;gameState.luck-=getRandomInt(18,28);LogHelper.add(`${t}を完膚なきまでに言い負かし気分爽快！ストレス${formatChange(-Math.round(sr))}、精神力${formatChange(mb)}、集中力${formatChange(fb)}。`);LogHelper.add(`しかし合格運著しく低下(${formatChange(getRandomInt(-28,-18),"negative")})。`);showThought("一瞬スッキリ！",2000,'success');}else{let si=getRandomInt(20,30);gameState.stress+=si;let md=getRandomInt(25,35);gameState.mental-=md;gameState.luck-=getRandomInt(10,16);gameState.focus-=getRandomInt(12,20);LogHelper.add(`${t}への悪態不発、逆に言い返された…。ストレス${formatChange(si,"negative")}、精神力${formatChange(-md,"negative")}。`);LogHelper.add(`集中力も散漫(${formatChange(getRandomInt(-20,-12),"negative")})、合格運も低下(${formatChange(getRandomInt(-16,-10),"negative")})。`);showThought("最悪だ…疲れた…。",2200,'failure');}}
    function pachinko(){gameState.pachinkoCount++;LogHelper.add("<strong><i class='fas fa-slot-machine'></i> 誘惑に負けパチンコへ…。</strong>");let c=Math.min(gameState.money,Math.max(1000,Math.round(gameState.money*0.20)));if(gameState.money<1000){LogHelper.add(formatMessage("資金1000円未満では遊べない。","negative"));showThought("娯楽は金持ちの道楽か…。",1800,'failure');gameState.stress+=8;}else{gameState.money-=c;LogHelper.add(`${c}円握りしめ一攫千金を夢見た。`);gameState.energy-=Math.round(calculateChange(25,[],[],1,true));let wc=clamp(0.15+(gameState.luck/450)-(gameState.stress/550)+(gameState.mental/650),0.01,0.30);if(Math.random()<wc){const w=Math.round(c*(getRandom(1,6)+getRandom(1,6)));gameState.money+=w;LogHelper.add(`信じられない幸運！${formatMessage("+"+w,"positive")}円獲得！`);gameState.stress-=getRandomInt(15,25);gameState.mental+=getRandomInt(7,13);gameState.luck+=getRandomInt(1,2);showThought("今日だけはツイてる！",1800,'success');}else{LogHelper.add(formatMessage("やはり現実は厳しかった…参加費全損。","negative"));gameState.stress+=getRandomInt(22,32);gameState.mental-=getRandomInt(15,22);gameState.luck-=getRandomInt(3,7);showThought("時間と金の無駄…。",2000,'failure');}}}
    function sleep(){LogHelper.add("<strong><i class='fas fa-bed'></i> 翌日のため質の高い睡眠を。</strong>");let eg=calculateChange(getRandom(38,70),[{p:(100-gameState.stress),v:0.12}],[{p:gameState.stress,v:0.55}]);let sr=calculateChange(getRandom(6,16),[{p:gameState.mental,v:0.45}]);gameState.energy+=Math.round(eg);gameState.stress-=Math.round(sr);LogHelper.add(`体力回復(${formatChange(Math.round(eg))})、ストレス軽減(${formatChange(-Math.round(sr))})。`);let r=getRandomInt(1,5);gameState.focus=Math.max(15,gameState.focus+Math.round(r*0.8));gameState.mental=Math.min(100,gameState.mental+Math.round(r*0.5));showThought("少し回復したか…。",1800,'neutral');}

    // --- クイズ関連ロジック ---
    let allQuizQuestionsData = [];
    let currentQuizSet = [];
    let currentQuizQuestionIndex = 0;
    let currentQuizScore = 0;
    const QUIZ_TARGET_NUM_QUESTIONS = 5; // 1日のクイズは5問に短縮
    const QUIZ_REWARD_MONEY = 300;
    const QUIZ_CLEAR_SCORE_THRESHOLD = 3; // 5問中3問正解でクリア

    async function loadQuizData() {
        try {
            const response = await fetch('quiz_data2.json'); // ユーザー提供のファイル名
            if (!response.ok) throw new Error(`クイズデータ読込エラー: ${response.status}`);
            allQuizQuestionsData = await response.json();
            if (!Array.isArray(allQuizQuestionsData) || allQuizQuestionsData.length === 0) {
                throw new Error("クイズデータが空か不正な形式です。");
            }
            console.log("クイズデータ読み込み完了。");
        } catch (error) {
            console.error("クイズデータの初期化に失敗:", error);
            LogHelper.addRaw(`<div class="log-event-highlight">クイズデータの読み込みに失敗しました。<br>${error.message}</div>`);
            // クイズボタンを無効化するなどの処理も検討
            if(doQuizButton) doQuizButton.disabled = true; 
        }
    }

    function prepareNewQuizSet() {
        let shuffled = [...allQuizQuestionsData].sort(() => 0.5 - Math.random());
        currentQuizSet = shuffled.slice(0, QUIZ_TARGET_NUM_QUESTIONS);
    }

    function displayQuizQuestion() {
        if (currentQuizQuestionIndex < currentQuizSet.length) {
            const q = currentQuizSet[currentQuizQuestionIndex];
            quizMessageTextContentElement.innerHTML = q.message.replace(/\n/g, '<br>');
            quizChoicesAreaElement.innerHTML = '';
            q.choices.forEach(choice => {
                const button = document.createElement('button');
                button.textContent = choice;
                button.addEventListener('click', () => handleQuizAnswer(choice, q.answer));
                quizChoicesAreaElement.appendChild(button);
            });
            quizFeedbackTextElement.textContent = '';
            quizFeedbackTextElement.className = 'quiz-feedback-text';
            quizNextQuestionBtn.style.display = 'none';
            updateQuizProgress();
        } else {
            showQuizResults();
        }
    }

    function handleQuizAnswer(selectedChoice, correctAnswer) {
        const buttons = quizChoicesAreaElement.getElementsByTagName('button');
        let selectedButtonElement = null;
        for (let btn of buttons) {
            btn.disabled = true;
            if (btn.textContent === selectedChoice) selectedButtonElement = btn;
            if (btn.textContent === correctAnswer) btn.classList.add('reveal-correct');
        }
        quizFeedbackTextElement.classList.add('visible');

        if (selectedChoice === correctAnswer) {
            currentQuizScore++;
            quizCurrentScoreValueElement.textContent = currentQuizScore;
            if(quizCurrentScoreDisplayElement) {
                quizCurrentScoreDisplayElement.classList.add('score-updated');
                setTimeout(() => quizCurrentScoreDisplayElement.classList.remove('score-updated'), 300);
            }
            quizFeedbackTextElement.textContent = "正解！🎉";
            quizFeedbackTextElement.classList.add('correct');
            if(selectedButtonElement) {selectedButtonElement.classList.remove('reveal-correct'); selectedButtonElement.classList.add('correct');}
            if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }});
        } else {
            quizFeedbackTextElement.textContent = `残念！正解は「${correctAnswer}」`;
            quizFeedbackTextElement.classList.add('wrong', 'feedback-text-shake');
            if(selectedButtonElement) selectedButtonElement.classList.add('wrong');
            setTimeout(() => quizFeedbackTextElement.classList.remove('feedback-text-shake'), 400);
        }
        quizNextQuestionBtn.style.display = 'inline-flex';
    }

    function updateQuizProgress() {
        const totalQ = currentQuizSet.length;
        if (totalQ > 0) {
            const progress = ((currentQuizQuestionIndex) / totalQ) * 100;
            quizProgressBarElement.style.width = `${progress}%`;
            quizProgressTextElement.textContent = `問題 ${currentQuizQuestionIndex + 1} / ${totalQ}`;
        }
    }

    function showQuizResults() {
        quizMainAreaElement.style.display = 'none';
        quizResultAreaElement.style.display = 'block';
        const totalAnswered = currentQuizSet.length;
        quizTotalQuestionsOnResultElement.textContent = totalAnswered;
        quizFinalScoreValueElement.textContent = currentQuizScore; // animateValue は省略

        let rank = '', rankTitle = '', message = '', iconClass = '';
        const percentage = totalAnswered > 0 ? Math.round((currentQuizScore / totalAnswered) * 100) : 0;

        if (currentQuizScore >= QUIZ_CLEAR_SCORE_THRESHOLD) { // クリア条件達成
            rank = 'b'; rankTitle = "クイズクリア！"; message = `おめでとうございます！${QUIZ_REWARD_MONEY}円獲得！`; iconClass = 'fas fa-check-circle';
            gameState.money += QUIZ_REWARD_MONEY;
            LogHelper.add(`デイリークイズをクリアし、活動資金${formatChange(QUIZ_REWARD_MONEY)}を獲得！`);
            // LogHelper.commitCurrentTurnToGameState(); // これはクイズ終了時にまとめて
            // LogHelper.renderFullLog();
             if (typeof confetti === 'function') {
                confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 }, scalar: 1.2 });
            }
        } else { // クリア失敗
            rank = 'd'; rankTitle = "残念…"; message = "クイズクリアならず。また明日挑戦しよう！"; iconClass = 'fas fa-times-circle';
            LogHelper.add(`デイリークイズに挑戦したが、クリアできなかった…。`);
        }
        // ユーザー提供のランク付けは複雑なので、クリア/失敗のシンプルな結果表示に
        quizResultIconContainer.className = `quiz-result-icon-container rank-${rank}`;
        quizResultIconContainer.innerHTML = `<i class="${iconClass}" style="color: var(--quiz-color-${currentQuizScore >= QUIZ_CLEAR_SCORE_THRESHOLD ? 'correct' : 'wrong'});"></i>`;
        quizResultRankTitleElement.textContent = rankTitle;
        quizResultMessageElement.textContent = message;
    }

    function startDailyQuiz() {
        if (gameState.quizAttemptedToday) {
            showThought("今日のクイズはもう挑戦済みだ。", 2000, 'neutral');
            // 即座にターン終了させないように、ボタンは無効のままにする
            // このアクションを選択しても何も起きないようにする
            enableActions(); // 他のボタンは有効に戻す
            if(doQuizButton) doQuizButton.disabled = true; // クイズボタンだけ無効
            return false; // アクション不実行を示す
        }
        if (allQuizQuestionsData.length === 0) {
            showThought("クイズの準備ができていないようだ…", 2000, 'failure');
            LogHelper.add("クイズデータがなく挑戦できませんでした。");
            return false; // アクション不実行
        }

        prepareNewQuizSet();
        if (currentQuizSet.length === 0) {
             showThought("出題できるクイズがないみたいだ。", 2000, 'neutral');
             LogHelper.add("クイズセットの準備に失敗しました。");
             return false;
        }

        currentQuizQuestionIndex = 0;
        currentQuizScore = 0;
        quizCurrentScoreValueElement.textContent = '0';
        if(quizCurrentScoreDisplayElement) quizCurrentScoreDisplayElement.classList.remove('score-updated');
        
        quizMainAreaElement.style.display = 'block';
        quizResultAreaElement.style.display = 'none';
        quizNextQuestionBtn.style.display = 'none';
        quizFeedbackTextElement.textContent = '';
        quizFeedbackTextElement.className = 'quiz-feedback-text';
        
        displayQuizQuestion();
        dailyQuizModal.classList.add('show');
        return true; // クイズ開始成功
    }

    function finishDailyQuiz() {
        dailyQuizModal.classList.remove('show');
        gameState.quizAttemptedToday = true;
        if(doQuizButton) doQuizButton.disabled = true;
        // ログはshowQuizResults内とhandleActionでコミットされる
        // updateMainUI(); // handleActionの最後で呼ばれる
        // setTimeout(() => endDay(), 1300); // handleActionの最後で呼ばれる
    }


    // --- ゲーム進行管理 (育成ゲーム) ---
    function endDay() { /* ... (前回から変更なし、maxDaysGlobal と quizAttemptedToday のリセットを確認) ... */
        gameState.omikujiUsedToday = false;
        gameState.quizAttemptedToday = false; // クイズ挑戦フラグをリセット
        gameState.day++;

        applyActiveEffectsEndOfDay();
        if (gameState.permanentBuffs.dailyLuckIncrease) {
            gameState.luck += gameState.permanentBuffs.dailyLuckIncrease;
            LogHelper.addRaw(`${formatMessage("お守り","item")}から微かな加護(合格運${formatChange(gameState.permanentBuffs.dailyLuckIncrease, "positive")})。<br>`);
        } else { 
            gameState.luck += getRandomInt(-2, -1);
        }
        gameState.luck = clamp(gameState.luck, 0, 100);
        let dailyStressMod = gameState.permanentBuffs.dailyStressResist || 0;
        gameState.stress += getRandomInt(0, 4) - dailyStressMod;
        gameState.mental -= getRandomInt(0, 2);
        gameState.energy -= getRandomInt(0, 2);
        gameState.focus -= getRandomInt(0, 2);
        
        LogHelper.commitCurrentTurnToGameState(`<br><br>--- ${gameState.day -1}日目の終わりに ---`);

        if (gameState.day > maxDaysGlobal) {
            triggerExam();
        } else {
            triggerRandomEvent(); 
            const newDayPrepend = `<br><br>--- ${gameState.day}日目 ---<br>今日も一日が始まる…。予備試験まであと${maxDaysGlobal - gameState.day + 1}日。`;
            LogHelper.commitCurrentTurnToGameState(newDayPrepend); // イベントログもここでコミット
            LogHelper.renderFullLog();
            updateMainUI();
            enableActions();
        }    
    }
    function triggerExam() { /* ... (前回から変更なし、passThresholdがmaxDaysGlobalを参照する点を確認) ... */
        disableActions(); examResultModal.classList.add('show');
        examCalcMsg.style.display='block'; examActualResult.style.display='none'; fictionEndingElem.style.display='none';
        LogHelper.addRaw("<strong><i class='fas fa-scroll'></i> 運命の予備試験、結果発表の時…</strong><br>これまでの全ての努力と選択が、今、審判される。");
        LogHelper.commitCurrentTurnToGameState(); LogHelper.renderFullLog(); 

        setTimeout(() => {
            let s = gameState.knowledge*2.6+gameState.mental*1.2+gameState.focus*1.0+gameState.luck*0.7-gameState.stress*1.5+gameState.energy*0.35;
            s=Math.max(0,Math.round(s)); const pt=(maxDaysGlobal===15?235:220);
            let msg="",title="",passed=false;
            if(s>=pt){if(gameState.luck>75&&gameState.mental>80&&s>pt*1.1)passed=true;else if(s>pt*1.05&&(gameState.luck>70||gameState.mental>75)&&Math.random()<0.6)passed=true;else if(Math.random()<(0.20+Math.max(0,(gameState.knowledge-70))/100+Math.max(0,(gameState.luck-70))/150+Math.max(0,(gameState.mental-70))/200))passed=true;}
            else{if(s>pt*0.9&&gameState.luck>85&&gameState.mental>70&&Math.random()<0.05)passed=true;}
            examShiroImageElem.src=passed?(gameState.shiroHappyImage||INITIAL_STATE_BASE.shiroImage):(gameState.shiroSadImage||INITIAL_STATE_BASE.shiroImage);
            examResultTitle.style.color=passed?'var(--color-success)':'var(--color-danger)';
            if(passed){title="予備試験 合格！";if(s>pt*1.10)msg=`<strong>信じられない！まさに奇跡！超高得点で合格です！</strong><br>絶望的な挑戦を乗り越え、不可能を可能にしました！`;else msg=`<strong>おめでとうございます！血と汗と涙、そして幸運が実り、見事合格です！</strong><br>厳しい道のりの果てに、ついに栄光を掴みました。`;fictionNoticeElem.innerHTML=`―――これはゲームの中の輝かしい未来。<br>現実のしろちゃんは、怠惰な時間を満喫中…！<br>めでたし？`;fictionEndingElem.style.display='block';}
            else{examResultTitle.style.color='var(--color-danger)';const iL=maxDaysGlobal===15?3:5;const pL=maxDaysGlobal===15?3:5;const sE=maxDaysGlobal===15?Math.round(maxDaysGlobal*0.6):Math.round(maxDaysGlobal*0.5);
                if(gameState.soaplandUsedCount>0){title="不合格…そして絶望の診断";msg=`<strong>予備試験に落ちた上、刹那的な快楽が仇となり体に深刻な異変が…。</strong><br>診断結果は無情にも性病。治療には莫大な費用と時間が…。`;}
                else if(gameState.insultOnlineCount>=iL){title="不合格…そして逮捕";msg=`<strong>予備試験にも落ち、度重なるネットでの誹謗中傷が仇となった…。</strong><br>「しろちゃん、署まで来てもらおうか」…人生、詰んだ。`;}
                else if(gameState.pachinkoCount>=pL){title="不合格…そして借金地獄";msg=`<strong>予備試験にも落ち、パチンコで作った借金は雪だるま式に膨れ上がった。</strong><br>取り立ての電話は鳴り止まず、もはやまともな生活は送れない…。`;}
                else if(gameState.studyActionCount>=sE&&s<pt){title="不合格…努力の果てに";msg=`<strong>予備試験不合格。あれだけ勉強したのに、結果は非情だった…。</strong><br>努力だけでは越えられない壁を痛感し、静かにペンを置いた。`;}
                else{title="予備試験 不合格…";if(s<pt*0.6)msg=`<strong>残念ながら、夢は完全に潰えました…。</strong><br>厳しい現実は、無情にも打ちのめしました。`;else if(s<pt*0.88)msg=`<strong>あと一歩でしたが、不合格です。</strong><br>悔しい結果です。しかし何かを掴んだと信じたい…。`;else msg=`<strong>本当に、本当に、あと僅かの差で不合格…。</strong><br>天は味方しませんでした。合格の光はこぼれ落ちました。`;}}
            examResultTitle.textContent=title;examResultMesssage.innerHTML=msg;examCalcMsg.style.display='none';examActualResult.style.display='block';
            shiroImageElem.classList.add('shiro-image-changed');setTimeout(()=>shiroImageElem.classList.remove('shiro-image-changed'),600);
        },2800);
    }

    function handleAction(actionType) {
        if (gameState.day > maxDaysGlobal || !actionButtonsEnabled) return;

        if (gameState.energy <= 0 && actionType !== 'sleep' && actionType !== 'do_quiz') {
            LogHelper.add(formatMessage("体力がゼロです…寝ましょう。", "negative"));
            LogHelper.commitCurrentTurnToGameState(`--- ${gameState.day}日目の行動 ---`);
            LogHelper.renderFullLog();
            showThought("意識が…遠のく……", 2000, 'failure');
            return; 
        }
        
        disableActions(); // アクション実行前にボタンを無効化

        let performEndDay = true; // クイズ以外のアクションは基本的に1日を終了させる

        switch (actionType) {
            case 'study_textbook': studyTextbook(); break;
            case 'do_exercise': doExercise(); break;
            case 'insult_online': insultOnline(); break;
            case 'work': work(); break;
            case 'pachinko': pachinko(); break;
            case 'sleep': sleep(); break;
            case 'do_quiz':
                const quizStarted = startDailyQuiz();
                if (!quizStarted) { // クイズが開始できなかった場合 (挑戦済み、データなしなど)
                    performEndDay = false; // 1日を消費しない
                    enableActions(); // ボタンを再度有効化
                } else {
                    performEndDay = false; // クイズはそれ自体で完結し、終了後にendDayを呼ぶか決める
                                         // ここでは、クイズ終了ボタンが押されたらendDayを呼ぶようにする
                }
                break;
            default:
                console.error("未定義のアクション:", actionType);
                performEndDay = false;
                enableActions(); // 未定義アクションならボタン有効に戻す
                return;
        }
        
        // クイズ以外のアクション、またはクイズが正常に開始できなかった場合(ログだけ表示して終わるなど)
        if (actionType !== 'do_quiz' || (actionType === 'do_quiz' && !performEndDay && !dailyQuizModal.classList.contains('show'))) {
            LogHelper.commitCurrentTurnToGameState(`--- ${gameState.day}日目の行動 ---`);
            LogHelper.renderFullLog();
            updateMainUI(); // ステータス更新を先に行う

            if (performEndDay) {
                setTimeout(() => {
                    if (gameState.day <= maxDaysGlobal) {
                        endDay();
                    }
                }, 1300);
            }
        }
        // クイズが開始された場合は、クイズ終了ボタン(quizFinishButton)のリスナーがendDayをハンドルする
    }

    let actionButtonsEnabled = true; // アクションボタンの有効状態を管理するフラグ
    function disableActions() { 
        actionButtonsEnabled = false;
        actionButtons.forEach(b => b.disabled = true); 
    }
    function enableActions() { 
        actionButtonsEnabled = true;
        if (gameState.day <= maxDaysGlobal) {
            actionButtons.forEach(b => b.disabled = false); 
            // クイズボタンの個別制御
            if(doQuizButton) doQuizButton.disabled = gameState.quizAttemptedToday;
        }
    }

    // --- ゲーム初期化とイベントリスナー (育成ゲーム) ---
    function initializeGame(selectedDays) { /* ... (変更なし、LogHelper.setInitialLogMessage() を使用) ... */
        maxDaysGlobal = parseInt(selectedDays);
        gameState = JSON.parse(JSON.stringify(INITIAL_STATE_BASE));
        if (maxDaysGlobal === 15) { gameState.money = 350; gameState.knowledge = 3;} 
        else { gameState.money = 550; }

        maxDaysDisplayElem.textContent = maxDaysGlobal;
        difficultyScreen.style.display = 'none';
        difficultyScreen.classList.add('hidden');
        gameContainer.style.display = 'block';
        gameContainer.classList.remove('hidden');

        LogHelper.resetFullLog(); 
        LogHelper.setInitialLogMessage(); 
        
        updateMainUI(); // これが gameState.logMessage を使ってログを描画する
        enableActions();
        eventNotificationArea.style.display = 'none';    
    }

    selectEasyButton.addEventListener('click', () => initializeGame(selectEasyButton.dataset.days));
    selectHardButton.addEventListener('click', () => initializeGame(selectHardButton.dataset.days));
    
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (actionButtonsEnabled) { // 連打防止
                 handleAction(button.dataset.action);
            }
        });
    });

    restartGameButton.addEventListener('click', () => {
        examResultModal.classList.remove('show');
        gameContainer.style.display = 'none'; gameContainer.classList.add('hidden');
        difficultyScreen.style.display = 'flex'; difficultyScreen.classList.remove('hidden');
    });

    openShopButton.addEventListener('click', () => { populateShop(); itemShopModal.classList.add('show'); });
    // 育成ゲームのモーダル閉じるボタン
    modalCloseButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modalId;
            if(modalId) {
                const modalToClose = document.getElementById(modalId);
                if(modalToClose) modalToClose.classList.remove('show');
            } else { // data-modal-idがない場合（クイズモーダルの閉じるボタンなど）
                const modal = e.target.closest('.modal');
                if (modal) modal.classList.remove('show');
            }
        });
    });
    // モーダル背景クリックで閉じる
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('show');
                // クイズモーダルを背景クリックで閉じた場合、クイズを「中断」したとみなし、
                // 挑戦済みフラグを立て、報酬なしでターンを進めるか、などを考慮する必要がある。
                // 今回はシンプルに閉じるだけ。
                if (modal.id === 'daily-quiz-modal' && gameState.day <= maxDaysGlobal) {
                    // クイズがアクティブな状態で閉じられたら、挑戦済みとして日を進める
                    // ただし、結果が出ていない場合は報酬なし
                    if (!quizResultAreaElement.style.display || quizResultAreaElement.style.display === 'none') {
                        LogHelper.add("デイリークイズを途中で終了しました。");
                        LogHelper.commitCurrentTurnToGameState(`--- ${gameState.day}日目の行動 ---`);
                         // commitCurrentTurnToGameState は renderFullLog を呼ばないので別途呼ぶか、
                         // handleAction のように updateUI -> setTimeout(endDay) の流れに持ち込む
                    }
                    // finishDailyQuizの中でendDayが呼ばれるようにするべきか検討
                    // ここでは、クイズモーダルが閉じられたら、handleAction の最後と同じように endDay を呼ぶ
                    // ただし、クイズの結果処理が完了しているかどうかのハンドリングが必要
                    if (!actionButtonsEnabled && gameState.day <= maxDaysGlobal) { // アクションボタンが無効＝行動処理中
                        setTimeout(() => {
                             if (gameState.day <= maxDaysGlobal) endDay();
                        }, 100); // 即座に近いタイミングで
                    }
                }
            }
        });
    });

    // --- クイズモーダル専用のイベントリスナー ---
    quizNextQuestionBtn.addEventListener('click', () => {
        currentQuizQuestionIndex++;
        if (currentQuizQuestionIndex < currentQuizSet.length) {
            displayQuizQuestion();
        } else {
            quizProgressBarElement.style.width = '100%';
            quizProgressTextElement.textContent = `結果を計算中...`;
            showQuizResults();
        }
    });

    quizFinishButton.addEventListener('click', () => {
        finishDailyQuiz(); // モーダルを閉じて、挑戦済みフラグを立てる
        // クイズアクションのログは既にコミットされているはず
        LogHelper.renderFullLog(); // 念のため最新ログを表示
        updateMainUI(); // 所持金などを更新
        // ターン終了処理
        setTimeout(() => {
            if (gameState.day <= maxDaysGlobal) {
                endDay();
            }
        }, 1300); // 通常のアクションと同じディレイ
    });
    
    // クイズモーダルの閉じるボタン（×）にも finishDailyQuiz と同様の処理をフックするか検討
    // 現状は汎用の modalCloseButtons リスナーで閉じられるだけ。
    // クイズの途中で×ボタンで閉じた場合の挙動を明確にする必要がある。
    // ここでは、 quizFinishButton と同じ処理を呼び出すようにする。
    closeQuizModalButton.addEventListener('click', () => {
        // showQuizResultsが呼ばれていない（結果画面が表示されていない）場合でも、
        // クイズを「プレイした」ことにして挑戦済みにする。報酬はなし。
        if (quizMainAreaElement.style.display === 'block' && 
            (!quizResultAreaElement.style.display || quizResultAreaElement.style.display === 'none')) {
            LogHelper.add("デイリークイズを途中で終了しました。報酬はありません。");
        }
        finishDailyQuiz();
        LogHelper.renderFullLog();
        updateMainUI();
        setTimeout(() => {
            if (gameState.day <= maxDaysGlobal) {
                endDay();
            }
        }, 1300);
    });


    // --- 初期化処理 ---
    async function gameStartInit() {
        await loadQuizData(); // まずクイズデータを読み込む
        gameContainer.style.display = 'none';
        gameContainer.classList.add('hidden');
        difficultyScreen.style.display = 'flex';
        difficultyScreen.classList.remove('hidden');
        console.log("しろちゃん 予備試験ガチモード - v6 (クイズ統合)");
    }

    gameStartInit(); // ゲーム全体の初期化を開始
});
