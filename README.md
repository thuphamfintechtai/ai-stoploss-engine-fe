# TradeGuard AI - Frontend

Giao diện web cho hệ thống hỗ trợ dừng lỗ và chốt lợi nhuận tăng cường AI, phục vụ nhà đầu tư chứng khoán Việt Nam.

Ứng dụng cung cấp giao diện giao dịch, quản lý danh mục, phân tích rủi ro và tín hiệu AI. Hỗ trợ cả giao dịch thật (Portfolio Management) và giao dịch mô phỏng (Paper Trading).


## Công nghệ

- **Framework:** React 19
- **Language:** TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS 4
- **Charts:** Lightweight Charts (TradingView) + Recharts
- **Real-time:** Socket.IO Client
- **AI:** Google GenAI (Gemini)
- **HTTP:** Axios


## Cấu trúc thư mục

```
ai-stoploss-engine-fe/
├── index.html                  # HTML entry point
├── index.tsx                   # React DOM render
├── index.css                   # Global styles, Tailwind config
├── App.tsx                     # Component chính, routing, state management
├── types.ts                    # TypeScript type definitions
├── constants.ts                # Hằng số ứng dụng (colors, config)
├── services/
│   ├── api.ts                  # HTTP client - tất cả API calls
│   ├── websocket.ts            # WebSocket client - dữ liệu real-time
│   └── geminiService.ts        # Google Gemini AI client
├── utils/
│   └── vnStockRules.ts         # Quy tắc chứng khoán VN (bước giá, biên độ)
├── chart-plugins/
│   ├── plugin-base.ts          # Base class cho chart plugin
│   ├── rectangle-drawing-tool.ts # Công cụ vẽ hình chữ nhật trên chart
│   ├── index.ts                # Exports
│   └── helpers/                # Tính toán kích thước, vị trí
├── components/
│   ├── ui/                     # UI primitives (dùng lại được)
│   │   ├── Tooltip.tsx             # Tooltip tài chính
│   │   ├── InfoCard.tsx            # Thẻ thông tin
│   │   ├── StatCard.tsx            # Thẻ số liệu thống kê
│   │   ├── EmptyState.tsx          # Trạng thái rỗng
│   │   ├── SkeletonLoader.tsx      # Loading skeleton
│   │   └── MobileBottomNav.tsx     # Navigation mobile
│   ├── AuthView.tsx            # Đăng nhập, đăng ký
│   ├── Sidebar.tsx             # Thanh điều hướng chính
│   ├── HomeView.tsx            # Trang chủ tổng quan
│   ├── DashboardView.tsx       # Dashboard - thống kê, AI insights
│   ├── TradingTerminal.tsx     # Giao diện giao dịch chính
│   ├── PortfolioView.tsx       # Quản lý danh mục đầu tư
│   ├── RiskManagerView.tsx     # Phân tích rủi ro (VaR, Monte Carlo, Stress Test)
│   ├── WatchlistView.tsx       # Danh sách theo dõi cổ phiếu
│   ├── AiSignalsView.tsx       # Tín hiệu giao dịch từ AI
│   ├── AiMonitorPanel.tsx      # Bảng giám sát AI
│   ├── NotificationsView.tsx   # Thông báo
│   ├── MarketNewsView.tsx      # Tin tức thị trường
│   ├── SettingsView.tsx        # Cài đặt người dùng
│   ├── OnboardingWizard.tsx    # Hướng dẫn 3 bước cho người mới
│   ├── TraderCard.tsx          # Thẻ thông tin trader
│   ├── RiskProgressBar.tsx     # Thanh tiến trình rủi ro
│   ├── AppErrorBoundary.tsx    # Xử lý lỗi React
│   ├── PaperVirtualBalance.tsx # Số dư paper trading
│   ├── PaperOrderManager.tsx   # Quản lý lệnh paper
│   ├── PaperPerformanceReport.tsx # Báo cáo hiệu suất paper
│   ├── charts/
│   │   └── CandlestickChart.tsx # Biểu đồ nến (OHLCV)
│   └── portfolio/              # Các component danh mục
│       ├── PortfolioHeroCard.tsx   # Tổng quan danh mục
│       ├── PortfolioSummaryCard.tsx # Tóm tắt tài sản
│       ├── CashBalanceCard.tsx     # Số dư tiền mặt
│       ├── RealPositionsTable.tsx  # Bảng vị thế
│       ├── RealOrderForm.tsx       # Form đặt lệnh
│       ├── ClosePositionModal.tsx  # Modal đóng vị thế
│       └── TransactionHistory.tsx  # Lịch sử giao dịch
└── public/
    ├── favicon.svg
    └── logo.png
```


## Cài đặt

### Yêu cầu

- Node.js v18+

### Các bước

1. Cài đặt dependencies:

```bash
npm install
```

2. Cấu hình biến môi trường (tùy chọn):

Tạo file `.env.local`:

```
VITE_API_URL=http://localhost:3000
VITE_GEMINI_API_KEY=your-gemini-api-key
```

Nếu không tạo file này, ứng dụng sẽ dùng giá trị mặc định kết nối đến `localhost:3000`.

3. Khởi động:

```bash
npm run dev
```

Ứng dụng chạy tại `http://localhost:5173`.


## Build Production

```bash
npm run build
```

Output nằm trong thư mục `dist/`, có thể deploy lên bất kỳ static hosting nào (Vercel, Netlify, Nginx, ...).

```bash
# Xem trước bản build
npm run preview
```


## Các màn hình chính

### Authentication
- Đăng nhập và đăng ký tài khoản.
- Lưu JWT token trong localStorage.

### Dashboard
- Tổng quan tài sản, lời/lỗ, phân bổ danh mục.
- Tín hiệu AI mới nhất, hành động nhanh.
- Widget thị trường real-time.

### Trading Terminal
- Giao diện giao dịch với biểu đồ nến (candlestick).
- Đặt lệnh mua/bán (paper và thật).
- Công cụ vẽ kỹ thuật trên chart.
- Toggle chế độ nâng cao / đơn giản.

### Portfolio Management
- Quản lý danh mục đầu tư thật.
- Bảng vị thế, form đặt lệnh, lịch sử giao dịch.
- Đóng vị thế, tính phí, lời/lỗ.
- Số dư tiền mặt và quản lý vốn.

### Paper Trading
- Mô phỏng giao dịch với số dư ảo.
- Đặt lệnh, theo dõi khớp lệnh, báo cáo hiệu suất.
- Không ảnh hưởng tài sản thật.

### Risk Manager
- Value at Risk (VaR) - đo rủi ro tối đa.
- Monte Carlo Simulation - mô phỏng ngẫu nhiên.
- Stress Test - kiểm tra chịu đựng thị trường cực đoan.
- Phân tích tập trung ngành.

### AI Signals
- Tín hiệu giao dịch từ Google Gemini.
- Khuyến nghị stop loss, take profit.
- Phân tích vị thế hiện tại.

### Watchlist
- Theo dõi giá cổ phiếu real-time.
- Đặt cảnh báo giá.

### Settings
- Cài đặt người dùng, thông số rủi ro.
- Cấu hình AI và thông báo.


## Kết nối Backend

Frontend kết nối với backend qua:

- **REST API** (Axios) - tất cả thao tác CRUD, phân tích AI.
- **WebSocket** (Socket.IO) - nhận cập nhật giá, trạng thái vị thế, thông báo real-time.

Mặc định kết nối đến `http://localhost:3000`. Thay đổi bằng biến môi trường `VITE_API_URL`.


## Responsive

Ứng dụng hỗ trợ responsive:
- Desktop: sidebar navigation, layout nhiều cột.
- Mobile: bottom navigation, layout 1 cột, card thu gọn.


## Ghi chú

- Giá trị tiền tệ hiển thị theo định dạng VND (dấu phẩy phân cách hàng nghìn).
- Biểu đồ sử dụng Lightweight Charts (TradingView open-source).
- Ứng dụng hỗ trợ dark theme.
- Onboarding wizard hướng dẫn người mới 3 bước cơ bản.
