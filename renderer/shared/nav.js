(function () {
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.hawall-nav-links a').forEach(a => {
    if (a.getAttribute('href') === current) a.classList.add('active');
  });
})();
