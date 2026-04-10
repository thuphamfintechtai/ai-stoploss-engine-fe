# TradeGuard AI - Frontend

Giao dien web cho he thong ho tro dung lo va chot loi nhuan tang cuong AI, phuc vu nha dau tu chung khoan Viet Nam.

Ung dung cung cap giao dien giao dich, quan ly danh muc, phan tich rui ro va tin hieu AI. Ho tro ca giao dich that (Portfolio Management) va giao dich mo phong (Paper Trading).


## Cong nghe

- **Framework:** React 19
- **Language:** TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS 4
- **Charts:** Lightweight Charts (TradingView) + Recharts
- **Real-time:** Socket.IO Client
- **AI:** Google GenAI (Gemini)
- **HTTP:** Axios


## Cau truc thu muc

```
ai-stoploss-engine-fe/
├── index.html                  # HTML entry point
├── index.tsx                   # React DOM render
├── index.css                   # Global styles, Tailwind config
├── App.tsx                     # Component chinh, routing, state management
├── types.ts                    # TypeScript type definitions
├── constants.ts                # Hang so ung dung (colors, config)
├── services/
│   ├── api.ts                  # HTTP client - tat ca API calls
│   ├── websocket.ts            # WebSocket client - du lieu real-time
│   └── geminiService.ts        # Google Gemini AI client
├── utils/
│   └── vnStockRules.ts         # Quy tac chung khoan VN (buoc gia, bien do)
├── chart-plugins/
│   ├── plugin-base.ts          # Base class cho chart plugin
│   ├── rectangle-drawing-tool.ts # Cong cu ve hinh chu nhat tren chart
│   ├── index.ts                # Exports
│   └── helpers/                # Tinh toan kich thuoc, vi tri
├── components/
│   ├── ui/                     # UI primitives (dung lai duoc)
│   │   ├── Tooltip.tsx             # Tooltip tai chinh
│   │   ├── InfoCard.tsx            # The thong tin
│   │   ├── StatCard.tsx            # The so lieu thong ke
│   │   ├── EmptyState.tsx          # Trang thai rong
│   │   ├── SkeletonLoader.tsx      # Loading skeleton
│   │   └── MobileBottomNav.tsx     # Navigation mobile
│   ├── AuthView.tsx            # Dang nhap, dang ky
│   ├── Sidebar.tsx             # Thanh dieu huong chinh
│   ├── HomeView.tsx            # Trang chu tong quan
│   ├── DashboardView.tsx       # Dashboard - thong ke, AI insights
│   ├── TradingTerminal.tsx     # Giao dien giao dich chinh
│   ├── PortfolioView.tsx       # Quan ly danh muc dau tu
│   ├── RiskManagerView.tsx     # Phan tich rui ro (VaR, Monte Carlo, Stress Test)
│   ├── WatchlistView.tsx       # Danh sach theo doi co phieu
│   ├── AiSignalsView.tsx       # Tin hieu giao dich tu AI
│   ├── AiMonitorPanel.tsx      # Bang giam sat AI
│   ├── NotificationsView.tsx   # Thong bao
│   ├── MarketNewsView.tsx      # Tin tuc thi truong
│   ├── SettingsView.tsx        # Cai dat nguoi dung
│   ├── OnboardingWizard.tsx    # Huong dan 3 buoc cho nguoi moi
│   ├── TraderCard.tsx          # The thong tin trader
│   ├── RiskProgressBar.tsx     # Thanh tien trinh rui ro
│   ├── AppErrorBoundary.tsx    # Xu ly loi React
│   ├── PaperVirtualBalance.tsx # So du paper trading
│   ├── PaperOrderManager.tsx   # Quan ly lenh paper
│   ├── PaperPerformanceReport.tsx # Bao cao hieu suat paper
│   ├── charts/
│   │   └── CandlestickChart.tsx # Bieu do nen (OHLCV)
│   └── portfolio/              # Cac component danh muc
│       ├── PortfolioHeroCard.tsx   # Tong quan danh muc
│       ├── PortfolioSummaryCard.tsx # Tom tat tai san
│       ├── CashBalanceCard.tsx     # So du tien mat
│       ├── RealPositionsTable.tsx  # Bang vi the
│       ├── RealOrderForm.tsx       # Form dat lenh
│       ├── ClosePositionModal.tsx  # Modal dong vi the
│       └── TransactionHistory.tsx  # Lich su giao dich
└── public/
    ├── favicon.svg
    └── logo.png
```


## Cai dat

### Yeu cau

- Node.js v18+

### Cac buoc

1. Cai dat dependencies:

```bash
npm install
```

2. Cau hinh bien moi truong (tuy chon):

Tao file `.env.local`:

```
VITE_API_URL=http://localhost:3000
VITE_GEMINI_API_KEY=your-gemini-api-key
```

Neu khong tao file nay, ung dung se dung gia tri mac dinh ket noi den `localhost:3000`.

3. Khoi dong:

```bash
npm run dev
```

Ung dung chay tai `http://localhost:5173`.


## Build Production

```bash
npm run build
```

Output nam trong thu muc `dist/`, co the deploy len bat ky static hosting nao (Vercel, Netlify, Nginx, ...).

```bash
# Xem truoc ban build
npm run preview
```


## Cac man hinh chinh

### Authentication
- Dang nhap va dang ky tai khoan.
- Luu JWT token trong localStorage.

### Dashboard
- Tong quan tai san, loi/lo, phan bo danh muc.
- Tin hieu AI moi nhat, hanh dong nhanh.
- Widget thi truong real-time.

### Trading Terminal
- Giao dien giao dich voi bieu do nen (candlestick).
- Dat lenh mua/ban (paper va that).
- Cong cu ve ky thuat tren chart.
- Toggle che do nang cao / don gian.

### Portfolio Management
- Quan ly danh muc dau tu that.
- Bang vi the, form dat lenh, lich su giao dich.
- Dong vi the, tinh phi, loi/lo.
- So du tien mat va quan ly von.

### Paper Trading
- Mo phong giao dich voi so du ao.
- Dat lenh, theo doi khop lenh, bao cao hieu suat.
- Khong anh huong tai san that.

### Risk Manager
- Value at Risk (VaR) - do rui ro toi da.
- Monte Carlo Simulation - mo phong ngau nhien.
- Stress Test - kiem tra chiu dung thi truong cuc doan.
- Phan tich tap trung nganh.

### AI Signals
- Tin hieu giao dich tu Google Gemini.
- Khuyen nghi stop loss, take profit.
- Phan tich vi the hien tai.

### Watchlist
- Theo doi gia co phieu real-time.
- Dat canh bao gia.

### Settings
- Cai dat nguoi dung, thong so rui ro.
- Cau hinh AI va thong bao.


## Ket noi Backend

Frontend ket noi voi backend qua:

- **REST API** (Axios) - tat ca thao tac CRUD, phan tich AI.
- **WebSocket** (Socket.IO) - nhan cap nhat gia, trang thai vi the, thong bao real-time.

Mac dinh ket noi den `http://localhost:3000`. Thay doi bang bien moi truong `VITE_API_URL`.


## Responsive

Ung dung ho tro responsive:
- Desktop: sidebar navigation, layout nhieu cot.
- Mobile: bottom navigation, layout 1 cot, card thu gon.


## Ghi chu

- Gia tri tien te hien thi theo dinh dang VND (dau phay phan cach hang nghin).
- Bieu do su dung Lightweight Charts (TradingView open-source).
- Ung dung ho tro dark theme.
- Onboarding wizard huong dan nguoi moi 3 buoc co ban.
