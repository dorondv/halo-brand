import arcjet, { fixedWindow, shield, slidingWindow } from '@arcjet/next';
import { Env } from './Env';

// Only initialize Arcjet if API key is configured
const getArcjetInstance = () => {
  if (!Env.ARCJET_KEY) {
    return null;
  }

  return arcjet({
    key: Env.ARCJET_KEY,
    characteristics: ['ip.src', 'http.request.uri.path'],
    rules: [
      // Shield protects against common attacks (OWASP Top 10)
      shield({
        mode: 'LIVE', // Use 'DRY_RUN' to test without blocking
      }),
      // Rate limit: Fixed window of 60 seconds
      fixedWindow({
        mode: 'LIVE',
        window: '1m', // 1 minute window
        max: 30, // Max 30 requests per window per IP
      }),
      // Additional rate limit: Sliding window for stricter control
      slidingWindow({
        mode: 'LIVE',
        interval: '1h', // 1 hour interval
        max: 1000, // Max 1000 requests per hour per IP
      }),
    ],
  });
};

// Stricter Arcjet instance for signup routes
const getSignupArcjetInstance = () => {
  if (!Env.ARCJET_KEY) {
    return null;
  }

  return arcjet({
    key: Env.ARCJET_KEY,
    characteristics: ['ip.src', 'http.request.uri.path'],
    rules: [
      // Shield protects against common attacks (OWASP Top 10)
      shield({
        mode: 'LIVE',
      }),
      // Stricter rate limit for signup: 5 requests per 15 minutes per IP
      fixedWindow({
        mode: 'LIVE',
        window: '15m', // 15 minute window
        max: 5, // Max 5 signup attempts per 15 minutes per IP
      }),
      // Additional protection: Max 10 signups per hour per IP
      slidingWindow({
        mode: 'LIVE',
        interval: '1h', // 1 hour interval
        max: 10, // Max 10 signup attempts per hour per IP
      }),
    ],
  });
};

const aj = getArcjetInstance();
const ajSignup = getSignupArcjetInstance();

export default aj;
export { ajSignup };
