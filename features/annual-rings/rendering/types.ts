import type { EventSelection, MarketDocument, MonthSelection } from '../domain/types';

export type CanvasSize = { width: number; height: number; pixelRatio: number };

export type RenderState = {
  data: MarketDocument;
  selection: MonthSelection;
  eventSelection: EventSelection;
};
