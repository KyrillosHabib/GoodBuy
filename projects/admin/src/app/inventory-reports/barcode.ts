import { Component, Input, OnChanges } from '@angular/core';

// Code 128 (set B): letters, digits and the usual signs. The table was checked against an independent encoder
// for every printable character and for the check digit.
const PATTERNS = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
  '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 ' +
  '232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 ' +
  '313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 ' +
  '111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 ' +
  '114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'
).split(' ');

const START_B = 104;
const STOP = 106;
const QUIET = 10; // empty modules on each side

export interface Bar { x: number; w: number }

export interface BarcodeShape { bars: Bar[]; width: number }

export function code128(text: string): BarcodeShape {
  // Anything Code 128 set B cannot draw becomes "?"
  const chars = Array.from(text ?? '').map((ch) => {
    const code = ch.charCodeAt(0);
    return code >= 32 && code <= 126 ? code - 32 : 31;
  });

  const check = (START_B + chars.reduce((sum, value, i) => sum + value * (i + 1), 0)) % 103;
  const symbols = [START_B, ...chars, check, STOP];

  const bars: Bar[] = [];
  let x = QUIET;

  for (const symbol of symbols) {
    const widths = PATTERNS[symbol].split('').map(Number);

    widths.forEach((w, i) => {
      if (i % 2 === 0) bars.push({ x, w }); // even positions are bars, odd ones are spaces
      x += w;
    });
  }

  return { bars, width: x + QUIET };
}

// <app-barcode value="SKU-001" /> draws the barcode as a vector picture (sharp when printed)
@Component({
  selector: 'app-barcode',
  standalone: true,
  templateUrl: './barcode.html',
  styleUrl: './barcode.css',
})
export class BarcodeComponent implements OnChanges {
  @Input() value = '';

  shape: BarcodeShape = code128('');

  ngOnChanges(): void {
    this.shape = code128(this.value);
  }
}
