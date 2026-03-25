/* global msal, CONFIG, showToast, refreshAll */

const msalInstance = new msal.PublicClientApplication(CONFIG.msal);

let currentAccount = null;

async function initAuth() {
  await msalInstance.handleRedirectPromise();

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
    onLoginSuccess();
  }
}

async function login() {
  try {
    const response = await msalInstance.loginPopup({
      scopes: CONFIG.apiScopes,
    });
    currentAccount = response.account;
    onLoginSuccess();
  } catch (err) {
    console.error('Login failed:', err);
    if (typeof showToast === 'function') {
      showToast('Login failed: ' + err.message, 'error');
    }
  }
}

function logout() {
  msalInstance.logoutPopup().catch(() => {});
  currentAccount = null;
  document.getElementById('user-info').textContent = '';
  document.getElementById('login-btn').style.display = '';
  document.getElementById('logout-btn').style.display = 'none';
  document.getElementById('vm-grid').innerHTML =
    '<p class="login-prompt">Please sign in to view VM status.</p>';
}

async function getAccessToken() {
  if (!currentAccount) throw new Error('Not logged in');

  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: CONFIG.apiScopes,
      account: currentAccount,
    });
    return response.accessToken;
  } catch (err) {
    // Silent failed — use popup
    const response = await msalInstance.acquireTokenPopup({
      scopes: CONFIG.apiScopes,
      account: currentAccount,
    });
    return response.accessToken;
  }
}

function getUserEmail() {
  return currentAccount ? currentAccount.username.toLowerCase() : null;
}

function canControl(vmName) {
  const email = getUserEmail();
  if (!email) return false;
  if (CONFIG.admins.some(a => a.toLowerCase() === email)) return true;
  const allowed = CONFIG.vmPermissions[vmName];
  return allowed && allowed.some(a => a.toLowerCase() === email);
}

function onLoginSuccess() {
  document.getElementById('user-info').textContent = currentAccount.username;
  document.getElementById('login-btn').style.display = 'none';
  document.getElementById('logout-btn').style.display = '';
  if (typeof refreshAll === 'function') {
    refreshAll();
  }
}

// Initialize on page load
initAuth();
