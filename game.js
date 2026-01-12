// ============================================================================
// STATE
// ============================================================================

const state = {
    challenges: [],
    currentChallenge: null,
    deck: [],
    hand: [],
    discardPile: [],
    legalPlays: 0,
    penalties: 0,
};

// ============================================================================
// CARD UTILITIES
// ============================================================================

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
    const deck = [];
    let id = 0;
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, id: id++ });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getCardColor(card) {
    return (card.suit === '♥' || card.suit === '♦') ? 'red' : 'black';
}

// ============================================================================
// RULE EVALUATION (Pure Functions)
// ============================================================================

function evaluateRule(rule, cardToPlay, topCard, prevCard) {
    switch (rule.type) {
        case 'BASE_MATCH_SUIT_OR_RANK':
            return evaluateBaseMatchRule(cardToPlay, topCard);
        
        case 'AFTER_RANK_REQUIRE_COLOR':
            return evaluateAfterRankRequireColorRule(rule, cardToPlay, topCard);
        
        case 'FORBID_SAME_SUIT_AS_PREV':
            return evaluateForbidSameSuitRule(cardToPlay, topCard);
        
        case 'FORBID_RANK_ON_COLOR':
            return evaluateForbidRankOnColorRule(rule, cardToPlay, topCard);
        
        default:
            return { legal: true };
    }
}

function evaluateBaseMatchRule(cardToPlay, topCard) {
    if (!topCard) {
        return { legal: true };
    }
    
    const matchesSuit = cardToPlay.suit === topCard.suit;
    const matchesRank = cardToPlay.rank === topCard.rank;
    
    if (matchesSuit || matchesRank) {
        return { legal: true };
    }
    
    return { 
        legal: false, 
        reason: 'Card must match either suit or rank of the top card' 
    };
}

function evaluateAfterRankRequireColorRule(rule, cardToPlay, topCard) {
    if (!topCard) {
        return { legal: true };
    }
    
    if (topCard.rank === rule.afterRank) {
        const cardColor = getCardColor(cardToPlay);
        if (cardColor !== rule.requiredColor) {
            return { 
                legal: false, 
                reason: `After a ${rule.afterRank}, you must play a ${rule.requiredColor} card` 
            };
        }
    }
    
    return { legal: true };
}

function evaluateForbidSameSuitRule(cardToPlay, topCard) {
    if (!topCard) {
        return { legal: true };
    }
    
    if (cardToPlay.suit === topCard.suit) {
        return { 
            legal: false, 
            reason: 'Cannot play the same suit consecutively' 
        };
    }
    
    return { legal: true };
}

function evaluateForbidRankOnColorRule(rule, cardToPlay, topCard) {
    if (!topCard) {
        return { legal: true };
    }
    
    const topColor = getCardColor(topCard);
    
    if (cardToPlay.rank === rule.forbiddenRank && topColor === rule.onColor) {
        return { 
            legal: false, 
            reason: `Cannot play ${rule.forbiddenRank} on a ${rule.onColor} card` 
        };
    }
    
    return { legal: true };
}

function isPlayLegal(cardToPlay, topCard, rules) {
    for (const rule of rules) {
        const result = evaluateRule(rule, cardToPlay, topCard);
        if (!result.legal) {
            return result;
        }
    }
    return { legal: true };
}

// ============================================================================
// GAME LOGIC
// ============================================================================

function initializeGame(challenge) {
    state.currentChallenge = challenge;
    state.deck = shuffleDeck(createDeck());
    state.hand = [];
    state.discardPile = [];
    state.legalPlays = 0;
    state.penalties = 0;
    
    // Deal initial hand (7 cards)
    for (let i = 0; i < 7; i++) {
        state.hand.push(state.deck.pop());
    }
    
    // Place first card on discard pile
    state.discardPile.push(state.deck.pop());
}

function drawCard() {
    if (state.deck.length === 0) {
        // Reshuffle discard pile back into deck (keep top card)
        const topCard = state.discardPile.pop();
        state.deck = shuffleDeck(state.discardPile);
        state.discardPile = [topCard];
    }
    
    if (state.deck.length > 0) {
        state.hand.push(state.deck.pop());
    }
}

function playCard(cardIndex) {
    const card = state.hand[cardIndex];
    const topCard = state.discardPile[state.discardPile.length - 1];
    
    const result = isPlayLegal(card, topCard, state.currentChallenge.rules);
    
    if (result.legal) {
        // Legal play
        state.hand.splice(cardIndex, 1);
        state.discardPile.push(card);
        state.legalPlays++;
        return { success: true, message: 'Legal play!' };
    } else {
        // Illegal play - penalty (don't reveal the reason)
        state.penalties++;
        drawCard();
        return { success: false, message: 'Illegal Play!' };
    }
}

function checkWinCondition() {
    const goal = state.currentChallenge.goal;
    
    // Check if penalties exceeded
    if (state.penalties > goal.maxPenalties) {
        return { won: false, message: 'Too many penalties! Challenge failed.' };
    }
    
    // Check goal type
    if (goal.type === 'LEGAL_PLAYS') {
        if (state.legalPlays >= goal.count) {
            return { 
                won: true, 
                message: `Success! You made ${state.legalPlays} legal plays with ${state.penalties} penalties.` 
            };
        }
    } else if (goal.type === 'EMPTY_HAND') {
        if (state.hand.length === 0) {
            return { 
                won: true, 
                message: `Success! You emptied your hand with ${state.penalties} penalties.` 
            };
        }
    }
    
    return null;
}

// ============================================================================
// UI RENDERING
// ============================================================================

function renderChallengeScreen() {
    const grid = document.getElementById('challenge-grid');
    grid.innerHTML = '';
    
    state.challenges.forEach((challenge, index) => {
        const tile = document.createElement('div');
        tile.className = `challenge-tile ${getLevelClass(challenge.level)}`;
        tile.setAttribute('data-challenge-id', challenge.id);
        
        tile.innerHTML = `
            <div class="challenge-number">${index + 1}</div>
        `;
        
        tile.addEventListener('click', () => startChallenge(challenge));
        grid.appendChild(tile);
    });
}

function getLevelClass(level) {
    return level === 1 ? 'easy' : level === 2 ? 'medium' : 'hard';
}

function getLevelName(level) {
    return level === 1 ? 'Easy' : level === 2 ? 'Medium' : 'Hard';
}

function renderPlayScreen() {
    // Update challenge info
    const challengeIndex = state.challenges.findIndex(c => c.id === state.currentChallenge.id);
    document.getElementById('challenge-number').textContent = challengeIndex + 1;
    
    // Update stats
    document.getElementById('legal-plays-count').textContent = state.legalPlays;
    document.getElementById('penalties-count').textContent = state.penalties;
    document.getElementById('hand-count').textContent = state.hand.length;
    
    // Render discard pile
    renderDiscardPile();
    
    // Render hand
    renderHand();
}

function getGoalDescription() {
    const goal = state.currentChallenge.goal;
    if (goal.type === 'LEGAL_PLAYS') {
        return `Make ${goal.count} legal plays (max ${goal.maxPenalties} penalties)`;
    } else if (goal.type === 'EMPTY_HAND') {
        return `Empty your hand (max ${goal.maxPenalties} penalties)`;
    }
    return '';
}

function renderDiscardPile() {
    const pileCard = document.getElementById('discard-pile-card');
    
    if (state.discardPile.length === 0) {
        pileCard.className = 'pile-card empty';
        pileCard.innerHTML = '<span>No cards yet</span>';
        return;
    }
    
    const topCard = state.discardPile[state.discardPile.length - 1];
    const color = getCardColor(topCard);
    
    pileCard.className = `pile-card ${color}`;
    pileCard.innerHTML = `
        <div class="rank">${topCard.rank}</div>
        <div class="suit">${topCard.suit}</div>
    `;
}

function renderHand() {
    const handElement = document.getElementById('hand');
    handElement.innerHTML = '';
    
    state.hand.forEach((card, index) => {
        const cardElement = document.createElement('div');
        const color = getCardColor(card);
        cardElement.className = `card ${color}`;
        
        cardElement.innerHTML = `
            <div class="rank">${card.rank}</div>
            <div class="suit">${card.suit}</div>
        `;
        
        cardElement.addEventListener('click', () => onCardClick(index));
        handElement.appendChild(cardElement);
    });
}

function showMessage(text, isError = false) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = 'message show ' + (isError ? 'error' : 'success');
    
    setTimeout(() => {
        messageEl.className = 'message';
    }, 2000);
}

function showWinModal(message) {
    const modal = document.getElementById('win-modal');
    document.getElementById('win-message').textContent = message;
    modal.className = 'modal show';
}

function hideWinModal() {
    const modal = document.getElementById('win-modal');
    modal.className = 'modal';
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function startChallenge(challenge) {
    initializeGame(challenge);
    switchToPlayScreen();
    renderPlayScreen();
}

function switchToPlayScreen() {
    document.getElementById('challenge-screen').classList.remove('active');
    document.getElementById('play-screen').classList.add('active');
}

function switchToChallengeScreen() {
    document.getElementById('play-screen').classList.remove('active');
    document.getElementById('challenge-screen').classList.add('active');
    hideWinModal();
}

function onCardClick(cardIndex) {
    const result = playCard(cardIndex);
    
    // Only show message for illegal plays
    if (!result.success) {
        showMessage(result.message, true);
    }
    
    renderPlayScreen();
    
    // Check win/loss condition
    const winCheck = checkWinCondition();
    if (winCheck) {
        if (winCheck.won) {
            setTimeout(() => showWinModal(winCheck.message), 500);
        } else {
            setTimeout(() => {
                showMessage(winCheck.message, true);
                setTimeout(() => switchToChallengeScreen(), 2000);
            }, 500);
        }
    }
}

function onDrawClick() {
    drawCard();
    renderPlayScreen();
}

function findNextChallenge() {
    const currentIndex = state.challenges.findIndex(c => c.id === state.currentChallenge.id);
    if (currentIndex >= 0 && currentIndex < state.challenges.length - 1) {
        return state.challenges[currentIndex + 1];
    }
    return null;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function loadChallenges() {
    try {
        const response = await fetch('challenges.json');
        state.challenges = await response.json();
        renderChallengeScreen();
    } catch (error) {
        console.error('Failed to load challenges:', error);
        document.getElementById('challenge-grid').innerHTML = 
            '<p style="color: white;">Failed to load challenges. Please refresh the page.</p>';
    }
}

function initializeEventListeners() {
    document.getElementById('back-btn').addEventListener('click', switchToChallengeScreen);
    document.getElementById('draw-btn').addEventListener('click', onDrawClick);
    
    document.getElementById('next-challenge-btn').addEventListener('click', () => {
        const nextChallenge = findNextChallenge();
        if (nextChallenge) {
            hideWinModal();
            startChallenge(nextChallenge);
        } else {
            switchToChallengeScreen();
        }
    });
    
    document.getElementById('back-to-menu-btn').addEventListener('click', switchToChallengeScreen);
    
    // Instructions button on challenge screen
    document.getElementById('instructions-btn').addEventListener('click', () => {
        document.getElementById('instructions-modal').classList.add('show');
    });
    
    // Instructions button on play screen
    document.getElementById('instructions-btn-play').addEventListener('click', () => {
        document.getElementById('instructions-modal').classList.add('show');
    });
    
    document.getElementById('close-instructions-btn').addEventListener('click', () => {
        document.getElementById('instructions-modal').classList.remove('show');
    });
    
    document.getElementById('instructions-modal').addEventListener('click', (e) => {
        if (e.target.id === 'instructions-modal') {
            document.getElementById('instructions-modal').classList.remove('show');
        }
    });
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadChallenges();
});
