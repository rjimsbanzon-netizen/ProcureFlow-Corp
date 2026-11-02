// @ts-nocheck

// Migrated from enterprise.html. Business rules / markup preserved.
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center p-4 w-full rounded-lg shadow-lg text-white transition-all duration-300 transform translate-y-2 opacity-0 ${type === 'error' ? 'max-w-md break-words' : 'max-w-xs'} ${
        type === 'success' ? 'bg-emerald-600' :
        type === 'error' ? 'bg-rose-600' :
        type === 'warning' ? 'bg-amber-500' : 'bg-sky-600'
    }`;

    const icon = type === 'success' ? 'fa-check-circle' :
                 type === 'error' ? 'fa-exclamation-circle' :
                 type === 'warning' ? 'fa-triangle-exclamation' : 'fa-info-circle';

    toast.innerHTML = `
        <i class="fa-solid ${icon} text-lg mr-3"></i>
        <div class="text-sm font-medium flex-1"></div>
    `;

    toast.querySelector('div').textContent = String(message);

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, type === 'error' ? 11000 : 3500);
}
