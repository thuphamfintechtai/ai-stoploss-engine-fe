import React from 'react';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type AlertAction =
  | 'HOLD'
  | 'TIGHTEN_SL'
  | 'TAKE_PARTIAL'
  | 'EXIT'
  | 'REBALANCE'
  | 'INFO';

export interface AiAlert {
  id: string;
  portfolio_id: string;
  position_id?: string | null;
  severity: AlertSeverity;
  symbol?: string | null;
  title: string;
  narrative: string;
  action_type?: AlertAction | null;
  action_payload?: Record<string, unknown> | null;
  acked_at?: string | null;
  dismissed_at?: string | null;
  created_at: string;
}

export interface MonitorState {
  enabled: boolean;
  frequency_min: 15 | 30 | 60 | 120;
  last_run_at?: string | null;
  next_run_at?: string | null;
}

interface AiMonitorSectionProps {
  portfolioId: string;
  /** Phase 4 sẽ fetch GET /monitor/state. P1 = undefined → render trạng thái Off mặc định. */
  state?: MonitorState;
  /** Phase 4 sẽ fetch GET /alerts?since=now-7d. P1 = []. */
  alerts?: AiAlert[];
  loading?: boolean;
  onToggle?: (enabled: boolean) => void;
  onChangeFrequency?: (min: 15 | 30 | 60 | 120) => void;
  onAckAlert?: (id: string) => void;
  onDismissAlert?: (id: string) => void;
  onApplyAlert?: (alert: AiAlert) => void;
}

const SEVERITY_DOT: Record<AlertSeverity, string> = {
  LOW: 'bg-[var(--color-text-muted)]',
  MEDIUM: 'bg-[var(--color-warning)]',
  HIGH: 'bg-[var(--color-negative)] animate-pulse',
};

export const AiMonitorSection: React.FC<AiMonitorSectionProps> = ({
  state,
  alerts = [],
  loading,
  onToggle,
  onChangeFrequency: _onChangeFrequency,
  onAckAlert: _onAckAlert,
  onDismissAlert: _onDismissAlert,
  onApplyAlert: _onApplyAlert,
}) => {
  const enabled = state?.enabled ?? false;
  const frequency = state?.frequency_min ?? 30;

  return (
    <div className="panel-section">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-divider)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[14px]" aria-hidden>
            🤖
          </span>
          <h3 className="text-[12px] font-semibold text-[var(--color-text-main)]">
            AI Giám sát
          </h3>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              enabled
                ? 'bg-[var(--color-positive)]/10 text-[var(--color-positive)]'
                : 'bg-white/5 text-[var(--color-text-muted)]'
            }`}
          >
            {enabled ? `Đang chạy · ${frequency}ph/lần` : 'Đã tắt'}
          </span>
        </div>
        <button
          onClick={() => onToggle?.(!enabled)}
          disabled={!onToggle}
          className={`text-[11px] font-semibold px-3 py-1.5 rounded transition-colors ${
            enabled
              ? 'bg-[var(--color-negative)]/10 text-[var(--color-negative)] hover:bg-[var(--color-negative)]/20'
              : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {enabled ? 'Tắt giám sát' : 'Bật giám sát'}
        </button>
      </div>

      {/* Body */}
      <div className="p-4">
        {!enabled && alerts.length === 0 && (
          <div className="text-center py-6">
            <p className="text-[12px] text-[var(--color-text-muted)] mb-1">
              AI sẽ rà soát danh mục của bạn định kỳ
            </p>
            <p className="text-[10px] text-[var(--color-text-dim)]">
              Bật giám sát để nhận cảnh báo khi vị thế chạm SL, gần TP, hoặc danh mục mất cân bằng.
            </p>
          </div>
        )}

        {enabled && state?.next_run_at && (
          <div className="text-[11px] text-[var(--color-text-muted)] mb-3">
            Lần rà soát kế tiếp:{' '}
            <span className="font-mono text-[var(--color-text-main)]">
              {new Date(state.next_run_at).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {loading && (
          <div className="text-center py-4 text-[11px] text-[var(--color-text-dim)] animate-pulse">
            Đang tải...
          </div>
        )}

        {alerts.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-2 p-2.5 rounded border border-[var(--color-border-subtle)] hover:bg-[var(--color-panel-hover)] transition-colors"
              >
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[alert.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-dim)] mb-0.5">
                    <span className="font-mono">
                      {new Date(alert.created_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {alert.symbol && (
                      <span className="font-bold text-[var(--color-text-main)]">{alert.symbol}</span>
                    )}
                  </div>
                  <p className="text-[12px] font-medium text-[var(--color-text-main)]">
                    {alert.title}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {alert.narrative}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
