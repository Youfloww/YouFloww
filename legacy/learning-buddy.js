// === Learning Buddy System - Center Overlay ===
class LearningBuddy {
    constructor() {
        this.isActive = false;
        this.isListening = true; // Start in listening mode
        this.eyeTrackingEnabled = true;
        this.tipsVisible = false;

        this.messages = [
            "Hi! I'm here to listen while you explain your concepts. Teaching is one of the best ways to learn! 🎓",
            "Go ahead, explain your topic to me. I'm all ears! 👂",
            "Tell me about what you're studying. Break it down step by step!",
            "I'm listening! Explain it like I'm a complete beginner.",
            "What's the most challenging part? Let's work through it together!",
            "Great! Now try explaining it in even simpler terms.",
            "Perfect! Keep going, you're doing amazing! 🌟",
            "I'm your learning companion. Share your knowledge with me!",
            "Don't worry if you get stuck - that's how we learn! 💪",
            "You're explaining this so well! I'm learning a lot from you! ✨"
        ];

        this.encouragements = [
            "You're doing fantastic! Keep explaining! 🌟",
            "I can see you really understand this! Great job! 👏",
            "Your explanations are getting clearer and clearer! 🚀",
            "This is exactly how learning works - you're nailing it! 💯",
            "I'm so proud of how you're breaking this down! 🎯",
            "You've got this! Your understanding is growing! 🌱",
            "Amazing work! Teaching really does help you learn! 📚",
            "Every expert was once a beginner. You're making real progress! 💪",
            "Your curiosity is your superpower. Keep questioning! ✨",
            "Mistakes are proof you're trying. That's courage! 🦁",
            "You're not just learning, you're transforming! 🦋",
            "Small steps every day lead to big achievements! 👣",
            "Your brain is literally creating new connections right now! 🧠",
            "The fact that it's challenging means you're growing! 🌳",
            "You're building skills that will last a lifetime! 🏗️",
            "Progress, not perfection. You're doing great! 📈",
            "Your dedication is inspiring! Keep that energy! ⚡",
            "Knowledge is power, and you're getting stronger! 💎",
            "Every moment studying is an investment in yourself! 💰",
            "You're capable of amazing things. Believe it! 🌈",
            "The struggle you're in today develops the strength you need tomorrow! 🏋️",
            "Your potential is limitless. Keep unlocking it! 🔓",
            "Learning is a journey, and you're moving forward! 🛤️",
            "You're not behind. You're exactly where you need to be! ⏰",
            "Your effort matters more than talent ever could! 💫",
            "Consistency beats intensity. You're showing up! 🎯",
            "You're writing your own success story right now! 📖",
            "The best time to start was yesterday. The next best is now! ⏳",
            "Your future self is thanking you for this effort! 🙏",
            "Difficult roads often lead to beautiful destinations! 🏔️",
            "You're stronger than you think, smarter than you know! 🦸",
            "Every challenge is an opportunity in disguise! 🎁",
            "You're not just studying, you're evolving! 🌟",
            "Your persistence is your greatest asset! 🔥",
            "Keep going! You're closer than you were yesterday! 🎖️",
            "Your hard work is building an unstoppable future! 🚂",
            "You learn something new every time you practice! 🎨",
            "Great things never come from comfort zones! 🌊",
            "You're creating the life you want, one study session at a time! 🏆",
            "Your determination is absolutely incredible! 💪",
            "Focus on progress, not perfection. You're doing both! 📊",
            "You're planting seeds today for tomorrow's harvest! 🌾",
            "The only limit is the one you set yourself. Dream bigger! 🎪",
            "You're proof that dedication pays off! 🏅",
            "Every minute counts, and you're making them matter! ⌚",
            "Your growth mindset is your ticket to success! 🎟️",
            "Champions are made when no one is watching. You're doing it! 🥇",
            "You're not wasting time, you're investing wisely! 💵",
            "The view from the top is worth the climb. Keep going! ⛰️",
            "Your commitment to learning is truly admirable! 👑",
            "You're building a better you, brick by brick! 🧱",
            "This effort will echo through your entire life! 📣",
            "You're exactly where you need to be in your journey! 🗺️",
            "Your persistence today creates your excellence tomorrow! 🌅",
            "Believe in yourself as much as I believe in you! 💝"
        ];

        this.tipsData = [
            { icon: "💬", title: "Explain Out Loud", text: "Pretend you're teaching a 5-year-old. Use simple words!" },
            { icon: "🔍", title: "Ask 'Why?'", text: "Question every step. Don't just memorize, understand the logic." },
            { icon: "🎨", title: "Use Analogies", text: "Connect new concepts to things you already know well." },
            { icon: "📝", title: "Break It Down", text: "Split complex topics into small, manageable chunks." },
            { icon: "🔁", title: "Spaced Repetition", text: "Review this topic again tomorrow, then in 3 days, then weekly." },
            { icon: "🧠", title: "Active Recall", text: "Close your notes and try to remember everything from memory." },
            { icon: "🦆", title: "Rubber Ducking", text: "Explain your code or problem line-by-line to a duck (or cat!)." },
            { icon: "✍️", title: "Write It Down", text: "Writing by hand helps your brain process and remember better." },
            { icon: "🎯", title: "Focus on Understanding", text: "Don't rush. It's better to deeply understand one thing than half-learn many." },
            { icon: "🔄", title: "Practice Retrieval", text: "Test yourself regularly without looking at notes. This strengthens memory." },
            { icon: "🗺️", title: "Mind Mapping", text: "Create visual diagrams connecting related ideas. Your brain loves visuals!" },
            { icon: "⏰", title: "Pomodoro Technique", text: "Study for 25 minutes, break for 5. Your focus will thank you!" },
            { icon: "📚", title: "Interleaving", text: "Mix different topics in one session. It improves problem-solving skills." },
            { icon: "💡", title: "Real-World Examples", text: "Find practical applications. How is this used in real life?" },
            { icon: "👥", title: "Teach Someone", text: "The best way to master something is to teach it to another person." },
            { icon: "🎵", title: "Use Mnemonics", text: "Create memorable acronyms, rhymes, or songs to remember lists." },
            { icon: "🚀", title: "Start with 'Why'", text: "Understand why this topic matters before diving into the details." },
            { icon: "🔬", title: "Experiment & Explore", text: "Don't just read—try it yourself! Hands-on learning sticks better." }
        ];

        this.init();
    }

    init() {
        this.bindEvents();
        this.startEyeTracking();
        this.showInitialMessage();
    }

    bindEvents() {
        // Learning Buddy Overlay Toggle
        const learningBtn = document.getElementById('learningTechniquesBtn');
        const overlay = document.getElementById('learningBuddyOverlay');
        const closeBtn = document.getElementById('closeLearningBuddy');

        // Tips Popup Elements
        const tipsOverlay = document.getElementById('tipsPopupOverlay');
        const closeTipsBtn = document.getElementById('closeTipsPopup');

        learningBtn?.addEventListener('click', () => this.openBuddy());
        closeBtn?.addEventListener('click', () => this.closeBuddy());

        closeTipsBtn?.addEventListener('click', () => this.closeTipsPopup());
        tipsOverlay?.addEventListener('click', (e) => {
            if (e.target === tipsOverlay) this.closeTipsPopup();
        });

        // Close on overlay background click
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeBuddy();
            }
        });

        // Buddy Controls
        const listenBtn = document.getElementById('buddyListenBtn');
        const tipsBtn = document.getElementById('buddyTipsBtn');
        const encourageBtn = document.getElementById('buddyEncourageBtn');

        listenBtn?.addEventListener('click', () => this.toggleListening());
        tipsBtn?.addEventListener('click', () => this.toggleTips());
        encourageBtn?.addEventListener('click', () => this.showEncouragement());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !overlay?.classList.contains('hidden')) {
                this.closeBuddy();
            }
        });

        // Focus Mode Integration
        this.integrateFocusMode();

        // Play with Me button - triggers fast cat rotation with sound
        const playBtn = document.getElementById('buddyPlayWithMeBtn');
        const catSound = new Audio('assets/sounds/catsound.mp3');
        catSound.loop = true;

        playBtn?.addEventListener('click', () => {
            const buddy3D = document.getElementById('buddy3D');
            if (!buddy3D) return;

            const isSpinning = buddy3D.hasAttribute('auto-rotate');

            if (isSpinning) {
                // Stop spinning completely and stop sound
                buddy3D.removeAttribute('auto-rotate');
                buddy3D.removeAttribute('rotation-per-second');
                buddy3D.removeAttribute('auto-rotate-delay');
                catSound.pause();
                catSound.currentTime = 0;
                playBtn.textContent = '🎮 Play with Me!';
            } else {
                // Start spinning SUPER FAST - INSTANT start, even faster!
                buddy3D.setAttribute('auto-rotate', '');
                buddy3D.setAttribute('auto-rotate-delay', '0'); // INSTANT rotation start
                buddy3D.setAttribute('rotation-per-second', '3600deg'); // DOUBLE the speed - extremely fast!
                catSound.play().catch(e => console.log('Audio play failed:', e));
                playBtn.textContent = '⏸️ Stop Playing';
            }
        });
    }

    openBuddy() {
        const overlay = document.getElementById('learningBuddyOverlay');
        overlay?.classList.remove('hidden');
        this.isActive = true;

        // Start buddy animations
        this.startBuddyAnimations();

        // Show initial message
        setTimeout(() => {
            this.showMessage(this.messages[0]);
        }, 300);

        // Start mouth talking animation
        setTimeout(() => {
            const mouth = document.querySelector('.buddy-mouth');
            mouth?.classList.add('talking');
            setTimeout(() => mouth?.classList.remove('talking'), 3000);
        }, 500);
    }

    closeBuddy() {
        const overlay = document.getElementById('learningBuddyOverlay');
        overlay?.classList.add('hidden');
        this.isActive = false;
        this.tipsVisible = false;

        // Hide tips panel
        const tipsPanel = document.getElementById('buddyTipsPanel');
        tipsPanel?.classList.add('hidden');

        // Stop buddy animations
        this.stopBuddyAnimations();
    }

    toggleListening() {
        this.isListening = !this.isListening;
        const listenBtn = document.getElementById('buddyListenBtn');
        const mouth = document.querySelector('.buddy-mouth');

        if (this.isListening) {
            listenBtn?.classList.add('listening');
            listenBtn.querySelector('span').textContent = "I'm Listening!";
            listenBtn.querySelector('i').className = 'fas fa-ear-listen';
            mouth?.classList.add('talking');
            this.showRandomMessage();
        } else {
            listenBtn?.classList.remove('listening');
            listenBtn.querySelector('span').textContent = 'Start Listening';
            listenBtn.querySelector('i').className = 'fas fa-play';
            mouth?.classList.remove('talking');
            this.showMessage("Click 'I'm Listening!' when you're ready to explain! 🚀");
        }
    }

    toggleTips() {
        this.tipsVisible = !this.tipsVisible;
        const tipsBtn = document.getElementById('buddyTipsBtn');

        if (this.tipsVisible) {
            this.openTipsPopup();
            tipsBtn?.classList.add('active');
            this.showMessage("Check out these learning techniques! Tap the cards! 🃏");
        } else {
            this.closeTipsPopup();
            tipsBtn?.classList.remove('active');
        }
    }

    openTipsPopup() {
        const overlay = document.getElementById('tipsPopupOverlay');
        overlay?.classList.remove('hidden');
        // Small delay to allow display:flex to apply before opacity transition
        setTimeout(() => overlay?.classList.add('visible'), 10);
        this.renderTipsCards();
    }

    closeTipsPopup() {
        const overlay = document.getElementById('tipsPopupOverlay');
        overlay?.classList.remove('visible');
        setTimeout(() => overlay?.classList.add('hidden'), 400);
        this.tipsVisible = false;
        document.getElementById('buddyTipsBtn')?.classList.remove('active');
    }

    renderTipsCards() {
        const stack = document.getElementById('tipsCardStack');
        if (!stack) return;

        stack.innerHTML = '';

        // Reverse order so first item is on top (z-index)
        [...this.tipsData].reverse().forEach((tip, index) => {
            const card = document.createElement('div');
            card.className = 'tip-card';
            card.style.zIndex = index;
            // Slight random rotation for messy stack effect
            const rotation = (Math.random() - 0.5) * 6;
            card.style.transform = `rotate(${rotation}deg)`;

            card.innerHTML = `
                <div class="tip-icon">${tip.icon}</div>
                <h4>${tip.title}</h4>
                <p>${tip.text}</p>
            `;

            // Click to swipe
            card.addEventListener('click', () => this.handleCardSwipe(card));

            stack.appendChild(card);
        });
    }

    handleCardSwipe(card) {
        card.classList.add('swiped');

        // If it's the last card (visually bottom, but first in DOM due to reverse), reset stack
        const remainingCards = document.querySelectorAll('.tip-card:not(.swiped)');
        if (remainingCards.length === 0) {
            setTimeout(() => {
                this.renderTipsCards();
            }, 600);
        }
    }

    preventBackgroundScroll(prevent) {
        const tipsPanel = document.getElementById('buddyTipsPanel');

        if (prevent && tipsPanel) {
            // Add event listeners to prevent scrolling on the tips panel
            tipsPanel.addEventListener('wheel', this.handleTipsPanelScroll, { passive: false });
            tipsPanel.addEventListener('touchmove', this.handleTipsPanelScroll, { passive: false });
        } else if (tipsPanel) {
            // Remove event listeners
            tipsPanel.removeEventListener('wheel', this.handleTipsPanelScroll);
            tipsPanel.removeEventListener('touchmove', this.handleTipsPanelScroll);
        }
    }

    handleTipsPanelScroll(e) {
        const tipsPanel = document.getElementById('buddyTipsPanel');
        if (!tipsPanel) return;

        const { scrollTop, scrollHeight, clientHeight } = tipsPanel;
        const isScrollingUp = e.deltaY < 0;
        const isScrollingDown = e.deltaY > 0;

        // Allow scrolling within the tips panel
        if ((isScrollingUp && scrollTop === 0) ||
            (isScrollingDown && scrollTop + clientHeight >= scrollHeight)) {
            // Prevent background scroll when at the edges
            e.preventDefault();
            e.stopPropagation();
        }
    }

    showEncouragement() {
        const randomEncouragement = this.encouragements[Math.floor(Math.random() * this.encouragements.length)];
        this.showMessage(randomEncouragement);

        // Add visual feedback
        const encourageBtn = document.getElementById('buddyEncourageBtn');
        encourageBtn?.classList.add('encouraging');
        setTimeout(() => encourageBtn?.classList.remove('encouraging'), 2000);

        // Animate mouth
        const mouth = document.querySelector('.buddy-mouth');
        mouth?.classList.add('talking');
        setTimeout(() => mouth?.classList.remove('talking'), 2500);
    }

    resetBot() {
        const bot = document.getElementById('learningBot');
        bot?.classList.remove('listening');

        const activateBtn = document.getElementById('activateBotBtn');
        activateBtn?.classList.remove('active');
        activateBtn.querySelector('span').textContent = 'Start Listening';
        activateBtn.querySelector('i').className = 'fas fa-play';

        this.isListening = false;
        this.showInitialMessage();

        // Reset technique cards
        document.querySelectorAll('.technique-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector('.technique-card[data-technique=\"explain\"]')?.classList.add('active');
    }

    selectTechnique(card) {
        // Remove active class from all cards
        document.querySelectorAll('.technique-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const technique = card.dataset.technique;
        this.showTechniqueMessage(technique);
    }

    showTechniqueMessage(technique) {
        const messages = {
            'explain': "Perfect! Start explaining your concept out loud. I'll listen attentively! 👂",
            'feynman': "Great choice! Break it down into the simplest terms possible. Pretend I know nothing about it!",
            'rubber-duck': "Excellent! Walk me through your problem step by step. Don't skip any details!",
            'active-recall': "Nice! Close your notes and try to explain everything from memory. I'll be your audience!"
        };

        this.showMessage(messages[technique] || messages['explain']);
    }

    showInitialMessage() {
        this.showMessage(this.messages[0]);
    }

    showRandomMessage() {
        const randomMessage = this.messages[Math.floor(Math.random() * this.messages.length)];
        this.showMessage(randomMessage);
    }

    showMessage(message) {
        const bubble = document.getElementById('buddySpeechBubble');
        const messageEl = document.getElementById('buddyMessage');

        if (bubble && messageEl) {
            messageEl.textContent = message;

            // Animate bubble appearance
            bubble.style.animation = 'bubbleAppear 0.5s ease-out';

            // Auto-hide after 4 seconds
            setTimeout(() => {
                bubble.style.opacity = '0.7';
            }, 4000);

            // Reset opacity after a while
            setTimeout(() => {
                bubble.style.opacity = '1';
            }, 8000);
        }
    }

    startBuddyAnimations() {
        if (!this.isActive) return;

        // Start eye tracking immediately
        this.startEyeTracking();

        // Random encouraging messages
        this.messageInterval = setInterval(() => {
            if (!this.isActive || !this.isListening) return;

            // 30% chance to show a random encouraging message
            if (Math.random() < 0.3) {
                this.showRandomMessage();

                // Animate mouth
                const mouth = document.querySelector('.buddy-mouth');
                mouth?.classList.add('talking');
                setTimeout(() => mouth?.classList.remove('talking'), 2000);
            }
        }, 8000 + Math.random() * 7000); // Every 8-15 seconds
    }

    stopBuddyAnimations() {
        clearInterval(this.messageInterval);
    }

    randomHeadMovement() {
        const bot = document.getElementById('learningBot');
        if (!bot) return;

        const movements = [
            'translateY(-1px) rotate(0.5deg)',
            'translateY(-2px) rotate(-0.3deg)',
            'translateY(0px) rotate(0.2deg)',
            'translateY(-1px) rotate(-0.4deg)'
        ];

        const randomMovement = movements[Math.floor(Math.random() * movements.length)];
        bot.style.transform = randomMovement;

        setTimeout(() => {
            bot.style.transform = '';
        }, 500);
    }

    randomEyeMovement() {
        const pupils = document.querySelectorAll('.bot-pupil');
        pupils.forEach(pupil => {
            const maxMove = 3;
            const x = (Math.random() - 0.5) * maxMove;
            const y = (Math.random() - 0.5) * maxMove;

            pupil.style.transform = `translate(${x}px, ${y}px)`;

            setTimeout(() => {
                pupil.style.transform = '';
            }, 1000);
        });
    }

    startEyeTracking() {
        // Eye tracking disabled for 3D model viewer
        /*
        const overlay = document.getElementById('learningBuddyOverlay');
        if (!overlay) return;
        
        overlay.addEventListener('mousemove', (e) => {
            if (!this.eyeTrackingEnabled || !this.isActive) return;
            
            const character = document.querySelector('.learning-cat-container');
            if (!character) return;
            
            const rect = character.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2 - 60; // Adjust for cat head position
            
            const mouseX = e.clientX;
            const mouseY = e.clientY;
            
            const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
            const distance = Math.min(3, Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2)) / 100);
            
            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;
            
            // Update cat pupils (slit-shaped)
            const leftPupil = document.querySelector('.left-pupil');
            const rightPupil = document.querySelector('.right-pupil');
            
            if (leftPupil && rightPupil) {
                leftPupil.setAttribute('cx', 145 + moveX);
                leftPupil.setAttribute('cy', 125 + moveY);
                rightPupil.setAttribute('cx', 175 + moveX);
                rightPupil.setAttribute('cy', 125 + moveY);
            }
        });
        
        overlay.addEventListener('mouseleave', () => {
            // Reset cat pupils to center
            const leftPupil = document.querySelector('.left-pupil');
            const rightPupil = document.querySelector('.right-pupil');
            
            if (leftPupil && rightPupil) {
                leftPupil.setAttribute('cx', 145);
                leftPupil.setAttribute('cy', 125);
                rightPupil.setAttribute('cx', 175);
                rightPupil.setAttribute('cy', 125);
            }
        });
        */
    }

    integrateFocusMode() {
        // Hide learning button when focus mode is active
        const focusModeBtn = document.getElementById('focusModeBtn');
        const learningBtn = document.getElementById('learningTechniquesBtn');

        focusModeBtn?.addEventListener('click', () => {
            setTimeout(() => {
                if (document.body.classList.contains('focus-mode-active')) {
                    // Hide learning button in focus mode
                    learningBtn?.style.setProperty('opacity', '0');
                    learningBtn?.style.setProperty('pointer-events', 'none');
                    learningBtn?.style.setProperty('transform', 'translateY(-10px)');

                    // Close buddy if open
                    this.closeBuddy();
                } else {
                    // Show learning button when focus mode ends
                    learningBtn?.style.setProperty('opacity', '1');
                    learningBtn?.style.setProperty('pointer-events', 'all');
                    learningBtn?.style.setProperty('transform', 'translateY(0)');
                }
            }, 100);
        });

        // Also handle focus mode exit button
        const focusModeExitBtn = document.getElementById('focusModeExitBtn');
        focusModeExitBtn?.addEventListener('click', () => {
            setTimeout(() => {
                learningBtn?.style.setProperty('opacity', '1');
                learningBtn?.style.setProperty('pointer-events', 'all');
                learningBtn?.style.setProperty('transform', 'translateY(0)');
            }, 100);
        });
    }
}

// Initialize Learning Buddy when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.learningBuddy = new LearningBuddy();
});

// Also try after window load in case DOM is already ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.learningBuddy) {
            window.learningBuddy = new LearningBuddy();
        }
    });
} else {
    if (!window.learningBuddy) {
        window.learningBuddy = new LearningBuddy();
    }
}
