import React from 'react';
import type { RealPosition } from '../../services/api';

interface RealPositionsTableProps {
  positions: RealPosition[];
  onClosePosition: (position: RealPosition) => void;
  loading?: boolean;
}

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export const RealPositionsTable: React.FC<RealPositionsTableProps> = ({
  positions,
  onClosePosition,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="panel-section">
        <div className="px-4 py-2.5 border-b border-[var(--color-divider)]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Vị thế đang mở</span>
        </div>
        <div className="text-center py-8 text-[var(--color-text-disabled)] text-[11px] animate-pulse">
          Đang tải...
        </div>
      </div>
    );
  }

  return (
    <div className="panel-section">
      <div className="px-4 py-2.5 border-b border-[var(--color-divider)]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Vị thế đang mở
        </span>
        {positions.length > 0 && (
          <span className="ml-2 text-[10px] text-[var(--color-text-dim)]">({positions.length})</span>
        )}
      </div>

      {positions.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-disabled)] text-[11px]">
          Chưa có vị thế nào
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-terminal w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
                  Mã CK
                </th>
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
                  Sàn
                </th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
                  Giá vào
                </th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
                  Số lượng
                </th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
                  Giá HT
                </th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
                  P&L
                </th>
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
                  Ngày mở
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const pnl = pos.unrealized_pnl ?? 0;
                const hasPnl = pos.current_price != null;
                return (
                  <tr
                    key={pos.id}
                    className="border-b border-[var(--color-divider)] hover:bg-[var(--color-panel-hover)] transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-[var(--color-text-main)] font-mono">
                        {pos.symbol}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[var(--color-text-muted)]">{pos.exchange}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[var(--color-text-muted)]">
                      {formatVND(Number(pos.entry_price))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[var(--color-text-muted)]">
                      {Number(pos.quantity).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {pos.current_price != null ? (
                        <span className="text-[var(--color-text-muted)]">
                          {formatVND(Number(pos.current_price))}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-disabled)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {hasPnl ? (
                        <span
                          className={`font-semibold ${
                            pnl >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                          }`}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {formatVND(pnl)}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-disabled)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-muted)]">
                      {formatDate(pos.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => onClosePosition(pos)}
                        className="text-[9px] font-semibold bg-[var(--color-negative)]/15 text-[var(--color-negative)] hover:bg-[var(--color-negative)]/25 px-2 py-1 rounded transition-colors"
                      >
                        Đóng vị thế
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
