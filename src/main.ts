import 'pixi.js/unsafe-eval';
import { bootstrap } from '@/app/bootstrap';

bootstrap().catch((err) => {
  console.error('[HORMUZ] Fatal bootstrap error:', err);
});
