import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { DopeTableView } from './dope-print.model';

const PIXEL_RATIO = 2;
const PADDING_PX = 16;
const TITLE_HEIGHT_PX = 24;
const LINE_HEIGHT_PX = 18;
const ROW_HEIGHT_PX = 20;
const COLUMN_WIDTHS_PX = [56, 72, 56, 96, 64, 48];
const PAPER = '#ffffff';
const INK = '#000000';
const GRID = '#9a9a9a';
const TITLE_FONT = '700 16px "Roboto Condensed", sans-serif';
const TEXT_FONT = '500 12px "Roboto Mono", monospace';
const HEADER_FONT = '700 12px "Roboto Mono", monospace';

export function renderDopeImage(view: DopeTableView): Promise<Blob> {
  const widthPx = PADDING_PX * 2 + COLUMN_WIDTHS_PX.reduce((sum, width) => sum + width, 0);
  const tableTopPx = PADDING_PX + TITLE_HEIGHT_PX + view.headerLines.length * LINE_HEIGHT_PX + LINE_HEIGHT_PX / 2;
  const heightPx = tableTopPx + (view.rows.length + 1) * ROW_HEIGHT_PX + PADDING_PX;
  const canvas = document.createElement('canvas');
  canvas.width = widthPx * PIXEL_RATIO;
  canvas.height = heightPx * PIXEL_RATIO;
  const context = canvas.getContext('2d')!;
  context.scale(PIXEL_RATIO, PIXEL_RATIO);
  context.fillStyle = PAPER;
  context.fillRect(0, 0, widthPx, heightPx);
  context.fillStyle = INK;
  context.textBaseline = 'top';
  context.font = TITLE_FONT;
  context.fillText(view.title, PADDING_PX, PADDING_PX);
  context.font = TEXT_FONT;
  view.headerLines.forEach((line, index) => context.fillText(line, PADDING_PX, PADDING_PX + TITLE_HEIGHT_PX + index * LINE_HEIGHT_PX));
  [view.columns, ...view.rows].forEach((cells, rowIndex) => {
    const topPx = tableTopPx + rowIndex * ROW_HEIGHT_PX;
    context.font = rowIndex === 0 ? HEADER_FONT : TEXT_FONT;
    let rightPx = PADDING_PX;
    cells.forEach((cell, columnIndex) => {
      rightPx += COLUMN_WIDTHS_PX[columnIndex];
      context.textAlign = columnIndex === 0 ? 'left' : 'right';
      context.fillText(cell, columnIndex === 0 ? rightPx - COLUMN_WIDTHS_PX[0] : rightPx - 4, topPx + 4);
    });
    context.strokeStyle = rowIndex === 0 ? INK : GRID;
    context.beginPath();
    context.moveTo(PADDING_PX, topPx + ROW_HEIGHT_PX);
    context.lineTo(widthPx - PADDING_PX, topPx + ROW_HEIGHT_PX);
    context.stroke();
  });
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('canvas is empty'))), 'image/png'));
}

export async function deliverDopeImage(blob: Blob, fileName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const written = await Filesystem.writeFile({ path: fileName, data: await base64Of(blob), directory: Directory.Cache });
  await Share.share({ files: [written.uri] });
}

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
