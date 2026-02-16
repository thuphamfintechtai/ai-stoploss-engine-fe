# Frontend Integration Guide

## Các file đã sẵn sàng

### 1. API Services (`/services/api.ts`)
- Axios client với JWT authentication
- 5 API modules: auth, portfolio, position, signal, market
- TypeScript interfaces đầy đủ

### 2. WebSocket Client (`/services/websocket.ts`)
- Socket.IO integration
- Auto-reconnection
- Subscribe/unsubscribe methods
- Event listeners cho 6 loại events

### 3. Constants (`/constants.ts`)
- VN stocks thay vì crypto
- Exchanges, Indices, Timeframes
- API_CONFIG từ .env

## 🔧 Cách integrate vào App.tsx

### Bước 1: Import API & WebSocket

```typescript
import { portfolioApi, positionApi, signalApi } from './services/api';
import wsService from './services/websocket';
```

### Bước 2: Thay mock data bằng API calls

**Thay thế:**
```typescript
// CŨ:
const [totalBalance, setTotalBalance] = useState(10000);
const [maxRiskPercent, setMaxRiskPercent] = useState(5);

// MỚI:
const [portfolio, setPortfolio] = useState(null);
const [totalBalance, setTotalBalance] = useState(0);
const [maxRiskPercent, setMaxRiskPercent] = useState(5);
```

### Bước 3: Load data từ API trong useEffect

```typescript
useEffect(() => {
  loadPortfolioData();
  loadPositions();
  loadSignals();
  connectWebSocket();

  return () => {
    wsService.disconnect();
  };
}, []);

async function loadPortfolioData() {
  try {
    const res = await portfolioApi.getAll();
    if (res.data.success && res.data.data.length > 0) {
      const p = res.data.data[0]; // First portfolio
      setPortfolio(p);
      setTotalBalance(p.total_balance);
      setMaxRiskPercent(p.max_risk_percent);
    }
  } catch (error) {
    console.error('Load portfolio failed:', error);
  }
}

async function loadPositions() {
  try {
    const res = await positionApi.getActive();
    if (res.data.success) {
      // Convert API format to local format
      const positions = res.data.data.map(p => ({
        id: p.id,
        symbol: p.symbol,
        entryPrice: parseFloat(p.entry_price),
        stopLoss: parseFloat(p.stop_loss),
        amount: parseFloat(p.quantity),
        riskValue: parseFloat(p.risk_value_usd),
        status: p.status === 'OPEN' ? PositionStatus.OPEN : PositionStatus.CLOSED_SL,
        openedAt: new Date(p.opened_at).toLocaleTimeString(),
        traderName: p.signal_source_id ? 'AI' : undefined
      }));
      setPositions(positions);
    }
  } catch (error) {
    console.error('Load positions failed:', error);
  }
}

async function loadSignals() {
  try {
    const res = await signalApi.getRecommended();
    if (res.data.success) {
      // Update MOCK_TRADERS với real data
      // ...
    }
  } catch (error) {
    console.error('Load signals failed:', error);
  }
}

function connectWebSocket() {
  wsService.connect();

  if (portfolio) {
    wsService.subscribeToPortfolio(portfolio.id);
  }

  // Listen to updates
  wsService.onPositionUpdate((data) => {
    console.log('Position update:', data);
    loadPositions(); // Refresh positions
  });

  wsService.onRiskUpdate((data) => {
    console.log('Risk update:', data);
    // Update risk display
  });

  wsService.onNotification((data) => {
    console.log('Notification:', data);
    alert(`${data.title}\n${data.message}`);
  });
}
```

### Bước 4: Update handleOpenPosition

**Thay thế logic local bằng API call:**

```typescript
const handleOpenPosition = async (symbol: string, entry: number, sl: number, amount: number, traderName?: string) => {
  if (!portfolio) {
    alert("Vui lòng tạo portfolio trước");
    return;
  }

  try {
    const res = await positionApi.create({
      portfolioId: portfolio.id,
      symbol: symbol,
      exchange: 'HOSE', // Hoặc detect từ symbol
      entryPrice: entry,
      stopLoss: sl,
      takeProfit: null,
      quantity: amount
    });

    if (res.data.success) {
      alert(`Lệnh đã được mở: ${symbol}`);
      loadPositions(); // Refresh
    }

  } catch (error: any) {
    if (error.response?.status === 400 && error.response.data.code === 'RISK_EXCEEDED') {
      alert(`⛔ ${error.response.data.message}`);
    } else {
      alert('Không thể mở lệnh. Vui lòng thử lại.');
    }
  }
};
```

### Bước 5: Update handleClosePosition

```typescript
const handleClosePosition = async (id: string, reason: PositionStatus) => {
  try {
    // Get current price (giả sử)
    const position = positions.find(p => p.id === id);
    if (!position) return;

    const closedPrice = position.entryPrice + (Math.random() - 0.5) * 1000;

    const res = await positionApi.close(id, {
      closedPrice: closedPrice,
      notes: reason === PositionStatus.CLOSED_TP ? 'Take profit' : 'Stop loss'
    });

    if (res.data.success) {
      loadPositions(); // Refresh
    }

  } catch (error) {
    console.error('Close position failed:', error);
    alert('Không thể đóng lệnh');
  }
};
```

## 🔧 Cách integrate vào TradeForm

### Thay đổi trong TradeForm.tsx

**Bước 1: Import API**
```typescript
import { positionApi } from '../services/api';
```

**Bước 2: Update Props**
```typescript
interface Props {
  portfolioId: string; // ADD THIS
  maxRiskAmount: number;
  currentRiskUsed: number;
  onSuccess?: () => void; // CHANGE: Remove onOpenPosition, add onSuccess callback
  copyTarget: TraderProfile | null;
  onClearCopyTarget: () => void;
}
```

**Bước 3: Update handleSubmit**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  if (calculatedRisk <= 0) {
    setError("Rủi ro phải lớn hơn 0");
    return;
  }

  if (isRiskExceeded) {
    setError(`Vượt quá hạn mức rủi ro. Còn dư $${remainingRisk.toFixed(2)}.`);
    return;
  }

  try {
    const res = await positionApi.create({
      portfolioId: portfolioId,
      symbol: symbol.toUpperCase(),
      exchange: 'HOSE', // TODO: Auto-detect hoặc dropdown
      entryPrice: parseFloat(entryPrice),
      stopLoss: parseFloat(stopLoss),
      takeProfit: null, // TODO: Add TP field
      quantity: parseFloat(amount.replace(',', '.'))
    });

    if (res.data.success) {
      // Reset form
      setSymbol('ACB');
      setEntryPrice('24000');
      setStopLoss('23500');
      setAmount('100');
      setError(null);

      // Success callback
      if (onSuccess) {
        onSuccess();
      }

      // Clear copy target
      if (copyTarget) {
        onClearCopyTarget();
      }
    }

  } catch (error: any) {
    if (error.response?.status === 400) {
      if (error.response.data.code === 'RISK_EXCEEDED') {
        setError(error.response.data.message);
      } else if (error.response.data.code === 'INVALID_INPUT') {
        setError('Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.');
      } else {
        setError(error.response.data.message || 'Không thể mở lệnh');
      }
    } else if (error.response?.status === 401) {
      setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    } else {
      setError('Lỗi hệ thống. Vui lòng thử lại sau.');
    }
  }
};
```

**Bước 4: Update default values cho VN stocks**
```typescript
// Thay vì BTC, dùng ACB
const [symbol, setSymbol] = useState('ACB');
const [entryPrice, setEntryPrice] = useState<string>('24000');
const [stopLoss, setStopLoss] = useState<string>('23500');
const [amount, setAmount] = useState<string>('100');
```

## 📝 Checklist

### Backend (Hoàn chỉnh)
- [x] Database schema
- [x] API endpoints (28 total)
- [x] WebSocket server
- [x] Stop-loss monitor worker
- [x] Gemini AI service
- [x] Technical analysis service
- [x] Signal collector worker
- [x] AI signal generator worker

### Frontend (Cần update)
- [x] API client (`/services/api.ts`)
- [x] WebSocket client (`/services/websocket.ts`)
- [x] Constants updated (`/constants.ts`)
- [ ] App.tsx - Thay mock bằng API calls
- [ ] TradeForm - Call API để create position
- [ ] Login/Register flow (optional - có thể dùng demo account)

## 🚀 Quick Start Testing

### 1. Start Backend
```bash
cd ai-stoploss-engine-be
npm start  # Port 3000

# Trong terminal khác:
node workers/stopLossMonitor.js
```

### 2. Start Frontend
```bash
cd ai-stoploss-engine-fe
npm run dev  # Port 5173
```

### 3. Login với Demo Account
- Email: `demo@example.com`
- Password: `demo123`

### 4. Test Workflow
1. Vào terminal view
2. Portfolio đã load tự động (balance $10,000, max risk 5%)
3. Thử mở lệnh ACB với risk nhỏ → Success
4. Thử mở lệnh với risk quá lớn → Rejected
5. Check WebSocket real-time updates trong console

## 🔍 Debug Tips

### API Errors
```typescript
// Thêm vào api.ts để log errors
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
```

### WebSocket Connection
```typescript
// Check connection status
console.log('WebSocket connected:', wsService.isConnected());
```

### Risk Calculation
```typescript
// Verify risk calculation matches backend
console.log('Frontend risk:', calculatedRisk);
console.log('Backend risk:', apiResponse.data.risk_value_usd);
```

## Important Notes

1. **Authentication**:
   - Token stored in `localStorage` với key `auth_token`
   - Mỗi API request tự động attach Bearer token

2. **Error Handling**:
   - `RISK_EXCEEDED`: User vượt quá risk limit
   - `INVALID_INPUT`: Validation failed
   - `401`: Token expired → Redirect to login

3. **Real-time Updates**:
   - Stop-loss monitor chạy mỗi 10s
   - WebSocket emit updates khi position đóng
   - Frontend auto-refresh positions

4. **VN Stocks**:
   - Giá tính bằng VND (24,000 thay vì 24k USD)
   - Exchange: HOSE, HNX, UPCOM
   - Symbols: ACB, FPT, VNM, HPG, etc.

