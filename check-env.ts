import { loadEnv } from 'vite';
const env = loadEnv('development', '.', '');
console.log('GEMINI_API_KEY exists:', !!env.GEMINI_API_KEY);
if (env.GEMINI_API_KEY) {
  console.log('GEMINI_API_KEY starts with:', env.GEMINI_API_KEY.substring(0, 4));
  console.log('GEMINI_API_KEY is placeholder:', env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY');
}
