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
      <div className="bg-gray-800 rounded-xl shadow-lg p-5">
        <h3 className="text-sm font-bold text-white mb-4">Vi The Dang Mo</h3>
        <div className="text-center py-8 text-gray-500 text-[11px] animate-pulse">
          Dang tai...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-5">
      <h3 className="text-sm font-bold text-white mb-4">
        Vi The Dang Mo
        {positions.length > 0 && (
          <span className="ml-2 text-[10px] font-normal text-gray-400">
            ({positions.length} vi the)
          </span>
        )}
      </h3>

      {positions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-[11px]">
          Chua co vi the nao
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  Ma CK
                </th>
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  San
                </th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  Gia Vao
                </th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  So Luong
                </th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  Gia HT
                </th>
                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  P&L
                </th>
                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  Ngay Mo
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
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-white font-mono">
                        {pos.symbol}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-gray-400">{pos.exchange}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                      {formatVND(Number(pos.entry_price))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                      {Number(pos.quantity).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {pos.current_price != null ? (
                        <span className="text-gray-300">
                          {formatVND(Number(pos.current_price))}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {hasPnl ? (
                        <span
                          className={`font-semibold ${
                            pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {formatVND(pnl)}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {formatDate(pos.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => onClosePosition(pos)}
                        className="text-[9px] font-semibold text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400 px-2 py-1 rounded transition-colors"
                      >
                        Dong vi the
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
