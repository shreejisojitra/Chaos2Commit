/**
 * Chaos2Commit / AI Solution Builder — Chaos Engine
 * Central Project State, Reactive Module Flow, Document Processing, and Dynamic AI Logic.
 */

(function (window) {
  'use strict';

  // ─── Theme Management ─────────────────────────────────────────────────────────
  const THEME_KEY = 'chaos_theme';
  const ChaosTheme = {
    current: 'light',
    init() {
      const saved = localStorage.getItem(THEME_KEY) || 'dark';
      this.set(saved, false);
    },
    set(theme, save = true) {
      this.current = theme;
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body && document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body && document.body.classList.remove('dark');
      }
      if (save) localStorage.setItem(THEME_KEY, theme);
      this.updateToggles();
    },
    toggle() {
      this.set(this.current === 'dark' ? 'light' : 'dark');
    },
    updateToggles() {
      document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.innerHTML = this.current === 'dark' 
          ? `<svg class="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`
          : `<svg class="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`;
        btn.setAttribute('title', `Switch to ${this.current === 'dark' ? 'light' : 'dark'} mode`);
      });
    }
  };

  // ─── UI Notification & Toast System ──────────────────────────────────────────
  const ChaosUI = {
    toast(message, type = 'info', duration = 3500) {
      let container = document.getElementById('chaos-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'chaos-toast-container';
        container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
      }
      const toast = document.createElement('div');
      const bg = type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white';
      const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';
      toast.className = `toast-notification pointer-events-auto px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold ${bg}`;
      toast.innerHTML = `<span class="text-sm font-bold">${icon}</span><span>${this.escape(message)}</span>`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },
    escape(str) {
      return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  };

  // ─── Pani Puri Demo Scenario Blueprint & Dynamic Template ────────────────────
  const PANI_PURI_DEMO = {
    id: 'p_panipuri_express',
    name: 'Pani Puri Online Ordering & Delivery Management System',
    businessName: 'Royal Pani Puri Express',
    idea: 'A Pani Puri shop wants to accept online orders through a Swiggy-like platform. The shop should receive new-order notifications. Customers should be able to track their delivery partner using live GPS.',
    requirements: 'Customer registration/login, browse Pani Puri menu with custom spice & water choices, add products to cart, place order with online payment, shop receives instant order notification, shop prepares order, delivery partner assignment, live GPS tracking, status alerts, order history.',
    process: 'Currently customers wait in long queues at the counter, or order via phone calls which are often missed. Payments are cash or direct UPI with no automated confirmation. No delivery partner tracking exists.',
    language: 'en',
    status: 'blueprint',
    progress: {
      idea: true,
      consultant: true,
      requirements: true,
      blueprint: true,
      architecture: true,
      build: false,
      deployed: false,
    },
    businessContext: {
      domain: 'Food & Beverage / Hyperlocal QSR',
      targetAudience: 'Street food lovers, family gatherings, office parties',
      currentProcess: 'Counter service, manual billing, phone orders, cash/UPI receipts',
      coreProblems: ['Peak evening counter congestion', 'Untracked phone orders', 'No delivery dispatcher', 'Lack of real-time order visibility'],
      objectives: ['Launch digital ordering platform', 'Automate kitchen preparation ticket generation', 'Enable live delivery partner GPS tracking', 'Increase daily orders by 250%'],
    },
    requirements_list: [
      { id: 'req_1', text: 'Customer authentication via Mobile OTP and Email login', type: 'explicit', confidence: 0.98, state: 'accepted', source: 'consultant', evidence: 'Core user security requirement' },
      { id: 'req_2', text: 'Interactive Pani Puri Menu with customizable pani options (Teekha, Meetha, Hing, Garlic) and quantity packs', type: 'explicit', confidence: 0.95, state: 'accepted', source: 'consultant', evidence: 'Direct business offering' },
      { id: 'req_3', text: 'Real-time cart & instant digital checkout with Razorpay/Stripe integration', type: 'explicit', confidence: 0.94, state: 'accepted', source: 'consultant', evidence: 'Payment gateway requirement' },
      { id: 'req_4', text: 'Shop live order dashboard with audio ring alerts on incoming orders', type: 'explicit', confidence: 0.92, state: 'accepted', source: 'consultant', evidence: 'Store operations efficiency' },
      { id: 'req_5', text: 'Kitchen order management (Accept, Preparing, Packed, Ready for Dispatch)', type: 'explicit', confidence: 0.96, state: 'accepted', source: 'consultant', evidence: 'Order lifecycle management' },
      { id: 'req_6', text: 'Automated delivery partner assignment based on proximity and shop readiness', type: 'missing', confidence: 0.88, state: 'accepted', source: 'consultant', evidence: 'Identified gap in delivery workflow' },
      { id: 'req_7', text: 'Live GPS location tracking of delivery partner on interactive map with ETA', type: 'explicit', confidence: 0.97, state: 'accepted', source: 'consultant', evidence: 'Explicit customer requirement' },
      { id: 'req_8', text: 'WhatsApp & SMS notifications for order confirmation, dispatch, and delivery', type: 'recommendation', confidence: 0.85, state: 'accepted', source: 'consultant', evidence: 'Enhances customer trust and reduces support calls' },
      { id: 'req_9', text: 'Customer order history, digital receipts, and delivery rating system', type: 'explicit', confidence: 0.91, state: 'accepted', source: 'consultant', evidence: 'Retention & feedback' },
      { id: 'req_10', text: 'Admin analytics for top-selling flavours, sales volume, peak hours, and delivery times', type: 'recommendation', confidence: 0.89, state: 'accepted', source: 'consultant', evidence: 'Business intelligence for shop scaling' }
    ],
    consultantConversation: [
      {
        role: 'user',
        content: 'We want customers to order Pani Puri online from our shop with custom pani options and live delivery tracking.'
      },
      {
        role: 'assistant',
        content: `I've analyzed your business model for **Royal Pani Puri Express**! Hyperlocal street-food delivery requires tight synchronization between order packaging (to keep puris crisp) and instant driver dispatch.

Key insights extracted:
1. **Packaging Sensitivity**: Water & puris must be packed separately; prep time is minimal (3-5 minutes).
2. **Order Dispatching**: Immediate pairing with nearby delivery executives prevents delays.
3. **Live GPS Tracking**: Real-time telemetry map builds customer anticipation and reduces incoming inquiry calls.`,
        source: 'openai',
        analysis: {
          businessUnderstanding: 'Hyperlocal street food delivery platform with fast kitchen turnaround and live delivery partner dispatch.',
          explicitRequirements: [
            { text: 'Customer ordering with custom flavor variations', evidence: 'User prompt', confidence: 0.98 },
            { text: 'Live GPS driver tracking', evidence: 'User prompt', confidence: 0.97 },
            { text: 'Shop order receipt alerts', evidence: 'User prompt', confidence: 0.95 }
          ],
          missingRequirements: [
            'Separate water packaging selection to maintain puri crispness',
            'Automated delivery partner proximity dispatch algorithm',
            'Estimated Time of Arrival (ETA) calculation with live traffic'
          ],
          questions: [
            'Do you offer scheduled delivery for parties or on-demand only?',
            'Will the delivery fleet be in-house staff or third-party riders?',
            'Do you need multi-branch support across multiple city outlets?'
          ],
          recommendations: [
            { text: 'WebSockets for zero-latency kitchen alerts and live rider coordinates', explanation: 'Eliminates HTTP polling overhead for GPS coordinates', confidence: 0.95 },
            { text: 'Integrated UPI and Card payments with instant merchant settlements', explanation: 'Prevents delivery cancellation risk', confidence: 0.92 }
          ]
        }
      }
    ],
    blueprint: {
      productName: 'Royal Pani Puri Express — Order & Fleet Platform',
      productDescription: 'Complete on-demand hyperlocal street-food ordering, kitchen dispatch, and real-time GPS tracking solution.',
      targetUsers: ['Online Customers', 'Shop Owners & Kitchen Staff', 'Delivery Fleet Partners', 'Business Admin'],
      userRoles: ['customer', 'shop_manager', 'delivery_partner', 'admin'],
      coreModules: [
        { name: 'Customer Ordering Portal', description: 'Browse Pani Puri flavours, custom spice/sweet levels, cart & checkout', priority: 'must-have' },
        { name: 'Kitchen Order Management (KDS)', description: 'Real-time order board with audio chimes and preparation timer', priority: 'must-have' },
        { name: 'Fleet Dispatch & GPS Tracking', description: 'Driver assignment engine with live geolocation streaming', priority: 'must-have' },
        { name: 'Payment & Billing Gateway', description: 'Secure payments via Razorpay / Stripe with instant digital invoices', priority: 'must-have' },
        { name: 'Notification Service', description: 'WhatsApp, SMS, and Push notifications for all order lifecycle events', priority: 'high' },
        { name: 'Analytics & Inventory Dashboard', description: 'Monitor daily sales, top-selling waters, and fleet response times', priority: 'medium' }
      ],
      dataEntities: [
        { name: 'Users', fields: ['id', 'name', 'phone', 'email', 'role', 'created_at'] },
        { name: 'MenuItems', fields: ['id', 'title', 'category', 'price', 'flavours', 'is_available'] },
        { name: 'Orders', fields: ['id', 'customer_id', 'shop_id', 'driver_id', 'status', 'total_amount', 'delivery_address', 'created_at'] },
        { name: 'OrderItems', fields: ['id', 'order_id', 'item_id', 'quantity', 'spice_level', 'pani_type'] },
        { name: 'Deliveries', fields: ['id', 'order_id', 'driver_id', 'current_lat', 'current_lng', 'eta_minutes', 'status'] },
        { name: 'Payments', fields: ['id', 'order_id', 'transaction_ref', 'amount', 'method', 'status'] }
      ],
      keyFlows: [
        'Customer customizes Pani Puri pack (e.g. 50 puris + Teekha Pudina + Khatta Meetha) → pays online',
        'Shop receives instant sound alert → accepts order → begins hygienic vacuum packaging',
        'System alerts nearby delivery partner → driver accepts and heads to shop',
        'Driver picks up package → GPS coordinates stream live to customer app',
        'Delivery partner arrives at customer address → OTP verified → order marked delivered'
      ],
      techStack: {
        frontend: 'React 19 / Vite / Tailwind CSS',
        backend: 'Node.js / Express / Socket.io',
        database: 'PostgreSQL + Redis (for live GPS caching)',
        deployment: 'Docker / Node Server / Render / Railway'
      }
    },
    architecture: {
      systemDiagram: `graph TD
  Customer[📱 Customer Mobile Web] -->|HTTP / WebSocket| Gateway[API Gateway / Node.js]
  Shop[🖥️ Shop Kitchen Dashboard] -->|WebSocket Listen| Gateway
  Driver[🛵 Delivery Partner App] -->|GPS Streaming| Gateway
  Gateway --> Auth[🔐 Auth & Security Service]
  Gateway --> OrderService[📦 Order Management Engine]
  Gateway --> TrackingService[📍 Real-time GPS Tracker]
  Gateway --> PaymentService[💳 Razorpay Gateway]
  TrackingService --> Redis[(⚡ Redis Live Coordinates)]
  OrderService --> DB[(🗄️ PostgreSQL Database)]
  OrderService --> Notif[🔔 WhatsApp / SMS Service]`,
      erDiagram: `erDiagram
  USERS ||--o{ ORDERS : places
  SHOPS ||--o{ ORDERS : fulfills
  ORDERS ||--|{ ORDER_ITEMS : contains
  ORDERS ||--|| DELIVERIES : dispatched_via
  DELIVERIES ||--o{ GPS_LOGS : records
  ORDERS ||--|| PAYMENTS : settled_by
  MENU_ITEMS ||--o{ ORDER_ITEMS : specified_in`,
      apiEndpoints: [
        { method: 'POST', path: '/api/orders', description: 'Create and initialize a new Pani Puri order', auth: true },
        { method: 'GET', path: '/api/orders/:id', description: 'Retrieve order details, items and current status', auth: true },
        { method: 'PUT', path: '/api/orders/:id/status', description: 'Update status (preparing, ready, dispatched, delivered)', auth: true },
        { method: 'POST', path: '/api/delivery/assign', description: 'Assign nearest delivery partner to order', auth: true },
        { method: 'GET', path: '/api/delivery/:orderId/location', description: 'Fetch live GPS latitude/longitude and ETA', auth: false },
        { method: 'POST', path: '/api/payments/verify', description: 'Verify payment gateway signature and webhook', auth: true }
      ],
      sitemap: [
        '/ (Customer Order Front & Menu)',
        '/cart (Custom Flavor Picker & Checkout)',
        '/tracking/:id (Live GPS Delivery Map)',
        '/shop/dashboard (Kitchen Order Display System)',
        '/driver/portal (Delivery Partner Order & Navigation)',
        '/admin/analytics (Sales & Business Reports)'
      ],
      securityNotes: [
        'JWT tokens with HttpOnly cookies for customer and staff sessions',
        'Rate limiting on order endpoints to prevent fake traffic surges',
        'HMAC SHA-256 signature verification for payment webhooks',
        'Obfuscation of customer phone numbers between driver and buyer'
      ]
    },
    businessAnalysis: {
      currentState: 'Physical street cart / shop setup with manual queuing, verbal orders, paper tokens, and zero delivery infrastructure.',
      futureState: 'Automated omnichannel food ordering platform with digital kitchen queue, automated rider dispatch, and live GPS map tracking.',
      gapAnalysis: 'Lack of digital ordering interface, absence of real-time inventory tracking for puris/water, zero delivery coordination.',
      opportunities: [
        'Party & event bulk catering bookings via the web app',
        'Subscription model: "Weekly Puri Fix" for regular families',
        'Automated re-stock alerts for fresh mint, tamarind, and boondi'
      ]
    },
    activity: [
      { timestamp: new Date(Date.now() - 3600000).toISOString(), actor: 'System', action: 'Project initialized', module: 'Discovery', status: 'Completed' },
      { timestamp: new Date(Date.now() - 2400000).toISOString(), actor: 'AI Consultant', action: 'Extracted 10 business requirements', module: 'Requirements', status: 'Completed' },
      { timestamp: new Date(Date.now() - 1200000).toISOString(), actor: 'Solution Builder', action: 'Generated Product Blueprint', module: 'Blueprint', status: 'Completed' },
      { timestamp: new Date(Date.now() - 600000).toISOString(), actor: 'Architecture Engine', action: 'Generated System and ER Diagrams', module: 'Architecture', status: 'Completed' }
    ],
    notifications: [
      { id: 'notif_1', type: 'success', title: 'Blueprint Generated', message: 'Hyperlocal Pani Puri solution blueprint ready for review.', time: '15m ago', read: false },
      { id: 'notif_2', type: 'info', title: 'GPS Tracking Configured', message: 'WebSockets and Redis enabled for live location dispatch.', time: '10m ago', read: false }
    ],
    updatedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString()
  };

  // ─── Central Project Store ───────────────────────────────────────────────────
  const PROJECTS_KEY = 'asb_projects';
  const BILLING_KEY = 'asb_billing';

  const ChaosStore = {
    projects: [],
    currentProject: null,
    listeners: new Set(),

    init() {
      try {
        const stored = localStorage.getItem(PROJECTS_KEY);
        this.projects = stored ? JSON.parse(stored) : [];
      } catch (_) {
        this.projects = [];
      }

      // Check if Pani Puri demo project exists, if not, add it seamlessly
      if (!this.projects.some(p => p.id === PANI_PURI_DEMO.id)) {
        this.projects.unshift(PANI_PURI_DEMO);
        this.persist();
      }

      // Also sync with server in background
      this.syncWithServer();
    },

    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    },

    notify() {
      this.listeners.forEach(fn => {
        try { fn(this.currentProject, this.projects); } catch (e) { console.error(e); }
      });
    },

    persist() {
      try {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(this.projects));
      } catch (e) {
        console.warn('Storage quota warning', e);
      }
    },

    getProjects() {
      return this.projects;
    },

    getProjectById(id) {
      return this.projects.find(p => p.id === id) || null;
    },

    saveProject(project) {
      if (!project || !project.id) return;
      project.updatedAt = new Date().toISOString();
      const idx = this.projects.findIndex(p => p.id === project.id);
      if (idx >= 0) {
        this.projects[idx] = { ...this.projects[idx], ...project };
      } else {
        this.projects.unshift(project);
      }
      this.persist();
      if (this.currentProject && this.currentProject.id === project.id) {
        this.currentProject = this.projects.find(p => p.id === project.id);
      }
      this.notify();

      // Fire & forget sync to server PUT /api/projects/:id
      fetch('/api/projects/' + encodeURIComponent(project.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      }).catch(() => {});
    },

    calculateProgress(project) {
      if (!project) return 0;
      const prog = project.progress || {};
      let score = 0;
      if (prog.idea) score += 15;
      if (prog.consultant) score += 15;
      if (prog.requirements) score += 15;
      if (prog.blueprint) score += 15;
      if (prog.architecture) score += 15;
      if (prog.build) score += 15;
      if (prog.deployed) score += 10;
      return Math.min(score, 100);
    },

    logActivity(projectId, action, module, status = 'Completed') {
      const p = this.getProjectById(projectId);
      if (!p) return;
      p.activity = p.activity || [];
      p.activity.unshift({
        timestamp: new Date().toISOString(),
        actor: 'User',
        action,
        module,
        status
      });
      p.activity = p.activity.slice(0, 30);
      this.saveProject(p);
    },

    async syncWithServer() {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const serverList = await res.json();
          if (Array.isArray(serverList) && serverList.length > 0) {
            serverList.forEach(sp => {
              const localIdx = this.projects.findIndex(p => p.id === sp.id);
              if (localIdx >= 0) {
                // merge preserving latest
                if (new Date(sp.updatedAt || 0) > new Date(this.projects[localIdx].updatedAt || 0)) {
                  this.projects[localIdx] = { ...this.projects[localIdx], ...sp };
                }
              } else {
                this.projects.push(sp);
              }
            });
            this.persist();
            this.notify();
          }
        }
      } catch (_) {}
    }
  };

  // ─── Initialize Engine on Load ────────────────────────────────────────────────
  ChaosTheme.init();
  ChaosStore.init();

  window.ChaosTheme = ChaosTheme;
  window.ChaosUI = ChaosUI;
  window.ChaosStore = ChaosStore;
  window.PANI_PURI_DEMO = PANI_PURI_DEMO;

})(window);
