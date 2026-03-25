const VM_WHITELIST = {
  'BravuraDemo':        'Bravura_DV',
  'BravuraDVEnv':       'Bravura_DV',
  'BravuraDockerHost':  'Bravura_DV',
  'LonzaVM':            'Bravura_DV',
  'IowaUniversityVM':   'Bravura_DV',
  'BrianShared':        'Bravura_DV',
  'DamonShared':        'Bravura_DV',
  'BravuraAI':          'BravuraAI',
  'BravuraPlntUnityVM': 'Bravura_DV',
  'OpenVPN-Gateway':    'Bravura_DV',
};

// VMs that are 24/7 — no start/stop/extend allowed for anyone
const STATUS_ONLY_VMS = ['BravuraPlntUnityVM', 'OpenVPN-Gateway'];

// Actions that require authorization check (status is open to all authenticated users)
const PROTECTED_ACTIONS = ['start', 'stop', 'extend-shutdown'];

// Authorization matrix
const ADMINS = [
  'bartek.pien@bravura-ai.com',
  'brian.mcwhorter@bravura-ai.com',
];

const VM_PERMISSIONS = {
  'BrianShared':  ['brian.mcwhorter@bravura-ai.com', 'gab.libettario@bravura-ai.com'],
  'DamonShared':  ['damon.kirin@bravura-ai.com', 'leah.acain@bravura-ai.com'],
};

function isAuthorized(email, vmName, action) {
  const normalizedEmail = email.toLowerCase();

  // Status is always allowed for authenticated users
  if (action === 'status' || action === 'shutdown-schedule') return true;

  // Always-on VMs: no actions allowed
  if (STATUS_ONLY_VMS.includes(vmName)) return false;

  // Admins can do everything
  if (ADMINS.some(a => a.toLowerCase() === normalizedEmail)) return true;

  // Check VM-specific permissions
  const allowed = VM_PERMISSIONS[vmName];
  if (allowed && allowed.some(a => a.toLowerCase() === normalizedEmail)) return true;

  return false;
}

module.exports = { VM_WHITELIST, STATUS_ONLY_VMS, PROTECTED_ACTIONS, isAuthorized };
