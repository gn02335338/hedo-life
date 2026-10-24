// Retire other game tabs after a migration changes their in-memory identity or
// save. The importer publishes its revision only after all writes succeed.
(() => {
  if (location.origin !== 'https://hodo.bvivify.com') return;
  let reloading = false;
  window.addEventListener('storage', event => {
    try {
      if (event.storageArea !== localStorage || event.oldValue === event.newValue) return;
      if (event.key !== null && !['hedo-anonymous-v1', 'hodo-domain-migration-active-v1'].includes(event.key)) return;
      if (!reloading) {
        reloading = true;
        location.reload();
      }
    } catch { /* Browsers without storage still show the migration retry screen. */ }
  });
})();
