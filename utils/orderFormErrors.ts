/**
 * Typed error keys for RealOrderForm submit validation (C-05 lock).
 *
 * Source of truth for user-facing error copy when handleSubmit short-circuits.
 * Field-level rule errors (LOT/TICK/BAND) continue rendering inline via
 * `<OrderFieldError>` from useMarketRules; constants below cover the
 * submit-level + cross-field copy.
 *
 * DO NOT inline magic strings — every `setError(...)` call site in
 * RealOrderForm.tsx must reference `ORDER_FORM_ERRORS[KEY]`.
 */

export type OrderFormErrorKey =
  | 'MISSING_SYMBOL'
  | 'MISSING_EXCHANGE'
  | 'INVALID_QUANTITY'
  | 'INVALID_PRICE'
  | 'MISSING_DATE'
  | 'TICK_VIOLATION'
  | 'LOT_VIOLATION'
  | 'BAND_VIOLATION'
  | 'RULE_ERROR_PRESENT';

export const ORDER_FORM_ERRORS: Record<OrderFormErrorKey, string> = {
  MISSING_SYMBOL: 'Vui lòng nhập mã chứng khoán',
  MISSING_EXCHANGE: 'Vui lòng chọn sàn',
  INVALID_QUANTITY: 'Số lượng phải lớn hơn 0',
  INVALID_PRICE: 'Giá khớp phải lớn hơn 0',
  MISSING_DATE: 'Vui lòng chọn ngày khớp',
  TICK_VIOLATION: 'Giá không khớp bước giá quy định',
  LOT_VIOLATION: 'Số lượng phải là bội số lô tối thiểu',
  BAND_VIOLATION: 'Giá ngoài biên độ cho phép',
  RULE_ERROR_PRESENT: 'Vui lòng sửa các lỗi quy tắc sàn trước khi gửi lệnh',
};

/**
 * Pair an error key with the ref-name of the field that should receive focus
 * after `setError(...)`. Consumed by RealOrderForm submit handler to map the
 * first invalid field → focus target.
 */
export interface FieldFocusTarget {
  key: OrderFormErrorKey;
  fieldRef: 'symbol' | 'exchange' | 'quantity' | 'price' | 'filledDate';
}
