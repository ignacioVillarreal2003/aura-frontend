/**
 * Production: configure all API URLs in your release pipeline via file replacement or runtime config.
 */
export const environment = {
  production: true,
  chatApiUrl: '/chat',
  authenticationApiUrl: '',
  documentProcessingUrl: '/processing',
  toolsApiUrl: '/processing',
  notificationApiUrl: '/notifications',
  llmApiUrl: '/llm',
  adminUrl: '/admin/',
};
