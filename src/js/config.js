const CONFIG = {
  // MSAL configuration — clientId will be updated after Entra ID app registration
  msal: {
    auth: {
      clientId: 'd1ad912f-a083-4449-8b12-92fde5c9d7db',
      authority: 'https://login.microsoftonline.com/44c8266a-ac5b-4499-9611-66018108683a',
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false,
    },
  },

  // Scope for acquiring access token to vm-task API
  apiScopes: ['api://0b9ebf85-47ea-4c9f-b67a-64f3ed297a4c/.default'],

  // Auto-refresh interval (ms)
  refreshInterval: 30000,

  // VM definitions
  vms: [
    { name: 'BravuraDemo',        rg: 'Bravura_DV',  ip: '10.0.1.6',  alwaysOn: false },
    { name: 'BravuraDVEnv',       rg: 'Bravura_DV',  ip: '10.0.1.5',  alwaysOn: false },
    { name: 'BravuraDockerHost',  rg: 'Bravura_DV',  ip: '10.0.1.7',  alwaysOn: false },
    { name: 'LonzaVM',            rg: 'Bravura_DV',  ip: '10.0.2.5',  alwaysOn: false },
    { name: 'IowaUniversityVM',   rg: 'Bravura_DV',  ip: '10.0.2.6',  alwaysOn: false },
    { name: 'BrianShared',        rg: 'Bravura_DV',  ip: '10.0.2.8',  alwaysOn: false },
    { name: 'DamonShared',        rg: 'Bravura_DV',  ip: '10.0.2.9',  alwaysOn: false },
    { name: 'BravuraAI',          rg: 'BravuraAI',   ip: null,         alwaysOn: false },
    { name: 'BravuraPlntUnityVM', rg: 'Bravura_DV',  ip: '10.0.1.4',  alwaysOn: false },
    { name: 'OpenVPN-Gateway',    rg: 'Bravura_DV',  ip: '10.0.2.7',  alwaysOn: true },
  ],

  // Client-side auth matrix — UI only (server enforces the real check)
  admins: ['bartek.pien@bravura-ai.com', 'brian.mcwhorter@bravura-ai.com'],
  vmPermissions: {
    'BrianShared':  ['brian.mcwhorter@bravura-ai.com', 'gab.libettario@bravura-ai.com'],
    'DamonShared':  ['damon.kirin@bravura-ai.com', 'leah.acain@bravura-ai.com'],
  },
};
