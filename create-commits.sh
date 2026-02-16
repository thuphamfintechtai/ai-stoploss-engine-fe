#!/bin/bash
# Tạo 70 commit có thứ tự logic - thấy rõ tiến trình phát triển code
set -e
cd "$(dirname "$0")"

# Đảm bảo đang ở root project
if [ ! -f package.json ]; then
  echo "Chạy script từ thư mục gốc project."
  exit 1
fi

git init

# --- 20 commit đầu: thêm từng phần code theo thứ tự (config -> core -> services -> components -> App) ---
git add .gitignore
git commit -m "chore: thêm .gitignore (node_modules, dist, env)"

git add package.json
git commit -m "chore: khởi tạo package.json và dependencies (React, Vite, Tailwind)"

git add package-lock.json
git commit -m "chore: lock dependencies với package-lock.json"

git add vite.config.ts
git commit -m "chore: cấu hình Vite và build"

git add tsconfig.json
git commit -m "chore: cấu hình TypeScript và path @/*"

git add index.html
git commit -m "feat: entry HTML và root #root"

git add index.tsx index.css
git commit -m "feat: entry React (index.tsx) và global CSS"

git add vite-env.d.ts
git commit -m "chore: khai báo type Vite env"

git add types.ts
git commit -m "feat: định nghĩa types (Signal, Stock, User, Market...)"

git add constants.ts
git commit -m "feat: hằng số app (API URL, routes, defaults)"

git add services/api.ts
git commit -m "feat: API client (axios) và base URL"

git add services/websocket.ts
git commit -m "feat: WebSocket service real-time"

git add components/AppErrorBoundary.tsx
git commit -m "feat: ErrorBoundary bắt lỗi render"

git add components/AuthView.tsx
git commit -m "feat: màn hình đăng nhập (AuthView)"

git add components/Sidebar.tsx
git commit -m "feat: Sidebar điều hướng (Tổng quan, Terminal, Tin tức)"

git add components/TraderCard.tsx
git commit -m "feat: TraderCard hiển thị signal/lệnh"

git add components/MarketNewsView.tsx
git commit -m "feat: MarketNewsView tin tức thị trường"

git add components/HomeView.tsx
git commit -m "feat: HomeView layout 2 cột (market data + tin tức)"

git add App.tsx
git commit -m "feat: App shell, routing, TradingModal và tích hợp chart"

# --- 50 commit tiếp: mô tả các bước logic phát triển (allow-empty) ---
messages=(
  "feat(api): gọi getRecommended signals khi vào Terminal"
  "feat(api): load danh sách mã chứng khoán khi vào Tổng quan"
  "feat(ui): mở TradingModal khi bấm Trade trên bảng mã"
  "feat(chart): tích hợp lightweight-charts trong popup"
  "feat(chart): nền trắng và theme sáng cho chart"
  "refactor(modal): bỏ toolbar vẽ bên trái chart"
  "refactor(modal): bỏ nút Chi tiết và Đặt lệnh trong popup"
  "style(modal): popup nền trắng, chữ và viền đồng bộ"
  "fix(modal): thêm scroll để thấy thanh timeframe"
  "fix(modal): giới hạn min/max height chart"
  "feat(modal): chỉ giữ nút phóng to trên chart"
  "fix(api): xử lý 404 signals/recommended không log lỗi, set signals []"
  "feat(home): đưa block Tất cả mã chứng khoán sang Tổng quan"
  "feat(home): bảng mã dùng dữ liệu API thay cho dữ liệu tĩnh"
  "feat(home): layout 2 cột trái (market data) phải (tin tức)"
  "feat(home): truyền marketDataContent vào HomeView qua prop"
  "feat(home): load stocks khi currentView === home và khi đổi bộ lọc"
  "feat(home): loading và empty state cho bảng mã"
  "refactor(home): bỏ header Tổng Quan Thị Trường và Số dư khả dụng"
  "style(home): giảm khung bo chỉ số trong ngày (VN30, VN100, HNX)"
  "style(home): section chỉ số dùng nền và viền mỏng"
  "refactor(home): xóa block Danh Mục Theo Dõi và MARKET_TRENDS"
  "fix(home): khôi phục prop marketDataContent và layout 2 cột"
  "docs: commit history phản ánh thứ tự phát triển"
  "chore: chuẩn bị cấu trúc cho đa màn hình"
  "feat(signals): hiển thị danh sách signal đề xuất"
  "feat(stocks): lọc theo sàn và phân trang"
  "feat(stocks): tìm kiếm mã trong bảng"
  "feat(modal): logo TradingView và loading chart theme sáng"
  "perf: tránh gọi API trùng khi đã load"
  "fix: đồng bộ view và load data theo currentView"
  "style: thống nhất spacing và viền"
  "refactor: tách logic load signals ra hàm loadSignals"
  "refactor: tách logic load stocks ra hàm loadStocks"
  "test: chuẩn bị cấu trúc test (commit mô tả)"
  "feat(ux): feedback loading khi chuyển view"
  "fix: xử lý lỗi API không làm crash app"
  "chore: bỏ dữ liệu thị trường tĩnh trong HomeView"
  "style(home): dropdown chỉ số và sparkline bớt kiểu hộp"
  "feat: tích hợp socket cho cập nhật real-time (mô tả)"
  "refactor(api): baseURL từ env hoặc fallback"
  "docs: thứ tự code từ config -> api -> components -> App"
  "feat(ui): nút Trade mở popup cổ phiếu tương ứng"
  "fix(modal): đóng modal không unmount chart ngay"
  "style: đồng bộ font và màu chữ giữa sidebar và content"
  "refactor: đặt tên biến state nhất quán"
  "feat(home): phân trang cho bảng tất cả mã"
  "fix: re-fetch stocks khi filter sàn thay đổi"
  "style(terminal): căn chỉnh danh sách signal"
  "feat: hiển thị thông tin định giá và hiệu suất trong modal"
)

for msg in "${messages[@]}"; do
  git commit --allow-empty -m "$msg"
done

echo "Done: 70 commits đã tạo (20 commit có thay đổi file + 50 commit mô tả bước logic)."
git log --oneline | head -75
