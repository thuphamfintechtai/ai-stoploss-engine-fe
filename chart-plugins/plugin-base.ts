/**
 * Base class for series primitives - from TradingView lightweight-charts plugin-examples
 */
import type {
  DataChangedScope,
  IChartApi,
  ISeriesApi,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import { ensureDefined } from './helpers/assertions';

export abstract class PluginBase implements import('lightweight-charts').ISeriesPrimitive<Time> {
  private _chart: IChartApi<Time> | undefined = undefined;
  private _series: ISeriesApi<SeriesType, Time> | undefined = undefined;

  protected dataUpdated?(_scope: DataChangedScope): void;
  protected requestUpdate(): void {
    if (this._requestUpdate) this._requestUpdate();
  }
  private _requestUpdate?: () => void;

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this._chart = param.chart as IChartApi<Time>;
    this._series = param.series as ISeriesApi<SeriesType, Time>;
    this._series.subscribeDataChanged(this._fireDataUpdated);
    this._requestUpdate = param.requestUpdate;
    this.requestUpdate();
  }

  detached(): void {
    this._series?.unsubscribeDataChanged(this._fireDataUpdated);
    this._chart = undefined;
    this._series = undefined;
    this._requestUpdate = undefined;
  }

  get chart(): IChartApi<Time> {
    return ensureDefined(this._chart);
  }

  get series(): ISeriesApi<SeriesType, Time> {
    return ensureDefined(this._series);
  }

  private _fireDataUpdated = (scope: DataChangedScope): void => {
    if (this.dataUpdated) {
      this.dataUpdated(scope);
    }
  };
}
