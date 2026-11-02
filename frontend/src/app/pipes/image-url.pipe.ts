import { Pipe, PipeTransform } from '@angular/core';
import { resolveApiOrigin } from '../config';

@Pipe({
  name: 'imageUrl',
  standalone: true
})
export class ImageUrlPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.startsWith('assets/') || value.startsWith('/assets/')) {
      return value.replace(/^\//, '');
    }

    const origin = resolveApiOrigin();
    return `${origin}${value}`;
  }
}
