/* Herald Voyages account forms. Auth provider owns password storage and email verification. */
(() => {
  'use strict';

  function loadGuestTransfer() {
    const base = window.WIBAuth?.base || new URL('.', document.currentScript?.src || location.href);
    const loadScript = (path, done) => {
      const script = document.createElement('script');
      script.src = new URL(path, base).href;
      script.onload = done || null;
      document.head.appendChild(script);
    };
    const loadTransfer = () => {
      if (document.querySelector('script[data-herald-transfer]')) return;
      const script = document.createElement('script');
      script.dataset.heraldTransfer = 'true';
      script.src = new URL('herald.js?v=voyages-v2', base).href;
      document.head.appendChild(script);
    };
    if (window.WIBModel) loadTransfer();
    else loadScript('account-model.js', loadTransfer);
  }
  loadGuestTransfer();

  document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id), page = document.body.dataset.accountPage;
    const message = (text, bad = false) => { $('accountMessage').textContent = text; $('accountMessage').style.color = bad ? 'var(--red)' : 'var(--text)'; };
    let client, currentUser;
    const recovery = () => { if (page === 'reset-password') { $('resetForm').hidden = true; $('recoveryForm').hidden = false; message('Choose your new password.'); } };
    const render = user => {
      const identityChanged = currentUser?.id !== user?.id;
      currentUser = user;
      if (page !== 'profile') return;
      $('signedOutPanel').hidden = !!user; $('signedInPanel').hidden = !user;
      if (user) {
        if (identityChanged) {
          $('displayName').value = user.user_metadata?.display_name || '';
          $('email').value = user.email || '';
        }
        $('profileSummary').textContent = 'Signed in as ' + user.email;
      } else {
        $('displayName').value = ''; $('email').value = ''; $('profileSummary').textContent = ''; $('passwordForm').reset();
      }
    };
    function newPassword() {
      if ($('newPassword').value !== $('confirmPassword').value) throw new Error('The passwords do not match.');
      return $('newPassword').value;
    }
    function form(id, action) {
      const el = $(id); if (!el) return;
      el.addEventListener('submit', async event => {
        event.preventDefault(); const button = el.querySelector('button[type="submit"], button'); button.disabled = true;
        message('Please wait…');
        try { await action(); } catch (error) { message(error.message || 'Something went wrong. Please try again.', true); }
        finally { button.disabled = false; }
      });
    }
    function checked(result) { if (result.error) throw result.error; return result.data; }
    try {
      const isRecovery = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
      const authError = new URLSearchParams(location.hash.slice(1)).get('error_description');
      client = WIBAuth.client();
      client.auth.onAuthStateChange((event, session) => {
        render(session?.user || null);
        if (event === 'PASSWORD_RECOVERY') recovery();
      });
      const session = checked(await client.auth.getSession()).session;
      render(session?.user || null);
      if (isRecovery && session) recovery();
      if (authError) { message('This email link has expired or is invalid. Request a new link.', true); history.replaceState(null, '', location.pathname); }
    } catch (error) { message(error.message, true); return; }

    form('loginForm', async () => {
      checked(await client.auth.signInWithPassword({email: $('email').value.trim(), password: $('password').value}));
      $('password').value = ''; location.assign(WIBAuth.url(''));
    });
    form('registerForm', async () => {
      const data = checked(await client.auth.signUp({
        email: $('email').value.trim(), password: newPassword(),
        options: {data: {display_name: $('displayName').value.trim()}, emailRedirectTo: WIBAuth.url('profile/')}
      }));
      $('registerForm').reset();
      if (data.session) location.assign(WIBAuth.url(''));
      else message('Check your email to confirm your Herald Voyages account, then log in. Your existing guest data is still safe.');
    });
    form('resetForm', async () => {
      checked(await client.auth.resetPasswordForEmail($('email').value.trim(), {redirectTo: WIBAuth.url('reset-password/')}));
      message('If a Herald Voyages account exists for that email, you’ll receive a password reset link.');
    });
    form('recoveryForm', async () => {
      checked(await client.auth.updateUser({password: newPassword()}));
      $('recoveryForm').reset(); $('recoveryForm').hidden = true; $('resetForm').hidden = false;
      message('Password updated. You can now log in with your new password.');
    });
    form('detailsForm', async () => {
      if (!currentUser) throw new Error('Please log in again.');
      const email = $('email').value.trim(), oldEmail = currentUser.email;
      const details = {data: {display_name: $('displayName').value.trim()}};
      if (email !== oldEmail) details.email = email;
      checked(await client.auth.updateUser(details, {emailRedirectTo: WIBAuth.url('profile/')}));
      message(email !== oldEmail ? 'Name saved. Check your email to confirm the address change. Your current login email stays active until confirmation.' : 'Account details saved.');
    });
    form('passwordForm', async () => {
      checked(await client.auth.updateUser({password: newPassword()})); $('passwordForm').reset(); message('Password updated.');
    });
    if ($('logoutBtn')) $('logoutBtn').onclick = async () => {
      $('logoutBtn').disabled = true;
      try {
        checked(await client.auth.signOut({scope: 'local'}));
        render(null); message('Logged out. Any unsent changes remain on this device and will retry when you log in again.');
      } catch (error) { message(error.message, true); }
      finally { $('logoutBtn').disabled = false; }
    };
  });
})();
