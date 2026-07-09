// Componente de Notificaciones Flotantes Estéticas (Toasts)

export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '✨';
  if (type === 'error') {
    icon = '❌';
  } else if (type === 'info') {
    icon = 'ℹ️';
  }

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // Forzar reflow para animación
  toast.offsetHeight;
  toast.classList.add('show');

  // Remover después de 4 segundos
  setTimeout(() => {
    toast.classList.remove('show');
    
    // Función auxiliar para remover del DOM de forma segura
    const removeToast = () => {
      toast.removeEventListener('transitionend', removeToast);
      toast.remove();
    };
    
    toast.addEventListener('transitionend', removeToast);
    
    // Backup por si la animación no dispara transitionend
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 500);
  }, 4000);
}
