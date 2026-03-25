/* global msal, CONFIG, showToast, refreshAll */

const msalInstance = new msal.PublicClientApplication(CONFIG.msal);

let currentAccount = null;
var isEmbedded = window.self !== window.top;

async function initAuth() {
  if (isEmbedded) {
    document.body.classList.add('embedded');
  }

  await msalInstance.handleRedirectPromise();

  // Check for cached account
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
    onLoginSuccess();
  }

  // Show sign-in banner if not authenticated
  if (!currentAccount) {
    var banner = document.getElementById('auth-banner');
    if (banner) banner.style.display = 'flex';
  }

  // Always load VM status regardless of auth
  if (typeof refreshAll === 'function') {
    refreshAll();
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

// Called when an action needs auth — ensures user is logged in first
async function ensureAuth() {
  if (currentAccount) return true;

  try {
    // Try SSO silent first
    var ssoResponse = await msalInstance.ssoSilent({
      scopes: CONFIG.apiScopes,
    });
    currentAccount = ssoResponse.account;
    onLoginSuccess();
    return true;
  } catch (err) {
    // Fall back to popup
    try {
      var popupResponse = await msalInstance.loginPopup({
        scopes: CONFIG.apiScopes,
      });
      currentAccount = popupResponse.account;
      onLoginSuccess();
      return true;
    } catch (err2) {
      showToast('Sign in required to perform this action', 'error');
      return false;
    }
  }
}

function logout() {
  msalInstance.logoutPopup().catch(function () {});
  currentAccount = null;
  document.getElementById('user-info').textContent = '';
  document.getElementById('login-btn').style.display = '';
  document.getElementById('logout-btn').style.display = 'none';
  if (typeof refreshAll === 'function') {
    refreshAll();
  }
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
  var email = getUserEmail();
  if (!email) return false;
  if (CONFIG.admins.some(function (a) { return a.toLowerCase() === email; })) return true;
  var allowed = CONFIG.vmPermissions[vmName];
  return allowed && allowed.some(function (a) { return a.toLowerCase() === email; });
}

function onLoginSuccess() {
  document.getElementById('user-info').textContent = currentAccount.username;
  document.getElementById('login-btn').style.display = 'none';
  document.getElementById('logout-btn').style.display = '';
  // Hide the sign-in banner
  var banner = document.getElementById('auth-banner');
  if (banner) banner.style.display = 'none';
  // Re-render to show action buttons now that user is authenticated
  if (typeof refreshAll === 'function') {
    refreshAll();
  }
}

window.addEventListener('DOMContentLoaded', function () {
  initAuth();
});
