import { Pipe, PipeTransform } from '@angular/core';
import { SettingsService } from '../services/settings.service';

@Pipe({
  name: 'formatCurrency',
  standalone: true
})
export class FormatCurrencyPipe implements PipeTransform {
  constructor(private settings: SettingsService) {}

  transform(value: any, digits = 2): string {
    const num = Number(value);
    if (isNaN(num)) return '';
    return `${num.toLocaleString('fr-FR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    })} ${this.settings.currency.symbol}`;
  }
}
