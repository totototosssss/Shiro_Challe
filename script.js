document.addEventListener('DOMContentLoaded', () => {
    let maxDaysGlobal;
    const INITIAL_STATE_BASE = {
        day: 1,
        knowledge: 5, stress: 20, energy: 100, money: 500,
        focus: 20, mental: 30, luck: 5,
        shiroImage: 'shiro.png',
        shiroHappyImage: 'shiro_happy.png',
        shiroSadImage: 'shiro_sad.png',
        shiroEndedImage: 'shiro_ended.png',
        logMessage: '', 
        inventory: [],
        permanentBuffs: {},
        activeEffects: {},
        insultOnlineCount: 0,
        pachinkoCount: 0,
        soaplandUsedCount: 0,
        studyActionCount: 0,
        omikujiUsedToday: false,
        quizAttemptedToday: false
    };
    let gameState = {};

    const ITEMS = {
        'energy_drink_law': { 
            name: 'エナジードリンク', 
            price: 600, 
            type: 'consumable_active', 
            description: '使用: 体力+25(+α)、集中力+18(+α)。ただしストレス+8。15日モード時効果UP。', 
            use: (gs, lh) => { 
                let energyGain = 25;
                let focusGain = 18;
                const stressGain = 8;
                let modeText = "";
                if (maxDaysGlobal === 15) {
                    energyGain = Math.round(energyGain * 1.20); 
                    focusGain = Math.round(focusGain * 1.20);  
                    modeText = "(短期集中ブースト) ";
                }
                gs.energy += energyGain; 
                lh.add(`${modeText}体力${formatChange(energyGain)}。`);
                gs.focus += focusGain; 
                lh.add(`${modeText}集中力${formatChange(focusGain)}。`);
                gs.stress += stressGain; 
                lh.add(`代償としてストレスが${formatChange(stressGain, "negative")}。`);
                return true; 
            }
        },
        'omikuji': { 
            name: '開運おみくじ', 
            price: 150, 
            type: 'consumable_active', 
            description: '今日の運勢を占う。1日1回限定。15日モード時少し吉が出やすい？', 
            use: (gs, lh) => { 
                if (gs.omikujiUsedToday) { 
                    lh.add("おみくじは本日既に引いています。"); 
                    showThought("今日はもう引いた…",1800,'neutral'); 
                    return false; 
                } 
                gs.omikujiUsedToday = true; 
                let r = Math.random() * 100;
                if (maxDaysGlobal === 15) { 
                    if (r > 60 && r < 95) r -= 10;
                }
                let rt="",lc=0,mc=0,sm="",st='neutral'; 
                if(r<7){rt="【大吉】";lc=getRandomInt(30,45);mc=getRandomInt(10,20);sm="やったー！ツイてる！";st='success';}
                else if(r<25){rt="【中吉】";lc=getRandomInt(10,18);mc=getRandomInt(5,10);sm="おお、中吉！";st='success';}
                else if(r<55){rt="【小吉】";lc=getRandomInt(3,7);mc=getRandomInt(1,3);sm="小吉か。";st='neutral';} 
                else if(r<80){rt="【吉】";lc=getRandomInt(1,2);mc=0;sm="吉。平穏が一番。";st='neutral';} 
                else if(r<90){rt="【末吉】";lc=0;mc=getRandomInt(-2,0);sm="末吉…微妙。";st='neutral';} 
                else if(r<97){rt="【凶】";lc=getRandomInt(-7,-3);mc=getRandomInt(-5,-3);sm="うわっ、凶だ…。";st='failure';}
                else{rt="【大凶】";lc=getRandomInt(-10,-8);mc=getRandomInt(-8,-5);sm="まさかの大凶…！";st='failure';} 
                lh.add(`おみくじ結果 ${formatMessage(rt,st)}！`); 
                if(lc!==0){gs.luck+=lc;lh.add(`合格運${formatChange(lc)}`);}else{lh.add(`合格運変化なし`);} 
                if(mc!==0){gs.mental+=mc;lh.add(`精神力${formatChange(mc)}`);}else{lh.add(`精神力変化なし`);} 
                showThought(sm,2300,st); return true; 
            }
        },
        'luxury_soapland': { 
            name: '行きつけのソープ', 
            price: 65000, 
            type: 'consumable_active', 
            description: '究極癒やし。ストレス0,集中力MAX。資金も激減。', 
            use: (gs, lh) => { 
                gs.stress=0;lh.add(`ストレス完全消滅！`);
                gs.focus=100;lh.add(`集中力MAX！`);
                gs.soaplandUsedCount++;
                let cost = 10000;
                if (maxDaysGlobal === 15) cost = 8000;
                gs.money -= cost;
                lh.add(`追加料金で資金${formatChange(-cost,"negative")}。`);
                showThought("全て忘れてリフレッシュ！",2500,'success');return true;
            }
        },
        'best_exercise_book':{
            name:'Sランク過去問集', price:7500, type:'permanent',
            description:'所有中、演習時の知識獲得ボーナス、集中力消費軽減。(15日モード時効果UP)',
            permanentEffectBase: { exerciseKnowledgeBoost: 0.45, exerciseFocusSave: 0.20 },
            getPermanentEffect: function() { // maxDaysGlobal を参照して効果を返す関数
                let effect = {...this.permanentEffectBase};
                if (maxDaysGlobal === 15) {
                    effect.exerciseKnowledgeBoost = this.permanentEffectBase.exerciseKnowledgeBoost * 1.15; 
                    effect.exerciseFocusSave = this.permanentEffectBase.exerciseFocusSave * 1.15;   
                }
                return effect;
            }
        },
        'counseling_ticket':{
            name:'カウンセリング予約券', price:1800, type:'consumable_active',
            description:'使用:精神力+35(+α)、ストレス-40(-α)。専門家は頼りに。(15日モード時効果UP)',
            use:(gs,lh)=>{
                let mentalBoost = 35;
                let stressRelief = -40;
                let modeText = "";
                if (maxDaysGlobal === 15) {
                    mentalBoost = Math.round(mentalBoost * 1.2);
                    stressRelief = Math.round(stressRelief * 1.2);
                    modeText = "(短期集中ケア) ";
                }
                gs.mental+=mentalBoost;lh.add(`${modeText}精神力が${formatChange(mentalBoost)}。`);
                gs.stress+=stressRelief;lh.add(`${modeText}ストレスが${formatChange(stressRelief)}。`); 
                return true;
            }
        },
        'noise_cancelling_earphones':{
            name:'高級NCイヤホン', price:5000, type:'permanent',
            description:'所有中、勉強時集中力低下抑制、ストレス自然増を微軽減。(15日モード時効果UP)',
            permanentEffectBase: { focusRetentionBoost: 0.40, dailyStressResist: 1 },
            getPermanentEffect: function() {
                let effect = {...this.permanentEffectBase};
                if (maxDaysGlobal === 15) {
                    effect.focusRetentionBoost = this.permanentEffectBase.focusRetentionBoost * 1.15;
                    effect.dailyStressResist = this.permanentEffectBase.dailyStressResist + 1; 
                }
                return effect;
            }
        },
        'small_lucky_charm':{
            name:'小さな交通安全お守り', price:1000, type:'permanent',
            description:'所有中、合格運ボーナス、毎日運気が少し上がる気が。(15日モード時効果UP)',
            permanentEffectBase: { luck: 10, dailyLuckIncrease: 2 },
            getPermanentEffect: function() {
                let effect = {...this.permanentEffectBase};
                if (maxDaysGlobal === 15) {
                    effect.luck = Math.round(this.permanentEffectBase.luck * 1.5); 
                    effect.dailyLuckIncrease = this.permanentEffectBase.dailyLuckIncrease * 1.5;
                }
                return effect;
            }
        },
        'poison_self': {
            name: '毒薬',
            price: 1500,
            type: 'consumable_active',
            description: '使用: 全てを終わらせる。',
            use: (gs, lh) => {
                lh.add(`${formatMessage("しろちゃんは毒薬を飲み干した…。", "negative")}`);
     
                LogHelper.commitCurrentTurnToGameState(`--- ${gs.day}日目の行動 ---`);
                LogHelper.renderFullLog();
                triggerImmediateGameOver({
                    title: "終焉",
                    message: "目の前が暗くなり、すべての苦しみから解放された…<br>どうせ予備試験には受からないし俺にはお似合いだ...。",
                    shiroImageSrc: gs.shiroEndedImage || INITIAL_STATE_BASE.shiroEndedImage,
                    isSuicideEnding: true
                });
                return true; // アイテム使用成功
            }
        }
    };

const RANDOM_EVENTS = [
        { 
            name: "オプチャ炎上", 
            msg: "障害者差別発言が拡散し炎上！精神的にダメージ…", 
            effect: (gs) => { 
                gs.knowledge = Math.round(gs.knowledge * 0.8); 
                gs.stress = Math.min(100, gs.stress + 25);   
                gs.energy = Math.round(gs.energy * 0.75);   
                gs.focus = Math.round(gs.focus * 0.7);    
                gs.mental = Math.round(gs.mental * 0.6);   
                gs.luck = Math.max(0, gs.luck - 10);      
            }
        },
        { 
            name: "にゃま暴言", 
            msg: "突然にゃまが現れ心無い言葉を…少し心が揺らぐ。", 
            effect: (gs) => { 
                gs.knowledge = Math.round(gs.knowledge * 0.85); 
                gs.stress = Math.min(100, gs.stress + 20);    
                gs.energy = Math.round(gs.energy * 0.8);      
                gs.focus = Math.round(gs.focus * 0.75);   
                gs.mental = Math.round(gs.mental * 0.7);    
                gs.luck = Math.max(0, gs.luck - 8);        
            }
        },
        { 
            name: "親バレ", 
            msg: "自室で㊙️㊙️をしていたら親に見られそうになった…萎えてしまった。", 
            effect: (gs) => { 
                gs.stress = Math.min(100, gs.stress + 30);   
                gs.energy = Math.round(gs.energy * 0.85);    
                gs.focus = Math.round(gs.focus * 0.8);     
                gs.mental = Math.round(gs.mental * 0.75);    
            }
        },
        { 
            name: "将来心配", 
            msg: "親から「28歳にもなって将来どうするの？」と心配された…少し気分が重い。", 
            effect: (gs) => { 
                gs.stress = Math.min(100, gs.stress + 20);    
                gs.mental = Math.max(0, gs.mental - 15);    
                gs.focus = Math.max(0, gs.focus - 10);       
            }
        },
        { 
            name: "体調不良", 
            msg: "原因不明の体調不良。男の子の日に違いない。", 
            effect: (gs) => { 
                gs.energy = Math.max(10, gs.energy - 30);     
                gs.focus = Math.max(10, gs.focus - 20);       
                gs.stress = Math.min(100, gs.stress + 15);     
                gs.activeEffects['bad_condition'] = { duration:3, displayName:'体調不良(軽度)', value:0.5 }; 
            }
        },
        { 
            name: "大谷活躍", 
            msg: "大谷選手が特大HR！なんだか元気が出た！勉強しなきゃ!", 
            effect: (gs) => { 
                gs.knowledge = Math.round(gs.knowledge * 1.02); 
                gs.stress = Math.max(0, gs.stress - 6); 
                gs.energy = Math.round(gs.energy * 1.05); 
                gs.focus = Math.round(gs.focus * 1.05); 
                gs.mental = Math.round(gs.mental * 1.05); 
                gs.luck = Math.min(100, gs.luck + 7);
            }
        },
        { 
            name: "学者動画発見", 
            msg: "有名学者の予備試験対策動画を偶然発見！役立ちそうだ！", 
            effect: (gs) => { 
                gs.knowledge += getRandomInt(1,3); 
                gs.focus += getRandomInt(4,9); 
                gs.stress -= 4;
            }
        },
        { 
            name: "真実の言葉", 
            msg: "にゃまに「予備試験なんて夢見すぎ笑」と言われた。少し落ち込む…。", 
            effect: (gs) => { 
                gs.mental -= getRandomInt(10, 20);     
                gs.stress += getRandomInt(15, 25);    
                gs.focus -= getRandomInt(8, 15);    
                gs.knowledge -= getRandomInt(0,1);   
            }
        },
        { 
            name: "基準点上昇デマ", 
            msg: "SNSで「今年の択一基準点は大幅上昇」というデマを見てしまった…。少し不安だ。", 
            effect: (gs) => { 
                gs.stress += getRandomInt(10, 15);  
                gs.focus -= getRandomInt(5, 10);     
                gs.mental -= getRandomInt(3, 7);    
            }
        }
    ];
    const RANDOM_EVENT_CHANCE = 0.07;

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
    const actionButtonsNodeList = document.querySelectorAll('.action-buttons-grid button');
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
    const modalCloseButtons = document.querySelectorAll('.modal-close-button'); 
    const openDailyQuizButton = document.getElementById('open-daily-quiz-button');

    const dailyQuizModal = document.getElementById('daily-quiz-modal');
    const closeQuizModalButton = document.getElementById('close-quiz-modal-button');
    const quizMessageTextContentElement = document.getElementById('quiz-message-text-content');
    const quizChoicesAreaElement = document.getElementById('quiz-choices-area');
    const quizFeedbackTextElement = document.getElementById('quiz-feedback-text');
    const quizNextQuestionBtn = document.getElementById('quiz-next-question-btn');
    const quizMainAreaElement = document.getElementById('quiz-main-area');
    const quizResultAreaElement = document.getElementById('quiz-result-area');
    const quizProgressBarElement = document.getElementById('quiz-progress-bar');
    const quizProgressTextElement = document.getElementById('quiz-progress-text');
    const quizCurrentScoreValueElement = document.getElementById('quiz-current-score-value');
    const quizCurrentScoreDisplayElement = dailyQuizModal.querySelector('.quiz-current-score-display');
    const quizResultIconContainer = document.getElementById('quiz-result-icon-container');
    const quizResultRankTitleElement = document.getElementById('quiz-result-rank-title');
    const quizFinalScoreValueElement = document.getElementById('quiz-final-score-value');
    const quizTotalQuestionsOnResultElement = document.getElementById('quiz-total-questions-on-result');
    const quizResultMessageElement = document.getElementById('quiz-result-message');
    const quizFinishButton = document.getElementById('quiz-finish-button');

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
            gameState.logMessage = ""; this.clearCurrentTurnLogs(); this.renderFullLog();
        }
    };

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
        parentP.classList.remove('param-value-increased', 'param-value-decreased', 
                                  'flash-positive', 'flash-negative');
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
    
    function updateMainUI() {
        Object.keys(gameState).forEach(key => {
            if (['knowledge','stress','energy','focus','mental','luck'].includes(key)) {
                let maxVal = 100;
                if (key === 'knowledge') maxVal = 150;
                if (key === 'energy' && gameState.permanentBuffs.maxEnergyBoost) {
                    maxVal += gameState.permanentBuffs.maxEnergyBoost;
                }
                gameState[key] = clamp(gameState[key], 0, maxVal);
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
            const elem = paramsToUpdate[key];
            if (elem) {
                const oldVal = parseFloat(elem.textContent);
                const newVal = Math.round(gameState[key]);
                if (oldVal !== newVal && !isNaN(oldVal)) flashParamValue(elem, newVal - oldVal);
                elem.textContent = newVal;
            }
        }
        shiroImageElem.src = gameState.shiroImage;
        LogHelper.renderFullLog();

        inventoryListElem.innerHTML = '';
        const items = gameState.inventory.filter(i => ITEMS[i.id]);
        if (items.length === 0) {
            inventoryListElem.innerHTML = '<li class="no-items">なし</li>';
        } else {
            items.forEach(inv => {
                const def = ITEMS[inv.id]; if (!def) return;
                const li = document.createElement('li');
                let html = `<span class="item-name-qty">${def.name}`;
                if(def.type==='consumable_active') html+=` <span class="item-quantity">(x${inv.quantity})</span>`;
                else if(def.type==='permanent') html+=` <span class="item-quantity">(所持中)</span>`;
                html += `</span>`;
                if(def.type==='consumable_active') html+=`<button class="use-item-button" data-item-id="${inv.id}">使用</button>`;
                li.innerHTML = html; inventoryListElem.appendChild(li);
            });
        }
        document.querySelectorAll('.use-item-button').forEach(b => 
            b.addEventListener('click', (e) => useItem(e.target.dataset.itemId, e.target.closest('li')))
        );

        if (openDailyQuizButton) {
            openDailyQuizButton.disabled = gameState.quizAttemptedToday;
        }
    }

    function populateShop() {
        itemShopListElem.innerHTML = '';
        shopMoneyDisplay.textContent = Math.round(gameState.money);
        for (const id in ITEMS) {
            const item = ITEMS[id]; const card = document.createElement('div'); card.className = 'item-card';
            const ownPerm = item.type==='permanent' && gameState.inventory.find(i=>i.id===id);
            const afford = gameState.money >= item.price;
            card.innerHTML = `<h4><i class="fas fa-star"></i> ${item.name}</h4><p>${item.description}</p><p class="item-price"><i class="fas fa-coins"></i> ${item.price}円</p><button class="button-primary buy-item-button" data-item-id="${id}" ${!afford||ownPerm?'disabled':''}> <i class="fas fa-shopping-cart"></i> ${ownPerm?'購入済':'購入'}</button>`;
            itemShopListElem.appendChild(card);
        }
        document.querySelectorAll('.buy-item-button').forEach(b=>b.addEventListener('click',()=>buyItem(b.dataset.itemId)));
    }
    function buyItem(itemId){
        const itemDef=ITEMS[itemId];if(!itemDef)return;
        if(itemDef.type==='permanent'&&gameState.inventory.find(i=>i.id===itemId)){showThought("既に購入済み。",1800,'neutral');return;}
        if(gameState.money<itemDef.price){showThought("資金不足…",1800,'failure');return;}
        gameState.money-=itemDef.price;LogHelper.add(`--- アイテム購入 ---`);LogHelper.add(`${formatMessage(itemDef.name,"item")}を${itemDef.price}円で購入。`);
        if(itemDef.type==='permanent'){if(itemDef.permanentEffect){for(const k in itemDef.permanentEffect){if(k==='luck')gameState.luck=clamp(gameState.luck+itemDef.permanentEffect.luck,0,100);else gameState.permanentBuffs[k]=(gameState.permanentBuffs[k]||0)+itemDef.permanentEffect[k];}} LogHelper.add(`${formatMessage(itemDef.name,"item")}の永続効果発揮。`);if(!gameState.inventory.find(i=>i.id===itemId))gameState.inventory.push({id:itemId,name:itemDef.name,quantity:1});}
        else{const ex=gameState.inventory.find(i=>i.id===itemId);if(ex)ex.quantity++;else gameState.inventory.push({id:itemId,name:itemDef.name,quantity:1});}
        LogHelper.commitCurrentTurnToGameState();LogHelper.renderFullLog();showThought(`${itemDef.name}入手！`,1800,'success');updateMainUI();populateShop();
    }
    function useItem(itemId,itemElement){
        const idx=gameState.inventory.findIndex(i=>i.id===itemId&&i.quantity>0);if(idx===-1){showThought("アイテムなし。",1800,'failure');return;}
        const itemDef=ITEMS[itemId];if(!itemDef||itemDef.type!=='consumable_active'||!itemDef.use){showThought("使用不可。",1800,'failure');return;}
        if(gameState.energy<5&&itemId!=='energy_drink_law'){showThought("体力不足。",2000,'failure');return;}
        LogHelper.add(`--- アイテム使用 ---`);const success=itemDef.use(gameState,LogHelper);
        if(success){gameState.inventory[idx].quantity--;if(gameState.inventory[idx].quantity<=0)gameState.inventory.splice(idx,1);if(itemElement){itemElement.classList.add('item-used-flash');setTimeout(()=>itemElement.classList.remove('item-used-flash'),700);}showThought(`${itemDef.name}使用！`,1800,'success');}
        LogHelper.commitCurrentTurnToGameState();LogHelper.renderFullLog();updateMainUI();
    }
    
    function formatChange(c,tO=null){const r=Math.round(c);let t=tO;if(!t)t=r>=0?"positive":"negative";const s=r>0?"+":"";return `<strong class="${t}">${s}${r}</strong>`;}
    function formatMessage(tx,ty=""){return `<strong class="${ty==="item"?"item":ty}">${tx}</strong>`;}
    function calculateChange(b,pF=[],nF=[],m=1.0,isEC=false){let fM=m;if(isEC&&gameState.permanentBuffs.energyConsumptionModifier)fM*=(1+gameState.permanentBuffs.energyConsumptionModifier);pF.forEach(f=>fM*=(1+f.v*(f.p/100)));nF.forEach(f=>fM*=(1-f.v*(f.p/100)));let ch=b*Math.max(0.01,fM);if(gameState.activeEffects.bad_condition?.duration>0&&b>0&&!isEC)ch*=gameState.activeEffects.bad_condition.value;return ch;}

    function applyActiveEffectsEndOfDay(){let msg="";for(const k in gameState.activeEffects){gameState.activeEffects[k].duration--;if(gameState.activeEffects[k].duration<=0){msg+=`${formatMessage(gameState.activeEffects[k].displayName,"item")}効果終了。<br>`;delete gameState.activeEffects[k];}}if(msg)LogHelper.addRaw(msg);}
    function triggerRandomEvent(){eventNotificationArea.style.display='none';if(Math.random()<RANDOM_EVENT_CHANCE){const e=RANDOM_EVENTS[getRandomInt(0,RANDOM_EVENTS.length-1)];eventMessageElem.innerHTML=`<strong>イベント発生！</strong> ${e.msg}`;eventNotificationArea.style.display='block';gameContainer.classList.add('event-flash-highlight');setTimeout(()=>gameContainer.classList.remove('event-flash-highlight'),1500);e.effect(gameState);LogHelper.addRaw(`<div class="log-event-highlight"><strong>ランダムイベント:${e.name}</strong><br>${e.msg}</div>`);showThought(`「${e.name}」発生！`,3200,'neutral');return true;}return false;}
    
    function studyTextbook() {
        gameState.studyActionCount++; 
        LogHelper.add("<strong><i class='fas fa-book-open'></i> 基本書を読み知識を詰めた。</strong>");
        
        let kGainBase = getRandom(3, 7);
        let knowledgeMultiplier = 1.0;

        const quizBonus = gameState.activeEffects.quizMasteryBonus;
        if (quizBonus?.duration > 0 && quizBonus.type === 'genericLearningBoost' && 
            quizBonus.boostKey === 'studyTextbookBoost') {
            knowledgeMultiplier *= quizBonus.value;
            LogHelper.add(`${formatMessage(quizBonus.displayName, "item")}により学習効率が更にUP！`);
        }

        const itemBoost = gameState.activeEffects.studyTextbookBoost;
        if (itemBoost?.duration > 0) {
            knowledgeMultiplier *= itemBoost.value; 
            LogHelper.add(`${formatMessage(itemBoost.displayName, "item")}により効率UP！`);
        }
        
        let kGain = calculateChange(
            kGainBase, 
            [{p:gameState.focus, v:0.85}, {p:gameState.mental, v:0.25}],
            [{p:gameState.stress,v:0.85}, {p:(100-gameState.energy), v:0.75}], 
            knowledgeMultiplier
        );
        kGain = Math.max(0, Math.round(kGain)); 
        gameState.knowledge += kGain; 
        LogHelper.add(kGain > 0 ? `法律知識が${formatChange(kGain)}。` : `全く頭に入らなかった…。`);
        
        gameState.energy -= Math.round(calculateChange(30,[],[],1,true)); 
        gameState.stress += Math.round(calculateChange(15,[{p:(100-gameState.mental),v:0.65}]));
        
        let focusDrain = getRandomInt(22,32); 
        if (gameState.permanentBuffs.focusRetentionBoost) {
            focusDrain *= (1 - gameState.permanentBuffs.focusRetentionBoost);
        }
        gameState.focus -= Math.round(focusDrain); 
        gameState.mental -= getRandomInt(4,8);

        if (gameState.energy < 10) {
            showThought("もう限界だ…", 1800, 'failure');
        } else if (gameState.focus < 5) {
            showThought("目がかすむ…", 1800, 'failure');
        }
    }

    function doExercise() {
        gameState.studyActionCount++;
        LogHelper.add("<strong><i class='fas fa-pencil-alt'></i> 過去問・演習書と格闘。</strong>");
        
        let kGainBase = getRandom(2,8);
        let knowledgeMultiplier = 1.0;

        if (gameState.permanentBuffs.exerciseKnowledgeBoost) {
            knowledgeMultiplier += gameState.permanentBuffs.exerciseKnowledgeBoost;
        }

        const quizBonus = gameState.activeEffects.quizMasteryBonus;
        if (quizBonus?.duration > 0 && quizBonus.type === 'genericLearningBoost' &&
            quizBonus.boostKey === 'studyExerciseBoost') {
            knowledgeMultiplier *= quizBonus.value;
            LogHelper.add(`${formatMessage(quizBonus.displayName, "item")}により演習効率が更にUP！`);
        }
        
        const itemBoost = gameState.activeEffects.studyExerciseBoost;
        if (itemBoost?.duration > 0) { 
            knowledgeMultiplier *= itemBoost.value; 
            LogHelper.add(`${formatMessage(itemBoost.displayName,"item")}により効率UP！`);
        }
        
        let kGain = calculateChange(
            kGainBase, 
            [{p:gameState.focus,v:0.9},{p:gameState.knowledge,v:0.10}],
            [{p:gameState.stress,v:0.75},{p:(100-gameState.energy),v:0.75}],
            knowledgeMultiplier
        );
        kGain = Math.max(0, Math.round(kGain)); 
        gameState.knowledge += kGain; 
        LogHelper.add(kGain > 0 ? `実践的な法律知識が${formatChange(kGain)}。` : `問題が全く解けなかった…。`);
        
        let focusConsumption = getRandomInt(28,40); 
        if (gameState.permanentBuffs.exerciseFocusSave) {
            focusConsumption *= (1 - gameState.permanentBuffs.exerciseFocusSave);
        }
        gameState.focus -= Math.round(focusConsumption); 
        gameState.energy -= Math.round(calculateChange(38,[],[],1,true)); 
        gameState.stress += Math.round(calculateChange(20,[{p:(100-gameState.mental),v:0.55}])); 
        gameState.mental -= getRandomInt(6,12);

        if (gameState.focus < 5) {
            showThought("頭が停止した…", 1800, 'failure');
        }
    }
    
    
    function work(){LogHelper.add("<strong><i class='fas fa-briefcase'></i> 短期バイトに励んだ。</strong>");if(gameState.energy<40){LogHelper.add(formatMessage("疲労困憊、仕事にならず…。","negative"));showThought("体が重い…",1800,'failure');gameState.money+=getRandomInt(200,500);gameState.energy-=getRandomInt(25,40);}else{let e=calculateChange(getRandom(800,2200),[{p:gameState.focus,v:0.03}]);e=Math.round(e);gameState.money+=e;LogHelper.add(`働いて${formatMessage("+"+e,"positive")}円得た。`);showThought("これで少しは…。",1800,'neutral');}gameState.energy-=Math.round(calculateChange(55,[],[],1,true));gameState.stress+=getRandomInt(10,24);gameState.focus-=getRandomInt(9,18);gameState.mental-=getRandomInt(2,4);}
    

    function insultOnline() {
        gameState.insultOnlineCount++;
        const targets = ["にゃま", "なんく", "ささみ"];
        const target = targets[getRandomInt(0, targets.length - 1)];
    
        LogHelper.add(`<strong><i class='fas fa-keyboard'></i> オプチャで${target}に暴言を吐いた。</strong>`);
        gameState.energy -= getRandomInt(8, 18);
    
        if (Math.random() < 0.7) { 
            let stressRelief = getRandomInt(25, 45); 
            gameState.stress -= Math.round(stressRelief);
            let mentalBoost = getRandomInt(5, 10);
            gameState.mental += mentalBoost;
            let focusBoost = getRandomInt(3, 7);
            gameState.focus += focusBoost;
            gameState.luck -= getRandomInt(5, 10);
    
            LogHelper.add(`${target}を完膚なきまでに言い負かした！気分爽快だ！ストレス${formatChange(-Math.round(stressRelief))}、精神力${formatChange(mentalBoost)}、集中力${formatChange(focusBoost)}。`);
            LogHelper.add(`しかし、このような行為は合格運を著しく下げるだろう(${formatChange(getRandomInt(-25, -15), "negative")})。`);
            showThought("論破してやったぜ！…少し心が痛むが。", 2000, 'success');
        } else {
            let stressIncrease = getRandomInt(25, 35); 
            gameState.stress += stressIncrease;
            let mentalDamage = getRandomInt(20, 30); 
            gameState.mental -= mentalDamage;
            gameState.luck -= getRandomInt(8, 14); 
            gameState.focus -= getRandomInt(10, 18); 
    
            LogHelper.add(`${target}への悪態は不発に終わり、逆に言い返されてしまった…。ストレスが${formatChange(stressIncrease,"negative")}、精神力が${formatChange(-mentalDamage,"negative")}。`);
            LogHelper.add(`集中力も散漫になり(${formatChange(getRandomInt(-18, -10),"negative")})、合格運も下がった(${formatChange(getRandomInt(-14, -8),"negative")})。`);
            showThought("言い返されてしまった…最悪だ。", 2200, 'failure');
    
            // --- 「ささみ」エンディング分岐 ---
            if (target === "ささみ") {
                if (Math.random() < 0.5) {
                    LogHelper.addRaw(`<div class="log-event-highlight"><strong>致命的な挑発:</strong> ${target}を本気で怒らせてしまったようだ…！</div>`);
                    LogHelper.commitCurrentTurnToGameState(`--- ${gameState.day}日目の行動 ---`);
                    LogHelper.renderFullLog();
                    
                    triggerImmediateGameOver({
                        title: "ささみの逆襲",
                        message: "ささみを煽った結果、激怒したささみとその取り巻きによってネット上で全てを晒されてしまった…。<br>社会的な信用は失墜し、予備試験どころではなくなった。",
                        shiroImageSrc: gameState.shiroSadImage || INITIAL_STATE_BASE.shiroSadImage 
                    });
                    return; 
                } else {
                     LogHelper.add(`${target}は相当怒っているようだが、今回はなんとか襲撃を免れたようだ…。`);
                }
            }
        }
    }

    
    function pachinko(){gameState.pachinkoCount++;LogHelper.add("<strong><i class='fas fa-slot-machine'></i> 誘惑に負けパチンコへ…。</strong>");let c=Math.min(gameState.money,Math.max(1000,Math.round(gameState.money*0.20)));if(gameState.money<1000){LogHelper.add(formatMessage("資金1000円未満では遊べない。","negative"));showThought("娯楽は金持ちの道楽か…。",1800,'failure');gameState.stress+=8;}else{gameState.money-=c;LogHelper.add(`${c}円握りしめ一攫千金を夢見た。`);gameState.energy-=Math.round(calculateChange(25,[],[],1,true));let wc=clamp(0.15+(gameState.luck/450)-(gameState.stress/550)+(gameState.mental/650),0.01,0.30);if(Math.random()<wc){const w=Math.round(c*(getRandom(1,6)+getRandom(1,6)));gameState.money+=w;LogHelper.add(`信じられない幸運！${formatMessage("+"+w,"positive")}円獲得！`);gameState.stress-=getRandomInt(15,25);gameState.mental+=getRandomInt(7,13);gameState.luck+=getRandomInt(1,2);showThought("今日だけはツイてる！",1800,'success');}else{LogHelper.add(formatMessage("やはり現実は厳しかった…参加費全損。","negative"));gameState.stress+=getRandomInt(22,32);gameState.mental-=getRandomInt(15,22);gameState.luck-=getRandomInt(3,7);showThought("時間と金の無駄…。",2000,'failure');}}}
    function sleep(){LogHelper.add("<strong><i class='fas fa-bed'></i> 翌日のため質の高い睡眠を。</strong>");let eg=calculateChange(getRandom(38,70),[{p:(100-gameState.stress),v:0.12}],[{p:gameState.stress,v:0.55}]);let sr=calculateChange(getRandom(6,16),[{p:gameState.mental,v:0.45}]);gameState.energy+=Math.round(eg);gameState.stress-=Math.round(sr);LogHelper.add(`体力回復(${formatChange(Math.round(eg))})、ストレス軽減(${formatChange(-Math.round(sr))})。`);let r=getRandomInt(1,5);gameState.focus=Math.max(15,gameState.focus+Math.round(r*0.8));gameState.mental=Math.min(100,gameState.mental+Math.round(r*0.5));showThought("少し回復したか…。",1800,'neutral');}

    let allQuizQuestionsData = [];
    let currentQuizSet = [];
    let currentQuizQuestionIndex = 0;
    let currentQuizScore = 0;
    const QUIZ_TARGET_NUM_QUESTIONS = 3;
    const QUIZ_REWARD_MONEY = 300;
    const QUIZ_CLEAR_SCORE_THRESHOLD = 2;

    async function loadQuizData() {
        try {
            const response = await fetch('quiz_data2.json');
            if (!response.ok) throw new Error(`Quiz data HTTP error: ${response.status}`);
            allQuizQuestionsData = await response.json();
            if (!Array.isArray(allQuizQuestionsData) || allQuizQuestionsData.length === 0) {
                throw new Error("Quiz data is empty or not an array.");
            }
        } catch (error) {
            console.error("Failed to load or initialize quiz data:", error);
            LogHelper.addRaw(`<div class="log-event-highlight">クイズ準備失敗: ${error.message}</div>`);
            if(openDailyQuizButton) openDailyQuizButton.disabled = true;
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
        let selBtnEl = null;
        for (let btn of buttons) {
            btn.disabled = true;
            if (btn.textContent === selectedChoice) selBtnEl = btn;
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
            if(selBtnEl) {selBtnEl.classList.remove('reveal-correct'); selBtnEl.classList.add('correct');}
            if (typeof confetti === 'function') confetti({particleCount:80,spread:60,origin:{y:0.7},zIndex:10001});
        } else {
            quizFeedbackTextElement.textContent = `残念！正解は「${correctAnswer}」`;
            quizFeedbackTextElement.classList.add('wrong', 'feedback-text-shake');
            if(selBtnEl) selBtnEl.classList.add('wrong');
            setTimeout(() => quizFeedbackTextElement.classList.remove('feedback-text-shake'), 400);
        }
        quizNextQuestionBtn.style.display = 'inline-flex';
    }

    function updateQuizProgress() {
        const totalQ = currentQuizSet.length;
        if (totalQ > 0) {
            const prog = ((currentQuizQuestionIndex) / totalQ) * 100;
            quizProgressBarElement.style.width = `${prog}%`;
            quizProgressTextElement.textContent = `問題 ${currentQuizQuestionIndex + 1} / ${totalQ}`;
        }
    }

    function showQuizResults() {
        quizMainAreaElement.style.display = 'none';
        quizResultAreaElement.style.display = 'block';
        const totalAnswered = currentQuizSet.length;
        quizTotalQuestionsOnResultElement.textContent = totalAnswered;
        quizFinalScoreValueElement.textContent = currentQuizScore;

        let rank = '', rankTitle = '', message = '', iconClass = '';
        let moneyChange = 0;
        let energyChange = 0;
        let bonusEffectActive = false;

        if (currentQuizScore === 3) { // 3問正解
            rank = 's'; rankTitle = "全問正解！天才！"; 
            moneyChange = 400;
            energyChange = 10;
            
            // 「プラス効果1.2倍」バフを付与 (次の勉強/演習効率UP)
            const effectKey = 'quizMasteryBonus'; // 効果のキー名
            const effectDisplayName = 'クイズ全問正解ボーナス';
            // ランダムで勉強か演習のどちらかの効率を上げる
            const targetActionBoost = Math.random() < 0.5 ? 'studyTextbookBoost' : 'studyExerciseBoost';
            gameState.activeEffects[effectKey] = { 
                duration: 2, // 次の1日有効 (endDayで1減るので実質1日)
                value: 1.2, 
                displayName: effectDisplayName,
                // このキー自体を studyTextbookBoost や studyExerciseBoost と同じように、
                // calculateChange 関数または各アクション関数で参照できるようにする。
                // ここでは、特定の行動ブーストキーに効果を上書きまたは追加する形で実装。
                // 例: gameState.activeEffects[targetActionBoost] = { duration: 2, value: 1.2, displayName: effectDisplayName };
                // より汎用的な実装として、新しい効果タイプとして追加する
                type: 'genericLearningBoost', // 例: このタイプを calculateChange で見る
                boostKey: targetActionBoost // どのブーストに影響するか
            };
            bonusEffectActive = true;
            message = `完璧！${formatChange(moneyChange, "positive")}円と体力${formatChange(energyChange)}、さらに${effectDisplayName}(1.2倍)ゲット！`;
            iconClass = 'fas fa-crown';
            if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, scalar: 1.3, zIndex: 10001 });
        
        } else if (currentQuizScore === 2) { // 2問正解
            rank = 'a'; rankTitle = "おしい！あと一歩！";
            moneyChange = 200;
            message = `2問正解！${formatChange(moneyChange, "positive")}円獲得！`;
            iconClass = 'fas fa-thumbs-up';
            if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, zIndex: 10001 });
        
        } else if (currentQuizScore === 1) { // 1問正解
            rank = 'c'; rankTitle = "うーん…もうやめたら?";
            // moneyChange は 0 のまま
            energyChange = -10;
            message = `1問正解。報酬なし、体力${formatChange(energyChange)}…。`;
            iconClass = 'fas fa-meh';
        
        } else { // 0問正解
            rank = 'e'; rankTitle = "やる気ないね…";
            moneyChange = -200;
            energyChange = -20;
            message = `まさかの0問正解…。活動資金${formatChange(moneyChange)}、体力${formatChange(energyChange)}…。`;
            iconClass = 'fas fa-skull-crossbones';
        }

        gameState.money = clamp(gameState.money + moneyChange, 0, Infinity);
        // 体力の上限は gameState.permanentBuffs.maxEnergyBoost も考慮
        const maxEnergy = 100 + (gameState.permanentBuffs.maxEnergyBoost || 0);
        gameState.energy = clamp(gameState.energy + energyChange, 0, maxEnergy);

        quizResultIconContainer.className = `quiz-result-icon-container rank-${rank}`;
        let iconColorVar = '--quiz-color-wrong';
        if (currentQuizScore === 3) iconColorVar = '--quiz-color-correct'; // 全問正解
        else if (currentQuizScore === 2) iconColorVar = '--quiz-color-accent-primary'; // 2問正解
        else if (currentQuizScore === 1) iconColorVar = '--quiz-color-accent-secondary'; // 1問正解
        quizResultIconContainer.innerHTML = `<i class="${iconClass}" style="color: var(${iconColorVar});"></i>`;
        quizResultRankTitleElement.textContent = rankTitle;
        quizResultMessageElement.textContent = message;
    }

    function startDailyQuizSession() {
        if (gameState.quizAttemptedToday) {
            showThought("今日のクイズはもう挑戦済みだ。", 2000, 'neutral');
            return;
        }
        if (allQuizQuestionsData.length === 0) {
            showThought("クイズの準備ができていないようだ…", 2000, 'failure');
            LogHelper.add("クイズデータがなく挑戦できませんでした。");
            LogHelper.commitCurrentTurnToGameState(); LogHelper.renderFullLog();
            return;
        }
        prepareNewQuizSet();
        if (currentQuizSet.length === 0) {
            showThought("出題できるクイズがないみたいだ。", 2000, 'neutral');
            LogHelper.add("クイズセットの準備に失敗。");
            LogHelper.commitCurrentTurnToGameState(); LogHelper.renderFullLog();
            return;
        }
        currentQuizQuestionIndex = 0; currentQuizScore = 0;
        quizCurrentScoreValueElement.textContent = '0';
        if(quizCurrentScoreDisplayElement) quizCurrentScoreDisplayElement.classList.remove('score-updated');
        quizMainAreaElement.style.display = 'block';
        quizResultAreaElement.style.display = 'none';
        quizNextQuestionBtn.style.display = 'none';
        quizFeedbackTextElement.textContent = '';
        quizFeedbackTextElement.className = 'quiz-feedback-text';
        updateQuizProgress(); displayQuizQuestion();
        dailyQuizModal.classList.add('show');
        disableActions();
    }

    function finishQuizSession() {
        dailyQuizModal.classList.remove('show');
        gameState.quizAttemptedToday = true;
        
        LogHelper.add(`--- デイリークイズ結果 ---`);
        // showQuizResults で gameState は更新されているので、それに基づいてログを生成
        if (currentQuizScore === 3) {
            LogHelper.add(`全問正解！${formatChange(400, "positive")}円と体力${formatChange(10)}を獲得！さらに次回学習効率UP！`);
        } else if (currentQuizScore === 2) {
            LogHelper.add(`2問正解！${formatChange(200, "positive")}円獲得！`);
        } else if (currentQuizScore === 1) {
            LogHelper.add(`1問正解。体力${formatChange(-10)}。`);
        } else { // 0問正解
            LogHelper.add(`0問正解…。活動資金${formatChange(-200)}、体力${formatChange(-20)}。`);
        }
        
        LogHelper.commitCurrentTurnToGameState();
        LogHelper.renderFullLog();
        updateMainUI(); 
        enableActions(); 
    }

    function endDay() {
        gameState.omikujiUsedToday = false;
        gameState.quizAttemptedToday = false; 
        gameState.day++;
        applyActiveEffectsEndOfDay();
        if (gameState.permanentBuffs.dailyLuckIncrease) {
            gameState.luck += gameState.permanentBuffs.dailyLuckIncrease;
            LogHelper.addRaw(`${formatMessage("お守り","item")}から微かな加護(合格運${formatChange(gameState.permanentBuffs.dailyLuckIncrease,"positive")})。<br>`);
        } else { 
            gameState.luck += getRandomInt(-2, -1);
        }
        gameState.luck = clamp(gameState.luck, 0, 100);
        let dSM = gameState.permanentBuffs.dailyStressResist || 0;
        gameState.stress += getRandomInt(0, 4) - dSM;
        gameState.mental -= getRandomInt(0, 2);
        gameState.energy -= getRandomInt(0, 2);
        gameState.focus -= getRandomInt(0, 2);
        LogHelper.commitCurrentTurnToGameState(`<br><br>--- ${gameState.day-1}日目の終わりに ---`);
        if (gameState.day > maxDaysGlobal) {
            triggerExam();
        } else {
            triggerRandomEvent(); 
            const nDP = `<br><br>--- ${gameState.day}日目 ---<br>今日も一日が始まる…。予備試験まであと${maxDaysGlobal-gameState.day+1}日。`;
            LogHelper.commitCurrentTurnToGameState(nDP);
            LogHelper.renderFullLog();
            updateMainUI();
            enableActions();
        }    
    }
    function triggerExam() {
        disableActions(); examResultModal.classList.add('show');
        examCalcMsg.style.display='block'; examActualResult.style.display='none'; fictionEndingElem.style.display='none';
        LogHelper.addRaw("<strong><i class='fas fa-scroll'></i> 運命の予備試験、結果発表の時…</strong><br>これまでの全ての努力と選択が、今、審判される。");
        LogHelper.commitCurrentTurnToGameState(); LogHelper.renderFullLog(); 
        setTimeout(() => {
            let s=gameState.knowledge*2.6+gameState.mental*1.2+gameState.focus*1.0+gameState.luck*0.7-gameState.stress*1.5+gameState.energy*0.35;
            s=Math.max(0,Math.round(s));const pt=(maxDaysGlobal===15?235:220);let msg="",t="",p=false;
            if(s>=pt){if(gameState.luck>75&&gameState.mental>80&&s>pt*1.1)p=true;else if(s>pt*1.05&&(gameState.luck>70||gameState.mental>75)&&Math.random()<0.6)p=true;else if(Math.random()<(0.20+Math.max(0,(gameState.knowledge-70))/100+Math.max(0,(gameState.luck-70))/150+Math.max(0,(gameState.mental-70))/200))p=true;}
            else{if(s>pt*0.9&&gameState.luck>85&&gameState.mental>70&&Math.random()<0.05)p=true;}
            examShiroImageElem.src=p?(gameState.shiroHappyImage||INITIAL_STATE_BASE.shiroImage):(gameState.shiroSadImage||INITIAL_STATE_BASE.shiroImage);
            examResultTitle.style.color=p?'var(--color-success)':'var(--color-danger)';
            if(p){t="予備試験 合格！";if(s>pt*1.10)msg=`<strong>信じられない！まさに奇跡！超高得点で合格です！</strong><br>絶望的な挑戦を乗り越え、不可能を可能にしました！`;else msg=`<strong>おめでとうございます！血と汗と涙、そして幸運が実り、見事合格です！</strong><br>厳しい道のりの果てに、ついに栄光を掴みました。`;fictionNoticeElem.innerHTML=`―――これはゲームの中の輝かしい未来。<br>現実のしろちゃんは、怠惰な時間を満喫中…！<br>めでたし？`;fictionEndingElem.style.display='block';}
            else{examResultTitle.style.color='var(--color-danger)';const iL=maxDaysGlobal===15?3:5;const pL=maxDaysGlobal===15?3:5;const sE=maxDaysGlobal===15?Math.round(maxDaysGlobal*0.6):Math.round(maxDaysGlobal*0.5);
                if(gameState.soaplandUsedCount>0){t="不合格…そして絶望の診断";msg=`<strong>予備試験に落ちた上、刹那的な快楽が仇となり体に深刻な異変が…。</strong><br>診断結果は無情にも性病。治療には莫大な費用と時間が…。`;}
                else if(gameState.insultOnlineCount>=iL){t="不合格…そして逮捕";msg=`<strong>予備試験にも落ち、度重なるネットでの誹謗中傷が仇となった…。</strong><br>「しろちゃん、署まで来てもらおうか」…人生、詰んだ。`;}
                else if(gameState.pachinkoCount>=pL){t="不合格…そして借金地獄";msg=`<strong>予備試験にも落ち、パチンコで作った借金は雪だるま式に膨れ上がった。</strong><br>取り立ての電話は鳴り止まず、もはやまともな生活は送れない…。しろちゃんは自殺した。`;}
                else if(gameState.studyActionCount>=sE&&s<pt){t="不合格…努力の果てに";msg=`<strong>予備試験不合格。あれだけ勉強したのに、結果は非情だった…。</strong><br>努力だけでは越えられない壁を痛感し、静かにペンを置いた。`;}
                else{t="予備試験 不合格…";if(s<pt*0.6)msg=`<strong>残念ながら、夢は完全に潰えました…。</strong><br>厳しい現実は、無情にも打ちのめしました。`;else if(s<pt*0.88)msg=`<strong>あと一歩でしたが、不合格です。</strong><br>悔しい結果です。しかし何かを掴んだと信じたい…。`;else msg=`<strong>本当に、本当に、あと僅かの差で不合格…。</strong><br>天は味方しませんでした。合格の光はこぼれ落ちました。`;}}
            examResultTitle.textContent=t;examResultMesssage.innerHTML=msg;examCalcMsg.style.display='none';examActualResult.style.display='block';
            shiroImageElem.classList.add('shiro-image-changed');setTimeout(()=>shiroImageElem.classList.remove('shiro-image-changed'),600);
        },2800);
    }

    function triggerImmediateGameOver(details) {
        disableActions(); // 全ての行動ボタンを無効化
        
        // 試験結果モーダルを再利用してゲームオーバー画面を表示
        examResultModal.classList.add('show');
        
        // モーダル内の表示をクリア・設定
        examResultTitle.textContent = details.title || "ゲームオーバー";
        examResultTitle.style.color = 'var(--color-danger)'; // 通常は赤文字
        
        examShiroImageElem.src = details.shiroImageSrc || INITIAL_STATE_BASE.shiroSadImage;
        
        examResultMesssage.innerHTML = details.message || "何かが起こり、物語はここで終わった…。";
        
        // 試験関連の表示は隠す
        examCalcMsg.style.display = 'none';
        fictionEndingElem.style.display = 'none'; // フィクションエンディング部分は非表示
        
        examActualResult.style.display = 'block'; // 結果メッセージ部分を表示
        
        // 通常の試験終了ではないことを示すために、一部UIを調整（任意）
        // 例えば、restartGameButton のテキストを変えるなど
        // restartGameButton.textContent = "最初からやり直す";
        
        // gameState.day はこの関数内では更新しない (アイテム使用時に即終了のため)
        // 必要であれば、グローバルなゲーム終了フラグなどを立てる
        // actionButtonsCurrentlyDisabled は disableActions で true になっている
    }

    let actionButtonsCurrentlyDisabled = false;
    function handleAction(actionType) {
        if (gameState.day > maxDaysGlobal || actionButtonsCurrentlyDisabled) return;
        if (gameState.energy <= 0 && actionType !== 'sleep') {
            LogHelper.add(formatMessage("体力がゼロです…寝ましょう。", "negative"));
            LogHelper.commitCurrentTurnToGameState(`--- ${gameState.day}日目の行動 ---`);
            LogHelper.renderFullLog();
            showThought("意識が…遠のく……", 2000, 'failure');
            return; 
        }
        disableActions();
        switch (actionType) {
            case 'study_textbook': studyTextbook(); break;
            case 'do_exercise': doExercise(); break;
            case 'insult_online': insultOnline(); break;
            case 'work': work(); break;
            case 'pachinko': pachinko(); break;
            case 'sleep': sleep(); break;
            default: console.error("未定義のアクション(handleAction):", actionType); enableActions(); return;
        }
        LogHelper.commitCurrentTurnToGameState(`--- ${gameState.day}日目の行動 ---`);
        LogHelper.renderFullLog();
        updateMainUI(); 
        setTimeout(() => {
            if (gameState.day <= maxDaysGlobal) endDay();
        }, 1300);
    }

    function disableActions() { 
        actionButtonsCurrentlyDisabled = true;
        actionButtonsNodeList.forEach(b => b.disabled = true); 
        if (openDailyQuizButton) openDailyQuizButton.disabled = true;
    }
    function enableActions() { 
        actionButtonsCurrentlyDisabled = false;
        if (gameState.day <= maxDaysGlobal) {
            actionButtonsNodeList.forEach(b => b.disabled = false); 
            if (openDailyQuizButton) openDailyQuizButton.disabled = gameState.quizAttemptedToday;
        }
    }

    function initializeGame(selectedDays) {
        maxDaysGlobal = parseInt(selectedDays);
        gameState = JSON.parse(JSON.stringify(INITIAL_STATE_BASE));
        if (maxDaysGlobal === 15) { gameState.money = 800; gameState.knowledge = 10;} 
        else { gameState.money = 500; }
        maxDaysDisplayElem.textContent = maxDaysGlobal;
        difficultyScreen.style.display = 'none';
        difficultyScreen.classList.add('hidden');
        gameContainer.style.display = 'block';
        gameContainer.classList.remove('hidden');
        LogHelper.resetFullLog(); 
        LogHelper.setInitialLogMessage(); 
        updateMainUI();
        enableActions();
        eventNotificationArea.style.display = 'none';    
    }

    selectEasyButton.addEventListener('click', () => initializeGame(selectEasyButton.dataset.days));
    selectHardButton.addEventListener('click', () => initializeGame(selectHardButton.dataset.days));
    
    actionButtonsNodeList.forEach(button => {
        button.addEventListener('click', () => {
            if (!actionButtonsCurrentlyDisabled) { 
                 handleAction(button.dataset.action);
            }
        });
    });

    openDailyQuizButton.addEventListener('click', () => {
        if (!actionButtonsCurrentlyDisabled && !gameState.quizAttemptedToday) {
            startDailyQuizSession();
        } else if (gameState.quizAttemptedToday) {
            showThought("今日のクイズはもう挑戦済みだ。", 2000, 'neutral');
        }
    });

    restartGameButton.addEventListener('click', () => {
        examResultModal.classList.remove('show');
        gameContainer.style.display = 'none'; gameContainer.classList.add('hidden');
        difficultyScreen.style.display = 'flex'; difficultyScreen.classList.remove('hidden');
    });

    openShopButton.addEventListener('click', () => { populateShop(); itemShopModal.classList.add('show'); });
    
    modalCloseButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modalId;
            if(modalId) {
                const modalToClose = document.getElementById(modalId);
                if(modalToClose) modalToClose.classList.remove('show');
            }
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                if (modal.id === 'daily-quiz-modal' && modal.classList.contains('show')) {
                    if (quizMainAreaElement.style.display === 'block' && 
                        (!quizResultAreaElement.style.display || quizResultAreaElement.style.display === 'none')) {
                        LogHelper.add("デイリークイズを途中で終了しました。");
                    }
                    finishQuizSession();
                } else {
                    modal.classList.remove('show');
                }
            }
        });
    });

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
        finishQuizSession();
    });
    
    closeQuizModalButton.addEventListener('click', () => {
        if (quizMainAreaElement.style.display === 'block' && 
            (!quizResultAreaElement.style.display || quizResultAreaElement.style.display === 'none')) {
            LogHelper.add("デイリークイズを途中で終了しました。報酬はありません笑。");
        }
        finishQuizSession();
    });

    async function gameStartInit() {
        await loadQuizData(); 
        gameContainer.style.display = 'none';
        gameContainer.classList.add('hidden');
        difficultyScreen.style.display = 'flex';
        difficultyScreen.classList.remove('hidden');
        console.log("しろちゃん 予備試験ガチモード");
    }

    gameStartInit();
});
