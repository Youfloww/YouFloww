// ============ Achievement System ============
class AchievementSystem {
    constructor() {
        this.achievements = this.defineAchievements();
        this.userAchievements = this.loadUserAchievements();
        this.notificationQueue = [];
    }

    defineAchievements() {
        return {
            // Streak Achievements
            'first_streak': {
                id: 'first_streak',
                name: 'Getting Started',
                description: 'Complete your first focus session',
                icon: '🌱',
                category: 'streak',
                condition: (stats) => stats.totalSessions >= 1,
                rarity: 'common'
            },
            'week_warrior': {
                id: 'week_warrior',
                name: 'Week Warrior',
                description: 'Maintain a 7-day focus streak',
                icon: '⚡',
                category: 'streak',
                condition: (stats) => stats.currentStreak >= 7,
                rarity: 'uncommon'
            },
            'month_master': {
                id: 'month_master',
                name: 'Month Master',
                description: 'Maintain a 30-day focus streak',
                icon: '🏆',
                category: 'streak',
                condition: (stats) => stats.currentStreak >= 30,
                rarity: 'rare'
            },
            'century_club': {
                id: 'century_club',
                name: 'Century Club',
                description: 'Maintain a 100-day focus streak',
                icon: '💎',
                category: 'streak',
                condition: (stats) => stats.currentStreak >= 100,
                rarity: 'legendary'
            },

            // Time-based Achievements
            'hour_hero': {
                id: 'hour_hero',
                name: 'Hour Hero',
                description: 'Complete 10 hours of total focus time',
                icon: '⏰',
                category: 'time',
                condition: (stats) => stats.totalFocusMinutes >= 600,
                rarity: 'common'
            },
            'focus_fanatic': {
                id: 'focus_fanatic',
                name: 'Focus Fanatic',
                description: 'Complete 100 hours of total focus time',
                icon: '🎯',
                category: 'time',
                condition: (stats) => stats.totalFocusMinutes >= 6000,
                rarity: 'rare'
            },
            'zen_master': {
                id: 'zen_master',
                name: 'Zen Master',
                description: 'Complete 500 hours of total focus time',
                icon: '🧘‍♂️',
                category: 'time',
                condition: (stats) => stats.totalFocusMinutes >= 30000,
                rarity: 'legendary'
            },

            // Consistency Achievements
            'early_bird': {
                id: 'early_bird',
                name: 'Early Bird',
                description: 'Start 10 focus sessions before 8 AM',
                icon: '🐦',
                category: 'consistency',
                condition: (stats) => stats.earlyMorningSessions >= 10,
                rarity: 'uncommon'
            },
            'night_owl': {
                id: 'night_owl',
                name: 'Night Owl',
                description: 'Complete 10 focus sessions after 10 PM',
                icon: '🦉',
                category: 'consistency',
                condition: (stats) => stats.lateNightSessions >= 10,
                rarity: 'uncommon'
            },
            'weekend_warrior': {
                id: 'weekend_warrior',
                name: 'Weekend Warrior',
                description: 'Complete focus sessions on 5 consecutive weekends',
                icon: '⚔️',
                category: 'consistency',
                condition: (stats) => stats.consecutiveWeekends >= 5,
                rarity: 'rare'
            },

            // Session Achievements
            'marathon_runner': {
                id: 'marathon_runner',
                name: 'Marathon Runner',
                description: 'Complete a 4-hour focus session',
                icon: '🏃‍♂️',
                category: 'session',
                condition: (stats) => stats.longestSession >= 240,
                rarity: 'rare'
            },
            'speed_demon': {
                id: 'speed_demon',
                name: 'Speed Demon',
                description: 'Complete 10 sessions in one day',
                icon: '💨',
                category: 'session',
                condition: (stats) => stats.maxSessionsPerDay >= 10,
                rarity: 'uncommon'
            },

            // Special Achievements
            'multitasker': {
                id: 'multitasker',
                name: 'Multitasker',
                description: 'Complete sessions for 20 different tasks',
                icon: '🎨',
                category: 'special',
                condition: (stats) => stats.uniqueTasks >= 20,
                rarity: 'uncommon'
            },
            'perfectionist': {
                id: 'perfectionist',
                name: 'Perfectionist',
                description: 'Complete 50 sessions without skipping breaks',
                icon: '✨',
                category: 'special',
                condition: (stats) => stats.perfectSessions >= 50,
                rarity: 'rare'
            }
        };
    }

    loadUserAchievements() {
        const saved = localStorage.getItem('youfloww_achievements');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Convert earned/claimed arrays back to Sets if they were serialized as arrays
            if (Array.isArray(parsed.earned)) {
                parsed.earned = new Set(parsed.earned);
            } else if (!(parsed.earned instanceof Set)) {
                parsed.earned = new Set();
            }
            if (Array.isArray(parsed.claimed)) {
                parsed.claimed = new Set(parsed.claimed);
            } else if (!(parsed.claimed instanceof Set)) {
                parsed.claimed = new Set();
            }
            return parsed;
        }
        return {
            earned: new Set(),
            claimed: new Set(),
            progress: {},
            lastChecked: Date.now()
        };
    }

    saveUserAchievements() {
        const toSave = {
            earned: Array.from(this.userAchievements.earned),
            claimed: Array.from(this.userAchievements.claimed || []),
            progress: this.userAchievements.progress,
            lastChecked: this.userAchievements.lastChecked
        };
        localStorage.setItem('youfloww_achievements', JSON.stringify(toSave));
        this.updateNewIndicator();
    }

    checkAchievements(userStats) {
        // Only track achievements for authenticated users, not guests
        if (typeof isGuestMode !== 'undefined' && isGuestMode) {
            console.log('\ud83d\udcad Guest mode - achievements not tracked');
            return [];
        }
        
        const newAchievements = [];
        
        Object.values(this.achievements).forEach(achievement => {
            if (!this.userAchievements.earned.has(achievement.id)) {
                if (achievement.condition(userStats)) {
                    this.userAchievements.earned.add(achievement.id);
                    // Do NOT auto-claim. Keep it pending so user can claim in the panel.
                    newAchievements.push(achievement);
                    console.log('\ud83c\udfc6 New achievement earned:', achievement.name);
                }
            }
        });

        if (newAchievements.length > 0) {
            this.saveUserAchievements();
            // Optional: show modal notifications when newly earned
            this.showAchievementNotifications(newAchievements);
        }

        return newAchievements;
    }

    showAchievementNotifications(achievements) {
        achievements.forEach((achievement, index) => {
            setTimeout(() => {
                this.showAchievementModal(achievement);
            }, index * 2000); // Stagger notifications
        });
    }

    showAchievementModal(achievement) {
        const modal = document.createElement('div');
        modal.className = 'achievement-modal';
        modal.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-header">
                    <span class="achievement-icon">${achievement.icon}</span>
                    <button class="achievement-close">&times;</button>
                </div>
                <div class="achievement-body">
                    <div class="achievement-rarity ${achievement.rarity}">${achievement.rarity.toUpperCase()}</div>
                    <h3 class="achievement-name">${achievement.name}</h3>
                    <p class="achievement-description">${achievement.description}</p>
                </div>
                <div class="achievement-footer">
                    <button class="achievement-dismiss">Continue</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.achievement-close').onclick = () => modal.remove();
        modal.querySelector('.achievement-dismiss').onclick = () => modal.remove();

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (document.body.contains(modal)) {
                modal.remove();
            }
        }, 10000);

        // Add celebration effect
        this.triggerCelebration();
        this.updateNewIndicator();
    }


    triggerCelebration(opts = {}) {
        // Create confetti effect
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#8e44ad', '#2ecc71'];
        const count = opts.heavy ? 140 : 50;
        const stagger = opts.heavy ? 25 : 50;
        
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDelay = Math.random() * 1.5 + 's';
                confetti.style.width = (Math.random()*6 + 6) + 'px';
                confetti.style.height = (Math.random()*6 + 6) + 'px';
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 3200);
            }, i * stagger);
        }
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    getEarnedAchievements() {
        return Array.from(this.userAchievements.earned).map(id => this.achievements[id]);
    }

    getUnclaimedAchievements() {
        const earned = this.userAchievements.earned || new Set();
        const claimed = this.userAchievements.claimed || new Set();
        const unclaimed = [];
        earned.forEach(id => {
            if (!claimed.has(id) && this.achievements[id]) unclaimed.push(this.achievements[id]);
        });
        return unclaimed;
    }

    updateNewIndicator() {
        try {
            const indicator = document.getElementById('newAchievementBadge');
            if (!indicator) return;
            const hasUnclaimed = this.getUnclaimedAchievements().length > 0;
            indicator.classList.toggle('hidden', !hasUnclaimed);
        } catch {}
    }

    getAchievementProgress(userStats) {
        const progress = {};
        
        Object.values(this.achievements).forEach(achievement => {
            if (!this.userAchievements.earned.has(achievement.id)) {
                // Calculate progress towards achievement
                progress[achievement.id] = this.calculateProgress(achievement, userStats);
            }
        });
        
        return progress;
    }

    calculateProgress(achievement, stats) {
        // This is simplified - you'd want more sophisticated progress calculation
        if (achievement.category === 'streak') {
            const target = achievement.id === 'week_warrior' ? 7 :
                          achievement.id === 'month_master' ? 30 :
                          achievement.id === 'century_club' ? 100 : 1;
            return Math.min(100, (stats.currentStreak / target) * 100);
        }
        
        if (achievement.category === 'time') {
            const target = achievement.id === 'hour_hero' ? 600 :
                          achievement.id === 'focus_fanatic' ? 6000 :
                          achievement.id === 'zen_master' ? 30000 : 1;
            return Math.min(100, (stats.totalFocusMinutes / target) * 100);
        }
        
        return 0;
    }

    showAchievementsPanel() {
        // Check if user is in guest mode - guests shouldn't see achievements panel
        if (typeof isGuestMode !== 'undefined' && isGuestMode) {
            console.log('\ud83d\udeab Guest users cannot view badges - sign in required');
            // Show sign-in prompt instead
            if (typeof showLoginPrompt === 'function') {
                showLoginPrompt('Badges');
            }
            return;
        }
        
        const panel = document.createElement('div');
        panel.className = 'achievements-panel modal visible';
        
        const earned = this.getEarnedAchievements();
        const totalAchievements = Object.keys(this.achievements).length;
        const unclaimed = this.getUnclaimedAchievements();
        
        panel.innerHTML = `
            <div class="modal-content achievements-container">
                <div class="achievements-header">
                    <h2>🏆 Badges</h2>
                    <span class="achievement-counter">${earned.length}/${totalAchievements}</span>
                    <span class="close-btn">&times;</span>
                </div>
                ${unclaimed.length > 0 ? `
                <div class="achievements-claim-banner">
                    <div class="claim-text">${unclaimed.length} badge${unclaimed.length>1?'s':''} ready to claim!</div>
                    <button class="claim-all-btn">Claim All</button>
                </div>` : ''}
                <div class="achievements-grid">
                    ${this.renderAchievementGrid()}
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        panel.querySelector('.close-btn').onclick = () => panel.remove();
        
        // Claim single
        panel.querySelectorAll('.claim-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.claimAchievement(id, panel);
            });
        });
        // Claim all
        const claimAllBtn = panel.querySelector('.claim-all-btn');
        if (claimAllBtn) {
            claimAllBtn.addEventListener('click', () => {
                this.getUnclaimedAchievements().forEach(a => this.claimAchievement(a.id, panel, {silent:false}));
            });
        }

        // Fireworks if there are things to claim
        if (unclaimed.length > 0) {
            this.triggerCelebration({heavy:true});
        }
        
        return panel;
    }

    renderAchievementGrid() {
        return Object.values(this.achievements).map(achievement => {
            const isEarned = this.userAchievements.earned.has(achievement.id);
            const isClaimed = this.userAchievements.claimed && this.userAchievements.claimed.has(achievement.id);
            const isClaimable = isEarned && !isClaimed;
            const progress = isEarned ? 100 : 0; // Simplified progress
            
            return `
                <div class="achievement-card ${isClaimable ? 'claimable' : (isEarned ? 'earned' : 'locked')} ${achievement.rarity}" data-id="${achievement.id}">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <div class="achievement-info">
                        <h4>${achievement.name}</h4>
                        <p>${achievement.description}</p>
                        <div class="achievement-rarity-badge">${achievement.rarity}</div>
                        ${!isEarned ? `<div class="achievement-progress-bar"><div class="achievement-progress" style="width: ${progress}%"></div></div>` : ''}
                        ${isClaimable ? `<button class="claim-btn" data-id="${achievement.id}">Claim</button>` : ''}
                        ${isEarned && isClaimed ? `<div class="claimed-badge">Claimed ✔</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    claimAchievement(id, panelRef = null, opts = {}) {
        if (!this.userAchievements.earned.has(id)) return;
        this.userAchievements.claimed = this.userAchievements.claimed || new Set();
        if (this.userAchievements.claimed.has(id)) return;
        this.userAchievements.claimed.add(id);
        this.saveUserAchievements();
        // Visual celebration
        this.triggerCelebration(opts.heavy ? {heavy:true} : undefined);
        this.showToast('Badge claimed!');
        // Refresh grid UI if panel is open
        if (panelRef) {
            const grid = panelRef.querySelector('.achievements-grid');
            if (grid) grid.innerHTML = this.renderAchievementGrid();
            // Rebind claim buttons
            panelRef.querySelectorAll('.claim-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const bid = e.currentTarget.dataset.id;
                    this.claimAchievement(bid, panelRef);
                });
            });
            // Hide banner and indicator if nothing to claim
            const unclaimed = this.getUnclaimedAchievements();
            const banner = panelRef.querySelector('.achievements-claim-banner');
            if (banner) banner.style.display = unclaimed.length > 0 ? '' : 'none';
        }
    }
}

// Initialize achievement system
const achievementSystem = new AchievementSystem();

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AchievementSystem;
}
