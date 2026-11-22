export const environment = {
  production: false,

  // Base URL of the Voltara API (https profile in launchSettings.json)
  //apiUrl: 'https://localhost:7180',
  apiUrl: 'https://goodbuy.runasp.net',

  // Must match Localization:SupportedLanguages / DefaultLanguage in the API
  languages: ['en', 'ar'] as readonly string[],
  defaultLanguage: 'ar',
};
