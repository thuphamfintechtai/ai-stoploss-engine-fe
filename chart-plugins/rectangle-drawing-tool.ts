/**
 * Rectangle Drawing Tool - from TradingView lightweight-charts plugin-examples
 * https://github.com/tradingview/lightweight-charts/tree/master/plugin-examples
 */
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
  type Coordinate,
  type IChartApi,
  isBusinessDay,
  type ISeriesApi,
  type ISeriesPrimitiveAxisView,
  type IPrimitivePaneRenderer,
  type IPrimitivePaneView,
  type MouseEventParams,
  type PrimitivePaneViewZOrder,
  type SeriesType,
  type Time,
} from 'lightweight-charts';
import { ensureDefined } from './helpers/assertions';
import { PluginBase } from './plugin-base';
import { positionsBox } from './helpers/dimensions/positions';

interface ViewPoint {
  x: Coordinate | null;
  y: Coordinate | null;
}

class RectanglePaneRenderer implements IPrimitivePaneRenderer {
  _p1: ViewPoint;
  _p2: ViewPoint;
  _fillColor: string;

  constructor(p1: ViewPoint, p2: ViewPoint, fillColor: string) {
    this._p1 = p1;
    this._p2 = p2;
    this._fillColor = fillColor;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (
        this._p1.x === null ||
        this._p1.y === null ||
        this._p2.x === null ||
        this._p2.y === null
      )
        return;
      const ctx = scope.context;
      const horizontalPositions = positionsBox(
        this._p1.x,
        this._p2.x,
        scope.horizontalPixelRatio
      );
      const verticalPositions = positionsBox(
        this._p1.y,
        this._p2.y,
        scope.verticalPixelRatio
      );
      ctx.fillStyle = this._fillColor;
      ctx.fillRect(
        horizontalPositions.position,
        verticalPositions.position,
        horizontalPositions.length,
        verticalPositions.length
      );
    });
  }
}

class RectanglePaneView implements IPrimitivePaneView {
  _source: Rectangle;
  _p1: ViewPoint = { x: null, y: null };
  _p2: ViewPoint = { x: null, y: null };

  constructor(source: Rectangle) {
    this._source = source;
  }

  update(): void {
    const series = this._source.series;
    const y1 = series.priceToCoordinate(this._source._p1.price as number);
    const y2 = series.priceToCoordinate(this._source._p2.price as number);
    const timeScale = this._source.chart.timeScale();
    const x1 = timeScale.timeToCoordinate(this._source._p1.time);
    const x2 = timeScale.timeToCoordinate(this._source._p2.time);
    this._p1 = { x: x1, y: y1 };
    this._p2 = { x: x2, y: y2 };
  }

  renderer(): RectanglePaneRenderer {
    return new RectanglePaneRenderer(
      this._p1,
      this._p2,
      this._source._options.fillColor
    );
  }
}

class RectangleAxisPaneRenderer implements IPrimitivePaneRenderer {
  _p1: number | null;
  _p2: number | null;
  _fillColor: string;
  _vertical: boolean = false;

  constructor(
    p1: number | null,
    p2: number | null,
    fillColor: string,
    vertical: boolean
  ) {
    this._p1 = p1;
    this._p2 = p2;
    this._fillColor = fillColor;
    this._vertical = vertical;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (this._p1 === null || this._p2 === null) return;
      const ctx = scope.context;
      ctx.globalAlpha = 0.5;
      const positions = positionsBox(
        this._p1,
        this._p2,
        this._vertical ? scope.verticalPixelRatio : scope.horizontalPixelRatio
      );
      ctx.fillStyle = this._fillColor;
      if (this._vertical) {
        ctx.fillRect(0, positions.position, 15, positions.length);
      } else {
        ctx.fillRect(positions.position, 0, positions.length, 15);
      }
    });
  }
}

abstract class RectangleAxisPaneView implements IPrimitivePaneView {
  _source: Rectangle;
  _p1: number | null = null;
  _p2: number | null = null;
  _vertical: boolean = false;

  constructor(source: Rectangle, vertical: boolean) {
    this._source = source;
    this._vertical = vertical;
  }

  abstract getPoints(): [Coordinate | null, Coordinate | null];

  update(): void {
    [this._p1, this._p2] = this.getPoints();
  }

  renderer(): RectangleAxisPaneRenderer {
    return new RectangleAxisPaneRenderer(
      this._p1,
      this._p2,
      this._source._options.fillColor,
      this._vertical
    );
  }
  zOrder(): PrimitivePaneViewZOrder {
    return 'bottom';
  }
}

class RectanglePriceAxisPaneView extends RectangleAxisPaneView {
  getPoints(): [Coordinate | null, Coordinate | null] {
    const series = this._source.series;
    const y1 = series.priceToCoordinate(this._source._p1.price as number);
    const y2 = series.priceToCoordinate(this._source._p2.price as number);
    return [y1, y2];
  }
}

class RectangleTimeAxisPaneView extends RectangleAxisPaneView {
  getPoints(): [Coordinate | null, Coordinate | null] {
    const timeScale = this._source.chart.timeScale();
    const x1 = timeScale.timeToCoordinate(this._source._p1.time);
    const x2 = timeScale.timeToCoordinate(this._source._p2.time);
    return [x1, x2];
  }
}

interface Point {
  time: Time;
  price: number;
}

abstract class RectangleAxisView implements ISeriesPrimitiveAxisView {
  _source: Rectangle;
  _p: Point;
  _pos: Coordinate | null = null;
  constructor(source: Rectangle, p: Point) {
    this._source = source;
    this._p = p;
  }
  abstract update(): void;
  abstract text(): string;

  coordinate(): number {
    return this._pos ?? -1;
  }

  visible(): boolean {
    return this._source._options.showLabels;
  }

  tickVisible(): boolean {
    return this._source._options.showLabels;
  }

  textColor(): string {
    return this._source._options.labelTextColor;
  }
  backColor(): string {
    return this._source._options.labelColor;
  }
  movePoint(p: Point): void {
    this._p = p;
    this.update();
  }
}

class RectangleTimeAxisView extends RectangleAxisView {
  update(): void {
    const timeScale = this._source.chart.timeScale();
    this._pos = timeScale.timeToCoordinate(this._p.time);
  }
  text(): string {
    return this._source._options.timeLabelFormatter(this._p.time);
  }
}

class RectanglePriceAxisView extends RectangleAxisView {
  update(): void {
    const series = this._source.series;
    this._pos = series.priceToCoordinate(this._p.price as number);
  }
  text(): string {
    return this._source._options.priceLabelFormatter(this._p.price);
  }
}

export interface RectangleDrawingToolOptions {
  fillColor: string;
  previewFillColor: string;
  labelColor: string;
  labelTextColor: string;
  showLabels: boolean;
  priceLabelFormatter: (price: number) => string;
  timeLabelFormatter: (time: Time) => string;
}

const defaultOptions: RectangleDrawingToolOptions = {
  fillColor: 'rgba(200, 50, 100, 0.75)',
  previewFillColor: 'rgba(200, 50, 100, 0.25)',
  labelColor: 'rgba(200, 50, 100, 1)',
  labelTextColor: 'white',
  showLabels: true,
  priceLabelFormatter: (price: number) => price.toFixed(2),
  timeLabelFormatter: (time: Time) => {
    if (typeof time === 'string') return time;
    const date = isBusinessDay(time)
      ? new Date(time.year, time.month, time.day)
      : new Date((time as number) * 1000);
    return date.toLocaleDateString();
  },
};

class Rectangle extends PluginBase {
  _options: RectangleDrawingToolOptions;
  _p1: Point;
  _p2: Point;
  _paneViews: RectanglePaneView[];
  _timeAxisViews: RectangleTimeAxisView[];
  _priceAxisViews: RectanglePriceAxisView[];
  _priceAxisPaneViews: RectanglePriceAxisPaneView[];
  _timeAxisPaneViews: RectangleTimeAxisPaneView[];

  constructor(p1: Point, p2: Point, options: Partial<RectangleDrawingToolOptions> = {}) {
    super();
    this._p1 = p1;
    this._p2 = p2;
    this._options = { ...defaultOptions, ...options };
    this._paneViews = [new RectanglePaneView(this)];
    this._timeAxisViews = [
      new RectangleTimeAxisView(this, p1),
      new RectangleTimeAxisView(this, p2),
    ];
    this._priceAxisViews = [
      new RectanglePriceAxisView(this, p1),
      new RectanglePriceAxisView(this, p2),
    ];
    this._priceAxisPaneViews = [new RectanglePriceAxisPaneView(this, true)];
    this._timeAxisPaneViews = [new RectangleTimeAxisPaneView(this, false)];
  }

  updateAllViews(): void {
    this._paneViews.forEach((pw) => pw.update());
    this._timeAxisViews.forEach((pw) => pw.update());
    this._priceAxisViews.forEach((pw) => pw.update());
    this._priceAxisPaneViews.forEach((pw) => pw.update());
    this._timeAxisPaneViews.forEach((pw) => pw.update());
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this._priceAxisViews;
  }

  timeAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this._timeAxisViews;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }

  priceAxisPaneViews(): readonly IPrimitivePaneView[] {
    return this._priceAxisPaneViews;
  }

  timeAxisPaneViews(): readonly IPrimitivePaneView[] {
    return this._timeAxisPaneViews;
  }

  applyOptions(options: Partial<RectangleDrawingToolOptions>): void {
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }
}

class PreviewRectangle extends Rectangle {
  constructor(
    p1: Point,
    p2: Point,
    options: Partial<RectangleDrawingToolOptions> = {}
  ) {
    super(p1, p2, options);
    this._options.fillColor = this._options.previewFillColor;
  }

  updateEndPoint(p: Point): void {
    this._p2 = p;
    this._paneViews[0].update();
    this._timeAxisViews[1].movePoint(p);
    this._priceAxisViews[1].movePoint(p);
    this.requestUpdate();
  }
}

export class RectangleDrawingTool {
  private _chart: IChartApi<Time> | undefined;
  private _series: ISeriesApi<SeriesType, Time> | undefined;
  private _drawingsToolbarContainer: HTMLDivElement | undefined;
  private _defaultOptions: Partial<RectangleDrawingToolOptions>;
  private _rectangles: Rectangle[] = [];
  private _previewRectangle: PreviewRectangle | undefined = undefined;
  private _points: Point[] = [];
  private _drawing: boolean = false;
  private _toolbarButton: HTMLButtonElement | undefined;

  constructor(
    chart: IChartApi<Time>,
    series: ISeriesApi<SeriesType, Time>,
    drawingsToolbarContainer: HTMLDivElement,
    options: Partial<RectangleDrawingToolOptions> = {}
  ) {
    this._chart = chart;
    this._series = series;
    this._drawingsToolbarContainer = drawingsToolbarContainer;
    this._defaultOptions = options;
    this._addToolbarButton();
    this._rectangles = [];
    this._chart.subscribeClick(this._clickHandler);
    this._chart.subscribeCrosshairMove(this._moveHandler);
  }

  private _clickHandler = (param: MouseEventParams<Time>) => this._onClick(param);
  private _moveHandler = (param: MouseEventParams<Time>) => this._onMouseMove(param);

  remove(): void {
    this.stopDrawing();
    if (this._chart) {
      this._chart.unsubscribeClick(this._clickHandler);
      this._chart.unsubscribeCrosshairMove(this._moveHandler);
    }
    this._rectangles.forEach((rectangle) => {
      this._removeRectangle(rectangle);
    });
    this._rectangles = [];
    this._removePreviewRectangle();
    this._chart = undefined;
    this._series = undefined;
    this._drawingsToolbarContainer = undefined;
  }

  startDrawing(): void {
    this._drawing = true;
    this._points = [];
    if (this._toolbarButton) {
      this._toolbarButton.style.backgroundColor = 'rgb(100, 150, 250)';
    }
  }

  stopDrawing(): void {
    this._drawing = false;
    this._points = [];
    if (this._toolbarButton) {
      this._toolbarButton.style.backgroundColor = 'transparent';
    }
  }

  isDrawing(): boolean {
    return this._drawing;
  }

  private _onClick(param: MouseEventParams<Time>): void {
    if (!this._drawing || !param.point || !param.time || !this._series) return;
    const price = this._series.coordinateToPrice(param.point.y);
    if (price === null) return;
    this._addPoint({
      time: param.time,
      price: price as number,
    });
  }

  private _onMouseMove(param: MouseEventParams<Time>): void {
    if (!this._drawing || !param.point || !param.time || !this._series) return;
    const price = this._series.coordinateToPrice(param.point.y);
    if (price === null) return;
    if (this._previewRectangle) {
      this._previewRectangle.updateEndPoint({
        time: param.time,
        price: price as number,
      });
    }
  }

  private _addPoint(p: Point): void {
    this._points.push(p);
    if (this._points.length >= 2) {
      this._addNewRectangle(this._points[0], this._points[1]);
      this.stopDrawing();
      this._removePreviewRectangle();
    }
    if (this._points.length === 1) {
      this._addPreviewRectangle(this._points[0]);
    }
  }

  private _addNewRectangle(p1: Point, p2: Point): void {
    const rectangle = new Rectangle(p1, p2, { ...this._defaultOptions });
    this._rectangles.push(rectangle);
    ensureDefined(this._series).attachPrimitive(rectangle);
  }

  private _removeRectangle(rectangle: Rectangle): void {
    ensureDefined(this._series).detachPrimitive(rectangle);
  }

  private _addPreviewRectangle(p: Point): void {
    this._previewRectangle = new PreviewRectangle(p, p, {
      ...this._defaultOptions,
    });
    ensureDefined(this._series).attachPrimitive(this._previewRectangle);
  }

  private _removePreviewRectangle(): void {
    if (this._previewRectangle) {
      ensureDefined(this._series).detachPrimitive(this._previewRectangle);
      this._previewRectangle = undefined;
    }
  }

  private _addToolbarButton(): void {
    if (!this._drawingsToolbarContainer) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Vẽ hình chữ nhật (click 2 điểm trên biểu đồ)';
    button.style.width = '32px';
    button.style.height = '28px';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.border = '1px solid #E5E7EB';
    button.style.borderRadius = '6px';
    button.style.background = 'transparent';
    button.style.cursor = 'pointer';
    button.style.padding = '0';
    button.innerHTML = `<svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="22" height="16" rx="1"/></svg>`;
    button.addEventListener('click', () => {
      if (this.isDrawing()) {
        this.stopDrawing();
      } else {
        this.startDrawing();
      }
    });
    this._drawingsToolbarContainer.appendChild(button);
    this._toolbarButton = button;

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = '#C83264';
    colorPicker.title = 'Màu hình chữ nhật';
    colorPicker.style.width = '28px';
    colorPicker.style.height = '28px';
    colorPicker.style.border = 'none';
    colorPicker.style.borderRadius = '6px';
    colorPicker.style.padding = '2px';
    colorPicker.style.cursor = 'pointer';
    colorPicker.style.backgroundColor = 'transparent';
    colorPicker.addEventListener('change', () => {
      const newColor = colorPicker.value;
      this._defaultOptions.fillColor = newColor + 'CC';
      this._defaultOptions.previewFillColor = newColor + '77';
      this._defaultOptions.labelColor = newColor;
    });
    this._drawingsToolbarContainer.appendChild(colorPicker);
  }
}
