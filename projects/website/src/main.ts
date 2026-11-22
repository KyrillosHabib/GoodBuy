import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { restoreCachedTheme, setDefaultFont } from '@shared/core/theme';

// One modern family for Arabic and English (the dashboard can still choose another font)
setDefaultFont('Readex Pro');
restoreCachedTheme();

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
