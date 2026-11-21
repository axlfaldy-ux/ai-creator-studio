import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

app.listen(port, host, () => console.log(`AI Creator Studio server listening on ${host}:${port}`));
