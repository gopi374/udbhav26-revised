/**
 * UDBHAV'26 Dashboard Core Logic
 */

const Dashboard = {
    teamId: null,
    targetDate: new Date("2026-04-25T08:00:00"),
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
        this.renderTimeline();
        this.setupEventListeners();
        this.startTimers();
        this.initializeIcons();
        this.initEthereal();
    },

    initEthereal() {
        const hueEl = document.getElementById('etherHueRotate');
        if (!hueEl) return;

        let hue = 0;
        const DEG = 360 / (5.84 * 60);
        const anim = () => {
            hue = (hue + DEG) % 360;
            hueEl.setAttribute('values', hue.toFixed(2));
            requestAnimationFrame(anim);
        };
        anim();
    },

    initializeIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    checkAuth() {
        const savedTeam = localStorage.getItem("udbhav_team_data");
        if (savedTeam) {
            try {
                const team = JSON.parse(savedTeam);
                this.login(team, true); // true = skip persistence
            } catch (e) {
                localStorage.removeItem("udbhav_team_data");
                this.showView('login-view');
            }
        } else {
            this.showView('login-view');
        }
    },

    async login(teamData, skipPersistence = false) {
        this.teamId = teamData.id;
        if (!skipPersistence) {
            localStorage.setItem("udbhav_team_data", JSON.stringify(teamData));
        }

        document.querySelectorAll('.display-team-id').forEach(el => el.textContent = teamData.id);

        this.showView('dashboard-view');
        this.fetchStats(teamData.id);
    },

    logout() {
        this.teamId = null;
        localStorage.removeItem("udbhav_team_data");
        this.showView('login-view');
    },

    showView(viewId) {
        document.querySelectorAll('[data-view]').forEach(view => {
            if (view.id === viewId) {
                view.classList.remove('hidden');
                setTimeout(() => view.style.opacity = '1', 10);
            } else {
                view.classList.add('hidden');
                view.style.opacity = '0';
            }
        });
    },

    renderTimeline() {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        container.innerHTML = `
            <div class="absolute left-[13px] top-2 bottom-2 w-[2px] -ml-[0.5px] bg-gradient-to-b from-primary via-primary/50 to-transparent drop-shadow-[0_0_8px_rgba(139,92,246,0.8)] shadow-[0_0_15px_rgba(139,92,246,0.4)]"></div>
        `;

        this.timelineStages.forEach((stage, idx) => {
            const stageEl = document.createElement('div');
            stageEl.className = 'timeline-stage flex gap-4 relative';
            stageEl.setAttribute('data-timestamp', stage.timestamp);
            stageEl.innerHTML = `
                <div class="timeline-icon relative z-10 flex items-start pt-0.5 justify-center bg-background shrink-0">
                    <i data-lucide="circle" class="w-[26px] h-[26px] text-white/20 bg-background rounded-full transition-all duration-500"></i>
                </div>
                <div class="timeline-content flex-1 pb-4">
                    <div class="flex items-center justify-between mb-1">
                        <span class="stage-time text-[10px] font-bold tracking-widest text-white/30">${stage.time}</span>
                        <div class="flex items-center">
                            <span class="status-live hidden text-[9px] font-black text-blue-400 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(59,130,246,0.6)] items-center gap-1.5">
                                <span class="relative flex h-2 w-2">
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                                </span>
                                Live
                            </span>
                            <span class="status-completed hidden text-[9px] font-black text-white/30 bg-white/5 px-2 py-0.5 rounded-md uppercase tracking-wider items-center gap-1 border border-white/5">
                                <i data-lucide="check" class="w-3 h-3"></i> Completed
                            </span>
                        </div>
                    </div>
                    <h4 class="stage-title text-sm font-bold text-white transition-all duration-500">${stage.title}</h4>
                    <p class="text-xs mt-1 leading-relaxed text-white/60">${stage.description}</p>
                </div>
            `;
            container.appendChild(stageEl);
        });
        this.initializeIcons();
    },

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');
        const teamIdInput = document.getElementById('teamId-input');

        if (teamIdInput) {
            teamIdInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase().replace(/\s/g, '');
            });
        }

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const idInput = document.getElementById('teamId-input');
                const teamCode = idInput.value.trim();

                if (!teamCode) return;

                // UI Loading State
                loginBtn.disabled = true;
                const originalText = loginBtn.textContent;
                loginBtn.textContent = 'Verifying...';
                loginError.textContent = '';
                loginError.style.opacity = '0';

                try {
                    const res = await fetch('/api/auth/team', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ teamCode })
                    });

                    const data = await res.json();

                    if (data.success) {
                        this.login(data.team);
                    } else {
                        throw new Error(data.message || data.error || 'Authentication failed');
                    }
                } catch (err) {
                    loginError.textContent = err.message;
                    loginError.style.opacity = '1';
                } finally {
                    loginBtn.disabled = false;
                    loginBtn.textContent = originalText;
                }
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

    closeActiveModal() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        });
    },

    startTimers() {
        this.updateCountdown();
        setInterval(() => this.updateCountdown(), 1000);

        this.updateTimeline();
        setInterval(() => this.updateTimeline(), 60000);

        // Auto Refresh Protocol
        let refreshSeconds = 60;
        const refreshEl = document.getElementById('refresh-timer');
        setInterval(() => {
            refreshSeconds--;
            if (refreshSeconds <= 0) {
                window.location.reload();
            } else if (refreshEl) {
                refreshEl.textContent = refreshSeconds.toString().padStart(2, '0');
            }
        }, 2000);
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
            const statusCompleted = stage.querySelector('.status-completed');

            const h4 = stage.querySelector('.stage-title');

            if (now >= stageTime && now < nextStageTime) {
                stage.classList.add('is-current');
                stage.classList.remove('is-completed', 'is-upcoming');
                if (statusLive) {
                    statusLive.classList.remove('hidden');
                    statusLive.classList.add('flex');
                }
                if (statusCompleted) {
                    statusCompleted.classList.add('hidden');
                    statusCompleted.classList.remove('flex');
                }
                if (iconI) {
                    iconI.setAttribute('data-lucide', 'play-circle');
                    iconI.className = 'w-[26px] h-[26px] bg-background rounded-full transition-all duration-500 text-primary drop-shadow-[0_0_12px_rgba(139,92,246,1)] scale-110';
                }
                if (h4) h4.className = 'stage-title text-sm font-bold transition-all duration-500 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]';
            } else if (now >= nextStageTime) {
                stage.classList.add('is-completed');
                stage.classList.remove('is-current', 'is-upcoming');
                if (statusLive) {
                    statusLive.classList.add('hidden');
                    statusLive.classList.remove('flex');
                }
                if (statusCompleted) {
                    statusCompleted.classList.remove('hidden');
                    statusCompleted.classList.add('flex');
                }
                if (iconI) {
                    iconI.setAttribute('data-lucide', 'check-circle-2');
                    iconI.className = 'w-[26px] h-[26px] bg-background rounded-full transition-all duration-500 text-white/40 drop-shadow-none scale-100';
                }
                if (h4) h4.className = 'stage-title text-sm font-bold transition-all duration-500 text-white/60 drop-shadow-none';
            } else {
                stage.classList.add('is-upcoming');
                stage.classList.remove('is-current', 'is-completed');
                if (statusLive) {
                    statusLive.classList.add('hidden');
                    statusLive.classList.remove('flex');
                }
                if (statusCompleted) {
                    statusCompleted.classList.add('hidden');
                    statusCompleted.classList.remove('flex');
                }
                if (iconI) {
                    iconI.setAttribute('data-lucide', 'circle');
                    iconI.className = 'w-[26px] h-[26px] bg-background rounded-full transition-all duration-500 text-white/20 drop-shadow-none scale-100';
                }
                if (h4) h4.className = 'stage-title text-sm font-bold text-white transition-all duration-500 text-white drop-shadow-none';

                if (!nextStageFound) {
                    const text = document.getElementById('next-phase-text');
                    if (text) text.textContent = `${h4 ? h4.textContent : stage.querySelector('h4').textContent} @ ${stage.querySelector('.stage-time').textContent}`;
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
                
                // 5 minutes before popup logic
                const diffMs = visibleTime - now;
                if (diffMs > 0 && diffMs <= 5 * 60 * 1000) {
                    const actionId = el.getAttribute('data-action') || visibleTime.toString();
                    if (!this.notifiedUpcoming) this.notifiedUpcoming = new Set();
                    if (!this.notifiedUpcoming.has(actionId)) {
                        this.notifiedUpcoming.add(actionId);
                        
                        let title = el.querySelector('h4') ? el.querySelector('h4').textContent.trim() : 'A new feature';
                        this.showToast(`Heads up! ${title} opens in 5 minutes!`);
                    }
                }
            }
        });

        this.initializeIcons();
    },

    showToast(message, type = 'info') {
        let container = document.getElementById('local-toast-container');
        if (!container) return; // Fallback if missing
        
        const toast = document.createElement('div');
        toast.className = `glass-dark border border-primary/20 bg-primary/10 px-6 py-3 rounded-xl flex items-center gap-3 transform -translate-y-4 opacity-0 transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.15)]`;
        
        toast.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                <i data-lucide="bell" class="w-4 h-4 text-primary animate-pulse"></i>
            </div>
            <p class="text-sm font-bold text-white">${message}</p>
        `;
        
        container.appendChild(toast);
        this.initializeIcons();
        
        // entry animation
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });
        
        // auto remove
        setTimeout(() => {
            toast.style.transform = '-translateY(4px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 300000);
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

    async fetchStats(id) {
        try {
            const res = await fetch(`/api/team-dashboard?code=${id}`);
            const data = await res.json();
            if (data.success) {
                this.currentTeamData = data.team;
                console.log("Team data synchronized:", this.currentTeamData);
            }
        } catch (err) {
            console.error("Failed to fetch team stats:", err);
        }
    },

    async handleOptMentorship(file) {
        if (!this.teamId || !file) return;
        
        const btn = document.getElementById('submitReceiptBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Uploading Receipt...';
        }

        try {
            // 1. Upload to Cloudinary (using unsigned preset)
            // USER: Replace with your actual credentials
            // const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dimq4wo1i/image/upload';
            // const UPLOAD_PRESET = 'udbhav_receipts';
            const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;
            const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;


            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', UPLOAD_PRESET);

            const uploadRes = await fetch(CLOUDINARY_URL, {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadRes.json();

            if (!uploadData.secure_url) {
                throw new Error('Cloudinary upload failed. Please check your credentials.');
            }

            const receiptUrl = uploadData.secure_url;

            // 2. Submit to backend
            const res = await fetch('/api/mentorship/opt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode: this.teamId, receiptUrl })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast('Payment receipt submitted! Verification in progress.');
                await this.fetchStats(this.teamId); // Refresh data
                this.openModal('mentorship'); // Re-render modal
            } else {
                throw new Error(data.error || 'Submission failed');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Submit Receipt';
            }
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
                document.getElementById('modal-title').textContent = action.replace(/-/g, ' ').toUpperCase();
            }

            if (action === 'mentorship') {
                const content = document.getElementById('mentor-modal-content');
                if (!content) return;

                const team = this.currentTeamData || {};
                
                if (team.mentorSession) {
                    if (team.mentor && team.mentor.name) {
                        content.innerHTML = `
                            <div class="space-y-4">
                                <div class="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto border border-orange-500/20 mb-4">
                                    <i data-lucide="user" class="w-10 h-10 text-orange-500"></i>
                                </div>
                                <h4 class="text-xl font-bold text-white">${team.mentor.name}</h4>
                                <p class="text-white/40 text-xs uppercase tracking-widest">Your Assigned Mentor</p>
                                <div class="flex flex-col gap-2 mt-6">
                                    ${team.mentor.linkedin ? `
                                        <a href="${team.mentor.linkedin}" target="_blank" class="flex items-center justify-center gap-2 bg-[#0077b5]/10 text-[#0077b5] border border-[#0077b5]/20 px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#0077b5]/20 transition-all">
                                            <i data-lucide="linkedin" class="w-4 h-4"></i> LinkedIn Profile
                                        </a>
                                    ` : ''}
                                    ${team.mentor.contact ? `
                                        <div class="flex items-center justify-center gap-2 bg-white/5 text-white/60 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold">
                                            <i data-lucide="phone" class="w-4 h-4"></i> ${team.mentor.contact}
                                        </div>
                                    ` : ''}
                                </div>
                                <p class="text-[10px] text-white/20 mt-4 italic">Direct coordination starts April 25.</p>
                            </div>
                        `;
                    } else {
                        content.innerHTML = `
                            <div class="py-6">
                                <i data-lucide="clock" class="w-16 h-16 text-orange-500/40 mx-auto mb-4 animate-pulse"></i>
                                <h3 class="text-lg font-bold text-white mb-2 uppercase">Assignment Pending</h3>
                                <p class="text-white/40 text-sm">Your mentor is being assigned. Check back shortly!</p>
                            </div>
                        `;
                    }
                } else if (team.mentorshipStatus === 'pending') {
                    content.innerHTML = `
                        <div class="py-6 space-y-4">
                            <div class="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto border border-blue-500/20 mb-4">
                                <i data-lucide="shield-check" class="w-10 h-10 text-blue-500 animate-pulse"></i>
                            </div>
                            <h3 class="text-xl font-bold text-white uppercase tracking-tight">Verification In Progress</h3>
                            <p class="text-white/40 text-sm">Our admins are verifying your ₹300 payment receipt. This usually takes 2-4 hours.</p>
                            ${team.mentorshipReceiptUrl ? `
                                <div class="mt-4 pt-4 border-t border-white/5">
                                    <p class="text-[9px] text-white/20 uppercase font-black tracking-widest mb-2">Submitted Receipt</p>
                                    <img src="${team.mentorshipReceiptUrl}" class="w-full h-32 object-cover rounded-xl border border-white/10 opacity-50 gray-scale hover:opacity-100 transition-all cursor-pointer" onclick="window.open(this.src)">
                                </div>
                            ` : ''}
                        </div>
                    `;
                } else {
                    content.innerHTML = `
                        <div class="py-2">
                             <div class="flex flex-col items-center gap-4">
                                <div class="w-full aspect-square max-w-[200px] bg-white p-3 rounded-2xl shadow-2xl">
                                    <img src="/mentor-opt.jpeg" alt="Mentorship QR Code" class="w-full h-full object-contain">
                                </div>
                                <div class="text-center">
                                    <p class="text-white/40 text-xs uppercase tracking-widest mb-1">Fee: <span class="text-white font-black text-sm">₹300</span></p>
                                    <p class="text-[10px] text-white/20">Scan to pay via any UPI app</p>
                                </div>
                            </div>
                            
                            <div class="mt-8 space-y-4">
                                <div class="relative group">
                                    <input type="file" id="receiptInput" accept="image/*" class="hidden">
                                    <button onclick="document.getElementById('receiptInput').click()" class="w-full py-3 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all text-xs font-bold uppercase flex items-center justify-center gap-2">
                                        <i data-lucide="upload-cloud" class="w-4 h-4"></i>
                                        <span id="fileLabel">Upload Payment Receipt</span>
                                    </button>
                                </div>
                                <button id="submitReceiptBtn" disabled class="w-full py-4 bg-primary text-white font-black rounded-xl uppercase hover:scale-102 transition-all opacity-50 cursor-not-allowed">Submit Request</button>
                            </div>
                        </div>
                    `;
                    
                    const receiptInput = document.getElementById('receiptInput');
                    const fileLabel = document.getElementById('fileLabel');
                    const submitBtn = document.getElementById('submitReceiptBtn');
                    
                    receiptInput?.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            fileLabel.textContent = file.name;
                            submitBtn.disabled = false;
                            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                        }
                    });

                    submitBtn?.addEventListener('click', () => {
                        const file = receiptInput.files[0];
                        if (file) this.handleOptMentorship(file);
                    });
                }
                this.initializeIcons();
            }
        }
    },
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
