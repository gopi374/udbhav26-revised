/**
 * UDBHAV'26 Dashboard Core Logic
 */

const Dashboard = {
    teamId: null,
    targetDate: new Date("2026-04-25T10:45:00"),
    psReleased: false,

    // Timeline Stages Data
    timelineStages: [
        { time: "8:00–9:30 AM", title: "Doors Open", description: "Check-in & On-boarding", timestamp: "2026-04-25T08:00:00" },
        { time: "10:00 AM", title: "Kickoff", description: "Orientation Session", timestamp: "2026-04-25T10:00:00" },
        { time: "10:45 AM", title: "PS Drop", description: "Problem Statement Live — Teams Choose PS", timestamp: "2026-04-25T10:45:00" },
        { time: "11:00 AM–1:00 PM", title: "Build Sprint 1", description: "Hacking Begins — Thinking & Planning Phase (2H)", timestamp: "2026-04-25T11:00:00" },
        { time: "1:00–2:00 PM", title: "Lunch Break", description: "Meal Break", timestamp: "2026-04-25T13:00:00" },
        { time: "2:00–5:00 PM", title: "Build Sprint 2", description: "Deep Work Mode (3H)", timestamp: "2026-04-25T14:00:00" },
        { time: "5:00–6:00 PM", title: "Strategy Pivot", description: "Mentor Interaction + Snacks & Activity", timestamp: "2026-04-25T17:00:00" },
        { time: "6:00–8:00 PM", title: "Build Sprint 3", description: "Grind Mode (2H)", timestamp: "2026-04-25T18:00:00" },
        { time: "8:00 PM", title: "Power Dinner", description: "Dinner Break", timestamp: "2026-04-25T20:00:00" },
        { time: "9:00 PM–2:00 AM", title: "Build Sprint 4", description: "Midnight Push (5H) + Optional Midnight Snack", timestamp: "2026-04-25T21:00:00" },
        { time: "2:00 AM", title: "Demo Pitch", description: "Pitch Round + GitHub Submission Deadline", timestamp: "2026-04-26T02:00:00" },
        { time: "3:00–7:00 AM", title: "Final Sprint", description: "Last Stand — Final Build Phase (4H)", timestamp: "2026-04-26T03:00:00" },
        { time: "7:00–8:00 AM", title: "Final Pitch", description: "GitHub + Deck + Live Link Submission", timestamp: "2026-04-26T07:00:00" },
        { time: "8:00 AM", title: "Breakfast", description: "Recharge Before the Verdict", timestamp: "2026-04-26T08:00:00" },
        { time: "8:30 AM", title: "Results Drop", description: "Results Announced — Eliminated Teams Dismissed", timestamp: "2026-04-26T08:30:00" },
        { time: "9:00–10:00 AM", title: "Grand Presentation", description: "Final PPT Presentation Round", timestamp: "2026-04-26T09:00:00" },
        { time: "10:30–11:00 AM", title: "Closing Ceremony", description: "Prize Distribution & Grand Finale", timestamp: "2026-04-26T10:30:00" },
    ],

    init() {
        this.checkAuth();
        this.renderTimeline(); // Dynamic rendering based on data
        this.setupEventListeners();
        this.startTimers();
        this.initializeIcons();
    },

    initializeIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    checkAuth() {
        const savedTeamId = localStorage.getItem("udbhav_team_id");
        if (savedTeamId) {
            this.login(savedTeamId);
        } else {
            this.showView('login-view');
        }
    },

    login(id) {
        this.teamId = id;
        localStorage.setItem("udbhav_team_id", id);

        document.querySelectorAll('.display-team-id').forEach(el => el.textContent = id);
        this.showView('dashboard-view');
        this.fetchStats(id);
    },

    logout() {
        this.teamId = null;
        localStorage.removeItem("udbhav_team_id");
        this.showView('login-view');
    },

    showView(viewId) {
        document.querySelectorAll('[data-view]').forEach(view => {
            if (view.id === viewId) {
                view.classList.remove('hidden');
                view.style.opacity = '1';
            } else {
                view.classList.add('hidden');
            }
        });
    },

    renderTimeline() {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        container.innerHTML = `
            <div class="absolute left-[13px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/50 via-white/10 to-transparent"></div>
        `;

        this.timelineStages.forEach((stage, idx) => {
            const stageEl = document.createElement('div');
            stageEl.className = 'timeline-stage flex gap-4 relative';
            stageEl.setAttribute('data-timestamp', stage.timestamp);
            stageEl.innerHTML = `
                <div class="timeline-icon relative z-10 flex items-start pt-0.5 justify-center bg-background shrink-0">
                    <i data-lucide="circle" class="w-[26px] h-[26px] text-white/20 bg-background rounded-full"></i>
                </div>
                <div class="timeline-content flex-1 pb-4">
                    <div class="flex items-center justify-between mb-1">
                        <span class="stage-time text-[10px] font-bold tracking-widest text-white/30">${stage.time}</span>
                        <span class="status-live text-[9px] font-black text-primary animate-pulse hidden uppercase">Live</span>
                    </div>
                    <h4 class="text-sm font-bold text-white">${stage.title}</h4>
                    <p class="text-xs mt-1 leading-relaxed text-white/60">${stage.description}</p>
                </div>
            `;
            container.appendChild(stageEl);
        });
        this.initializeIcons();
    },

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const idInput = document.getElementById('teamId-input');
                if (idInput.value.trim()) this.login(idInput.value.trim());
            });
        }

        document.querySelectorAll('.btn-logout').forEach(btn => {
            btn.addEventListener('click', () => this.logout());
        });

        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => this.openModal(btn.getAttribute('data-action')));
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeActiveModal());
        });

        // Submission Form
        const subForm = document.getElementById('submission-form');
        if (subForm) {
            subForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                this.handleSubmit(subForm);
            });
        }
    },

    startTimers() {
        this.updateCountdown();
        setInterval(() => this.updateCountdown(), 1000);

        this.updateTimeline();
        setInterval(() => this.updateTimeline(), 60000);
    },

    updateCountdown() {
        const now = new Date().getTime();
        const distance = this.targetDate.getTime() - now;
        const countdownEl = document.getElementById('deployment-countdown');
        const releasedEl = document.getElementById('ps-released-info');

        if (distance <= 0) {
            if (countdownEl) countdownEl.classList.add('hidden');
            if (releasedEl) releasedEl.classList.remove('hidden');
            if (!this.psReleased) {
                this.psReleased = true;
                this.decryptPS();
            }
            return;
        }

        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val.toString().padStart(2, '0');
        };

        setVal('cd-hours', hours);
        setVal('cd-minutes', minutes);
        setVal('cd-seconds', seconds);
    },

    decryptPS() {
        const d = document.getElementById('ps-decrypting');
        const c = document.getElementById('ps-content');
        if (d && c) {
            d.classList.remove('hidden');
            c.classList.add('hidden');
            setTimeout(() => {
                d.classList.add('hidden');
                c.classList.remove('hidden');
            }, 2000);
        }
    },

    updateTimeline() {
        const now = new Date().getTime();
        const stages = document.querySelectorAll('.timeline-stage');
        let nextStageFound = false;

        // 1. Sync Timeline Stages
        stages.forEach((stage, idx) => {
            const timestamp = stage.getAttribute('data-timestamp');
            const stageTime = new Date(timestamp).getTime();
            const nextStage = stages[idx + 1];
            const nextStageTime = nextStage ? new Date(nextStage.getAttribute('data-timestamp')).getTime() : Infinity;

            const iconI = stage.querySelector('.timeline-icon i');
            const statusLive = stage.querySelector('.status-live');

            if (now >= stageTime && now < nextStageTime) {
                stage.classList.add('is-current');
                stage.classList.remove('is-completed', 'is-upcoming');
                if (statusLive) statusLive.classList.remove('hidden');
                if (iconI) {
                    iconI.setAttribute('data-lucide', 'play-circle');
                    iconI.classList.add('text-primary');
                }
            } else if (now >= nextStageTime) {
                stage.classList.add('is-completed');
                stage.classList.remove('is-current', 'is-upcoming');
                if (statusLive) statusLive.classList.add('hidden');
                if (iconI) iconI.setAttribute('data-lucide', 'check-circle-2');
            } else {
                stage.classList.add('is-upcoming');
                stage.classList.remove('is-current', 'is-completed');
                if (!nextStageFound) {
                    const text = document.getElementById('next-phase-text');
                    if (text) text.textContent = `${stage.querySelector('h4').textContent} @ ${stage.querySelector('.stage-time').textContent}`;
                    nextStageFound = true;
                }
            }
        });

        // 2. Sync Command Center Visibility
        document.querySelectorAll('[data-visible-after]').forEach(el => {
            const visibleTime = new Date(el.getAttribute('data-visible-after')).getTime();
            if (now >= visibleTime) {
                if (el.classList.contains('hidden')) {
                    el.classList.remove('hidden');
                    // Fade in effect
                    el.style.opacity = '0';
                    el.style.transform = 'translateY(10px)';
                    requestAnimationFrame(() => {
                        el.style.transition = 'all 0.5s ease-out';
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0)';
                    });
                }
            } else {
                el.classList.add('hidden');
            }
        });

        this.initializeIcons();
    },

    async handleSubmit(form) {
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Uploading...';

        const linkInput = form.querySelector('input[type="url"]');
        const notesInput = form.querySelector('textarea');
        const action = document.getElementById('modal-title').textContent.toLowerCase().replace(' ', '-');

        try {
            const res = await fetch('/api/submissions/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId: this.teamId,
                    type: action,
                    submissionLink: linkInput.value,
                    description: notesInput.value
                })
            });

            const data = await res.json();
            if (data.success) {
                alert('Submission successful!');
                this.closeActiveModal();
                form.reset();
            } else {
                throw new Error(data.error || 'Submission failed');
            }
        } catch (err) {
            alert('Submission failed: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    openModal(action) {
        if (action === 'resources') {
            alert('Resource Center: Downloads will be available shortly after PS Selection is confirmed.');
            return;
        }
        if (action === 'leaderboard') {
            alert('Leaderboard: Real-time scores will start appearing at 11:00 AM on April 25.');
            return;
        }

        const id = action.includes('submission') ? 'submission-modal' :
            action === 'mentorship' ? 'mentor-modal' : null;
        if (id) {
            const m = document.getElementById(id);
            m.style.display = 'flex';
            m.classList.remove('hidden');
            if (id === 'submission-modal') {
                document.getElementById('modal-title').textContent = action.replace('-', ' ').toUpperCase();
            }
        }
    },

    closeActiveModal() {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.style.display = 'none';
            m.classList.add('hidden');
        });
    },

    fetchStats(id) {
        // Simplified fetch
        console.log(`Fetching stats for ${id}...`);
    }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
